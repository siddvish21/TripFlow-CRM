
import ExcelJS from 'exceljs';
import { CalculatorState, Lead } from '../types';
import { calculateAllFinancials } from '../utils/financialCalculations';

export const generateFinancialExcel = async (state: CalculatorState, lead: Lead): Promise<Blob> => {
    const workbook = new ExcelJS.Workbook();

    // --- 1. VISIBLE SHEET (Formatted for Humans) ---
    const worksheet = workbook.addWorksheet('Financials');

    // Calculate Data
    const data = calculateAllFinancials(state);

    // Styling Constants
    const headerFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } }; // Gray 900
    const headerFont: Partial<ExcelJS.Font> = { color: { argb: 'FFFFFFFF' }, bold: true };
    const borderStyle: Partial<ExcelJS.Borders> = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
    };

    // --- Header Info ---
    worksheet.mergeCells('A1:E1');
    worksheet.getCell('A1').value = `TripFlow CRM - Financial Working Sheet`;
    worksheet.getCell('A1').font = { size: 16, bold: true };

    worksheet.mergeCells('A2:E2');
    worksheet.getCell('A2').value = `Client: ${lead.name} | Destination: ${lead.destination} | Pax: ${lead.pax}`;

    // --- Main Table Headers ---
    worksheet.addRow([]);
    const headerRow = worksheet.addRow([
        'Item Description',
        'Qty (Opt 1)', 'Rate', 'Total', 'Mult', 'Cost (Opt 1)', '',
        'Qty (Opt 2)', 'Rate', 'Total', 'Mult', 'Cost (Opt 2)', '',
        'Qty (Opt 3)', 'Rate', 'Total', 'Mult', 'Cost (Opt 3)'
    ]);

    headerRow.eachCell((cell) => {
        cell.fill = headerFill;
        cell.font = headerFont;
        cell.border = borderStyle;
    });

    // --- Main Rows ---
    data.rows.forEach(row => {
        const r = worksheet.addRow([
            row.label,
            row.colC, row.colD, row.colE, row.colF, row.colG, '',
            row.colL, row.colM, row.colN, row.colO, row.colP, '',
            row.colU, row.colV, row.colW, row.colX, row.colY
        ]);
        r.eachCell(cell => cell.border = borderStyle);
    });

    // --- Summary Blocks ---
    worksheet.addRow([]);
    const summaryHeader = worksheet.addRow(['SUMMARY', 'OPTION 1', '', '', '', '', '', 'OPTION 2', '', '', '', '', '', 'OPTION 3']);
    summaryHeader.font = { bold: true };

    const addSummaryRow = (label: string, val1: number, val2: number, val3: number) => {
        worksheet.addRow([label, val1, '', '', '', '', '', val2, '', '', '', '', '', val3]);
    };

    addSummaryRow('Base Cost', data.block1.subTotal, data.block2.subTotal, data.block3.subTotal);
    addSummaryRow(`Markup Amount`, data.block1.markupAmount, data.block2.markupAmount, data.block3.markupAmount);
    addSummaryRow('Amount (Inc. Markup)', data.block1.amountWithMarkup, data.block2.amountWithMarkup, data.block3.amountWithMarkup);
    addSummaryRow(`GST Amount`, data.block1.gstAmount, data.block2.gstAmount, data.block3.gstAmount);
    addSummaryRow('Amount (Inc. GST)', data.block1.amountWithGST, data.block2.amountWithGST, data.block3.amountWithGST);
    addSummaryRow(`TCS Amount`, data.block1.tcsAmount, data.block2.tcsAmount, data.block3.tcsAmount);

    worksheet.addRow([]);
    const landTotalRow = worksheet.addRow(['LAND PACKAGE TOTAL', data.block1.landPackageTotal, '', '', '', '', '', data.block2.landPackageTotal, '', '', '', '', '', data.block3.landPackageTotal]);
    landTotalRow.font = { bold: true };

    // --- Addons ---
    worksheet.addRow([]);
    worksheet.addRow(['ADD-ONS (Flights/Visa)']);
    const addonHeader = worksheet.addRow(['Type', 'Opt 1 Final', '', '', '', '', '', 'Opt 2 Final', '', '', '', '', '', 'Opt 3 Final']);
    addonHeader.font = { bold: true };

    data.addOnRows.forEach(row => {
        worksheet.addRow([row.type, row.opt1.final, '', '', '', '', '', row.opt2.final, '', '', '', '', '', row.opt3.final]);
    });

    // --- Grand Totals ---
    worksheet.addRow([]);
    const grandRow = worksheet.addRow(['GRAND TOTAL (Rounded)', data.block1.roundedTotal, '', '', '', '', '', data.block2.roundedTotal, '', '', '', '', '', data.block3.roundedTotal]);
    grandRow.font = { bold: true, size: 12 };
    grandRow.eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEB3B' } }; }); // Yellow

    const perPersonRow = worksheet.addRow(['PER PERSON COST', data.block1.perPerson, '', '', '', '', '', data.block2.perPerson, '', '', '', '', '', data.block3.perPerson]);
    perPersonRow.font = { bold: true, size: 14 };

    // --- 2. HIDDEN STATE SHEET (For App Restoration) ---
    // This sheet stores the raw JSON state so we can restore input fields/formulas exactly
    const stateSheet = workbook.addWorksheet('App_State_DoNotEdit');
    stateSheet.state = 'hidden';
    const stateCell = stateSheet.getCell('A1');
    stateCell.value = JSON.stringify(state);

    // Generate Blob
    const buffer = await workbook.xlsx.writeBuffer();
    return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
};

export const generateQuotationExcelFromTemplate = async (state: CalculatorState, customerName: string): Promise<Blob> => {
    // 1. Fetch Template
    // Using a cache buster and direct path
    const templatePath = '/assets/quotation_template.xlsx';
    console.log("Fetching Excel template from:", templatePath);
    const response = await fetch(`${templatePath}?t=${Date.now()}`);
    
    if (!response.ok) {
        throw new Error(`Failed to fetch Excel template from ${templatePath}: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();

    const workbook = new ExcelJS.Workbook();
    try {
        await workbook.xlsx.load(arrayBuffer);
    } catch (loadError) {
        console.error("ExcelJS load error:", loadError);
        throw new Error("Failed to load Excel template. The file may be corrupt or in an unsupported format.");
    }

    const ws = workbook.getWorksheet('5%');
    if (!ws) {
        const sheetNames = workbook.worksheets.map(w => w.name).join(', ');
        console.error(`Available sheets: ${sheetNames}`);
        throw new Error(`Template sheet '5%' not found in the Excel file. Available sheets: ${sheetNames}`);
    }

    // 2. Fill Block 1 (Option 1)
    try {
        ws.getCell('E19').value = (state.configs.block1.gstPct || 0) / 100;
        ws.getCell('E22').value = (state.configs.block1.tcsPct || 0) / 100;
        ws.getCell('C17').value = state.configs.block1.markupPct || 0;
        ws.getCell('D4').value = `no of pax/total (${state.configs.block1.pax || 2})`;

        // 3. Fill Block 2 (Option 2)
        ws.getCell('N19').value = (state.configs.block2.gstPct || 0) / 100;
        ws.getCell('N22').value = (state.configs.block2.tcsPct || 0) / 100;
        ws.getCell('L17').value = state.configs.block2.markupPct || 0;
        ws.getCell('M4').value = `no of pax/total (${state.configs.block2.pax || 2})`;

        // 4. Fill Block 3 (Option 3)
        ws.getCell('W19').value = (state.configs.block3.gstPct || 0) / 100;
        ws.getCell('W22').value = (state.configs.block3.tcsPct || 0) / 100;
        ws.getCell('U17').value = state.configs.block3.markupPct || 0;
        ws.getCell('V4').value = `no of pax/total (${state.configs.block3.pax || 2})`;

        // 5. Fill Items
        state.rows.forEach((row, index) => {
            const r = 5 + index;
            if (r > 15) return; // Template limit

        // Block 1
        ws.getCell(`A${r}`).value = row.label;
        ws.getCell(`C${r}`).value = row.colC;
        ws.getCell(`D${r}`).value = row.colD;
        ws.getCell(`F${r}`).value = row.colF;

        // Block 2
        ws.getCell(`J${r}`).value = row.label;
        ws.getCell(`L${r}`).value = row.colL;
        ws.getCell(`M${r}`).value = row.colM;
        ws.getCell(`O${r}`).value = row.colO;

        // Block 3
        ws.getCell(`S${r}`).value = row.label;
        ws.getCell(`U${r}`).value = row.colU;
        ws.getCell(`V${r}`).value = row.colV;
        ws.getCell(`X${r}`).value = row.colX;
    });

    // 6. Fill Add-ons (Flights/Visa)
    // Map Flight to Row 25+, Visa to Row 30+
    const flights = state.addOnRows.filter(a => a.type === 'Flight');
    const visas = state.addOnRows.filter(a => a.type === 'Visa');

    flights.forEach((f, i) => {
        const r = 25 + i;
        if (r > 29) return;
        ws.getCell(`C${r}`).value = f.netRate1;
        ws.getCell(`D${r}`).value = f.markupPerPax1;
        ws.getCell(`F${r}`).value = f.qty1;

        ws.getCell(`L${r}`).value = f.netRate2;
        ws.getCell(`M${r}`).value = f.markupPerPax2;
        ws.getCell(`O${r}`).value = f.qty2;

        ws.getCell(`U${r}`).value = f.netRate3;
        ws.getCell(`V${r}`).value = f.markupPerPax3;
        ws.getCell(`X${r}`).value = f.qty3;
    });

    visas.forEach((v, i) => {
        const r = 30 + i;
        if (r > 32) return;
        ws.getCell(`C${r}`).value = v.netRate1;
        ws.getCell(`D${r}`).value = v.markupPerPax1;
        ws.getCell(`F${r}`).value = v.qty1;

        ws.getCell(`L${r}`).value = v.netRate2;
        ws.getCell(`M${r}`).value = v.markupPerPax2;
        ws.getCell(`O${r}`).value = v.qty2;

        ws.getCell(`U${r}`).value = v.netRate3;
        ws.getCell(`V${r}`).value = v.markupPerPax3;
        ws.getCell(`X${r}`).value = v.qty3;
    });

    } catch (err: any) {
        console.error("Error filling Excel template:", err);
        throw new Error(`Failed to fill Excel template: ${err.message}`);
    }

    // 7. Name List Sheet
    const nameSheet = workbook.getWorksheet('Name List');
    if (nameSheet) {
        nameSheet.getCell('A3').value = `Passenger details for ${customerName}`;
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
};
