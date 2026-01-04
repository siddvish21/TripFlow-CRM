import { GoogleGenAI, Type } from "@google/genai";
import { QuotationData, ItineraryDay, VendorParsedData } from '../types';

const API_KEY = (import.meta as any).env.VITE_GEMINI_API_KEY;

if (!API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const responseSchema = {
    type: Type.OBJECT,
    properties: {
        customerName: { type: Type.STRING, description: "The customer's name, e.g., 'Mr. Smith'. You MUST extract the actual customer name from the text. If no name is found, use a generic placeholder like 'Guest' or 'Client' but NEVER use 'Valued Customer'." },
        destination: { type: Type.STRING, description: "The primary travel destination." },
        duration: { type: Type.STRING, description: "The total duration of the trip, e.g., '5 Nights / 6 Days'." },
        dates: { type: Type.STRING, description: "The travel dates, e.g., '15th Oct - 20th Oct 2024'." },
        paxCount: { type: Type.INTEGER, description: "Number of people (PAX) traveling." },
        numberOfRooms: { type: Type.INTEGER, description: "Number of rooms required." },
        mealPlan: { type: Type.STRING, description: "The meal plan included, e.g., 'Breakfast & Dinner'." },
        vehicle: { type: Type.STRING, description: "The type of vehicle provided for travel, e.g., 'Private Sedan'." },
        itineraryTitle: { type: Type.STRING, description: "A beautiful, catchy header for the itinerary in 3-4 words. e.g., 'An Enchanting Thai Escape'." },
        isDomestic: { type: Type.BOOLEAN, description: "True if the destination is within India (e.g., Kerala, Goa, Shimla), otherwise false (e.g., Thailand, Paris, USA)." },
        showAccommodations: { type: Type.BOOLEAN, description: "Set to TRUE if the package includes hotels. Set to FALSE if the input text implies 'hotels on own', 'accommodation not included', or is silent about hotel bookings." },
        itinerary: {
            type: Type.ARRAY,
            description: "A day-by-day travel itinerary.",
            items: {
                type: Type.OBJECT,
                properties: {
                    day: { type: Type.INTEGER, description: "The day number of the itinerary, starting from 1." },
                    title: { type: Type.STRING, description: "A specific title indicating the main activity or theme of the day (e.g., 'Arrival in Paris'). DO NOT include 'Day X:' in the title string." },
                    points: {
                        type: Type.ARRAY,
                        description: "A list of bullet points for the day. Start each point with '→ '. Content MUST be elaborate, technical (travel terminology), and there must be at least 3 points per day.",
                        items: { type: Type.STRING }
                    }
                },
                required: ["day", "title", "points"]
            }
        },
        hotels: {
            type: Type.ARRAY,
            description: "Legacy field for single-option hotels. Use 'hotelOptions' instead if multiple options exist.",
            items: {
                type: Type.OBJECT,
                properties: {
                    destination: { type: Type.STRING },
                    hotelName: { type: Type.STRING },
                    roomCategory: { type: Type.STRING },
                    nights: { type: Type.INTEGER }
                },
                required: ["destination", "hotelName", "roomCategory", "nights"]
            }
        },
        hotelOptions: {
            type: Type.ARRAY,
            description: "If the input text provides multiple hotel options (e.g. 3 Star vs 4 Star), list them here distinctly. If only one option, you can still use this with one item.",
            items: {
                type: Type.OBJECT,
                properties: {
                    optionLabel: { type: Type.STRING, description: "Label for this option (e.g. 'Option 1: Standard Hotels', 'Option 2: Premium Hotels')." },
                    hotels: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                destination: { type: Type.STRING },
                                hotelName: { type: Type.STRING },
                                roomCategory: { type: Type.STRING },
                                nights: { type: Type.INTEGER }
                            },
                            required: ["destination", "hotelName", "roomCategory", "nights"]
                        }
                    }
                },
                required: ["optionLabel", "hotels"]
            }
        },
        inclusions: {
            type: Type.ARRAY,
            description: "A comprehensive list of inclusions. MUST explicitly state accommodation splits (e.g. 'Accommodation in Paris for 3 Nights...'). MUST list every specific tour/transfer Mentioned with (SIC)/(Private) tags.",
            items: { type: Type.STRING }
        },
        exclusions: {
            type: Type.ARRAY,
            description: "A list of 4-5 standard exclusions for the package, each starting with '➡️'.",
            items: { type: Type.STRING }
        },
        hotelCategory: { type: Type.STRING, description: "The category of hotels used, e.g., '4 Star', '5 Star', 'Luxury'." },
        costDetails: {
            type: Type.OBJECT,
            description: "Estimated cost breakdown for the package.",
            properties: {
                perPersonCost: { type: Type.INTEGER, description: "The base cost per person for the package, excluding taxes." },
                gstPercentage: { type: Type.NUMBER, description: "The Goods and Services Tax percentage. Default to 5 if not specified." },
                tcsPercentage: { type: Type.NUMBER, description: "The Tax Collected at Source percentage. Default to 5 if not specified for international trips." }
            },
            required: ["perPersonCost", "gstPercentage", "tcsPercentage"]
        },
        financialBreakdown: {
            type: Type.OBJECT,
            description: "Exact financial table extracted from the document (if available).",
            properties: {
                options: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            label: { type: Type.STRING, description: "Option Name (e.g. Option 1)" },
                            landBaseCost: { type: Type.INTEGER, description: "PACKAGE COST PER PERSON" },
                            landGST: { type: Type.INTEGER, description: "GST Amount" },
                            landTCS: { type: Type.INTEGER, description: "TCS Amount" },
                            addOnCost: { type: Type.INTEGER, description: "Flight/Visa Amount" },
                            extractedNetCost: { type: Type.INTEGER, description: "NET PACKAGE COST Per Person (The extracted subtotal from the document). Use this exact value even if Base+GST+TCS sums to something else." }
                        },
                        required: ["label", "landBaseCost", "landGST", "landTCS", "addOnCost", "extractedNetCost"]
                    }
                }
            },
            required: ["options"]
        }
    },
    required: ["customerName", "destination", "duration", "dates", "mealPlan", "vehicle", "itinerary", "itineraryTitle", "showAccommodations", "hotels", "inclusions", "exclusions", "paxCount", "numberOfRooms", "hotelCategory", "costDetails", "isDomestic"]
};

// Enhanced Schema for Vendor Data Parsing to support multiple options and smart quantity
const vendorDataSchema = {
    type: Type.OBJECT,
    properties: {
        currency: { type: Type.STRING, description: "The currency code detected (e.g., USD, THB, INR). Default INR." },
        totalPax: { type: Type.INTEGER, description: "Total number of people (Adults + Children)." },

        questions: {
            type: Type.ARRAY,
            description: "If any pricing, pax count, or hotel option logic is ambiguous, list specific questions for the user here. If clear, leave empty.",
            items: { type: Type.STRING }
        },

        unifiedLineItems: {
            type: Type.ARRAY,
            description: "Standardized list of cost items aligned across different hotel options.",
            items: {
                type: Type.OBJECT,
                properties: {
                    description: { type: Type.STRING, description: "Description (e.g. 'Adult Cost (DBL Basis)', 'Extra Bed Cost', 'Child No Bed')." },
                    quantity: { type: Type.NUMBER, description: "The quantity to multiply the rate by. IMPORTANT: If rate is 'Per Person', this MUST be the number of people. If 'Total', use 1." },
                    costOption1: { type: Type.NUMBER, description: "Cost for Option 1 (e.g. 3-Star / Standard). 0 if not applicable." },
                    costOption2: { type: Type.NUMBER, description: "Cost for Option 2 (e.g. 4-Star / Deluxe). 0 if not applicable." },
                    costOption3: { type: Type.NUMBER, description: "Cost for Option 3 (e.g. 5-Star / Luxury). 0 if not applicable." },
                    // New fields for exact restoration
                    multiplierOption1: { type: Type.NUMBER, description: "The conversion multiplier for Option 1. Default 1." },
                    multiplierOption2: { type: Type.NUMBER, description: "The conversion multiplier for Option 2. Default 1." },
                    multiplierOption3: { type: Type.NUMBER, description: "The conversion multiplier for Option 3. Default 1." }
                },
                required: ["description", "quantity", "costOption1", "costOption2", "costOption3"]
            }
        },

        addOns: {
            type: Type.ARRAY,
            description: "Specific add-on costs like Flights and Visas.",
            items: {
                type: Type.OBJECT,
                properties: {
                    type: { type: Type.STRING, enum: ["Flight", "Visa"], description: "Type of add-on." },
                    costPerPax: { type: Type.NUMBER, description: "Cost per person." }
                },
                required: ["type", "costPerPax"]
            }
        },

        // New section for restoring configs
        extractedConfigs: {
            type: Type.OBJECT,
            description: "Configuration values found in the footer/summary section of the sheet.",
            properties: {
                markupPct: { type: Type.NUMBER, description: "Markup Percentage (e.g. 15)" },
                gstPct: { type: Type.NUMBER, description: "GST Percentage (e.g. 5)" },
                tcsPct: { type: Type.NUMBER, description: "TCS Percentage (e.g. 5)" }
            },
            required: ["markupPct", "gstPct", "tcsPct"]
        }
    },
    required: ["currency", "totalPax", "unifiedLineItems", "addOns"]
};

// Helper for Image Processing - ENSURE CLEAN BASE64
const fileToPart = async (file: File) => {
    return new Promise<{ inlineData: { data: string, mimeType: string } }>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result as string;
            // Robustly extract base64 part
            const base64Data = result.includes(',') ? result.split(',')[1] : result;
            resolve({
                inlineData: {
                    data: base64Data,
                    mimeType: file.type,
                },
            });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

export const generateQuotationFromText = async (text: string): Promise<QuotationData> => {
    const prompt = `
  Extract travel quotation details from the following text:
  "${text}"
  
  Output strict JSON matching the schema. 
  - Ensure itinerary days are logical. 
  - If tax info is missing, assume GST 5% and TCS 5% (if international).
  
  **CRITICAL INSTRUCTIONS FOR "INCLUSIONS"**:
  1. **Accommodations**: You MUST explicitly mention the split of nights if applicable. Format: "Accommodation in [City Name] for [N] Nights and [City Name] for [N] Nights".
  2. **Tours & Transfers**: If the input text mentions specific tours or transfer types (SIC/Private), you MUST list ALL of them in the inclusions, explicitly mentioning "(SIC)" or "(Private)" alongside the tour name.
  
  **CRITICAL INSTRUCTIONS FOR "ITINERARY"**:
  1. **Detail Level**: Points must be elaborate and use professional travel industry terminology (e.g., "Private Transfer", "At Leisure", "Full Day Excursion", "Upon Arrival", "Check-in"). Avoid generic/lazy descriptions like "Visit city".
  2. **Quantity**: You MUST generate at least 3 detailed bullet points for every single day.
  3. **Format**: As per schema, start points with "→ ".

  - **Accommodations (Structure)**: 
    - If the text implies "Hotels on your own" or "Accommodation not included", set 'showAccommodations' to false.
    - If there are distinct hotel options (e.g., Option 1 vs Option 2, or Standard vs Deluxe), populate 'hotelOptions' with separate lists.
    - If only one list of hotels, populate 'hotels'.
  `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: responseSchema,
            },
        });

        const responseText = response.text?.trim() || "{}";
        if (!responseText.startsWith('{')) throw new Error("Invalid JSON response");
        return JSON.parse(responseText) as QuotationData;
    } catch (error: any) {
        console.error("Error parsing quotation:", error);
        throw new Error(`Failed to generate quotation: ${error.message || "Unknown error"}`);
    }
};

/**
 * RESTORE QUOTATION FROM DOCX TEXT
 * STRICT EXTRACTION MODE: No creativity, no recalculation.
 */
export const parseExistingQuotationText = async (text: string): Promise<QuotationData> => {
    // ... prompt ...
    const prompt = `
    You are a Data Restoration Engine. 
    You have been provided with the raw text extracted from a previously generated Travel Quotation Document (.docx).
    
    YOUR GOAL: Reconstruct the JSON data structure exactly as it exists in the text.
    
    CRITICAL RULES FOR RESTORATION:
    1. **NO CREATIVITY**: Do not invent new itinerary points. Do not change the wording.
    2. **NO RECALCULATION**: Extract the prices (Total, Per Person) exactly as written in the text. Do not apply new math.
    3. **FIX DAY TITLES**: 
       - The text might say "Day 1: Arrival in Paris". 
       - In the JSON 'title' field, output ONLY "Arrival in Paris". 
       - Remove "Day X" or "Day X:" from the title string to prevent repetition in the UI.
    4. **CLEAN POINTS**: 
       - If an itinerary point starts with "Day X", remove that point entirely.
       - Ensure points start with "→ ".
    5. **FINANCIALS (Rate Details)**: 
       - Extract the "Rate Details" table EXACTLY into the 'financialBreakdown' property.
       - 'landBaseCost' = PACKAGE COST PER PERSON
       - 'extractedNetCost' = NET PACKAGE COST Per Person (The total before flights). 
       - IMPORTANT: If the sum of Base + GST + TCS does not match the printed "NET PACKAGE COST", use the printed value in 'extractedNetCost'. Do NOT correct the math.
    6. **HOTELS**:
       - If multiple Hotel tables are present (e.g. Option 1 Hotels, Option 2 Hotels), extract them into 'hotelOptions'.
    
    Raw Document Text:
    "${text}"
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: responseSchema,
            },
        });

        const responseText = response.text?.trim() || "{}";
        if (!responseText.startsWith('{')) throw new Error("Invalid JSON response from AI");
        return JSON.parse(responseText) as QuotationData;
    } catch (error: any) {
        console.error("Error restoring quotation:", error);
        throw new Error(`Failed to restore quotation: ${error.message || "Unknown error"}`);
    }
};

export const modifyQuotationWithAI = async (currentData: QuotationData, instruction: string): Promise<QuotationData> => {
    // ... prompt ...
    const prompt = `
    You are a helpful travel assistant.
    
    Current Quotation Data (JSON):
    ${JSON.stringify(currentData)}

    User Instruction:
    "${instruction}"

    Task:
    - Modify the JSON data based ONLY on the user's instruction.
    - Keep all other fields exactly the same unless they need to change logicallly (e.g. swapping days changes the order).
    - Return the fully updated JSON matching the exact same schema.
    - Do NOT output markdown code blocks. Just the JSON string.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: responseSchema,
            },
        });

        const responseText = response.text?.trim() || "{}";
        return JSON.parse(responseText) as QuotationData;
    } catch (error: any) {
        console.error("Error modifying quotation:", error);
        throw new Error(`Failed to modify quotation: ${error.message}`);
    }
};

export const parseVendorData = async (vendorText: string): Promise<VendorParsedData> => {
    // ... prompt ...
    const prompt = `
    Analyze the following raw vendor pricing text.
    Your goal is to extract pricing into a matrix format suitable for a spreadsheet with 3 Options (Option 1, Option 2, Option 3).

    CRITICAL INSTRUCTION FOR PRECISION:
    - If the text is messy, ambiguous, or if you are unsure whether a rate is "Per Person" or "Total", OR if you cannot clearly distinguish between Option 1 and Option 2 hotels, DO NOT GUESS.
    - Instead, populate the 'questions' array with specific questions for the user (e.g., "Is the Hotel A rate per person or total?", "Which hotel corresponds to Option 2?").
    - Only fill the data if you are reasonably confident.

    Rules:
    1. **Currency**: Identify the currency (USD, THB, INR, etc.).
    2. **Total Pax**: Identify the total number of travelers (Adults + Children).
    3. **Options**: 
       - Look for multiple hotel/room categories (e.g., "Standard", "Deluxe", "Luxury" OR "Option 1", "Option 2").
       - Map these distinctly to costOption1, costOption2, and costOption3.
       - If only one option exists, fill costOption1 and set others to 0.
    
    4. **Line Items & Quantity Logic (CRITICAL)**:
       - **DBL Sharing / Per Person**: If a rate is quoted as "Per Person", "PP", "Half Twin", or "on DBL Sharing", the 'quantity' MUST be the Total Pax Count (e.g., if 2 adults, quantity = 2).
       - **Child Costs (Important)**: Look for "Child with Bed (CWB)" or "Child No Bed (CNB)". Create separate line items for these. The quantity should be the number of children.
       - **Total / Fixed Cost**: If a rate is "Per Room" (and implies total for the group) or "Total Package Cost", set 'quantity' to 1.
       - **Extra Bed**: If there is a specific rate for "Extra Bed", create a separate line item. Quantity = Number of extra beds.
    
    5. **Add-ons**: Extract Flight and Visa costs separately.

    Raw Text:
    ---
    ${vendorText}
    ---
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: vendorDataSchema,
            },
        });

        const text = response.text?.trim() || "{}";
        if (!text.startsWith('{')) throw new Error("Invalid JSON response");

        return JSON.parse(text) as VendorParsedData;
    } catch (error: any) {
        console.error("Error parsing vendor data:", error);
        throw new Error(`Failed to parse vendor data: ${error.message}`);
    }
};

export const parseFinancialImage = async (imageFile: File): Promise<VendorParsedData> => {
    try {
        const imagePart = await fileToPart(imageFile);

        // GENERIC PROMPT - NOT SPECIFIC TO TRIPFLOW
        const prompt = `
        Analyze this image of a financial table, pricing grid, or cost sheet.
        
        YOUR GOAL: Extract the financial structure (Items, Rates, Quantities) so it can be reconstructed in a calculator.
        
        INSTRUCTIONS:
        1. **Detect Structure**: The image might be a spreadsheet screenshot, a PDF table, or a hand-typed list. Adapt to the visual layout.
        
        2. **Identify Rows**: Look for line items (e.g., 'Adult', 'Child', 'Room Rate', 'Transfer', 'Excursion').
           - Map these to 'unifiedLineItems'.
           - 'description': The name of the item.
           - 'quantity': Infer this. If the label implies "Per Person", use the Total Pax count. If "Per Room", use Room count. If it looks like a one-time fixed cost, use 1.
           - 'costOption1': The rate/cost found in the column.
           - If there are multiple columns representing different packages (e.g., Standard vs Deluxe, or Option 1 vs Option 2), map them to 'costOption2' and 'costOption3'.
        
        3. **Identify Multipliers**:
           - Some sheets have a "Multiplier" or "X" column (e.g., Rate * 3 Nights). If you see a multiplier column, extract it to 'multiplierOption1/2/3'. Default is 1.
        
        4. **Identify Footer/Configs**:
           - Look for summary fields like "Markup", "Profit", "Service Fee" (percentage or amount). Map to 'extractedConfigs.markupPct'.
           - Look for "GST", "VAT", "Tax". Map to 'extractedConfigs.gstPct'.
           - Look for "TCS" (Tax Collected at Source). Map to 'extractedConfigs.tcsPct'.
        
        5. **Context**:
           - Look for "Total Pax", "No of Travelers" headers to set 'totalPax'.
           - Identify Currency ($, ₹, EUR). Default to 'INR' if unsure.

        Output STRICT JSON matching the provided schema.
        `;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: {
                role: 'user',
                parts: [
                    imagePart, // Passed as { inlineData: ... } which is a valid Part
                    { text: prompt }
                ]
            },
            config: {
                responseMimeType: "application/json",
                responseSchema: vendorDataSchema,
            },
        });

        const text = response.text?.trim() || "{}";
        if (!text.startsWith('{')) throw new Error("Invalid JSON response");
        return JSON.parse(text) as VendorParsedData;
    } catch (error: any) {
        console.error("Error parsing financial image:", error);
        // Log detailed error from SDK if available
        if (error.message) console.error("SDK Message:", error.message);
        throw new Error("Failed to process financial image. Ensure it is a valid image file.");
    }
};

export const reprocessVendorDataWithClarification = async (originalText: string, userClarification: string): Promise<VendorParsedData> => {
    return parseVendorData(`
        ORIGINAL DATA:
        ${originalText}

        USER CLARIFICATION TO YOUR PREVIOUS QUESTIONS:
        ${userClarification}
     `);
};

export const generateVendorEmail = async (requirements: string): Promise<{ subject: string, htmlBody: string }> => {
    const prompt = `
    You are a professional travel agency operations manager. Write a concise email to a B2B vendor/DMC requesting a quotation.
    
    Requirements:
    ${requirements}

    IMPORTANT FORMATTING RULES:
    1. **Output Format**: Return a JSON object with two fields: "subject" and "htmlBody".
    2. **Subject**: "Quotation Request | [Destination] | [Dates]"
    3. **HTML Body**: 
       - Start with "Dear Team,<br/><br/>".
       - Use <b> tag for headings (e.g. <b>Travel Details:</b>). Do NOT use markdown (**).
       - Use <ul> and <li> for lists.
       - Extract: Check-in/out, Pax, Hotel Category.
       - **SIGHTSEEING**: Research and list 4-5 specific top attractions as <li> items. Do NOT use generic terms like "City Tour".
       - Tone: Professional, direct, polite.
       - End with "Looking forward to your prompt response.<br/><br/>Best Regards,".
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });
        return JSON.parse(response.text || '{}');
    } catch (error) {
        console.error(error);
        throw new Error("Failed to generate email");
    }
};

export const modifyEmailWithAI = async (currentBody: string, instruction: string): Promise<string> => {
    const prompt = `
    You are an email assistant. Update the following HTML email body based on the instruction.
    
    Current HTML Body:
    ${currentBody}

    Instruction:
    "${instruction}"

    Output:
    - Return ONLY the updated HTML string.
    - Maintain standard HTML tags (<b>, <br>, <ul>, <li>).
    - Do NOT wrap in markdown code blocks.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });
        return response.text || '';
    } catch (error) {
        console.error(error);
        throw new Error("Failed to modify email");
    }
};

// --- NEW INTELLIGENCE FUNCTIONS ---

export const analyzeLeadIntent = async (notes: string, budget: string, destination: string): Promise<{ score: string, action: string }> => {
    const prompt = `
    Analyze this travel lead and suggest the next best action.
    
    Destination: ${destination}
    Budget: ${budget}
    Notes: "${notes}"

    Return JSON with:
    - "score": "Hot", "Warm", or "Cold"
    - "action": A concise 1-sentence recommended step (e.g. "Suggest 3-star alternatives due to low budget").
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });
        return JSON.parse(response.text || '{}');
    } catch (e) {
        return { score: "Warm", action: "Review details manually." };
    }
};

export const auditItinerary = async (itinerary: ItineraryDay[]): Promise<{ issues: string[], suggestions: string[] }> => {
    const prompt = `
    Audit this travel itinerary for logistical logic, pacing, and completeness.
    
    Itinerary: ${JSON.stringify(itinerary)}

    Return JSON with:
    - "issues": List of potential problems (e.g. "Too many activities on Day 2", "Missing transfer details").
    - "suggestions": List of specific improvements.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash", // Using Flash for speed as requested
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });
        return JSON.parse(response.text || '{}');
    } catch (e) {
        return { issues: [], suggestions: [] };
    }
};

export const generatePaymentReminder = async (clientName: string, balance: number, destination: string): Promise<string> => {
    const prompt = `
    Write a VERY SHORT, CASUAL payment reminder message for WhatsApp.
    
    Context:
    - Client: ${clientName}
    - Trip: ${destination}
    - Balance Due: ${balance}

    Requirements:
    - Tone: Informal, friendly, Indian English style.
    - Length: Under 30 words.
    - Format: Plain text (no subject line).
    - **CRITICAL**: Include 1 or 2 small typos (e.g., "pymnt", "thnks", "pls") to make it look like a manually typed quick message.
    - Do NOT be formal (avoid "Dear", "Sincerely").
    - Example Style: "Hi Rahul, hope u r doing good. Just a reminder regarding pending 20k for Goa trip. Pls clear when free. Thnks."
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
            },
        });
        return response.text || '';
    } catch (e) {
        return `Hi ${clientName}, reminder for pending ${balance} for ${destination}. Pls pay when possible. Thx!`;
    }
};

export const generateSmartQuoteSummary = async (data: QuotationData): Promise<string> => {
    const prompt = `
    Create a "Quote Summary" for a travel proposal based on the data below.
    
    DATA:
    ${JSON.stringify(data)}

    STRICT GUIDELINES:
    
    1️⃣ Purpose & Role
    - Act as a high-level snapshot.
    - Reinforce value and clarity.
    
    2️⃣ Length & Structure
    - 5 to 7 bullet points keys.
    - Total 60–120 words.
    - No paragraphs – bullets only.
    - Each bullet: 1 concise sentence (max 20–22 words).
    - Avoid long compound sentences.

    3️⃣ Heading & Labeling
    - Start with a clear title like: "QUOTE SUMMARY 📝" or "⭐ Quote Summary".
    - Use Title Casing.
    - Exactly ONE emoji in the heading.

    4️⃣ Bullet Point Styling
    - Use '•' (dot bullet).
    - Start each bullet with a FEATURE or BENEFIT (e.g., "Premium accommodation selected...").
    - Use present tense or passive professional tone.
    - No bold text inside bullets.

    5️⃣ Language & Tone
    - Tone: Professional, calm, reassuring.
    - Vocabulary: "Provided", "Included", "Arranged", "Selected", "Covered", "Designed for".
    - Avoid: Casual slang, First-person storytelling.
    - NO emojis inside sentences. Max 1-2 emojis in the entire body (at end of lines if needed).

    6️⃣ Emoji Usage Rules
    - 1 emoji in title (mandatory).
    - 0–2 emojis in body total (optional, soft use only).
    - Allowed: 📝, ⭐, 🌟, 🌴.

    7️⃣ Content Framing Logic (Non-Data)
    - Implicitly cover at least 3 of these categories: Accommodation quality, Transport style, Activities, Meal inclusions, Flexibility.
    - Do NOT list dry data (like dates explicitly) unless phrased as a benefit.

    8️⃣ Disclaimer
    - Max one bullet.
    - Polite, non-alarming (e.g. "Subject to availability").

    9️⃣ Formatting
    - No numbering.
    - Clean whitespace.
    - No bold inside bullets.

    OUTPUT: Only the raw text of the summary.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });
        return response.text?.trim() || '';
    } catch (e) {
        console.error("Summary generation failed", e);
        throw new Error("Failed to generate smart summary");
    }
};
