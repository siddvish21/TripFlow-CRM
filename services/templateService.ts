
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import mammoth from 'mammoth';
import { GoogleGenAI } from "@google/genai";
import { QuotationData, Template } from '../types';

const API_KEY = (import.meta as any).env.VITE_GEMINI_API_KEY;
if (!API_KEY) {
    console.error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY || '' });

export interface AutoMapResult {
    originalText: string;
    replacementText: string;
    confidence: string; // High/Medium/Low
}

export const templateService = {

    /**
     * Analyze a DOCX template and suggest replacements based on current quotation data.
     * Use this when the template does NOT have {{tags}}.
     */
    async analyzeForAutoMap(file: File, data: QuotationData): Promise<AutoMapResult[]> {
        const arrayBuffer = await file.arrayBuffer();
        const { value: docText } = await mammoth.extractRawText({ arrayBuffer });

        // Gemini Prompt
        const prompt = `
        You are a Document Mapping AI.
        
        I have a Quotation Document Text:
        "${docText.substring(0, 15000)}" 
        (truncated if too long)

        And I have this New Data (JSON):
        ${JSON.stringify({
            customerName: data.customerName,
            destination: data.destination,
            dates: data.dates,
            totalAmount: data.totalAmount,
            paxCount: data.paxCount,
            itineraryTitle: data.itineraryTitle,
            hotelCategory: data.hotelCategory
        }, null, 2)}

        YOUR TASK:
        Identify specific, unique strings in the Document Text that represent "Placeholder Data" (e.g. an old client name, old date, old price, old destination) and map them to the New Data.

        Rules:
        1. Only map if you are confident.
        2. The "originalText" MUST BE an exact substring found in the document text.
        3. Prioritize: Client Name, Destination, Dates, Total Cost.
        
        Output JSON:
        [
            { "originalText": "Mr. John Doe", "replacementText": "Mr. Smith", "confidence": "High" },
            { "originalText": "Thailand", "replacementText": "Bali", "confidence": "High" }
        ]
        `;

        try {
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: prompt,
                config: { responseMimeType: "application/json" }
            });

            const text = response.text?.trim() || "[]";
            const mappings = JSON.parse(text) as AutoMapResult[];
            return mappings;
        } catch (e) {
            console.error("AI Mapping failed", e);
            throw new Error("Failed to analyze template.");
        }
    },

    /**
     * Generate Document using Standard Pattern ({{tags}}) OR Deep XML Search/Replace
     */
    async generateDocument(file: File, data: QuotationData, autoMappings: AutoMapResult[] = []): Promise<Blob> {
        const arrayBuffer = await file.arrayBuffer();
        const zip = new PizZip(arrayBuffer);

        // 1. Try Standard DocxTemplater (for {{tags}})
        let doc: Docxtemplater | null = null;
        try {
            doc = new Docxtemplater(zip, {
                paragraphLoop: true,
                linebreaks: true,
            });

            // Flatten data for easy access
            const flatData = {
                ...data,
                clientName: data.customerName,
                // Add helper properties if needed
                currentDate: new Date().toLocaleDateString(),
            };

            doc.render(flatData);
        } catch (error) {
            // If render fails (e.g. no tags found or malformed), we proceed to manual replace
            console.warn("DocxTemplater standard render warning (ignore if using AutoMap):", error);
        }

        // 2. Perform Auto-Mappings (XML String Replacement)
        // This is "dangerous" but effective for simple text replacements
        if (autoMappings.length > 0) {
            const xmlFile = zip.files['word/document.xml'];
            if (xmlFile) {
                let xmlContent = xmlFile.asText();

                autoMappings.forEach(map => {
                    // Simple logic: Escape regex characters
                    if (!map.originalText) return;

                    // XML split mitigation (basic):
                    // If "John Doe" is split as "John</w:t>...</w:t>Doe", simple replace fails.
                    // We only replace EXACT matches found in the XML text content.
                    // Ideally, we search for the text in the mammoth output, verify it exists.
                    // Here we blindly replace, which works if the doc was typed continuously.

                    // Global replace
                    const esc = map.originalText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const re = new RegExp(esc, 'g');
                    xmlContent = xmlContent.replace(re, map.replacementText);
                });

                zip.file('word/document.xml', xmlContent);
            }
        }

        const out = zip.generate({
            type: "blob",
            mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        });
        return out;
    }
};
