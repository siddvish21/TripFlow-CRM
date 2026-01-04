
import React, { useMemo, useState } from 'react';
import { PaymentState, PaymentSnapshot } from '../types';
import PaymentLedger from './PaymentLedger';
import { generatePaymentReminder } from '../services/geminiService';

interface PaymentSummaryProps {
    clientName?: string;
    destination?: string;
    state: PaymentState;
    onChange: (newState: PaymentState) => void;
}

const PaymentSummary: React.FC<PaymentSummaryProps> = ({ clientName, destination, state, onChange }) => {
  const [isGeneratingReminder, setIsGeneratingReminder] = useState(false);
  const [reminderModalOpen, setReminderModalOpen] = useState(false);
  const [reminderText, setReminderText] = useState('');

  const updateState = (field: keyof PaymentState, value: any) => {
      onChange({ ...state, [field]: value });
  };

  // Calculations
  const calculations = useMemo(() => {
      // 1. Amounts Received (Prioritize Ledger)
      let receivedParts: number[] = [];
      let totalReceived = 0;
      let totalTransferredToVendor = 0;

      if (state.transactions && state.transactions.length > 0) {
          state.transactions.forEach(tx => {
              if (tx.type === 'Received from Client') {
                  receivedParts.push(tx.amount);
                  totalReceived += tx.amount;
              }
              if (tx.type === 'Paid to Vendor') {
                  totalTransferredToVendor += tx.amount;
              }
          });
      } else {
          // Fallback to legacy string input if no transactions
          receivedParts = (state.amountsReceivedStr || '').split('+').map(s => {
              const cleanStr = s.replace(/[^0-9.-]/g, ''); 
              return parseFloat(cleanStr) || 0;
          });
          totalReceived = receivedParts.reduce((a, b) => a + b, 0);
          totalTransferredToVendor = state.amountTransferredToVendor || 0;
      }
      
      // 2. Flights
      const flightMargin = (state.flightClientCost || 0) - (state.flightVendorCost || 0);
      
      // 3. Package Reverse Calculation
      const netPkg = state.netPackageReceivable || 0;
      
      const isTCSApplicable = state.isTCSApplicable !== false; 
      const gstRate = 0.05;
      const tcsRate = isTCSApplicable ? 0.05 : 0;
      
      const divider = (1 + gstRate) * (1 + tcsRate); 
      
      const packageBaseCost = netPkg / divider;
      const gstAmount = packageBaseCost * gstRate;
      const tcsAmount = (packageBaseCost + gstAmount) * tcsRate;
      
      const packageMargin = packageBaseCost - (state.packageVendorCost || 0);
      
      // 4. Totals
      const netReceivable = (state.flightClientCost || 0) + netPkg;
      const balance = netReceivable - totalReceived;
      
      return {
          receivedParts,
          totalReceived,
          totalTransferredToVendor,
          flightMargin,
          packageBaseCost,
          gstAmount,
          tcsAmount,
          packageMargin,
          netReceivable,
          balance,
          isTCSApplicable
      };
  }, [state]);

  const generateSummary = () => {
    const { 
        receivedParts, totalReceived, totalTransferredToVendor, flightMargin, 
        packageBaseCost, gstAmount, tcsAmount, 
        packageMargin, netReceivable, balance, isTCSApplicable 
    } = calculations;

    const receivedString = receivedParts.filter(p => p > 0).map(p => `₹${p.toLocaleString('en-IN')}`).join(' + ');

    let taxBreakdown = `- Base: ₹${Math.round(packageBaseCost).toLocaleString('en-IN')}\n- GST @5%: ₹${Math.round(gstAmount).toLocaleString('en-IN')}`;
    if (isTCSApplicable) {
        taxBreakdown += `\n- TCS @5%: ₹${Math.round(tcsAmount).toLocaleString('en-IN')}`;
    }

    return `✈ ${destination || 'Trip'} – Payment Summary
👤 Client: ${clientName || 'Guest'}

💰 Amounts Received

${receivedString} = ₹ ${totalReceived.toLocaleString('en-IN')}

✅ NET AMOUNT RECEIVABLE FROM CLIENT : ₹ ${Math.round(netReceivable).toLocaleString('en-IN')}
✅ Total Received: ₹ ${totalReceived.toLocaleString('en-IN')}
✅ Balance to be Received: ₹ ${Math.round(balance).toLocaleString('en-IN')}

🧾 Payments Made

- Flights: Paid ₹ ${(state.flightVendorCost || 0).toLocaleString('en-IN')} /-
- Flights Charged to Client ₹${(state.flightClientCost || 0).toLocaleString('en-IN')} /- (Margin = ₹${flightMargin.toLocaleString('en-IN')})

- NET PAYABLE to Vendor :₹ ${(state.packageVendorCost || 0).toLocaleString('en-IN')}
- Package Transferred to Vendor : ₹ ${totalTransferredToVendor.toLocaleString('en-IN')} /-

📦 Package Cost Charged

${taxBreakdown}
- NET Package Charged: ₹${(state.netPackageReceivable || 0).toLocaleString('en-IN')} /-

📊 Markup Summary

- Package Markup: ₹${Math.round(packageMargin).toLocaleString('en-IN')} /-
- Flight Markup: ₹${Math.round(flightMargin).toLocaleString('en-IN')} /-`;
  };

  const handleGenerateSummary = () => {
      const text = generateSummary();
      updateState('generatedText', text);
  }

  const handleGenerateReminder = async () => {
      setIsGeneratingReminder(true);
      try {
          const text = await generatePaymentReminder(clientName || 'Guest', calculations.balance, destination || 'Trip');
          setReminderText(text);
          setReminderModalOpen(true);
      } catch (e) {
          alert("Failed to generate reminder.");
      } finally {
          setIsGeneratingReminder(false);
      }
  }

  // --- Snapshot Logic ---
  const handleSaveSnapshot = () => {
      const currentHistory = state.history || [];
      const nextRevNumber = currentHistory.length + 1;
      
      const { history, ...currentDataWithoutHistory } = state;

      const newSnapshot: PaymentSnapshot = {
          id: Date.now().toString(),
          revision: `R${nextRevNumber}`,
          timestamp: Date.now(),
          data: currentDataWithoutHistory
      };

      onChange({
          ...state,
          history: [newSnapshot, ...currentHistory]
      });
      alert(`Saved as Revision ${newSnapshot.revision}`);
  };

  const handleRestoreSnapshot = (snapshot: PaymentSnapshot) => {
      if (confirm(`Restore data from ${snapshot.revision} (${new Date(snapshot.timestamp).toLocaleString()})? Current unsaved changes will be lost.`)) {
          onChange({
              ...snapshot.data,
              history: state.history // Keep history intact
          });
      }
  };

  const handleDeleteSnapshot = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if(confirm("Are you sure you want to delete this record?")) {
        const newHistory = (state.history || []).filter(h => h.id !== id);
        onChange({ ...state, history: newHistory });
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="flex justify-between items-center mb-6">
             <h2 className="text-xl font-bold text-gray-300">💰 Payment Summary Generator</h2>
             <button 
                onClick={handleSaveSnapshot}
                className="bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 px-4 rounded flex items-center text-sm"
             >
                💾 Save Record
             </button>
        </div>
        
        {/* LEDGER COMPONENT */}
        <PaymentLedger state={state} onChange={onChange} />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Main Input Section */}
            <div className="lg:col-span-8 space-y-6">
                
                {/* ... (Existing Inputs like Flights/Package) ... */}
                
                <h3 className="text-sm font-bold text-blue-400">✈️ Flights</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">Vendor Cost (Paid)</label>
                        <input type="number" value={state.flightVendorCost || ''} onChange={e => updateState('flightVendorCost', parseFloat(e.target.value))} className="w-full bg-gray-700 text-white p-2 rounded border border-gray-600" />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">Client Price (Charged)</label>
                        <input type="number" value={state.flightClientCost || ''} onChange={e => updateState('flightClientCost', parseFloat(e.target.value))} className="w-full bg-gray-700 text-white p-2 rounded border border-gray-600" />
                    </div>
                </div>
                <p className="text-xs text-gray-500 text-right">Flight Margin: ₹{calculations.flightMargin.toLocaleString('en-IN')}</p>

                <hr className="border-gray-700" />

                <h3 className="text-sm font-bold text-green-400">📦 Land Package</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">Net Payable to Vendor</label>
                        <input type="number" value={state.packageVendorCost || ''} onChange={e => updateState('packageVendorCost', parseFloat(e.target.value))} className="w-full bg-gray-700 text-white p-2 rounded border border-gray-600" />
                    </div>
                    <div>
                        {/* Read Only - Calculated from Ledger */}
                        <label className="block text-xs text-gray-400 mb-1">Amount Transferred to Vendor (Ledger)</label>
                        <input type="number" value={calculations.totalTransferredToVendor} disabled className="w-full bg-gray-700/50 text-gray-400 p-2 rounded border border-gray-600" />
                    </div>
                </div>
                
                <div className="mt-2 p-3 bg-gray-900/50 rounded border border-gray-700">
                    <label className="block text-xs text-yellow-400 mb-1">Net Package Cost (Inc. Taxes - Receivable from Client)</label>
                    <input type="number" value={state.netPackageReceivable || ''} onChange={e => updateState('netPackageReceivable', parseFloat(e.target.value))} className="w-full bg-gray-700 text-white p-2 rounded border border-yellow-600 mb-2" />
                    
                    <div className="flex items-center gap-2 mb-2">
                        <input 
                            type="checkbox" 
                            id="applyTcs"
                            checked={state.isTCSApplicable !== false} 
                            onChange={e => updateState('isTCSApplicable', e.target.checked)}
                            className="w-4 h-4 text-blue-600 rounded bg-gray-700 border-gray-600"
                        />
                        <label htmlFor="applyTcs" className="text-xs text-gray-300">Apply 5% TCS (Uncheck for Domestic)</label>
                    </div>

                    <p className="text-xs text-gray-500 font-mono">
                        Base: ₹{Math.round(calculations.packageBaseCost).toLocaleString('en-IN')} | 
                        GST (5%): ₹{Math.round(calculations.gstAmount).toLocaleString('en-IN')}
                        {calculations.isTCSApplicable && ` | TCS (5%): ₹${Math.round(calculations.tcsAmount).toLocaleString('en-IN')}`}
                    </p>
                </div>

                 <p className="text-xs text-gray-500 text-right mt-2">Pkg Margin: ₹{Math.round(calculations.packageMargin).toLocaleString('en-IN')}</p>

                 <div className="flex gap-4 mt-4">
                     <button 
                        onClick={handleGenerateSummary}
                        className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded"
                     >
                        Generate Summary
                     </button>
                     <button
                        onClick={handleGenerateReminder}
                        disabled={isGeneratingReminder}
                        className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded flex items-center justify-center gap-2"
                     >
                         {isGeneratingReminder ? 'Thinking...' : '⚡ Generate Reminder'}
                     </button>
                 </div>

                 <div className="relative bg-gray-900 p-4 rounded border border-gray-700 min-h-[200px]">
                    {state.generatedText ? (
                        <pre className="whitespace-pre-wrap font-sans text-gray-300 text-sm leading-relaxed">
                            {state.generatedText}
                        </pre>
                    ) : (
                        <div className="h-full flex items-center justify-center text-gray-500 italic">
                            Summary will appear here...
                        </div>
                    )}
                 </div>
            </div>
            
            {/* Sidebar: History */}
            <div className="lg:col-span-4 border-l border-gray-700 pl-6">
                <h3 className="text-sm font-bold text-gray-400 uppercase mb-4">Payment Records / History</h3>
                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                    {state.history && state.history.length > 0 ? (
                        state.history.map((snap) => (
                            <div key={snap.id} className="bg-gray-700 p-3 rounded border border-gray-600 hover:bg-gray-600 transition-colors relative group">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="font-bold text-white">{snap.revision}</span>
                                    <div className="flex gap-2">
                                        <span className="text-xs text-gray-400">{new Date(snap.timestamp).toLocaleDateString()}</span>
                                        <button 
                                            onClick={(e) => handleDeleteSnapshot(e, snap.id)}
                                            className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                            title="Delete Record"
                                        >
                                             <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                                <div className="text-xs text-gray-300 space-y-1 mb-2">
                                    <p>Rec: {snap.data.amountsReceivedStr}</p>
                                    <p>Net Pkg: ₹{snap.data.netPackageReceivable}</p>
                                </div>
                                <button 
                                    onClick={() => handleRestoreSnapshot(snap)}
                                    className="w-full py-1 bg-blue-900/50 hover:bg-blue-800 text-blue-200 text-xs rounded"
                                >
                                    Restore / View
                                </button>
                            </div>
                        ))
                    ) : (
                        <p className="text-gray-500 text-sm italic">No saved records yet.</p>
                    )}
                </div>
            </div>

        </div>

        {/* Reminder Modal */}
        {reminderModalOpen && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                <div className="bg-gray-800 rounded-lg p-6 max-w-lg w-full border border-green-500">
                    <h3 className="text-xl font-bold text-green-400 mb-4">💬 AI Payment Reminder</h3>
                    <textarea 
                        className="w-full bg-gray-900 text-white p-3 rounded h-32 text-sm border border-gray-600 mb-4"
                        value={reminderText}
                        onChange={(e) => setReminderText(e.target.value)}
                    />
                    <div className="flex justify-end gap-2">
                        <button onClick={() => setReminderModalOpen(false)} className="px-4 py-2 text-gray-400">Close</button>
                        <button 
                            onClick={() => { navigator.clipboard.writeText(reminderText); alert("Copied!"); }}
                            className="bg-green-600 text-white px-4 py-2 rounded font-bold"
                        >
                            Copy to Clipboard
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default PaymentSummary;
