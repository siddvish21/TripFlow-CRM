
import React, { useState, useMemo } from 'react';
import { PaymentState, PaymentTransaction } from '../types';

interface PaymentLedgerProps {
    state: PaymentState;
    onChange: (newState: PaymentState) => void;
}

const PaymentLedger: React.FC<PaymentLedgerProps> = ({ state, onChange }) => {
    const [newTx, setNewTx] = useState<Partial<PaymentTransaction>>({
        date: new Date().toISOString().split('T')[0],
        type: 'Received from Client',
        amount: 0,
        mode: 'Bank Transfer',
        notes: ''
    });

    // --- Statistics Calculation ---
    const stats = useMemo(() => {
        const txs = state.transactions || [];
        return txs.reduce((acc, tx) => {
            if (tx.type === 'Received from Client') {
                acc.received += tx.amount;
            } else {
                // Paid to Vendor, Paid for Flight, Refund
                acc.paidOut += tx.amount;
            }
            return acc;
        }, { received: 0, paidOut: 0 });
    }, [state.transactions]);

    const balanceWithUs = stats.received - stats.paidOut;

    const addTransaction = () => {
        if (!newTx.amount || !newTx.type) return alert("Amount and Type are required");
        
        const transaction: PaymentTransaction = {
            id: Date.now().toString(),
            date: newTx.date!,
            type: newTx.type!,
            amount: Number(newTx.amount),
            mode: newTx.mode!,
            notes: newTx.notes || ''
        };

        const updatedTransactions = [transaction, ...(state.transactions || [])];
        
        // Auto-update legacy fields for compatibility
        let totalReceived = 0;
        let totalPaidVendor = 0;
        
        updatedTransactions.forEach(t => {
            if (t.type === 'Received from Client') totalReceived += t.amount;
            if (t.type === 'Paid to Vendor') totalPaidVendor += t.amount;
        });

        onChange({
            ...state,
            transactions: updatedTransactions,
            amountTransferredToVendor: totalPaidVendor
        });

        setNewTx({
             date: new Date().toISOString().split('T')[0],
             type: 'Received from Client',
             amount: 0,
             mode: 'Bank Transfer',
             notes: ''
        });
    };

    const deleteTransaction = (id: string) => {
        if(!confirm("Delete this transaction?")) return;
        const updatedTransactions = state.transactions.filter(t => t.id !== id);
        onChange({ ...state, transactions: updatedTransactions });
    };

    return (
        <div className="bg-gray-800 rounded-lg shadow-lg p-6 mb-6 border border-gray-700">
            <h3 className="text-lg font-bold text-gray-200 mb-4">📖 Payment Ledger</h3>

            {/* --- BALANCE STATS CARDS --- */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-gray-900 border border-gray-600 p-4 rounded-lg flex flex-col items-center">
                    <span className="text-gray-400 text-xs uppercase tracking-wider mb-1">Total Received</span>
                    <span className="text-2xl font-bold text-green-400">₹{stats.received.toLocaleString('en-IN')}</span>
                </div>
                <div className="bg-gray-900 border border-gray-600 p-4 rounded-lg flex flex-col items-center">
                    <span className="text-gray-400 text-xs uppercase tracking-wider mb-1">Total Paid Out</span>
                    <span className="text-2xl font-bold text-red-400">₹{stats.paidOut.toLocaleString('en-IN')}</span>
                    <span className="text-[10px] text-gray-500">(Vendors + Flights + Refunds)</span>
                </div>
                <div className="bg-gray-900 border border-gray-600 p-4 rounded-lg flex flex-col items-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                    <span className="text-gray-400 text-xs uppercase tracking-wider mb-1">Balance With Us</span>
                    <span className={`text-2xl font-bold ${balanceWithUs >= 0 ? 'text-blue-400' : 'text-red-500'}`}>
                        ₹{balanceWithUs.toLocaleString('en-IN')}
                    </span>
                    <span className="text-[10px] text-gray-500">(Cash Flow in Hand)</span>
                </div>
            </div>
            
            {/* Add New Transaction */}
            <div className="grid grid-cols-1 md:grid-cols-6 gap-3 mb-6 bg-gray-900/50 p-4 rounded border border-gray-600">
                <div className="md:col-span-1">
                    <label className="block text-xs text-gray-400 mb-1">Date</label>
                    <input type="date" value={newTx.date} onChange={e => setNewTx({...newTx, date: e.target.value})} className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-sm text-white" />
                </div>
                <div className="md:col-span-1">
                    <label className="block text-xs text-gray-400 mb-1">Type</label>
                    <select value={newTx.type} onChange={e => setNewTx({...newTx, type: e.target.value as any})} className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-sm text-white">
                        <option>Received from Client</option>
                        <option>Paid to Vendor</option>
                        <option>Paid for Flight</option>
                        <option>Refund</option>
                    </select>
                </div>
                <div className="md:col-span-1">
                    <label className="block text-xs text-gray-400 mb-1">Amount (₹)</label>
                    <input type="number" value={newTx.amount || ''} onChange={e => setNewTx({...newTx, amount: parseFloat(e.target.value)})} className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-sm text-white" placeholder="0" />
                </div>
                <div className="md:col-span-1">
                    <label className="block text-xs text-gray-400 mb-1">Mode</label>
                    <select value={newTx.mode} onChange={e => setNewTx({...newTx, mode: e.target.value as any})} className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-sm text-white">
                        <option>Bank Transfer</option>
                        <option>UPI</option>
                        <option>Cash</option>
                        <option>Credit Card</option>
                    </select>
                </div>
                <div className="md:col-span-1">
                    <label className="block text-xs text-gray-400 mb-1">Notes</label>
                    <input type="text" value={newTx.notes} onChange={e => setNewTx({...newTx, notes: e.target.value})} className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-sm text-white" placeholder="Ref ID..." />
                </div>
                <div className="md:col-span-1 flex items-end">
                    <button onClick={addTransaction} className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-2 rounded text-sm">+ Add</button>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto max-h-[400px]">
                <table className="w-full text-left border-collapse text-sm">
                    <thead className="sticky top-0 bg-gray-700 z-10">
                        <tr className="text-gray-300">
                            <th className="p-3 border-b border-gray-600">Date</th>
                            <th className="p-3 border-b border-gray-600">Type</th>
                            <th className="p-3 border-b border-gray-600">Mode</th>
                            <th className="p-3 border-b border-gray-600">Notes</th>
                            <th className="p-3 border-b border-gray-600 text-right">Amount</th>
                            <th className="p-3 border-b border-gray-600"></th>
                        </tr>
                    </thead>
                    <tbody className="text-gray-300">
                        {state.transactions && state.transactions.length > 0 ? (
                            state.transactions.map(tx => (
                                <tr key={tx.id} className="border-b border-gray-700 hover:bg-gray-700/50">
                                    <td className="p-3">{tx.date}</td>
                                    <td className="p-3">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                                            tx.type === 'Received from Client' ? 'bg-green-900 text-green-300' :
                                            tx.type === 'Paid to Vendor' ? 'bg-blue-900 text-blue-300' :
                                            tx.type === 'Paid for Flight' ? 'bg-yellow-900 text-yellow-300' :
                                            'bg-red-900 text-red-300'
                                        }`}>
                                            {tx.type}
                                        </span>
                                    </td>
                                    <td className="p-3">{tx.mode}</td>
                                    <td className="p-3 text-gray-500 italic">{tx.notes}</td>
                                    <td className="p-3 text-right font-mono">₹{tx.amount.toLocaleString('en-IN')}</td>
                                    <td className="p-3 text-right">
                                        <button onClick={() => deleteTransaction(tx.id)} className="text-red-500 hover:text-red-400">✕</button>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={6} className="p-6 text-center text-gray-500 italic">No transactions recorded yet.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default PaymentLedger;
