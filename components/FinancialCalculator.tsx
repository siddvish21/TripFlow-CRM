
import React, { useState, useMemo, useEffect } from 'react';
import { parseVendorData, reprocessVendorDataWithClarification } from '../services/geminiService';
import { calculateAllFinancials } from '../utils/financialCalculations';
import { FinancialBreakdown, VendorParsedData, CalculatorState, CalculatorRow, AddOnRow, BlockConfig, FinancialOption } from '../types';

interface FinancialCalculatorProps {
    onUpdateQuotation?: (breakdown: FinancialBreakdown) => void;
    initialAutoFillData?: VendorParsedData | null;
    onAutoFillConsumed?: () => void;
    savedState: CalculatorState;
    onSaveState: (state: CalculatorState) => void;
}

const FinancialCalculator: React.FC<FinancialCalculatorProps> = ({ 
    onUpdateQuotation, 
    initialAutoFillData,
    onAutoFillConsumed,
    savedState,
    onSaveState 
}) => {
  
  // Initialize state from props (persistence)
  const [configs, setConfigs] = useState(savedState.configs);
  const [rows, setRows] = useState<CalculatorRow[]>(savedState.rows);
  const [addOnRows, setAddOnRows] = useState<AddOnRow[]>(savedState.addOnRows);
  const [vendorText, setVendorText] = useState(savedState.vendorText);
  const [detectedCurrency, setDetectedCurrency] = useState(savedState.detectedCurrency);
  const [conversionRate, setConversionRate] = useState(savedState.conversionRate);
  const [aiParsedData, setAiParsedData] = useState<VendorParsedData | null>(savedState.aiParsedData);

  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  
  // Clarification State
  const [clarificationNeeded, setClarificationNeeded] = useState<string[]>([]);
  const [userClarification, setUserClarification] = useState("");

  // Persistence Effect
  useEffect(() => {
      onSaveState({
          configs,
          rows,
          addOnRows,
          vendorText,
          detectedCurrency,
          conversionRate,
          aiParsedData
      });
  }, [configs, rows, addOnRows, vendorText, detectedCurrency, conversionRate, aiParsedData, onSaveState]);

  // Effect to handle external autofill data
  useEffect(() => {
      if (initialAutoFillData) {
          handleProcessedData(initialAutoFillData);
          if (onAutoFillConsumed) onAutoFillConsumed();
      }
  }, [initialAutoFillData]);

  // Handle Main Cell Updates
  const updateRow = (index: number, field: keyof CalculatorRow, value: string) => {
    if (field === 'label') {
        const newRows = [...rows];
        // @ts-ignore
        newRows[index] = { ...newRows[index], label: value };
        setRows(newRows);
        return;
    }
    const numValue = parseFloat(value);
    const newRows = [...rows];
    // @ts-ignore
    newRows[index] = { ...newRows[index], [field]: isNaN(numValue) ? 0 : numValue };
    setRows(newRows);
  };

  const addChildRows = () => {
      const startId = rows.length;
      const childWithBed: CalculatorRow = {
          id: startId,
          label: "Child With Bed",
          colC: 0, colD: 0, colF: 1,
          colL: 0, colM: 0, colO: 1,
          colU: 0, colV: 0, colX: 1
      };
      const childNoBed: CalculatorRow = {
          id: startId + 1,
          label: "Child No Bed",
          colC: 0, colD: 0, colF: 1,
          colL: 0, colM: 0, colO: 1,
          colU: 0, colV: 0, colX: 1
      };
      setRows([...rows, childWithBed, childNoBed]);
  };

  // Handle AddOn Cell Updates
  const updateAddOnRow = (index: number, field: keyof AddOnRow, value: string) => {
    const numValue = parseFloat(value);
    const newRows = [...addOnRows];
    // @ts-ignore
    newRows[index] = { ...newRows[index], [field]: isNaN(numValue) ? 0 : numValue };
    setAddOnRows(newRows);
  };

  const updateConfig = (block: 'block1' | 'block2' | 'block3', field: keyof BlockConfig, value: string) => {
    const numValue = parseFloat(value);
    setConfigs(prev => ({
      ...prev,
      [block]: {
        ...prev[block],
        [field]: isNaN(numValue) ? 0 : numValue
      }
    }));
  };

  // --- AI LOGIC ---

  const handleVendorAI = async () => {
    if (!vendorText.trim()) return;
    setIsProcessingAI(true);
    try {
        const data = await parseVendorData(vendorText);
        handleProcessedData(data);
    } catch (e) {
        console.error(e);
        alert("Failed to process vendor data.");
    } finally {
        setIsProcessingAI(false);
    }
  };

  const handleProcessedData = (data: VendorParsedData) => {
      if (data.questions && data.questions.length > 0) {
          setClarificationNeeded(data.questions);
          return;
      }
      setAiParsedData(data);
      setDetectedCurrency(data.currency.toUpperCase());
      
      if (data.currency.toUpperCase() !== 'INR') {
          setShowCurrencyModal(true);
      } else {
          applyAiData(data, 1);
      }
  }

  const submitClarification = async () => {
      if (!userClarification.trim()) return;
      setClarificationNeeded([]); // Close modal
      setIsProcessingAI(true);
      try {
          const data = await reprocessVendorDataWithClarification(vendorText, userClarification);
          handleProcessedData(data);
      } catch (e) {
          console.error(e);
          alert("Failed to re-process.");
      } finally {
          setIsProcessingAI(false);
          setUserClarification("");
      }
  }

  const confirmConversion = () => {
    if (aiParsedData) {
        applyAiData(aiParsedData, conversionRate);
        setShowCurrencyModal(false);
    }
  };

  const applyAiData = (data: VendorParsedData, rate: number) => {
      // 1. Update Configs if extracted (Restoration Mode)
      if (data.extractedConfigs) {
          const { markupPct, gstPct, tcsPct } = data.extractedConfigs;
          setConfigs(prev => ({
              block1: { ...prev.block1, markupPct, gstPct, tcsPct, pax: data.totalPax || prev.block1.pax },
              block2: { ...prev.block2, markupPct, gstPct, tcsPct, pax: data.totalPax || prev.block2.pax },
              block3: { ...prev.block3, markupPct, gstPct, tcsPct, pax: data.totalPax || prev.block3.pax },
          }));
      } else if (data.totalPax > 0) {
          // Standard autofill
          setConfigs(prev => ({
              block1: { ...prev.block1, pax: data.totalPax },
              block2: { ...prev.block2, pax: data.totalPax },
              block3: { ...prev.block3, pax: data.totalPax },
          }));
      }

      // 2. Map Rows with precise multipliers if available
      const newRows = [...rows];
      const items = data.unifiedLineItems || [];

      items.forEach((item, index) => {
          // Determine multipliers: Use extracted row-specific multiplier if present (Restoration), else global rate
          const m1 = item.multiplierOption1 !== undefined ? item.multiplierOption1 : rate;
          const m2 = item.multiplierOption2 !== undefined ? item.multiplierOption2 : rate;
          const m3 = item.multiplierOption3 !== undefined ? item.multiplierOption3 : rate;

          if (index < newRows.length) {
              newRows[index] = {
                  ...newRows[index],
                  label: item.description,
                  colC: item.quantity, colD: item.costOption1, colF: m1,
                  colL: item.quantity, colM: item.costOption2, colO: m2,
                  colU: item.quantity, colV: item.costOption3, colX: m3,
              };
          } else {
              newRows.push({
                  id: index,
                  label: item.description,
                  colC: item.quantity, colD: item.costOption1, colF: m1,
                  colL: item.quantity, colM: item.costOption2, colO: m2,
                  colU: item.quantity, colV: item.costOption3, colX: m3,
              });
          }
      });

      // Clear remaining rows if we are doing a full restore/replace
      for (let i = items.length; i < newRows.length; i++) {
           newRows[i].label = `Item ${i+1}`;
           newRows[i].colC = 0; newRows[i].colD = 0; newRows[i].colF = 1; 
           newRows[i].colL = 0; newRows[i].colM = 0; newRows[i].colO = 1; 
           newRows[i].colU = 0; newRows[i].colV = 0; newRows[i].colX = 1; 
      }
      setRows(newRows);

      // 3. Update AddOns
      const newAddOns = [...addOnRows];
      newAddOns.forEach(row => {
          row.qty1 = 0; row.netRate1 = 0;
          row.qty2 = 0; row.netRate2 = 0;
          row.qty3 = 0; row.netRate3 = 0;
      });

      let flightIdx = 0;
      let visaIdx = 2;
      const addons = data.addOns || [];

      addons.forEach((addon) => {
          if (addon.type === 'Flight' && flightIdx < 2) {
              const r = newAddOns[flightIdx];
              r.qty1 = data.totalPax || 1; r.netRate1 = addon.costPerPax;
              r.qty2 = data.totalPax || 1; r.netRate2 = addon.costPerPax;
              r.qty3 = data.totalPax || 1; r.netRate3 = addon.costPerPax;
              flightIdx++;
          } else if (addon.type === 'Visa' && visaIdx < 4) {
               const r = newAddOns[visaIdx];
               r.qty1 = data.totalPax || 1; r.netRate1 = addon.costPerPax;
               r.qty2 = data.totalPax || 1; r.netRate2 = addon.costPerPax;
               r.qty3 = data.totalPax || 1; r.netRate3 = addon.costPerPax;
               visaIdx++;
          }
      });
      setAddOnRows(newAddOns);
  };


  // --- CALCULATIONS (Using Shared Utility) ---
  const calculatedData = useMemo(() => {
    // Construct current state object to pass to utility
    const currentState: CalculatorState = {
        configs,
        rows,
        addOnRows,
        vendorText,
        detectedCurrency,
        conversionRate,
        aiParsedData
    };
    return calculateAllFinancials(currentState);
  }, [rows, addOnRows, configs, vendorText, detectedCurrency, conversionRate, aiParsedData]);


  const handleProceed = () => {
      if (onUpdateQuotation) {
          const options: FinancialOption[] = [];
          
          // Helper to create option with Child Data
          const addOptionIfValid = (block: any, config: BlockConfig, label: string) => {
               if (block.grandTotal > 0) {
                   const pax = config.pax || 1;
                   
                   // CRITICAL: Calculate Adult Rate by subtracting total Child Costs from Grand Total?
                   // No, the "Per Person" derived here is an Average. 
                   // But since we are showing "Per Child" separately, the "Per Adult" should likely be the Adult rows sum.
                   // For now, let's keep the standard "Per Person" as the base Adult Rate unless we implement strict row tagging.
                   // Given the structure, we'll pass the Average as Base, but include Child details for separate display.
                   
                   options.push({
                       label: label,
                       landBaseCost: block.amountWithMarkup / pax,
                       landGST: block.gstAmount / pax,
                       landTCS: block.tcsAmount / pax,
                       addOnCost: block.addOnsTotal / pax,
                       childCosts: block.childCosts // New: Pass extracted child costs
                   });
               }
          };

          addOptionIfValid(calculatedData.block1, configs.block1, "Option 1");
          addOptionIfValid(calculatedData.block2, configs.block2, "Option 2");
          addOptionIfValid(calculatedData.block3, configs.block3, "Option 3");

          if (options.length === 0) {
              options.push({ label: "Option 1", landBaseCost: 0, landGST: 0, landTCS: 0, addOnCost: 0 });
          }

          onUpdateQuotation({ options });
      }
  };

  return (
    <div className="bg-gray-800 rounded-lg shadow-lg p-4 overflow-x-auto">
        {/* ... (Same AI Input Section) ... */}
        <div className="bg-gray-700/50 p-4 rounded-lg mb-6 border border-gray-600">
            <h2 className="text-lg font-bold text-blue-300 mb-2">🚀 Auto-Fill from Vendor Data</h2>
            <div className="flex flex-col md:flex-row gap-4">
                <textarea 
                    className="flex-1 bg-gray-900 text-gray-300 p-3 rounded border border-gray-600 text-sm h-24"
                    placeholder="Paste raw vendor pricing here..."
                    value={vendorText}
                    onChange={(e) => setVendorText(e.target.value)}
                />
                <div className="flex flex-col justify-center">
                    <button 
                        onClick={handleVendorAI}
                        disabled={isProcessingAI}
                        className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-6 rounded"
                    >
                        {isProcessingAI ? 'Processing...' : 'Process with AI'}
                    </button>
                </div>
            </div>
        </div>

        {/* --- CLARIFICATION MODAL (UPDATED) --- */}
        {clarificationNeeded.length > 0 && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
                <div className="bg-gray-800 p-6 rounded-lg border border-red-500 max-w-lg w-full">
                     <h3 className="text-xl font-bold text-red-400 mb-4">⚠️ Clarification Needed</h3>
                     
                     {/* ADDED: Display the questions */}
                     <div className="mb-4 bg-red-900/20 p-3 rounded border border-red-500/30">
                        <ul className="list-disc pl-5 space-y-2 text-sm text-gray-300">
                            {clarificationNeeded.map((q, i) => (
                                <li key={i}>{q}</li>
                            ))}
                        </ul>
                     </div>

                     <p className="text-xs text-gray-500 mb-2">Please provide the missing details below:</p>
                     <textarea 
                        className="w-full bg-gray-900 text-white p-3 rounded mb-4 h-24 border border-gray-700 focus:border-blue-500 outline-none" 
                        value={userClarification} 
                        onChange={(e) => setUserClarification(e.target.value)} 
                        placeholder="e.g. Option 1 is 3-star, Rates are per person..."
                     />
                     <div className="flex justify-end gap-2">
                        <button onClick={() => setClarificationNeeded([])} className="text-gray-400 hover:text-white px-4 py-2 text-sm">Cancel</button>
                        <button onClick={submitClarification} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded font-bold text-sm">Submit Answer</button>
                     </div>
                </div>
            </div>
        )}

        {showCurrencyModal && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
                 <div className="bg-gray-800 p-6 rounded max-w-sm w-full">
                    <h3 className="text-xl font-bold text-yellow-400 mb-4">Currency: {detectedCurrency}</h3>
                    <input type="number" value={conversionRate} onChange={(e) => setConversionRate(parseFloat(e.target.value))} className="w-full bg-gray-900 text-white p-2 rounded mb-6 text-center text-lg" />
                    <button onClick={confirmConversion} className="w-full bg-green-600 text-white font-bold py-2 rounded">Apply</button>
                 </div>
            </div>
        )}

        {/* Controls */}
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-200">Financial Calculation Sheet</h2>
            <div className="flex gap-4">
                <button onClick={addChildRows} className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded text-sm font-bold flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" /></svg>
                    Add Child Cost
                </button>
                <button onClick={() => setRows([...rows, { id: rows.length, label: `Item ${rows.length+1}`, colC: 0, colD: 0, colF: 1, colL: 0, colM: 0, colO: 1, colU: 0, colV: 0, colX: 1 }])} className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-bold">+ Add Item Row</button>
            </div>
        </div>

        {/* --- MAIN TABLE --- */}
      <table className="w-full min-w-[1600px] border-collapse text-sm text-gray-300 mb-8">
        <thead>
          <tr>
            <th className="bg-gray-900 border border-gray-600 w-48">Item Description</th>
            <th colSpan={5} className="bg-green-900/30 border border-gray-600 p-2 text-center font-bold text-green-400">Option 1</th>
            <th className="w-4 border border-gray-600 bg-gray-900"></th>
            <th colSpan={5} className="bg-blue-900/30 border border-gray-600 p-2 text-center font-bold text-blue-400">Option 2</th>
            <th className="w-4 border border-gray-600 bg-gray-900"></th>
            <th colSpan={5} className="bg-purple-900/30 border border-gray-600 p-2 text-center font-bold text-purple-400">Option 3</th>
          </tr>
          {/* Headers */}
           <tr className="bg-gray-700 text-xs uppercase">
            <th className="border border-gray-600 p-2">Label</th>
            <th className="border border-gray-600 p-2">Qty</th><th className="border border-gray-600 p-2">Rate</th><th className="border border-gray-600 p-2">Total</th><th className="border border-gray-600 p-2">Mult</th><th className="border border-gray-600 p-2 bg-green-900/20">Cost</th>
            <th className="border border-gray-600 bg-gray-900"></th>
            <th className="border border-gray-600 p-2">Qty</th><th className="border border-gray-600 p-2">Rate</th><th className="border border-gray-600 p-2">Total</th><th className="border border-gray-600 p-2">Mult</th><th className="border border-gray-600 p-2 bg-blue-900/20">Cost</th>
            <th className="border border-gray-600 bg-gray-900"></th>
            <th className="border border-gray-600 p-2">Qty</th><th className="border border-gray-600 p-2">Rate</th><th className="border border-gray-600 p-2">Total</th><th className="border border-gray-600 p-2">Mult</th><th className="border border-gray-600 p-2 bg-purple-900/20">Cost</th>
          </tr>
        </thead>
        <tbody>
          {calculatedData.rows.map((row, index) => (
            <tr key={row.id} className="hover:bg-gray-700/50 border-b border-gray-700/50">
              <td className="border-x border-gray-600 p-1"><input type="text" value={row.label} onChange={(e) => updateRow(index, 'label', e.target.value)} className="w-full bg-transparent outline-none focus:bg-gray-700 p-1 rounded text-gray-400 text-xs" /></td>
              
              {/* Block 1 */}
              <td className="border-x border-gray-600 p-1"><input type="number" value={row.colC || ''} onChange={(e) => updateRow(index, 'colC', e.target.value)} className="w-full bg-transparent text-right outline-none p-1 text-gray-300" /></td>
              <td className="border-x border-gray-600 p-1"><input type="number" value={row.colD || ''} onChange={(e) => updateRow(index, 'colD', e.target.value)} className="w-full bg-transparent text-right outline-none p-1 text-gray-300" /></td>
              <td className="border-x border-gray-600 p-1 text-right text-gray-500 bg-gray-800/30">{row.colE.toLocaleString()}</td>
              <td className="border-x border-gray-600 p-1"><input type="number" value={row.colF || ''} onChange={(e) => updateRow(index, 'colF', e.target.value)} className="w-full bg-transparent text-right outline-none p-1 text-gray-300" /></td>
              <td className="border-x border-gray-600 p-1 text-right font-bold text-green-400/80 bg-green-900/10">{row.colG.toLocaleString()}</td>
              <td className="bg-gray-900 border-x border-gray-600"></td>

              {/* Block 2 */}
              <td className="border-x border-gray-600 p-1"><input type="number" value={row.colL || ''} onChange={(e) => updateRow(index, 'colL', e.target.value)} className="w-full bg-transparent text-right outline-none p-1 text-gray-300" /></td>
              <td className="border-x border-gray-600 p-1"><input type="number" value={row.colM || ''} onChange={(e) => updateRow(index, 'colM', e.target.value)} className="w-full bg-transparent text-right outline-none p-1 text-gray-300" /></td>
              <td className="border-x border-gray-600 p-1 text-right text-gray-500 bg-gray-800/30">{row.colN.toLocaleString()}</td>
              <td className="border-x border-gray-600 p-1"><input type="number" value={row.colO || ''} onChange={(e) => updateRow(index, 'colO', e.target.value)} className="w-full bg-transparent text-right outline-none p-1 text-gray-300" /></td>
              <td className="border-x border-gray-600 p-1 text-right font-bold text-blue-400/80 bg-blue-900/10">{row.colP.toLocaleString()}</td>
              <td className="bg-gray-900 border-x border-gray-600"></td>

              {/* Block 3 */}
              <td className="border-x border-gray-600 p-1"><input type="number" value={row.colU || ''} onChange={(e) => updateRow(index, 'colU', e.target.value)} className="w-full bg-transparent text-right outline-none p-1 text-gray-300" /></td>
              <td className="border-x border-gray-600 p-1"><input type="number" value={row.colV || ''} onChange={(e) => updateRow(index, 'colV', e.target.value)} className="w-full bg-transparent text-right outline-none p-1 text-gray-300" /></td>
              <td className="border-x border-gray-600 p-1 text-right text-gray-500 bg-gray-800/30">{row.colW.toLocaleString()}</td>
              <td className="border-x border-gray-600 p-1"><input type="number" value={row.colX || ''} onChange={(e) => updateRow(index, 'colX', e.target.value)} className="w-full bg-transparent text-right outline-none p-1 text-gray-300" /></td>
              <td className="border-x border-gray-600 p-1 text-right font-bold text-purple-400/80 bg-purple-900/10">{row.colY.toLocaleString()}</td>
            </tr>
          ))}

          {/* SUMMARY ROWS */}
            <tr className="border-t-4 border-gray-600 bg-gray-700/30">
                <td className="border-x border-gray-600"></td>
                <td colSpan={4} className="p-2 text-right text-gray-400">Base Cost:</td><td className="p-2 text-right font-bold">{calculatedData.block1.subTotal.toLocaleString()}</td>
                <td className="bg-gray-900 border-x border-gray-600"></td>
                <td colSpan={4} className="p-2 text-right text-gray-400">Base Cost:</td><td className="p-2 text-right font-bold">{calculatedData.block2.subTotal.toLocaleString()}</td>
                <td className="bg-gray-900 border-x border-gray-600"></td>
                <td colSpan={4} className="p-2 text-right text-gray-400">Base Cost:</td><td className="p-2 text-right font-bold">{calculatedData.block3.subTotal.toLocaleString()}</td>
            </tr>
            <tr>
                <td className="border-x border-gray-600"></td>
                <td colSpan={3} className="p-1 text-right">Markup %:</td><td className="p-1"><input type="number" value={configs.block1.markupPct} onChange={e => updateConfig('block1', 'markupPct', e.target.value)} className="w-full bg-gray-700 text-center rounded text-xs" /></td><td className="p-1 text-right">{calculatedData.block1.markupAmount.toLocaleString(undefined, {maximumFractionDigits:0})}</td>
                <td className="bg-gray-900 border-x border-gray-600"></td>
                <td colSpan={3} className="p-1 text-right">Markup %:</td><td className="p-1"><input type="number" value={configs.block2.markupPct} onChange={e => updateConfig('block2', 'markupPct', e.target.value)} className="w-full bg-gray-700 text-center rounded text-xs" /></td><td className="p-1 text-right">{calculatedData.block2.markupAmount.toLocaleString(undefined, {maximumFractionDigits:0})}</td>
                <td className="bg-gray-900 border-x border-gray-600"></td>
                <td colSpan={3} className="p-1 text-right">Markup %:</td><td className="p-1"><input type="number" value={configs.block3.markupPct} onChange={e => updateConfig('block3', 'markupPct', e.target.value)} className="w-full bg-gray-700 text-center rounded text-xs" /></td><td className="p-1 text-right">{calculatedData.block3.markupAmount.toLocaleString(undefined, {maximumFractionDigits:0})}</td>
            </tr>
            {/* ... GST and TCS rows similiar structure ... */}
             <tr>
                <td className="border-x border-gray-600"></td>
                <td colSpan={3} className="p-1 text-right">GST %:</td><td className="p-1"><input type="number" value={configs.block1.gstPct} onChange={e => updateConfig('block1', 'gstPct', e.target.value)} className="w-full bg-gray-700 text-center rounded text-xs" /></td><td className="p-1 text-right">{calculatedData.block1.gstAmount.toLocaleString(undefined, {maximumFractionDigits:0})}</td>
                <td className="bg-gray-900 border-x border-gray-600"></td>
                <td colSpan={3} className="p-1 text-right">GST %:</td><td className="p-1"><input type="number" value={configs.block2.gstPct} onChange={e => updateConfig('block2', 'gstPct', e.target.value)} className="w-full bg-gray-700 text-center rounded text-xs" /></td><td className="p-1 text-right">{calculatedData.block2.gstAmount.toLocaleString(undefined, {maximumFractionDigits:0})}</td>
                <td className="bg-gray-900 border-x border-gray-600"></td>
                <td colSpan={3} className="p-1 text-right">GST %:</td><td className="p-1"><input type="number" value={configs.block3.gstPct} onChange={e => updateConfig('block3', 'gstPct', e.target.value)} className="w-full bg-gray-700 text-center rounded text-xs" /></td><td className="p-1 text-right">{calculatedData.block3.gstAmount.toLocaleString(undefined, {maximumFractionDigits:0})}</td>
            </tr>
            <tr>
                <td className="border-x border-gray-600"></td>
                <td colSpan={3} className="p-1 text-right">TCS %:</td><td className="p-1"><input type="number" value={configs.block1.tcsPct} onChange={e => updateConfig('block1', 'tcsPct', e.target.value)} className="w-full bg-gray-700 text-center rounded text-xs" /></td><td className="p-1 text-right">{calculatedData.block1.tcsAmount.toLocaleString(undefined, {maximumFractionDigits:0})}</td>
                <td className="bg-gray-900 border-x border-gray-600"></td>
                <td colSpan={3} className="p-1 text-right">TCS %:</td><td className="p-1"><input type="number" value={configs.block2.tcsPct} onChange={e => updateConfig('block2', 'tcsPct', e.target.value)} className="w-full bg-gray-700 text-center rounded text-xs" /></td><td className="p-1 text-right">{calculatedData.block2.tcsAmount.toLocaleString(undefined, {maximumFractionDigits:0})}</td>
                <td className="bg-gray-900 border-x border-gray-600"></td>
                <td colSpan={3} className="p-1 text-right">TCS %:</td><td className="p-1"><input type="number" value={configs.block3.tcsPct} onChange={e => updateConfig('block3', 'tcsPct', e.target.value)} className="w-full bg-gray-700 text-center rounded text-xs" /></td><td className="p-1 text-right">{calculatedData.block3.tcsAmount.toLocaleString(undefined, {maximumFractionDigits:0})}</td>
            </tr>
             <tr className="bg-gray-700 font-bold">
                <td className="border-x border-gray-600"></td>
                <td colSpan={4} className="p-2 text-right">LAND PKG TOTAL:</td><td className="p-2 text-right font-mono">{calculatedData.block1.landPackageTotal.toLocaleString(undefined, {maximumFractionDigits:0})}</td>
                <td className="bg-gray-900 border-x border-gray-600"></td>
                <td colSpan={4} className="p-2 text-right">LAND PKG TOTAL:</td><td className="p-2 text-right font-mono">{calculatedData.block2.landPackageTotal.toLocaleString(undefined, {maximumFractionDigits:0})}</td>
                <td className="bg-gray-900 border-x border-gray-600"></td>
                <td colSpan={4} className="p-2 text-right">LAND PKG TOTAL:</td><td className="p-2 text-right font-mono">{calculatedData.block3.landPackageTotal.toLocaleString(undefined, {maximumFractionDigits:0})}</td>
            </tr>
        </tbody>
      </table>

      {/* --- ADDONS --- */}
      <h3 className="text-lg font-bold text-gray-200 mb-2">Add-ons</h3>
      <table className="w-full min-w-[1000px] border-collapse text-sm text-gray-300 mb-8">
           <thead>
               <tr className="bg-gray-700 text-xs">
                   <th className="p-2 border border-gray-600 text-left">Type</th>
                   <th className="p-2 border border-gray-600 bg-green-900/10">Qty</th><th className="p-2 border border-gray-600 bg-green-900/10">Net Rate</th><th className="p-2 border border-gray-600 bg-green-900/10 text-pink-200">Profit</th><th className="p-2 border border-gray-600 bg-green-900/20 font-bold">Final</th>
                   <th className="w-4 bg-gray-900 border border-gray-600"></th>
                   <th className="p-2 border border-gray-600 bg-blue-900/10">Qty</th><th className="p-2 border border-gray-600 bg-blue-900/10">Net Rate</th><th className="p-2 border border-gray-600 bg-blue-900/10 text-pink-200">Profit</th><th className="p-2 border border-gray-600 bg-blue-900/20 font-bold">Final</th>
                   <th className="w-4 bg-gray-900 border border-gray-600"></th>
                   <th className="p-2 border border-gray-600 bg-purple-900/10">Qty</th><th className="p-2 border border-gray-600 bg-purple-900/10">Net Rate</th><th className="p-2 border border-gray-600 bg-purple-900/10 text-pink-200">Profit</th><th className="p-2 border border-gray-600 bg-purple-900/20 font-bold">Final</th>
               </tr>
           </thead>
           <tbody>
               {calculatedData.addOnRows.map((row, index) => (
                   <tr key={row.id}>
                       <td className="p-2 border border-gray-600 font-bold">{row.type}</td>
                       {/* Opt 1 */}
                       <td className="p-1 border border-gray-600"><input type="number" value={row.qty1} onChange={e => updateAddOnRow(index, 'qty1', e.target.value)} className="w-full bg-transparent text-center" /></td>
                       <td className="p-1 border border-gray-600"><input type="number" value={row.netRate1} onChange={e => updateAddOnRow(index, 'netRate1', e.target.value)} className="w-full bg-transparent text-right" /></td>
                       <td className="p-1 border border-gray-600 text-right text-pink-300 text-xs">{row.opt1.netMargin.toLocaleString(undefined, {maximumFractionDigits:0})}</td>
                       <td className="p-1 border border-gray-600 text-right font-bold text-green-300">{row.opt1.final.toLocaleString(undefined, {maximumFractionDigits:0})}</td>
                       <td className="bg-gray-900 border border-gray-600"></td>
                       {/* Opt 2 */}
                       <td className="p-1 border border-gray-600"><input type="number" value={row.qty2} onChange={e => updateAddOnRow(index, 'qty2', e.target.value)} className="w-full bg-transparent text-center" /></td>
                       <td className="p-1 border border-gray-600"><input type="number" value={row.netRate2} onChange={e => updateAddOnRow(index, 'netRate2', e.target.value)} className="w-full bg-transparent text-right" /></td>
                       <td className="p-1 border border-gray-600 text-right text-pink-300 text-xs">{row.opt2.netMargin.toLocaleString(undefined, {maximumFractionDigits:0})}</td>
                       <td className="p-1 border border-gray-600 text-right font-bold text-blue-300">{row.opt2.final.toLocaleString(undefined, {maximumFractionDigits:0})}</td>
                       <td className="bg-gray-900 border border-gray-600"></td>
                       {/* Opt 3 */}
                       <td className="p-1 border border-gray-600"><input type="number" value={row.qty3} onChange={e => updateAddOnRow(index, 'qty3', e.target.value)} className="w-full bg-transparent text-center" /></td>
                       <td className="p-1 border border-gray-600"><input type="number" value={row.netRate3} onChange={e => updateAddOnRow(index, 'netRate3', e.target.value)} className="w-full bg-transparent text-right" /></td>
                       <td className="p-1 border border-gray-600 text-right text-pink-300 text-xs">{row.opt3.netMargin.toLocaleString(undefined, {maximumFractionDigits:0})}</td>
                       <td className="p-1 border border-gray-600 text-right font-bold text-purple-300">{row.opt3.final.toLocaleString(undefined, {maximumFractionDigits:0})}</td>
                   </tr>
               ))}
           </tbody>
      </table>
      
      {/* --- GRAND TOTALS --- */}
      <table className="w-full border-collapse text-sm text-gray-300 mb-8">
           <tbody>
               <tr className="bg-gray-700/50 border-t-2 border-gray-500">
                    <td className="w-48"></td>
                    <td className="p-2 text-right font-bold text-white">GRAND TOTAL:</td><td className="p-2 text-right font-bold text-xl text-green-400">{calculatedData.block1.roundedTotal.toLocaleString()}</td>
                    <td className="w-4"></td>
                    <td className="p-2 text-right font-bold text-white">GRAND TOTAL:</td><td className="p-2 text-right font-bold text-xl text-blue-400">{calculatedData.block2.roundedTotal.toLocaleString()}</td>
                    <td className="w-4"></td>
                    <td className="p-2 text-right font-bold text-white">GRAND TOTAL:</td><td className="p-2 text-right font-bold text-xl text-purple-400">{calculatedData.block3.roundedTotal.toLocaleString()}</td>
               </tr>
               <tr className="bg-gray-800">
                   <td></td>
                   <td className="p-1 text-right italic">Div by Pax:</td><td className="p-1"><input type="number" value={configs.block1.pax} onChange={e => updateConfig('block1', 'pax', e.target.value)} className="w-full bg-gray-700 text-center font-bold" /></td>
                   <td></td>
                   <td className="p-1 text-right italic">Div by Pax:</td><td className="p-1"><input type="number" value={configs.block2.pax} onChange={e => updateConfig('block2', 'pax', e.target.value)} className="w-full bg-gray-700 text-center font-bold" /></td>
                   <td></td>
                   <td className="p-1 text-right italic">Div by Pax:</td><td className="p-1"><input type="number" value={configs.block3.pax} onChange={e => updateConfig('block3', 'pax', e.target.value)} className="w-full bg-gray-700 text-center font-bold" /></td>
               </tr>
               <tr className="bg-gradient-to-b from-gray-700 to-gray-800">
                    <td></td>
                    <td className="p-3 text-right font-bold text-lg">AVG PER PERSON:</td><td className="p-3 text-right font-bold text-2xl text-green-300">{calculatedData.block1.perPerson.toLocaleString(undefined, {maximumFractionDigits: 0})}</td>
                    <td></td>
                    <td className="p-3 text-right font-bold text-lg">AVG PER PERSON:</td><td className="p-3 text-right font-bold text-2xl text-blue-300">{calculatedData.block2.perPerson.toLocaleString(undefined, {maximumFractionDigits: 0})}</td>
                    <td></td>
                    <td className="p-3 text-right font-bold text-lg">AVG PER PERSON:</td><td className="p-3 text-right font-bold text-2xl text-purple-300">{calculatedData.block3.perPerson.toLocaleString(undefined, {maximumFractionDigits: 0})}</td>
               </tr>
           </tbody>
      </table>

      {onUpdateQuotation && (
          <div className="flex justify-center py-8">
              <button onClick={handleProceed} className="bg-green-600 hover:bg-green-500 text-white text-xl font-bold py-4 px-12 rounded shadow-lg">✅ Okay to Proceed with Price</button>
          </div>
      )}
    </div>
  );
};

export default FinancialCalculator;
