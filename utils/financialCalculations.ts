
import { CalculatorState, BlockConfig, CalculatorRow, ChildFinancials } from '../types';

export const roundUpToNearest100 = (num: number) => {
  if (num === 0) return 0;
  return Math.ceil(num / 100) * 100;
};

// Helper: Calculate the full price stack for a single row (used for Child Cost isolation)
// This ensures that currency/multipliers are respected per row.
const calculateSingleRowStack = (
    rowTotal: number, // (Rate * Qty * Mult)
    config: BlockConfig
) => {
    const markupAmount = rowTotal * (config.markupPct / 100);
    const withMarkup = rowTotal + markupAmount;
    
    const gstAmount = withMarkup * (config.gstPct / 100);
    const withGST = withMarkup + gstAmount;
    
    const tcsAmount = withGST * (config.tcsPct / 100);
    const netCost = withGST + tcsAmount;

    return {
        base: Math.round(withMarkup),
        gst: Math.round(gstAmount),
        tcs: Math.round(tcsAmount),
        net: Math.round(netCost)
    };
};

export const calculateAllFinancials = (state: CalculatorState) => {
    const { rows, addOnRows, configs } = state;

    // 1. Main Rows Calculation
    const processedRows = rows.map(row => {
      // Block 1
      const colE = row.colD * row.colC; 
      const colG = colE * row.colF; // colF is the Row-Specific Multiplier     

      // Block 2
      const colN = row.colM * row.colL;
      const colP = colN * row.colO;

      // Block 3
      const colW = row.colV * row.colU;
      const colY = colW * row.colX;

      return { ...row, colE, colG, colN, colP, colW, colY };
    });

    // 2. AddOn Rows Calculation
    const processedAddOns = addOnRows.map(row => {
        const calcOption = (qty: number, rate: number, markupPerPax: number) => {
            const netTotal = qty * rate;
            const totalMarkup = qty * markupPerPax;
            
            const final = netTotal + totalMarkup;
            const gstOnMarkup = totalMarkup * 0.18; 
            const netMargin = totalMarkup - gstOnMarkup;

            return { netTotal, totalMarkup, gstOnMarkup, netMargin, final };
        };

        const opt1 = calcOption(row.qty1, row.netRate1, row.markupPerPax1);
        const opt2 = calcOption(row.qty2, row.netRate2, row.markupPerPax2);
        const opt3 = calcOption(row.qty3, row.netRate3, row.markupPerPax3);

        return { ...row, opt1, opt2, opt3 };
    });

    // Sums
    const subTotalG = processedRows.reduce((sum, r) => sum + r.colG, 0);
    const subTotalP = processedRows.reduce((sum, r) => sum + r.colP, 0);
    const subTotalY = processedRows.reduce((sum, r) => sum + r.colY, 0);

    const addOnsTotal1 = processedAddOns.reduce((sum, r) => sum + r.opt1.final, 0);
    const addOnsTotal2 = processedAddOns.reduce((sum, r) => sum + r.opt2.final, 0);
    const addOnsTotal3 = processedAddOns.reduce((sum, r) => sum + r.opt3.final, 0);

    // 3. Smart Child Cost Extraction
    // We scan rows for keywords like "Child", "CWB", "CNB"
    const isChildRow = (label: string) => {
        const l = label.toLowerCase();
        return l.includes('child') || l.includes('cwb') || l.includes('cnb');
    };

    const extractChildCosts = (optionRows: any[], config: BlockConfig, blockKey: 'colG' | 'colP' | 'colY'): ChildFinancials[] => {
        return optionRows
            .filter(r => isChildRow(r.label) && r[blockKey] > 0)
            .map(r => {
                const stack = calculateSingleRowStack(r[blockKey], config);
                // We assume the row value is Total for that line. 
                // If label says "Child" and Qty is 1, it's the cost. 
                // If Qty > 1, we should probably divide by Qty to get Per Child cost? 
                // Standard behavior: The row total usually implies the rate being multiplied.
                // Let's assume the row result [blockKey] is the *Total cost for that child line*.
                // To get Per Child, we check the input qty.
                
                let qty = 1;
                if (blockKey === 'colG') qty = r.colC || 1;
                else if (blockKey === 'colP') qty = r.colL || 1;
                else qty = r.colU || 1;

                return {
                    label: r.label,
                    landBaseCost: stack.base / qty,
                    landGST: stack.gst / qty,
                    landTCS: stack.tcs / qty,
                    netCost: stack.net / qty
                };
            });
    };

    const childCosts1 = extractChildCosts(processedRows, configs.block1, 'colG');
    const childCosts2 = extractChildCosts(processedRows, configs.block2, 'colP');
    const childCosts3 = extractChildCosts(processedRows, configs.block3, 'colY');

    // 4. Calculate Grand Totals (Standard Logic)
    const calculateBlockTotal = (subTotal: number, config: BlockConfig, addOnsTotal: number, childCosts: ChildFinancials[]) => {
        const markupAmount = subTotal * (config.markupPct / 100);
        const amountWithMarkup = subTotal + markupAmount;
        
        const gstAmount = amountWithMarkup * (config.gstPct / 100);
        const amountWithGST = amountWithMarkup + gstAmount;
        
        const tcsAmount = amountWithGST * (config.tcsPct / 100);
        const landPackageTotal = amountWithGST + tcsAmount;
        
        // Add Flight/Visa
        const grandTotal = landPackageTotal + addOnsTotal;
        const roundedTotal = roundUpToNearest100(grandTotal);
        
        // --- ADULT PER PERSON LOGIC ---
        // To get a true "Per Adult" cost, we must subtract the total child costs from the grand total
        // and then divide by (Total Pax - Child Count).
        // However, usually 'pax' config is Total Pax. 
        // Simplification: We calculate the 'Adult' portion by excluding Child Rows from the start?
        // NO, current industry standard in this specific spreadsheet format: 
        // Grand Total / Total Pax = Average Per Person.
        // But for the QUOTATION display, we use the specific rows.
        
        // So we keep this 'perPerson' as the Average for the spreadsheet view
        const perPerson = config.pax > 0 ? roundedTotal / config.pax : 0;

        return {
            subTotal,
            markupAmount,
            amountWithMarkup,
            gstAmount,
            amountWithGST,
            tcsAmount,
            landPackageTotal,
            grandTotal,
            roundedTotal,
            perPerson,
            addOnsTotal,
            childCosts // Pass this through to the block result
        };
    };

    const block1 = calculateBlockTotal(subTotalG, configs.block1, addOnsTotal1, childCosts1);
    const block2 = calculateBlockTotal(subTotalP, configs.block2, addOnsTotal2, childCosts2);
    const block3 = calculateBlockTotal(subTotalY, configs.block3, addOnsTotal3, childCosts3);

    return {
      rows: processedRows,
      addOnRows: processedAddOns,
      block1,
      block2,
      block3
    };
};
