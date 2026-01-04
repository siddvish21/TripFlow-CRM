
import React, { useState, useEffect, useMemo } from 'react';
import {
    QuotationData,
    CalculatorState,
    PaymentState,
    EmailState,
    Lead,
    VendorParsedData,
    FinancialBreakdown,
    QuotationSnapshot,
    FinancialOption
} from './types';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import QuotationForm from './components/QuotationForm';
import QuotationPreview from './components/QuotationPreview';
import FinancialCalculator from './components/FinancialCalculator';
import PaymentSummary from './components/PaymentSummary';
import VendorEmailGenerator from './components/VendorEmailGenerator';
import PaymentReceiptGenerator from './components/PaymentReceiptGenerator';
import QuotationAIAssistant from './components/QuotationAIAssistant';

import QuoteSummary from './components/QuoteSummary';
import { generateQuotationFromText, parseExistingQuotationText, parseFinancialImage } from './services/geminiService';
import { createDocx } from './services/docxGenerator';
import { generateFinancialExcel } from './services/excelGenerator';
import { dbService } from './services/dbService';
import { extractTextFromDocx } from './services/importService';
import { listFiles, findFolder, ensureFolderStructure } from './services/googleDriveService';
import FileSaver from 'file-saver';

// Initial States
const initialCalculatorState: CalculatorState = {
    configs: {
        block1: { pax: 2, markupPct: 0, gstPct: 5, tcsPct: 5 },
        block2: { pax: 2, markupPct: 0, gstPct: 5, tcsPct: 5 },
        block3: { pax: 2, markupPct: 0, gstPct: 5, tcsPct: 5 },
    },
    rows: [],
    addOnRows: [
        { id: 0, type: 'Flight', qty1: 0, netRate1: 0, markupPerPax1: 0, qty2: 0, netRate2: 0, markupPerPax2: 0, qty3: 0, netRate3: 0, markupPerPax3: 0 },
        { id: 1, type: 'Flight', qty1: 0, netRate1: 0, markupPerPax1: 0, qty2: 0, netRate2: 0, markupPerPax2: 0, qty3: 0, netRate3: 0, markupPerPax3: 0 },
        { id: 2, type: 'Visa', qty1: 0, netRate1: 0, markupPerPax1: 0, qty2: 0, netRate2: 0, markupPerPax2: 0, qty3: 0, netRate3: 0, markupPerPax3: 0 },
        { id: 3, type: 'Visa', qty1: 0, netRate1: 0, markupPerPax1: 0, qty2: 0, netRate2: 0, markupPerPax2: 0, qty3: 0, netRate3: 0, markupPerPax3: 0 },
    ],
    vendorText: '',
    detectedCurrency: 'INR',
    conversionRate: 1,
    aiParsedData: null
};

const initialPaymentState: PaymentState = {
    amountsReceivedStr: '',
    flightVendorCost: 0,
    flightClientCost: 0,
    packageVendorCost: 0,
    netPackageReceivable: 0,
    amountTransferredToVendor: 0,
    generatedText: '',
    transactions: [],
    history: []
};

const initialEmailState: EmailState = {
    recipient: '',
    subject: '',
    currentDraft: '',
    history: [],
    // linkedThreadId and cachedThread are undefined by default
};

const App: React.FC = () => {
    // Navigation & View State
    const [view, setView] = useState<'dashboard' | 'workspace'>('dashboard');
    const [activeTab, setActiveTab] = useState<'quotation' | 'financials' | 'payment' | 'receipt' | 'email' | 'summary' | 'templates'>('quotation');
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Unsaved Changes and Modal State
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);

    // Data State
    const [leads, setLeads] = useState<Lead[]>([]);
    const [currentLead, setCurrentLead] = useState<Lead | null>(null);

    // Workspace State
    const [rawText, setRawText] = useState('');
    const [margin, setMargin] = useState(15);
    const [quotationData, setQuotationData] = useState<QuotationData | null>(null);
    const [financialState, setFinancialState] = useState<CalculatorState>(initialCalculatorState);
    const [paymentState, setPaymentState] = useState<PaymentState>(initialPaymentState);
    const [emailState, setEmailState] = useState<EmailState>(initialEmailState);

    // Data Flow State
    const [vendorAutoFill, setVendorAutoFill] = useState<VendorParsedData | null>(null);

    // --- Initialization ---
    useEffect(() => {
        loadLeads();
    }, []);

    const loadLeads = async () => {
        try {
            const data = await dbService.getLeads();
            setLeads(data);
        } catch (e) {
            console.error("Failed to load leads", e);
        }
    };

    // --- Lead Management ---

    const handleCreateLead = async (lead: Lead) => {
        try {
            const newLead = await dbService.createLead(lead);
            setLeads([newLead, ...leads]);
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleUpdateLead = async (lead: Lead) => {
        try {
            const updatedLead = await dbService.updateLead(lead);
            setLeads(leads.map(l => l.id === updatedLead.id ? updatedLead : l));
            // If the updated lead is the currently active one, update it in state too
            if (currentLead?.id === updatedLead.id) {
                setCurrentLead(updatedLead);
            }
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleDeleteLead = async (id: number) => {
        try {
            await dbService.deleteLead(id);
            setLeads(leads.filter(l => l.id !== id));
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleOpenLead = async (leadId: number) => {
        setIsLoading(true);
        setError(null);
        try {
            const lead = leads.find(l => l.id === leadId);
            if (lead) setCurrentLead(lead);

            const workspace = await dbService.getWorkspace(leadId);

            if (workspace) {
                setQuotationData(workspace.quotation);
                setFinancialState(workspace.financials || initialCalculatorState);
                setPaymentState(workspace.payment || initialPaymentState);
                setEmailState(workspace.email || initialEmailState);
            } else {
                setQuotationData(null);
                setFinancialState(initialCalculatorState);
                setPaymentState(initialPaymentState);
                setEmailState(initialEmailState);
                setRawText('');
            }

            setView('workspace');
            setActiveTab('quotation');
            setHasUnsavedChanges(false); // Reset on load
        } catch (e: any) {
            console.error(e);
            setError("Failed to load workspace.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleBackToDashboard = () => {
        if (hasUnsavedChanges) {
            setShowConfirmModal(true);
            return;
        }
        confirmBack();
    };

    const confirmBack = () => {
        setView('dashboard');
        setCurrentLead(null);
        setQuotationData(null);
        setHasUnsavedChanges(false);
        setShowConfirmModal(false);
    };

    const handleSaveWorkspace = async () => {
        if (!currentLead?.id) return;
        setIsSaving(true);
        try {
            const workspaceData = {
                quotation: quotationData,
                financials: financialState,
                payment: paymentState,
                email: emailState
            };

            // Determine status based on progress
            let status = currentLead.status;
            if (quotationData && status === 'New') status = 'Quoted';

            await dbService.saveWorkspace(currentLead.id, workspaceData, status);

            // Update local lead status
            setLeads(leads.map(l => l.id === currentLead.id ? { ...l, status: status } : l));

            setHasUnsavedChanges(false);
            // alert("Workspace saved!");
        } catch (e: any) {
            console.error(e);
            alert("Failed to save workspace.");
        } finally {
            setIsSaving(false);
        }
    };

    // --- Drive Sync ---
    const checkForDriveRevisions = async () => {
        if (!quotationData || !quotationData.customerName) return;
        setIsLoading(true);
        try {
            const root = await findFolder("TripFlow Quotations");
            if (!root) return; // Should exist if we saved before

            // Logic: 
            // 1. Try to find the client folder inside the "Destination" folder (New Structure)
            // 2. Fallback to finding it directly in the Root (Legacy / Uncategorized)

            let clientFolder = null;

            // A. Check Destination Subfolder
            const destinationName = quotationData.destination || "Uncategorized";
            const destFolder = await findFolder(destinationName, root.id);
            if (destFolder) {
                clientFolder = await findFolder(quotationData.customerName, destFolder.id);
            }

            // B. Fallback: Check Root
            if (!clientFolder) {
                clientFolder = await findFolder(quotationData.customerName, root.id);
            }

            if (!clientFolder) return;

            const files = await listFiles(clientFolder.id);
            // Filter out Valued Customer and maybe other non-relevant files
            const revisions = files
                .filter((f: any) => !f.name.includes("Valued Customer") && !f.trashed)
                .map((f: any) => ({
                    id: f.id,
                    name: f.name,
                    webViewLink: f.webViewLink,
                    createdTime: f.createdTime
                }));

            setQuotationData({
                ...quotationData,
                driveRevisions: revisions
            });
            alert(`Synced! Found ${revisions.length} files in Google Drive.`);
        } catch (e) {
            console.error("Drive Sync Error", e);
            alert("Failed to sync with Google Drive.");
        } finally {
            setIsLoading(false);
        }
    };


    // --- Logic: Quotation ---

    const handleGenerate = async () => {
        if (!rawText) {
            setError("Please enter some text");
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const data = await generateQuotationFromText(rawText);
            // Initialize quotation with basic calculation
            setQuotationData({
                ...data,
                vendorInput: rawText, // Save the raw input
                marginPercentage: margin,
                totalAmount: 0,
                amountReceived: 0,
                balanceAmount: 0,
                history: []
            });
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };


    const handleUpdateQuotation = (newData: QuotationData) => {
        setQuotationData(newData);
        setHasUnsavedChanges(true);
    };

    const handleDownloadDocx = async () => {
        if (!quotationData) return;
        try {
            const blob = await createDocx(quotationData);
            FileSaver.saveAs(blob, `${quotationData.customerName.replace(/\s+/g, '_')}.docx`);
        } catch (e) {
            console.error(e);
            alert("Failed to generate DOCX");
        }
    };

    const handleImport = async (docFile: File | null, imgFile: File | null) => {
        setIsLoading(true);
        try {
            // 1. Parse DOCX text if provided
            if (docFile) {
                const text = await extractTextFromDocx(docFile);
                // Store raw text for reference
                setRawText(text);

                // RESTORATION LOGIC:
                try {
                    const restoredData = await parseExistingQuotationText(text);

                    // Handle extractedNetCost correctly for totalAmount
                    let importedTotal = 0;
                    if (restoredData.financialBreakdown && restoredData.financialBreakdown.options.length > 0) {
                        const opt = restoredData.financialBreakdown.options[0];
                        const netPerPerson = opt.extractedNetCost || (opt.landBaseCost + opt.landGST + opt.landTCS);
                        importedTotal = Math.round((netPerPerson + opt.addOnCost) * restoredData.paxCount);
                    }

                    setQuotationData({
                        ...restoredData,
                        vendorInput: text, // Save the restored text as input
                        marginPercentage: margin,
                        totalAmount: importedTotal || restoredData.totalAmount || 0, // Fallback
                        amountReceived: 0,
                        balanceAmount: 0
                    });
                } catch (e) {
                    console.warn("Restoration from doc text failed, falling back to raw text only.", e);
                    alert("Could not fully structure the document data. Text has been loaded into the input box.");
                }
            }

            // 2. Process Financial Image (AI Vision)
            if (imgFile) {
                try {
                    // Call Vision AI service
                    const extractedFinancials = await parseFinancialImage(imgFile);

                    // Set to autofill state to trigger FinancialCalculator population
                    setVendorAutoFill(extractedFinancials);

                    // Switch to financial tab to show loaded data
                    setActiveTab('financials');
                    alert("Financial data extracted from image! Please review in the 'Financials' tab.");

                } catch (e) {
                    console.error(e);
                    alert("Failed to extract financials from image. Please ensure the image is clear.");
                }
            }

        } catch (e) {
            console.error(e);
            alert("Import failed.");
        } finally {
            setIsLoading(false);
        }
    };

    // --- Logic: Financials ---

    const handleUpdateFromFinancials = (breakdown: FinancialBreakdown) => {
        if (quotationData) {
            setQuotationData({
                ...quotationData,
                financialBreakdown: breakdown,
                // Update total amount based on first option by default
                totalAmount: breakdown.options[0]?.landBaseCost
                    ? Math.round((breakdown.options[0].landBaseCost + breakdown.options[0].landGST + breakdown.options[0].landTCS + breakdown.options[0].addOnCost) * quotationData.paxCount)
                    : quotationData.totalAmount
            });
            // Show user it's updated
            alert("Quotation updated with financial breakdown!");
        }
    };

    const handleDownloadExcel = async () => {
        if (currentLead) {
            const blob = await generateFinancialExcel(financialState, currentLead);
            FileSaver.saveAs(blob, `Financials_${currentLead.name.replace(/\s+/g, '_')}.xlsx`);
        }
    };

    // --- Logic: Revisions (History) ---

    const handleSaveRevision = () => {
        if (!quotationData) return;
        const history = quotationData.history || [];
        const newSnapshot: QuotationSnapshot = {
            id: Date.now().toString(),
            revision: `Rev ${history.length + 1}`,
            timestamp: Date.now(),
            data: { ...quotationData }, // Shallow copy excluding history
            linkedFinancials: financialState // Save financial state with quote
        };
        // Clean recursive history from data
        // @ts-ignore
        delete newSnapshot.data.history;

        setQuotationData({
            ...quotationData,
            history: [newSnapshot, ...history]
        });
        setHasUnsavedChanges(false);
    };

    const handleRestoreRevision = (snapshot: QuotationSnapshot) => {
        if (confirm(`Restore revision ${snapshot.revision}? Unsaved changes will be lost.`)) {
            setQuotationData({
                ...snapshot.data,
                history: quotationData?.history // Keep history array intact
            });
            if (snapshot.data.vendorInput) {
                setRawText(snapshot.data.vendorInput); // Restore the input box text
            }
            if (snapshot.linkedFinancials) {
                setFinancialState(snapshot.linkedFinancials);
            }
        }
    };

    const handleDeleteRevision = (id: string) => {
        if (!quotationData) return;
        const newHistory = (quotationData.history || []).filter(h => h.id !== id);
        setQuotationData({ ...quotationData, history: newHistory });
        setHasUnsavedChanges(true);
    };

    // --- Logic: Payment Sync ---
    const handleSyncPayment = () => {
        if (!quotationData) return;
        // Calculate totals from payment ledger
        let totalRec = 0;
        if (paymentState.transactions && paymentState.transactions.length > 0) {
            totalRec = paymentState.transactions
                .filter(t => t.type === 'Received from Client')
                .reduce((sum, t) => sum + t.amount, 0);
        } else {
            // fallback
            const parts = (paymentState.amountsReceivedStr || '').split('+');
            totalRec = parts.reduce((sum, p) => sum + (parseFloat(p) || 0), 0);
        }

        const balance = quotationData.totalAmount - totalRec;

        setQuotationData({
            ...quotationData,
            amountReceived: totalRec,
            balanceAmount: balance
        });
        setHasUnsavedChanges(true);
    };

    // --- Logic: Name Sync ---
    const handleSyncName = async () => {
        if (!quotationData || !currentLead || !currentLead.id) return;

        const newData = { ...quotationData, customerName: currentLead.name };
        setQuotationData(newData);

        // Immediate Save as requested
        setIsSaving(true);
        try {
            const workspaceData = {
                quotation: newData,
                financials: financialState,
                payment: paymentState,
                email: emailState
            };

            await dbService.saveWorkspace(currentLead.id, workspaceData, currentLead.status);
            setHasUnsavedChanges(false);
            // Optional: User feedback handled by UI state update or toast if existed
        } catch (e) {
            console.error("Sync Name Save Error", e);
            alert("Name synced locally, but failed to save to database.");
        } finally {
            setIsSaving(false);
        }
    };

    // --- Helpers ---
    const calculatedFinancialsForPreview = useMemo(() => {
        if (!quotationData) return [];

        // Use logic similar to docxGenerator to create display models for preview
        if (quotationData.financialBreakdown && quotationData.financialBreakdown.options.length > 0) {
            return quotationData.financialBreakdown.options.map((opt: FinancialOption) => {
                // CRITICAL FIX: Use extractedNetCost if available for exact restoration logic
                const netCostPerPerson = opt.extractedNetCost || (opt.landBaseCost + opt.landGST + opt.landTCS);

                const netPayable = Math.round((netCostPerPerson + opt.addOnCost) * quotationData.paxCount);
                return {
                    label: opt.label,
                    perPersonCost: Math.round(opt.landBaseCost),
                    gstAmount: Math.round(opt.landGST),
                    tcsAmount: Math.round(opt.landTCS),
                    netCostPerPerson: Math.round(netCostPerPerson),
                    addOnCost: Math.round(opt.addOnCost),
                    netPayable: netPayable,
                    childCosts: opt.childCosts
                };
            });
        }

        // Fallback: Basic AI Estimation
        const { costDetails, paxCount, marginPercentage, isDomestic } = quotationData;
        const perPersonCost = costDetails?.perPersonCost || 0;
        const gstPercentage = costDetails?.gstPercentage || 5;
        const marginAmount = perPersonCost * (marginPercentage / 100);
        const costWithMargin = perPersonCost + marginAmount;
        const gstAmount = costWithMargin * (gstPercentage / 100);
        const tcsPercentage = isDomestic ? 0 : (costDetails?.tcsPercentage || 5);
        const tcsAmount = (costWithMargin + gstAmount) * (tcsPercentage / 100);
        const netCostPerPerson = costWithMargin + gstAmount + tcsAmount;
        const netPayable = Math.round(netCostPerPerson * paxCount);

        return [{
            label: "Estimated Option",
            perPersonCost: Math.round(perPersonCost),
            gstAmount: Math.round(gstAmount),
            tcsAmount: Math.round(tcsAmount),
            netCostPerPerson: Math.round(netCostPerPerson),
            addOnCost: 0,
            netPayable: netPayable,
            childCosts: []
        }];
    }, [quotationData]);


    // --- RENDER ---

    if (view === 'dashboard') {
        return (
            <div className="min-h-screen text-white font-sans">
                <Header />
                <Dashboard
                    leads={leads}
                    onOpenLead={handleOpenLead}
                    onCreateLead={handleCreateLead}
                    onUpdateLead={handleUpdateLead}
                    onDeleteLead={handleDeleteLead}
                />
            </div>
        );
    }

    return (
        <div className="min-h-screen text-white font-sans flex flex-col relative">
            <Header
                showBack={true}
                onBack={handleBackToDashboard}
                onSave={handleSaveWorkspace}
                isSaving={isSaving}
            />

            {/* TABS */}
            {/* TABS */}
            <div className="glass-nav border-b border-white/5 px-6">
                <div className="flex space-x-8 overflow-x-auto no-scrollbar">
                    {(['quotation', 'financials', 'payment', 'receipt', 'email', 'summary'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`py-4 px-2 border-b-2 font-bold text-xs uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === tab
                                ? 'border-blue-500 text-blue-400'
                                : 'border-transparent text-gray-500 hover:text-gray-300'
                                }`}
                        >
                            {tab === 'receipt' ? '🧾 Receipt' : tab === 'summary' ? '📱 Summary' : tab}
                        </button>
                    ))}
                </div>
            </div>

            <main className="flex-1 p-4 overflow-hidden h-[calc(100vh-110px)]">

                {/* QUOTATION TAB */}
                <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6 h-full ${activeTab === 'quotation' ? 'block' : 'hidden'}`}>
                    <div className="h-full overflow-y-auto">
                        <QuotationForm
                            rawText={rawText}
                            setRawText={setRawText}
                            margin={margin}
                            setMargin={setMargin}
                            onGenerate={handleGenerate}
                            isLoading={isLoading}
                            error={error}
                            onImport={handleImport}
                        />
                    </div>
                    <div className="h-full overflow-y-auto">
                        <QuotationPreview
                            data={quotationData}
                            financials={calculatedFinancialsForPreview}
                            financialState={financialState} // Passed here
                            isLoading={isLoading}
                            onUpdate={handleUpdateQuotation}
                            onDownload={handleDownloadDocx}
                            onSaveRevision={handleSaveRevision}
                            onRestoreRevision={handleRestoreRevision}
                            onDeleteRevision={handleDeleteRevision}
                            onSyncPayment={handleSyncPayment}
                            onSyncDrive={checkForDriveRevisions}
                            clientName={currentLead?.name}
                            onSyncName={handleSyncName}
                        />
                    </div>
                    <QuotationAIAssistant
                        quotationData={quotationData}
                        onUpdateQuotation={handleUpdateQuotation}
                    />
                </div>

                {/* FINANCIALS TAB */}
                <div className={`h-full overflow-y-auto ${activeTab === 'financials' ? 'block' : 'hidden'}`}>
                    <div className="mb-4 flex justify-between">
                        <h2 className="text-xl font-bold">Financial Calculator</h2>
                        <button
                            onClick={handleDownloadExcel}
                            className="bg-green-700 hover:bg-green-600 text-white px-3 py-1 rounded text-sm font-bold flex items-center"
                        >
                            📄 Export Excel
                        </button>
                    </div>
                    <FinancialCalculator
                        savedState={financialState}
                        onSaveState={setFinancialState}
                        onUpdateQuotation={handleUpdateFromFinancials}
                        initialAutoFillData={vendorAutoFill}
                        onAutoFillConsumed={() => setVendorAutoFill(null)}
                    />
                </div>

                {/* PAYMENT TAB */}
                <div className={`h-full overflow-y-auto ${activeTab === 'payment' ? 'block' : 'hidden'}`}>
                    <PaymentSummary
                        state={paymentState}
                        onChange={setPaymentState}
                        clientName={quotationData?.customerName || currentLead?.name}
                        destination={quotationData?.destination || currentLead?.destination}
                    />
                </div>

                {/* RECEIPT TAB */}
                <div className={`h-full overflow-y-auto ${activeTab === 'receipt' ? 'block' : 'hidden'}`}>
                    <PaymentReceiptGenerator
                        quotationData={quotationData}
                        paymentState={paymentState}
                        clientName={currentLead?.name}
                        onSyncName={handleSyncName}
                    />
                </div>

                {/* EMAIL TAB */}
                <div className={`h-full ${activeTab === 'email' ? 'block' : 'hidden'}`}>
                    <VendorEmailGenerator
                        state={emailState}
                        onChange={setEmailState}
                    />
                </div>

                {/* SUMMARY TAB */}
                <div className={`h-full overflow-y-auto ${activeTab === 'summary' ? 'block' : 'hidden'}`}>
                    <QuoteSummary data={quotationData} />
                </div>




            </main>

            {showConfirmModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm">
                    <div className="bg-gray-800 border border-gray-600 rounded-xl p-6 max-w-sm w-full shadow-2xl">
                        <h3 className="text-xl font-bold text-white mb-2">Unsaved Changes</h3>
                        <p className="text-gray-300 mb-6">You have unsaved changes. Are you sure you want to discard them?</p>
                        <div className="flex justify-end space-x-3">
                            <button
                                onClick={() => setShowConfirmModal(false)}
                                className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-medium transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmBack}
                                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold transition"
                            >
                                Discard Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default App;
