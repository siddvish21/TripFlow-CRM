import mammoth from 'mammoth';
import ExcelJS from 'exceljs';
import { CalculatorState, CalculatorRow, AddOnRow, BlockConfig } from '../types';

export const extractTextFromDocx = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
};

export const parseFinancialExcel = async (file: File): Promise<Partial<CalculatorState>> => {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);
    
    // STRATEGY 1: Hidden State (Perfect Match)
    const stateSheet = workbook.getWorksheet('App_State_DoNotEdit');
    if (stateSheet) {
        const rawJson = stateSheet.getCell('A1').value;
        if (typeof rawJson === 'string') {
            try {
                return JSON.parse(rawJson);
            } catch (e) { console.warn("Hidden state parse failed."); }
        }
    }

    // STRATEGY 2: Smart Heuristic Parsing
    // We don't rely on specific row numbers or exact section headers.
    // We scan for patterns.
    
    // Try to find a sheet that looks like data. Usually sheet 1.
    const worksheet = workbook.getWorksheet(1); 
    if (!worksheet) throw new Error("Invalid Excel file.");

    const rows: CalculatorRow[] = [];
    const addOnRows: AddOnRow[] = [];
    const configs = {
        block1: { pax: 2, markupPct: 0, gstPct: 5, tcsPct: 5 },
        block2: { pax: 2, markupPct: 0, gstPct: 5, tcsPct: 5 },
        block3: { pax: 2, markupPct: 0, gstPct: 5, tcsPct: 5 },
    };

    let itemIdCounter = 0;
    let addonIdCounter = 0;

    // Helper to clean values
    const getVal = (row: any, colIndex: number): number => {
        const cell = row.getCell(colIndex);
        const val = cell.value;
        if (typeof val === 'object' && val !== null && 'result' in val) return Number((val as any).result) || 0;
        return Number(val) || 0;
    };
    
    const getStr = (row: any, colIndex: number): string => {
        const val = row.getCell(colIndex).value;
        return val ? String(val).trim() : '';
    };

    // Keyword Matchers (Flexible)
    const isStopWord = (txt: string) => {
        const t = txt.toLowerCase();
        return t.includes('total') || t.includes('summary') || t.includes('base cost') || t.includes('amount');
    };

    const isAddOn = (txt: string) => {
        const t = txt.toLowerCase();
        return t.includes('flight') || t.includes('visa') || t.includes('insurance') || t.includes('airfare');
    };

    const isConfigKey = (txt: string) => {
        const t = txt.toLowerCase();
        return t.includes('pax') || t.includes('markup') || t.includes('gst') || t.includes('tcs') || t.includes('tax');
    };

    // Explicitly using 'any' for row to avoid type mismatches with the ESM library at runtime
    worksheet.eachRow((row: any, rowNumber: number) => {
        const label = getStr(row, 1);
        
        // 1. DETECT ITEMS
        // Logic: Row starts with text (not a keyword like Total/Summary), and has numbers in Col 2 or 3
        if (label && !isStopWord(label) && !isAddOn(label) && !isConfigKey(label)) {
            // Check if it looks like a data row (has numbers in expected rate columns)
            // We check Col 3 (Rate 1) or Col 9 (Rate 2) or Col 15 (Rate 3)
            const hasData = (getVal(row, 3) > 0) || (getVal(row, 9) > 0) || (getVal(row, 15) > 0);
            
            // Avoid header rows that might be text-heavy but have no numbers
            if (hasData) {
                rows.push({
                    id: itemIdCounter++,
                    label: label,
                    colC: getVal(row, 2), colD: getVal(row, 3), colF: getVal(row, 5) || 1,
                    colL: getVal(row, 8), colM: getVal(row, 9), colO: getVal(row, 11) || 1,
                    colU: getVal(row, 14), colV: getVal(row, 15), colX: getVal(row, 17) || 1,
                });
            }
        }

        // 2. DETECT ADD-ONS (Scan globally)
        if (label && isAddOn(label)) {
            // Usually Addons in this sheet format only show the FINAL value in the export.
            // We map the final value to Net Rate and set Qty to 1 to preserve cost.
            const cost1 = getVal(row, 2); // Assuming format aligns with Col B
            const cost2 = getVal(row, 8);
            const cost3 = getVal(row, 14);

            if (cost1 > 0 || cost2 > 0 || cost3 > 0) {
                 addOnRows.push({
                    id: addonIdCounter++,
                    type: label.toLowerCase().includes('visa') ? 'Visa' : 'Flight',
                    qty1: 1, netRate1: cost1, markupPerPax1: 0,
                    qty2: 1, netRate2: cost2, markupPerPax2: 0,
                    qty3: 1, netRate3: cost3, markupPerPax3: 0,
                });
            }
        }

        // 3. DETECT CONFIGS (Scan globally)
        if (label) {
            const lower = label.toLowerCase();
            
            // PAX
            if (lower.includes('pax')) {
                // Often formatted as "Div by Pax" label in col 2, value in col 3 OR label in col 1, value in col 2
                // We scan a few columns to find the number
                const p1 = getVal(row, 2) || getVal(row, 3);
                const p2 = getVal(row, 8) || getVal(row, 9);
                const p3 = getVal(row, 14) || getVal(row, 15);
                if (p1 > 0) configs.block1.pax = p1;
                if (p2 > 0) configs.block2.pax = p2;
                if (p3 > 0) configs.block3.pax = p3;
            }
            
            // TAXES / MARKUP
            // Heuristic: If we find "Markup" label, look for adjacent percentage values (< 100)
            if (lower.includes('markup')) {
                 // Try to find percentage input
                 const m1 = getVal(row, 2);
                 if (m1 > 0 && m1 < 100) configs.block1.markupPct = m1;
            }

            if (lower.includes('gst')) {
                 const g1 = getVal(row, 2) || 5; 
                 if (g1 > 0 && g1 < 30) configs.block1.gstPct = g1;
            }
            
            if (lower.includes('tcs')) {
                 const t1 = getVal(row, 2) || 5;
                 if (t1 > 0 && t1 < 30) configs.block1.tcsPct = t1;
            }
        }
    });

    return {
        rows: rows.length > 0 ? rows : undefined,
        configs,
        addOnRows: addOnRows.length > 0 ? addOnRows : undefined
    };
};