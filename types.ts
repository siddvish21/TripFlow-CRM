
export interface ItineraryDay {
    day: number;
    title: string;
    points: string[];
}

export interface HotelInfo {
    destination: string;
    hotelName: string;
    roomCategory: string;
    nights: number;
}

export interface HotelOption {
    optionLabel: string; // e.g. "Option 1 (3 Star)"
    hotels: HotelInfo[];
}

export interface CostDetails {
    perPersonCost: number;
    gstPercentage: number;
    tcsPercentage: number;
}

export interface ChildFinancials {
    label: string; // e.g. "Child With Bed"
    landBaseCost: number;
    landGST: number;
    landTCS: number;
    netCost: number;
}

export interface FinancialOption {
    label: string;        // e.g., "Option 1", "Option 2"
    landBaseCost: number; // Per Person (Includes Markup)
    landGST: number;      // Per Person
    landTCS: number;      // Per Person
    addOnCost: number;    // Per Person (Flight/Visa)

    // New: Exact override for restored documents
    extractedNetCost?: number;

    // New: Child Cost Breakdowns
    childCosts?: ChildFinancials[];
}

export interface FinancialBreakdown {
    options: FinancialOption[];
}

// --- Shared Types for Financial Calculator & Persistence ---

export interface VendorParsedData {
    currency: string;
    totalPax: number;
    questions?: string[];
    unifiedLineItems: {
        description: string;
        quantity: number;
        costOption1: number;
        costOption2: number;
        costOption3: number;
        // New fields for exact restoration
        multiplierOption1?: number;
        multiplierOption2?: number;
        multiplierOption3?: number;
    }[];
    addOns: { type: 'Flight' | 'Visa'; costPerPax: number }[];
    // New fields for exact restoration
    extractedConfigs?: {
        markupPct: number;
        gstPct: number;
        tcsPct: number;
    };
}

export interface BlockConfig {
    pax: number;
    markupPct: number;
    gstPct: number;
    tcsPct: number;
}

export interface CalculatorRow {
    id: number;
    label: string;
    // Block 1
    colC: number; colD: number; colF: number;
    // Block 2
    colL: number; colM: number; colO: number;
    // Block 3
    colU: number; colV: number; colX: number;
    // Note: Calculated columns (E, G, N, P, W, Y) are derived, not persisted
}

export interface AddOnRow {
    id: number;
    type: 'Flight' | 'Visa';
    // Block 1
    qty1: number; netRate1: number; markupPerPax1: number;
    // Block 2
    qty2: number; netRate2: number; markupPerPax2: number;
    // Block 3
    qty3: number; netRate3: number; markupPerPax3: number;
}

export interface CalculatorState {
    configs: { block1: BlockConfig; block2: BlockConfig; block3: BlockConfig };
    rows: CalculatorRow[];
    addOnRows: AddOnRow[];
    vendorText: string;
    detectedCurrency: string;
    conversionRate: number;
    aiParsedData: VendorParsedData | null;
}

// --- Snapshot & Quotation Types ---

export interface QuotationSnapshot {
    id: string;
    revision: string;
    timestamp: number;
    data: Omit<QuotationData, 'history'>;
    linkedFinancials: CalculatorState; // CRITICAL: Bundles the financial state with the quote
}


export interface DriveRevision {
    id: string;
    name: string;
    webViewLink: string;
    createdTime: string;
}

export interface QuotationData {
    // From AI
    customerName: string;
    destination: string;
    vendorInput?: string; // Raw text from vendor/user
    duration: string;
    dates: string;
    mealPlan: string;
    vehicle: string;
    itineraryTitle: string;
    itinerary: ItineraryDay[];
    showAccommodations?: boolean; // New flag to control visibility of hotel table
    hotels: HotelInfo[]; // Legacy/Single option
    hotelOptions?: HotelOption[]; // New: Multiple options support
    inclusions: string[];
    exclusions: string[];
    paxCount: number;
    adultsCount?: number;
    childrenCount?: number;
    childAges?: string;
    numberOfRooms: number;
    hotelCategory: string;
    costDetails: CostDetails;
    isDomestic: boolean;
    destinationImage?: string; // New: Custom cover image for the destination

    // From user input
    marginPercentage: number;

    // From Financial Calculator (Precise Values)
    financialBreakdown?: FinancialBreakdown;

    // For user editing and calculation
    totalAmount: number;
    amountReceived: number;
    balanceAmount: number;

    // History
    history?: QuotationSnapshot[];

    // Cloud Sync
    driveRevisions?: DriveRevision[];
}


// --- CRM / Database Types ---

export interface Lead {
    id?: number;
    name: string;
    phone: string;
    email: string;
    status: 'New' | 'Contacted' | 'Quoted' | 'Converted' | 'Lost';
    destination: string;
    travelDate: string;
    pax: number;
    budget: string;
    notes: string;
    createdAt: number; // timestamp
}

export interface PaymentSnapshot {
    id: string;
    revision: string;
    timestamp: number;
    data: Omit<PaymentState, 'history'>;
}

export interface PaymentTransaction {
    id: string;
    date: string;
    type: 'Received from Client' | 'Paid to Vendor' | 'Paid for Flight' | 'Refund';
    amount: number;
    mode: 'Bank Transfer' | 'UPI' | 'Cash' | 'Credit Card';
    notes: string;
}

export interface PaymentState {
    // Old manual fields (kept for backward compatibility or manual override)
    amountsReceivedStr: string;

    // Core Financials
    flightVendorCost: number;
    flightClientCost: number;
    packageVendorCost: number;
    netPackageReceivable: number;
    amountTransferredToVendor: number;

    isTCSApplicable?: boolean;
    generatedText: string;

    // New Ledger System
    transactions: PaymentTransaction[];

    history?: PaymentSnapshot[];
}

export interface EmailRevision {
    id: number; // timestamp
    subject: string;
    content: string; // HTML content
    type: 'Vendor Request' | 'Client Quote' | 'Other';
}

export interface GmailMessage {
    id: string;
    threadId: string;
    snippet: string;
    payload?: {
        headers: { name: string; value: string }[];
        body?: { data?: string };
        parts?: any[];
    };
    internalDate?: string;
}

export interface GmailThread {
    id: string;
    snippet: string;
    historyId: string;
    messages?: GmailMessage[];
}

export interface EmailState {
    recipient: string;
    subject: string;
    currentDraft: string; // HTML content
    history: EmailRevision[];

    // Linked Gmail Functionality
    linkedThreadId?: string;
    cachedThread?: GmailThread; // Store the fetched thread conversation
}

export interface Template {
    id?: number;
    name: string;
    description: string;
    tags: string[];
    fileData: string; // Base64 string
    createdAt: number;
}

export interface PaymentBankDetails {
    accountHolder: string;
    accountNumber: string;
    bankName: string;
    ifscCode: string;
    accountType: string;
    gpayNumber: string;
    companyName: string;
}

export interface UserSettings {
    companyName: string;
    paymentDetails: PaymentBankDetails;
}

