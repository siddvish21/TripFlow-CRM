import React, { useState, useRef, useMemo } from 'react';
import { QuotationData, PaymentState } from '../types';
import html2canvas from 'html2canvas';

interface PaymentReceiptGeneratorProps {
    quotationData: QuotationData | null;
    paymentState: PaymentState;
    clientName?: string;
    onSyncName?: () => void;
}

const PaymentReceiptGenerator: React.FC<PaymentReceiptGeneratorProps> = ({ quotationData, paymentState, clientName, onSyncName }) => {
    // --- State for Receipt Details ---
    const [selectedTxId, setSelectedTxId] = useState<string>('');
    const [customerName, setCustomerName] = useState(quotationData?.customerName || '');
    const [currentAmount, setCurrentAmount] = useState<number>(0);
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
    const [paymentMode, setPaymentMode] = useState('Bank Transfer');
    const [transactionRef, setTransactionRef] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    // Filter Ledger for Receipts
    const receivableTransactions = useMemo(() =>
        (paymentState.transactions || []).filter(t => t.type === 'Received from Client'),
        [paymentState.transactions]);

    // Handle Transaction Selection
    const handleTxSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const id = e.target.value;
        setSelectedTxId(id);

        if (id) {
            const tx = receivableTransactions.find(t => t.id === id);
            if (tx) {
                setCurrentAmount(tx.amount);
                setPaymentDate(tx.date);
                setPaymentMode(tx.mode);
                setTransactionRef(tx.notes || '');
            }
        } else {
            // Reset to default "New" state
            setCurrentAmount(0);
            setPaymentDate(new Date().toISOString().split('T')[0]);
            setPaymentMode('Bank Transfer');
            setTransactionRef('');
        }
    };

    // --- Calculated Totals ---
    const stats = useMemo(() => {
        // Total Cost is derived from Payment Ledger settings (Package + Flights)
        const totalTripCost = (paymentState.netPackageReceivable || 0) + (paymentState.flightClientCost || 0);

        let totalReceivedIncludingThis = 0;

        if (selectedTxId) {
            // CASE A: Viewing/Editing a HISTORICAL transaction
            // We want the snapshot of finances *at that time*.
            // Logic: Sum of all payments made BEFORE this one + This one (currentAmount state).
            // We assume IDs are chronological (Date.now()).

            const previousPaymentsSum = receivableTransactions
                .filter(t => t.id < selectedTxId)
                .reduce((sum, t) => sum + t.amount, 0);

            totalReceivedIncludingThis = previousPaymentsSum + (currentAmount || 0);

        } else {
            // CASE B: Creating a NEW transaction (Preview mode)
            // Logic: Sum of ALL existing payments + This new one (currentAmount state).
            const allExistingSum = receivableTransactions.reduce((sum, t) => sum + t.amount, 0);
            totalReceivedIncludingThis = allExistingSum + (currentAmount || 0);
        }

        const balancePending = totalTripCost - totalReceivedIncludingThis;

        return {
            totalTripCost,
            totalReceivedIncludingThis,
            balancePending
        };
    }, [paymentState, currentAmount, selectedTxId, receivableTransactions]);

    const receiptRef = useRef<HTMLDivElement>(null);

    const handleDownload = async () => {
        if (!receiptRef.current) return;
        setIsGenerating(true);
        try {
            const canvas = await html2canvas(receiptRef.current, {
                useCORS: true,
                scale: 2,
                backgroundColor: '#ffffff'
            });

            const link = document.createElement('a');
            link.download = `Receipt_${customerName.replace(/\s+/g, '_')}_${paymentDate}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (e) {
            console.error("Receipt generation failed:", e);
            alert("Failed to generate receipt image. Check console.");
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="flex flex-col lg:flex-row h-full gap-6 p-4">

            {/* LEFT: Input Controls */}
            <div className="w-full lg:w-1/3 bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700 h-fit overflow-y-auto">
                <h2 className="text-xl font-bold text-blue-400 mb-6 flex items-center gap-2">
                    🧾 Receipt Generator
                </h2>

                <div className="space-y-4">
                    {/* Transaction Selector */}
                    <div className="bg-gray-900/50 p-3 rounded border border-gray-600 mb-4">
                        <label className="block text-xs text-yellow-400 font-bold mb-1">Select from Ledger (Optional)</label>
                        <select
                            value={selectedTxId}
                            onChange={handleTxSelect}
                            className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-sm"
                        >
                            <option value="">-- Create New Receipt --</option>
                            {receivableTransactions.map(tx => (
                                <option key={tx.id} value={tx.id}>
                                    {tx.date} - ₹{tx.amount} ({tx.mode})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="block text-xs text-gray-400">Customer Name</label>
                            {clientName && onSyncName && clientName.trim() !== customerName.trim() && (
                                <button
                                    onClick={() => {
                                        onSyncName();
                                        setCustomerName(clientName);
                                    }}
                                    className="text-[10px] bg-blue-900 hover:bg-blue-800 text-blue-200 px-2 py-0.5 rounded border border-blue-700 transition flex items-center gap-1"
                                    title={`Sync name to "${clientName}"`}
                                >
                                    🔄 Sync to "{clientName}"
                                </button>
                            )}
                        </div>
                        <input
                            type="text"
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white"
                        />
                    </div>

                    <div>
                        <label className="block text-xs text-gray-400 mb-1">Amount Received (₹)</label>
                        <input
                            type="number"
                            value={currentAmount || ''}
                            onChange={(e) => {
                                // If editing an existing tx, we update local state only for preview
                                setCurrentAmount(parseFloat(e.target.value));
                            }}
                            className="w-full bg-gray-900 border border-green-600 rounded p-2 text-white font-bold text-lg"
                            placeholder="0"
                        />
                        {selectedTxId && <p className="text-[10px] text-gray-500 mt-1 italic">Editing this value only changes the receipt preview, not the ledger.</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">Date</label>
                            <input
                                type="date"
                                value={paymentDate}
                                onChange={(e) => setPaymentDate(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">Mode</label>
                            <select
                                value={paymentMode}
                                onChange={(e) => setPaymentMode(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white"
                            >
                                <option>Bank Transfer</option>
                                <option>UPI</option>
                                <option>Credit Card</option>
                                <option>Cash</option>
                                <option>Cheque</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs text-gray-400 mb-1">Transaction Ref / UTR (Optional)</label>
                        <input
                            type="text"
                            value={transactionRef}
                            onChange={(e) => setTransactionRef(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white"
                            placeholder="e.g. UPI-123456789"
                        />
                    </div>

                    <div className="pt-4 border-t border-gray-700">
                        <p className="text-xs text-gray-500 mb-2">Calculated Totals (Snapshot):</p>
                        <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-400">Total Trip Cost:</span>
                            <span className="text-white">₹{stats.totalTripCost.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-400">Total Received:</span>
                            <span className="text-green-400 font-bold">₹{stats.totalReceivedIncludingThis.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Pending Balance:</span>
                            <span className="text-red-400 font-bold">₹{Math.max(0, stats.balancePending).toLocaleString('en-IN')}</span>
                        </div>
                    </div>

                    <button
                        onClick={handleDownload}
                        disabled={isGenerating || !currentAmount}
                        className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 text-white font-bold py-3 rounded-lg shadow-lg flex justify-center items-center gap-2 mt-4"
                    >
                        {isGenerating ? 'Processing...' : '⬇️ Download Receipt Image'}
                    </button>
                </div>
            </div>

            {/* RIGHT: Live Preview (The Card to be Printed) */}
            <div className="flex-1 bg-gray-900 rounded-lg flex items-center justify-center p-8 overflow-auto border border-gray-800">

                {/* 
                    This div (receiptRef) is what gets converted to image. 
                    Using white background and specific dimensions for a "Card" look.
                */}
                <div
                    ref={receiptRef}
                    id="receipt-preview"
                    className="bg-white text-gray-900 w-[600px] min-h-[700px] rounded-xl shadow-2xl overflow-hidden relative flex flex-col font-sans"
                >
                    {/* Header Border Strip (Image Removed) */}
                    <div className="w-full h-2 bg-yellow-400"></div>

                    {/* Content Body */}
                    <div className="p-8 flex-1 flex flex-col">

                        {/* Title Section */}
                        <div className="flex justify-between items-center mb-8 border-b border-gray-200 pb-4">
                            <h1 className="text-3xl font-bold text-gray-800 uppercase tracking-wide">Payment Receipt</h1>
                            <div className="text-right">
                                <p className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-1">Date</p>
                                <p className="text-lg font-bold text-gray-800">{new Date(paymentDate).toLocaleDateString('en-GB')}</p>
                            </div>
                        </div>

                        <div className="flex justify-between items-start mb-8">
                            <div>
                                <p className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-1">Received From</p>
                                <h2 className="text-2xl font-bold text-blue-900">{customerName || 'Guest'}</h2>
                                <p className="text-sm text-gray-600 mt-1">
                                    {quotationData?.destination ? `Trip to ${quotationData.destination}` : 'Tour Package'}
                                </p>
                            </div>
                        </div>

                        {/* Payment Acknowledgement */}
                        <div className="bg-blue-50 border-l-4 border-blue-600 p-4 mb-8 rounded-r-lg">
                            <p className="text-gray-700 leading-relaxed italic">
                                "Dear <strong>{customerName || 'Guest'}</strong>, we gratefully acknowledge the receipt of your payment.
                                This amount has been successfully credited towards your travel booking."
                            </p>
                        </div>

                        {/* Transaction Details Table */}
                        <table className="w-full mb-8 border-collapse">
                            <tbody>
                                <tr className="border-b border-gray-200">
                                    <td className="py-3 text-gray-600 font-medium">Payment Amount</td>
                                    <td className="py-3 text-right text-2xl font-bold text-green-600">₹ {currentAmount.toLocaleString('en-IN')}</td>
                                </tr>
                                <tr className="border-b border-gray-200">
                                    <td className="py-3 text-gray-600">Payment Mode</td>
                                    <td className="py-3 text-right font-medium text-gray-800">{paymentMode}</td>
                                </tr>
                                {transactionRef && (
                                    <tr className="border-b border-gray-200">
                                        <td className="py-3 text-gray-600">Transaction Ref / UTR</td>
                                        <td className="py-3 text-right font-mono text-gray-700">{transactionRef}</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>

                        {/* Account Summary Box - Vertical Stack (Template 1 Style) */}
                        <div className="mt-auto border-t-2 border-dashed border-gray-300 pt-6">
                            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4">Financial Status</h3>
                            <div className="flex flex-col gap-2">
                                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-200">
                                    <span className="text-gray-600 font-medium">Total Trip Value</span>
                                    <span className="text-gray-900 font-bold text-lg">₹ {stats.totalTripCost.toLocaleString('en-IN')}</span>
                                </div>

                                <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg border border-green-200">
                                    <span className="text-green-700 font-medium">Total Received (Up to this Payment)</span>
                                    <span className="text-green-800 font-bold text-lg">₹ {stats.totalReceivedIncludingThis.toLocaleString('en-IN')}</span>
                                </div>

                                <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg border border-red-200">
                                    <span className="text-red-700 font-medium">Balance Due</span>
                                    <span className="text-red-800 font-bold text-xl">₹ {Math.max(0, stats.balancePending).toLocaleString('en-IN')}</span>
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* Footer - CLEAN TRIPEXPLORE SIGNATURE (Removed Vishwa details) */}
                    <div className="bg-gray-50 border-t border-gray-200 p-8">
                        <div className="flex justify-between items-end">
                            <div>
                                <h2 className="text-xl font-bold text-[#003366] tracking-tight">TripExplore</h2>
                                <p className="text-xs text-gray-500 font-medium">Your Trusted Travel Partner</p>
                            </div>
                            <div className="text-right">
                                {/* Signature Line */}
                                <div className="w-40 border-b border-gray-400 mb-2"></div>
                                <p className="text-sm font-bold text-gray-600">Authorized Signatory</p>
                            </div>
                        </div>
                        <div className="mt-4 pt-2 text-center">
                            <p className="text-[10px] text-gray-400 italic">This is a computer generated receipt and does not require a signature.</p>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default PaymentReceiptGenerator;
