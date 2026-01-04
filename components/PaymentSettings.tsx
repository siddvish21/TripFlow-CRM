
import React, { useState, useRef } from 'react';
import { PaymentBankDetails } from '../types';
import { parsePaymentImage } from '../services/geminiService';

interface PaymentSettingsProps {
    details: PaymentBankDetails;
    onSave: (details: PaymentBankDetails) => void;
    onClose: () => void;
    isSetupMode?: boolean;
}

const PaymentSettings: React.FC<PaymentSettingsProps> = ({ details, onSave, onClose, isSetupMode }) => {
    const [localDetails, setLocalDetails] = useState<PaymentBankDetails>(details);
    const [isProcessing, setIsProcessing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleChange = (field: keyof PaymentBankDetails, value: string) => {
        setLocalDetails(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = () => {
        onSave(localDetails);
        onClose();
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsProcessing(true);
        try {
            const extracted = await parsePaymentImage(file);
            setLocalDetails(prev => ({
                ...prev,
                ...extracted
            }));
            alert("Payment details extracted successfully! Please review and save.");
        } catch (error) {
            console.error(error);
            alert("Failed to extract details from image.");
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center z-[200] p-4">
            <div className="bg-slate-900 rounded-[32px] w-full max-w-2xl border border-white/10 shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-600 via-indigo-500 to-cyan-500"></div>
                
                <div className="p-8 border-b border-white/5 flex justify-between items-center bg-slate-900/50">
                    <div>
                        <h3 className="text-3xl font-black text-white tracking-tight">
                            {isSetupMode ? "Setup Agency " : "Agency & "} 
                            <span className="text-blue-500">{isSetupMode ? "Profile" : "Branding"}</span>
                        </h3>
                        <p className="text-gray-400 text-sm mt-1">
                            {isSetupMode ? "Welcome! Please set your company and payment details to begin." : "Configure your agency branding and bank transfer details."}
                        </p>
                    </div>
                    {!isSetupMode && (
                        <button onClick={onClose} className="bg-white/5 hover:bg-white/10 p-2.5 rounded-2xl transition-all">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>

                <div className="overflow-y-auto p-8 custom-scrollbar">
                    <div className="mb-10 text-center">
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleImageUpload} 
                            className="hidden" 
                            accept="image/*" 
                        />
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isProcessing}
                            className={`w-full py-8 border-2 border-dashed rounded-[32px] transition-all flex flex-col items-center justify-center gap-4 group ${
                                isProcessing 
                                ? 'border-blue-500/50 bg-blue-500/5' 
                                : 'border-white/10 bg-white/5 hover:border-blue-500/50 hover:bg-blue-500/5'
                            }`}
                        >
                            {isProcessing ? (
                                <>
                                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                    <span className="text-blue-400 font-black uppercase tracking-widest text-sm">AI is Reading your Image...</span>
                                </>
                            ) : (
                                <>
                                    <div className="w-16 h-16 bg-blue-600/20 text-blue-500 rounded-3xl flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
                                        📸
                                    </div>
                                    <div className="text-center">
                                        <p className="text-white font-bold text-lg">Snap & Auto-Fill</p>
                                        <p className="text-gray-500 text-xs mt-1">Upload a screenshot of your bank details to OCR</p>
                                    </div>
                                </>
                            )}
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2 md:col-span-2 p-1 bg-blue-500/10 rounded-2xl border border-blue-500/30">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 ml-3">✨ Company Name (Branding)</label>
                            <input 
                                type="text"
                                value={localDetails.companyName}
                                onChange={(e) => handleChange('companyName', e.target.value)}
                                className="w-full bg-slate-800/50 border border-blue-500/20 p-4 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all font-bold placeholder:text-gray-600"
                                placeholder="e.g. Dream Travels"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 ml-1">Account Holder</label>
                            <input 
                                type="text"
                                value={localDetails.accountHolder}
                                onChange={(e) => handleChange('accountHolder', e.target.value)}
                                className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-white focus:outline-none focus:border-blue-500 transition-all font-medium"
                                placeholder="Business or Name"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 ml-1">Bank Name</label>
                            <input 
                                type="text"
                                value={localDetails.bankName}
                                onChange={(e) => handleChange('bankName', e.target.value)}
                                className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-white focus:outline-none focus:border-blue-500 transition-all font-medium"
                                placeholder="e.g. HDFC Bank"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 ml-1">Account Number</label>
                            <input 
                                type="text"
                                value={localDetails.accountNumber}
                                onChange={(e) => handleChange('accountNumber', e.target.value)}
                                className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-white focus:outline-none focus:border-blue-500 transition-all font-medium font-mono"
                                placeholder="0000 0000 0000"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 ml-1">IFSC Code</label>
                            <input 
                                type="text"
                                value={localDetails.ifscCode}
                                onChange={(e) => handleChange('ifscCode', e.target.value)}
                                className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-white focus:outline-none focus:border-blue-500 transition-all font-medium font-mono uppercase"
                                placeholder="HDFC0001234"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 ml-1">Account Type</label>
                            <select 
                                value={localDetails.accountType}
                                onChange={(e) => handleChange('accountType', e.target.value)}
                                className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-white focus:outline-none focus:border-blue-500 transition-all font-medium appearance-none"
                            >
                                <option value="Current Account" className="bg-slate-900">Current Account</option>
                                <option value="Savings Account" className="bg-slate-900">Savings Account</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 ml-1">GPay / WhatsApp Pay</label>
                            <input 
                                type="text"
                                value={localDetails.gpayNumber}
                                onChange={(e) => handleChange('gpayNumber', e.target.value)}
                                className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-white focus:outline-none focus:border-blue-500 transition-all font-medium"
                                placeholder="+91 8884016046"
                            />
                        </div>
                    </div>
                </div>

                <div className="p-8 border-t border-white/5 bg-slate-900/50 flex gap-4">
                    <button 
                        onClick={onClose}
                        className="flex-1 py-4 text-gray-400 hover:text-white font-bold transition-all"
                    >
                        {isSetupMode ? "Skip for Now" : "Cancel"}
                    </button>
                    <button 
                        onClick={handleSave}
                        className="flex-[2] bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest py-4 rounded-2xl shadow-xl shadow-blue-900/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                        <span>{isSetupMode ? "🚀 Get Started" : "💾 Save Profile & Branding"}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PaymentSettings;
