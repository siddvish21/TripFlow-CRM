
import React, { useState, useEffect, useRef } from 'react';
import { QuotationData, QuotationSnapshot, CalculatorState } from '../types';
import { DestinationIcon, DurationIcon, CalendarIcon, MealIcon, VehicleIcon } from './Icons';
import { getPartnerBannerBase64 } from '../services/imageService';
import { auditItinerary } from '../services/geminiService';
import { generateQuotationHtml } from '../services/htmlGenerator';
import { ensureFolderStructure, createGoogleDocFromHtml, signInToGoogle, getIsSignedIn, uploadFileToDrive } from '../services/googleDriveService';
import { generateQuotationExcelFromTemplate } from '../services/excelGenerator';
import { createDocx } from '../services/docxGenerator';

interface QuotationPreviewProps {
    data: QuotationData | null;
    financials: any[] | null; // Array of options now
    isLoading: boolean;
    onUpdate: (data: QuotationData, field?: keyof QuotationData) => void;
    onDownload: () => void;
    // New props for parent-managed history
    onSaveRevision: () => void;
    onRestoreRevision: (snapshot: QuotationSnapshot) => void;
    onDeleteRevision: (id: string) => void;
    onSyncPayment: () => void;
    onSyncDrive?: () => void;
    financialState: CalculatorState | null; // Improved typing
    clientName?: string;
    onSyncName?: () => void;
}

const EditableField: React.FC<{ value: string | number; onSave: (newValue: string) => void; className?: string; isNumeric?: boolean }> = ({ value, onSave, className, isNumeric = false }) => {
    const handleBlur = (e: React.FocusEvent<HTMLSpanElement>) => {
        let newText = e.currentTarget.textContent || '';
        if (isNumeric) {
            newText = newText.replace(/[^0-9,.]/g, ''); // Allow comma and decimal for display
        }
        onSave(newText.replace(/,/g, '')); // Save without comma
    }

    const formattedValue = isNumeric ? Number(value).toLocaleString('en-IN') : String(value);

    return (
        <span
            contentEditable
            suppressContentEditableWarning
            onBlur={handleBlur}
            className={`px-1 rounded-md hover:bg-yellow-800 focus:bg-yellow-700 outline-none focus:ring-1 focus:ring-yellow-500 ${className}`}
            dangerouslySetInnerHTML={{ __html: formattedValue }}
        />
    );
};


const QuotationPreview: React.FC<QuotationPreviewProps> = ({
    data,
    financials,
    isLoading,
    onUpdate,
    onDownload,
    onSaveRevision,
    onRestoreRevision,
    onDeleteRevision,
    onSyncPayment,
    onSyncDrive,
    financialState,
    clientName,
    onSyncName
}) => {
    // Use the specific URL requested for the header
    const HEADER_IMG_URL = "https://res.cloudinary.com/dnauowwb0/image/upload/v1765680866/Trip-Explore-Banner_ejp9hh.png";
    const TOP_HEADER_IMG_URL = "https://res.cloudinary.com/dnauowwb0/image/upload/v1765683665/Gemini_Generated_Image_wniw9nwniw9nwniw_e0awo6.png";

    const [footerImg, setFooterImg] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Audit State
    const [isAuditing, setIsAuditing] = useState(false);
    const [auditResult, setAuditResult] = useState<{ issues: string[], suggestions: string[] } | null>(null);

    // Experimental: Google Docs Feature
    const [useGoogleDocs, setUseGoogleDocs] = useState(false);
    const [generatedDocUrl, setGeneratedDocUrl] = useState<string | null>(null);
    const [isGeneratingDoc, setIsGeneratingDoc] = useState(false);

    useEffect(() => {
        getPartnerBannerBase64().then(setFooterImg);
    }, [data]);

    const handleUpdate = <K extends keyof QuotationData>(key: K, value: QuotationData[K]) => {
        if (data) {
            onUpdate({ ...data, [key]: value }, key);
        }
    };

    const handleItineraryUpdate = (dayIndex: number, pointIndex: number, newValue: string) => {
        if (data) {
            const newItinerary = [...data.itinerary];
            newItinerary[dayIndex].points[pointIndex] = newValue;
            onUpdate({ ...data, itinerary: newItinerary });
        }
    }

    const handleDayTitleUpdate = (dayIndex: number, newValue: string) => {
        if (data) {
            const newItinerary = [...data.itinerary];
            newItinerary[dayIndex].title = newValue;
            onUpdate({ ...data, itinerary: newItinerary });
        }
    }

    const handleHotelUpdate = (hotelIndex: number, key: string, newValue: string) => {
        if (data) {
            const newHotels = [...data.hotels];
            (newHotels[hotelIndex] as any)[key] = key === 'nights' ? parseInt(newValue, 10) || 0 : newValue;
            onUpdate({ ...data, hotels: newHotels });
        }
    }

    const handleHotelOptionUpdate = (optIndex: number, hotelIndex: number, key: string, newValue: string) => {
        if (data && data.hotelOptions) {
            const newOptions = [...data.hotelOptions];
            const newHotels = [...newOptions[optIndex].hotels];
            (newHotels[hotelIndex] as any)[key] = key === 'nights' ? parseInt(newValue, 10) || 0 : newValue;
            newOptions[optIndex].hotels = newHotels;
            onUpdate({ ...data, hotelOptions: newOptions });
        }
    }

    const handleOptionLabelUpdate = (optIndex: number, newValue: string) => {
        if (data && data.hotelOptions) {
            const newOptions = [...data.hotelOptions];
            newOptions[optIndex].optionLabel = newValue;
            onUpdate({ ...data, hotelOptions: newOptions });
        }
    }

    const handleInclusionUpdate = (index: number, newValue: string) => {
        if (data) {
            const newInclusions = [...data.inclusions];
            newInclusions[index] = newValue;
            onUpdate({ ...data, inclusions: newInclusions });
        }
    }

    const handleExclusionUpdate = (index: number, newValue: string) => {
        if (data) {
            const newExclusions = [...data.exclusions];
            newExclusions[index] = newValue;
            onUpdate({ ...data, exclusions: newExclusions });
        }
    }

    const handleDeleteClick = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        onDeleteRevision(id);
    }

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result as string;
                // Remove data URL prefix for consistency with other assets if needed, 
                // but mostly we store full string for convenience in <img> tags.
                // For Docx, we strip it.
                const cleanBase64 = base64String.split(',')[1];
                handleUpdate('destinationImage', cleanBase64);
            };
            reader.readAsDataURL(file);
        }
    };

    const runAudit = async () => {
        if (!data?.itinerary) return;
        setIsAuditing(true);
        try {
            const result = await auditItinerary(data.itinerary);
            setAuditResult(result);
        } catch (e) {
            alert("Audit failed.");
        } finally {
            setIsAuditing(false);
        }
    }

    const handleGenerateGoogleDoc = async () => {
        if (!data) return;
        setIsGeneratingDoc(true);

        // Safety timeout to clear spinner if it gets stuck
        const timeoutId = setTimeout(() => {
            setIsGeneratingDoc(false);
            // alert("Request timed out. Please check if the popup was blocked or closed.");
        }, 30000);

        try {
            // Check if we need to sign in first
            const signedIn = await getIsSignedIn();
            if (!signedIn) {
                await signInToGoogle();
            }

            const folderId = await ensureFolderStructure(data.customerName, data.destination);
            const htmlContent = generateQuotationHtml(data);
            const fileName = `${data.customerName.replace(/\s+/g, '_')}`;

            const result = await createGoogleDocFromHtml(folderId, htmlContent, fileName);

            // --- NEW: Generate and Upload Excel Template ---
            try {
                if (financialState) {
                    const excelBlob = await generateQuotationExcelFromTemplate(financialState, data.customerName);
                    const excelFileName = `Financials_${data.customerName.replace(/\s+/g, '_')}.xlsx`;
                    await uploadFileToDrive(folderId, excelBlob, excelFileName);
                    console.log("✅ Excel Sheet generated and uploaded to Drive");
                }
            } catch (excelErr) {
                console.error("Failed to generate/upload Excel:", excelErr);
                // Don't fail the whole process if only Excel fails, but maybe notify?
            }

            const docUrl = `https://docs.google.com/document/d/${result.id}/edit`;
            setGeneratedDocUrl(docUrl);

            window.open(docUrl, '_blank');
        } catch (e: any) {
            console.error("Google Doc Gen Error:", e);
            if (e.error === 'popup_closed_by_user') {
                alert("Sign-in cancelled. You must sign in to generate a Google Doc.");
            } else {
                alert(`Failed to generate Google Doc: ${e.message || e}`);
            }
        } finally {
            clearTimeout(timeoutId);
            setIsGeneratingDoc(false);
        }
    };

    const handleUploadDocxToDrive = async () => {
        if (!data) return;
        setIsGeneratingDoc(true);

        const timeoutId = setTimeout(() => {
            setIsGeneratingDoc(false);
        }, 30000);

        try {
            const signedIn = await getIsSignedIn();
            if (!signedIn) {
                await signInToGoogle();
            }

            const folderId = await ensureFolderStructure(data.customerName, data.destination);

            // Generate DOCX file
            let docxBlob: Blob;
            try {
                docxBlob = await createDocx(data);
            } catch (docxError: any) {
                console.error('DOCX Generation Error:', docxError);
                throw new Error(`Failed to generate DOCX: ${docxError?.message || 'Unknown error during document generation'}`);
            }

            // Generate file name: Quotation - [Customer Name] - [Date]
            // Sanitize customer name to remove invalid characters for file names
            const sanitizedName = data.customerName.replace(/[<>:"/\\|?*]/g, '_').trim();
            const dateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
            const fileName = `Quotation - ${sanitizedName} - ${dateStr}.docx`;
            const uploadResult = await uploadFileToDrive(folderId, docxBlob, fileName);

            // Upload Excel as a companion file
            try {
                if (financialState) {
                    const excelBlob = await generateQuotationExcelFromTemplate(financialState, data.customerName);
                    const excelFileName = `Financials_${data.customerName.replace(/\s+/g, '_')}.xlsx`;
                    await uploadFileToDrive(folderId, excelBlob, excelFileName);
                    console.log('✅ Excel Sheet generated and uploaded to Drive');
                }
            } catch (excelErr) {
                console.error('Failed to generate/upload Excel:', excelErr);
            }

            const docUrl = `https://drive.google.com/file/d/${uploadResult.id}/view`;
            setGeneratedDocUrl(docUrl);
            window.open(docUrl, '_blank');
        } catch (e: any) {
            console.error('Drive Upload Error:', e);
            if (e.error === 'popup_closed_by_user') {
                alert('Sign-in cancelled. You must sign in to upload to Google Drive.');
            } else {
                // Extract meaningful error message from various error types
                console.error('Full Error Object:', e);
                let errorMessage = 'Unknown error occurred';
                
                if (typeof e === 'string') {
                    errorMessage = e;
                } else if (e?.message) {
                    errorMessage = e.message;
                } else if (e?.result?.error?.message) {
                    errorMessage = e.result.error.message;
                } else if (e?.error?.message) {
                    errorMessage = e.error.message;
                } else if (e?.error) {
                    errorMessage = typeof e.error === 'string' ? e.error : JSON.stringify(e.error);
                } else if (e?.response?.data) {
                    errorMessage = typeof e.response.data === 'string' ? e.response.data : JSON.stringify(e.response.data);
                } else if (typeof e === 'object') {
                    try {
                        errorMessage = JSON.stringify(e);
                    } catch {
                        errorMessage = 'Error object could not be stringified';
                    }
                } else if (e?.toString) {
                    errorMessage = e.toString();
                }
                alert(`Failed to upload DOCX: ${errorMessage}`);
            }
        } finally {
            clearTimeout(timeoutId);
            setIsGeneratingDoc(false);
        }
    };

    if (isLoading) {
        return (
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg flex items-center justify-center h-full">
                <div className="text-center">
                    <svg className="animate-spin mx-auto h-12 w-12 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="mt-4 text-gray-400">Generating your professional quotation...</p>
                </div>
            </div>
        );
    }

    if (!data || !financials) {
        return (
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg flex items-center justify-center h-full border-2 border-dashed border-gray-700">
                <div className="text-center">
                    <h2 className="text-xl font-bold mb-2 text-gray-300">2. Preview & Edit</h2>
                    <p className="text-gray-500">Your generated quotation will appear here.</p>
                </div>
            </div>
        );
    }

    const { totalAmount, amountReceived, balanceAmount, hotelCategory, paxCount, showAccommodations, destinationImage } = data;

    return (
        <div className="bg-gray-800 rounded-lg shadow-lg relative">
            <div className="p-6 border-b border-gray-700 flex flex-wrap justify-between items-center gap-4">
                <h2 className="text-xl font-bold text-gray-300">2. Preview & Edit</h2>
                <div className="flex gap-2">
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="bg-gray-700 text-gray-300 text-sm font-bold py-2 px-3 rounded hover:bg-gray-600 transition flex items-center"
                    >
                        🖼️ Add Cover Img
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" />

                    <button
                        onClick={onSaveRevision}
                        className="bg-purple-600 text-white text-sm font-bold py-2 px-3 rounded hover:bg-purple-700 transition flex items-center"
                    >
                        💾 Save Rev
                    </button>

                    {/* Google Docs Toggle & Button */}
                    <div className="flex items-center gap-2 bg-gray-700 p-1 rounded-lg">
                        <label className="flex items-center cursor-pointer relative px-2">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={useGoogleDocs}
                                onChange={(e) => setUseGoogleDocs(e.target.checked)}
                            />
                            <div className="w-9 h-5 bg-gray-500 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[10px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                            <span className="ml-2 text-xs font-bold text-gray-300">Exp. G-Docs</span>
                        </label>

                        {useGoogleDocs ? (
                            <button
                                onClick={handleUploadDocxToDrive}
                                disabled={isGeneratingDoc}
                                className="bg-blue-600 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-700 transition duration-150 ease-in-out flex items-center"
                            >
                                {isGeneratingDoc ? (
                                    <>
                                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                        Uploading...
                                    </>
                                ) : (
                                    <>
                                        <span className="mr-2">📄</span> Upload DOCX to Drive
                                    </>
                                )}
                            </button>
                        ) : (
                            <button
                                onClick={onDownload}
                                className="bg-green-600 text-white font-bold py-2 px-4 rounded-md hover:bg-green-700 transition duration-150 ease-in-out flex items-center"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                                Download .docx
                            </button>
                        )}
                    </div>

                    {generatedDocUrl && useGoogleDocs && (
                        <a
                            href={generatedDocUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 underline text-sm font-bold"
                        >
                            Last Generated Doc ↗
                        </a>
                    )}
                </div>
            </div>
            <div className="flex">
                {/* Main Preview Area */}
                <div className="p-8 h-[70vh] overflow-y-auto text-gray-300 flex-1 bg-white">

                    {/* 1. Top Header Image */}
                    <img src={TOP_HEADER_IMG_URL} alt="Top Header" className="w-full h-auto mb-2 rounded-t-md shadow-sm" style={{ maxHeight: '200px', objectFit: 'cover' }} />

                    {/* 2. Collaboration Message */}
                    <div className="text-center mb-1 text-gray-900" style={{ fontSize: '12pt' }}>
                        <p className="font-lexend font-bold italic">
                            🤝In <span className="underline">collaboration</span> with our trusted partners at <span className="underline" style={{ backgroundColor: 'yellow', color: 'black' }}>TripExplore</span> – crafting seamless travel experiences together.
                        </p>
                    </div>

                    {/* 3. Header Link */}
                    <div className="text-center mb-4 text-gray-700" style={{ fontSize: '10pt' }}>
                        🔗 Know more about them at: <a href="http://www.tripexplore.in" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-bold">www.tripexplore.in</a>
                    </div>

                    {/* 4. Updated Header Image from URL */}
                    <img src={HEADER_IMG_URL} alt="Header Banner" className="w-full mb-10 h-auto shadow-sm" style={{ maxHeight: '150px', objectFit: 'cover' }} />

                    {/* --- NEW: PROBLEM / SOLUTION SECTION (Transparency Block) --- */}
                    <div className="space-y-12 mb-16 px-4">

                        {/* Problem 1 */}
                        <div className="border-t border-b border-gray-200 py-6">
                            <h2 className="text-[#00AEEF] text-4xl font-bold mb-4">Problem 1</h2>
                            <p className="text-gray-800 text-xl mb-4">People think we only give tours with the hotels shown in our quote.</p>
                            <p className="text-gray-900 font-bold text-xl mb-2">Reality</p>
                            <p className="text-gray-800 text-xl italic">
                                Nope! We can plan your trip with <span className="italic font-medium text-gray-900">any hotel you like</span> and add <span className="italic font-medium text-gray-900">any sightseeing</span> you want.
                            </p>
                        </div>

                        {/* Problem 2 */}
                        <div className="border-b border-gray-200 pb-10">
                            <h2 className="text-[#00AEEF] text-4xl font-bold mb-4">Problem 2</h2>
                            <p className="text-gray-800 text-xl mb-4">People see one price (like Rs 50,000) and another lower price (like Rs 48,000) and quickly book the cheaper one.</p>
                            <p className="text-gray-900 font-bold text-xl mb-4">Solution</p>
                            <p className="text-gray-800 text-xl mb-4">Prices change because hotels and sightseeing are different.</p>
                            <ul className="list-disc pl-8 space-y-3 mb-6 text-gray-800 text-xl">
                                <li>One hotel may be close to the city and safe for tourists, another may be far away.</li>
                                <li>One hotel may cost Rs 5,000 a night, another Rs 2,500, even in the same area.</li>
                            </ul>
                            <p className="text-gray-800 text-xl leading-relaxed">
                                So, always check what’s included before booking. If you like another quote, share it with us—we’ll match the same hotel and sightseeing so you can compare fairly.
                            </p>
                        </div>

                        {/* Final Note */}
                        <div className="text-center">
                            <p className="text-gray-900 font-bold text-2xl italic">
                                "Let’s talk openly, like friends, and make sure you get the best deal possible."
                            </p>
                        </div>
                    </div>

                    {/* VISUAL PAGE BREAK INDICATOR */}
                    <div className="flex items-center justify-center my-16 opacity-50">
                        <div className="h-px bg-gray-300 flex-1"></div>
                        <span className="px-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Next Page</span>
                        <div className="h-px bg-gray-300 flex-1"></div>
                    </div>

                    {/* --- START OF ACTUAL QUOTATION DETAILS --- */}

                    {destinationImage && (
                        <div className="mb-10 relative rounded-lg overflow-hidden h-72 shadow-xl border border-gray-200">
                            <img src={`data:image/png;base64,${destinationImage}`} alt="Destination Cover" className="w-full h-full object-cover" />
                            <div className="absolute bottom-0 left-0 bg-gradient-to-t from-black/80 to-transparent w-full p-6">
                                <h2 className="text-3xl font-bold text-white">{data.itineraryTitle}</h2>
                            </div>
                        </div>
                    )}

                    <div className="text-center border-b-2 border-gray-200 pb-3 mb-8">
                        <p className="text-2xl font-bold text-gray-900" style={{ fontSize: '18pt' }}>
                            Quotation for Tour Package - <EditableField value={data.customerName} onSave={(v) => handleUpdate('customerName', v)} className="text-blue-700" />
                        </p>
                        {clientName && onSyncName && clientName.trim() !== data.customerName.trim() && (
                            <button
                                onClick={onSyncName}
                                className="mt-2 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 px-2 py-1 rounded border border-blue-300 transition flex items-center justify-center mx-auto gap-1"
                                title={`Sync name to "${clientName}" and save`}
                            >
                                🔄 Sync to "{clientName}" & Save
                            </button>
                        )}
                    </div>

                    <div className="space-y-4 bg-gray-50 p-6 rounded-xl border border-gray-200 mb-8" style={{ fontSize: '14pt' }}>
                        <p className="flex items-center text-gray-800"><DestinationIcon className="w-6 h-6 mr-4 text-red-500" /> <strong>Destination:</strong><span className="ml-2"><EditableField value={data.destination} onSave={(v) => handleUpdate('destination', v)} /></span></p>
                        <p className="flex items-center text-gray-800"><DurationIcon className="w-6 h-6 mr-4 text-blue-500" /> <strong>Duration:</strong><span className="ml-2"><EditableField value={data.duration} onSave={(v) => handleUpdate('duration', v)} /></span></p>
                        <p className="flex items-center text-gray-800"><CalendarIcon className="w-6 h-6 mr-4 text-green-500" /> <strong>Dates:</strong><span className="ml-2"><EditableField value={data.dates} onSave={(v) => handleUpdate('dates', v)} /></span></p>
                        <p className="flex items-center text-gray-800"><MealIcon className="w-6 h-6 mr-4 text-orange-500" /> <strong>Meal Plan:</strong><span className="ml-2"><EditableField value={data.mealPlan} onSave={(v) => handleUpdate('mealPlan', v)} /></span></p>
                        <p className="flex items-center text-gray-800"><VehicleIcon className="w-6 h-6 mr-4 text-purple-500" /> <strong>Vehicle:</strong><span className="ml-2"><EditableField value={data.vehicle} onSave={(v) => handleUpdate('vehicle', v)} /></span></p>
                    </div>

                    {!destinationImage && <h2 className="text-2xl font-bold text-center my-6 text-gray-900" style={{ fontSize: '16pt' }}><EditableField value={data.itineraryTitle} onSave={(v) => handleUpdate('itineraryTitle', v)} /></h2>}

                    <div>
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-2xl font-bold text-gray-800 border-b-4 border-blue-500 pb-1">Detailed Itinerary</h3>
                            <button onClick={runAudit} disabled={isAuditing} className="text-xs bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded border border-gray-300 text-gray-600 font-bold">
                                {isAuditing ? 'Auditing...' : '⚡ Audit Itinerary'}
                            </button>
                        </div>

                        <div className="space-y-8">
                            {data.itinerary && data.itinerary.map((day, dayIndex) => (
                                <div key={day.day} className="pb-8 border-b border-gray-200 border-dashed last:border-0">
                                    <h3 className="text-xl font-bold mb-4 text-blue-800" style={{ fontSize: '15pt' }}>
                                        <EditableField
                                            value={`🗓️ Day ${day.day}: ${day.title}`}
                                            onSave={(v) => handleDayTitleUpdate(dayIndex, v.replace(/🗓️ Day \d+: /g, ''))}
                                        />
                                    </h3>
                                    <ul className="space-y-3 pl-6 border-l-4 border-gray-100 ml-2" style={{ listStyle: 'none' }}>
                                        {day.points && day.points.map((point, pointIndex) => (
                                            <li key={pointIndex} className="text-gray-700 relative text-lg" style={{ fontSize: '13pt' }}>
                                                <span className="absolute -left-8 top-2 w-3 h-3 bg-blue-400 rounded-full"></span>
                                                <EditableField
                                                    value={point}
                                                    onSave={(v) => handleItineraryUpdate(dayIndex, pointIndex, v)}
                                                />
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    </div>
                    <hr className="my-10 border-gray-200 border-2" />

                    {/* Accommodations Table(s) */}
                    {showAccommodations !== false && (
                        <>
                            <h3 className="text-2xl font-bold mb-8 text-gray-800 border-b-4 border-blue-500 pb-1 w-fit" style={{ fontSize: '16pt' }}>Your Accommodations</h3>

                            {data.hotelOptions && data.hotelOptions.length > 0 ? (
                                data.hotelOptions.map((option, optIndex) => (
                                    <div key={optIndex} className="mb-10 bg-gray-50 p-6 rounded-xl border border-gray-200">
                                        <h4 className="text-lg font-bold text-blue-700 mb-4 uppercase tracking-wide border-b border-gray-200 pb-2">
                                            <EditableField value={option.optionLabel} onSave={(v) => handleOptionLabelUpdate(optIndex, v)} />
                                        </h4>
                                        <table className="w-full text-left border-collapse" style={{ fontSize: '12pt' }}>
                                            <thead>
                                                <tr className="bg-gray-200 text-gray-700 text-sm uppercase">
                                                    <th className="p-4 border-b border-gray-300 w-[25%]">Destination</th>
                                                    <th className="p-4 border-b border-gray-300 w-[35%]">Hotel</th>
                                                    <th className="p-4 border-b border-gray-300 w-[25%]">Room Category</th>
                                                    <th className="p-4 border-b border-gray-300 w-[15%] text-center">Nights</th>
                                                </tr>
                                            </thead>
                                            <tbody className="text-gray-800">
                                                {option.hotels.map((hotel, index) => (
                                                    <tr key={index} className="border-b border-gray-200 last:border-0 hover:bg-white transition-colors">
                                                        <td className="p-4"><EditableField value={hotel.destination} onSave={(v) => handleHotelOptionUpdate(optIndex, index, 'destination', v)} /></td>
                                                        <td className="p-4 font-bold text-gray-900"><EditableField value={hotel.hotelName} onSave={(v) => handleHotelOptionUpdate(optIndex, index, 'hotelName', v)} /></td>
                                                        <td className="p-4"><EditableField value={hotel.roomCategory} onSave={(v) => handleHotelOptionUpdate(optIndex, index, 'roomCategory', v)} /></td>
                                                        <td className="p-4 text-center font-bold"><EditableField value={hotel.nights} onSave={(v) => handleHotelOptionUpdate(optIndex, index, 'nights', v)} isNumeric /></td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ))
                            ) : (
                                data.hotels && data.hotels.length > 0 && (
                                    <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 my-6">
                                        <table className="w-full text-left border-collapse" style={{ fontSize: '12pt' }}>
                                            <thead>
                                                <tr className="bg-gray-200 text-gray-700 text-sm uppercase">
                                                    <th className="p-4 border-b border-gray-300 w-[25%]">Destination</th>
                                                    <th className="p-4 border-b border-gray-300 w-[35%]">Hotel</th>
                                                    <th className="p-4 border-b border-gray-300 w-[25%]">Room Category</th>
                                                    <th className="p-4 border-b border-gray-300 w-[15%] text-center">Nights</th>
                                                </tr>
                                            </thead>
                                            <tbody className="text-gray-800">
                                                {data.hotels.map((hotel, index) => (
                                                    <tr key={index} className="border-b border-gray-200 last:border-0 hover:bg-white transition-colors">
                                                        <td className="p-4"><EditableField value={hotel.destination} onSave={(v) => handleHotelUpdate(index, 'destination', v)} /></td>
                                                        <td className="p-4 font-bold text-gray-900"><EditableField value={hotel.hotelName} onSave={(v) => handleHotelUpdate(index, 'hotelName', v)} /></td>
                                                        <td className="p-4"><EditableField value={hotel.roomCategory} onSave={(v) => handleHotelUpdate(index, 'roomCategory', v)} /></td>
                                                        <td className="p-4 text-center font-bold"><EditableField value={hotel.nights} onSave={(v) => handleHotelUpdate(index, 'nights', v)} isNumeric /></td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )
                            )}
                            <hr className="my-10 border-gray-200 border-2" />
                        </>
                    )}

                    <h3 className="text-2xl font-bold mb-6 text-gray-800 border-b-4 border-green-500 pb-1 w-fit" style={{ fontSize: '16pt' }}>✅ Inclusions</h3>
                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10" style={{ fontSize: '13pt' }}>
                        {data.inclusions && data.inclusions.map((inclusion, index) => (
                            <li key={index} className="flex items-start bg-green-50 p-3 rounded-lg border border-green-100 text-gray-800">
                                <span className="mr-3 text-green-600 font-bold">✓</span>
                                <EditableField value={inclusion.replace(/^(→ ?|✅ ?)/, '')} onSave={(v) => handleInclusionUpdate(index, v)} />
                            </li>
                        ))}
                    </ul>
                    <hr className="my-10 border-gray-200 border-2" />

                    {/* Rate Details Table */}
                    <h3 className="text-2xl font-bold mb-6 text-gray-800 border-b-4 border-yellow-500 pb-1 w-fit" style={{ fontSize: '16pt' }}>Rate Details</h3>
                    {/* Redesigned Rate Details Table */}
                    <div className="space-y-12">
                        {financials.map((opt, i) => {
                            const child = opt.childCosts && opt.childCosts.length > 0 ? opt.childCosts[0] : null;
                            const adultCount = data.paxCount;
                            const adultSubtotal = (opt.netCostPerPerson + opt.addOnCost) * adultCount;
                            const childSubtotal = child ? (child.netCost + opt.addOnCost) * 1 : 0;
                            const grandTotal = adultSubtotal + childSubtotal;

                            return (
                                <div key={i} className="overflow-x-auto bg-gray-50 rounded-xl border-2 border-gray-200 shadow-sm mb-10">
                                    <h4 className="bg-gray-800 text-white p-4 font-bold text-lg text-center">{opt.label || `Option ${i + 1}`}</h4>
                                    <table className="w-full text-left border-collapse" style={{ fontSize: '13pt' }}>
                                        <thead>
                                            <tr className="bg-gray-100 text-gray-800 border-b-2 border-gray-300">
                                                <th className="p-4 border-r border-gray-300 w-[40%]">Description</th>
                                                <th className="p-4 border-r border-gray-300 text-center w-[30%] font-bold">Adults</th>
                                                <th className="p-4 text-center w-[30%] font-bold">Child</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-gray-800">
                                            <tr className="border-b border-gray-200">
                                                <td className="p-4 border-r border-gray-200 font-bold">Occupancy / Sharing</td>
                                                <td className="p-4 border-r border-gray-200 text-center">{hotelCategory}</td>
                                                <td className="p-4 text-center">{child ? "With/No Bed" : "N/A"}</td>
                                            </tr>
                                            <tr className="border-b border-gray-200">
                                                <td className="p-4 border-r border-gray-200">Base Package Cost</td>
                                                <td className="p-4 border-r border-gray-200 text-center">INR {opt.perPersonCost.toLocaleString('en-IN')}</td>
                                                <td className="p-4 text-center">{child ? `INR ${child.landBaseCost.toLocaleString('en-IN')}` : "-"}</td>
                                            </tr>
                                            <tr className="border-b border-gray-200">
                                                <td className="p-4 border-r border-gray-200">GST (5%)</td>
                                                <td className="p-4 border-r border-gray-200 text-center">INR {opt.gstAmount.toLocaleString('en-IN')}</td>
                                                <td className="p-4 text-center">{child ? `INR ${child.landGST.toLocaleString('en-IN')}` : "-"}</td>
                                            </tr>
                                            <tr className="border-b border-gray-200">
                                                <td className="p-4 border-r border-gray-200">TCS (5%)</td>
                                                <td className="p-4 border-r border-gray-200 text-center">INR {opt.tcsAmount.toLocaleString('en-IN')}</td>
                                                <td className="p-4 text-center">{child ? `INR ${child.landTCS.toLocaleString('en-IN')}` : "-"}</td>
                                            </tr>
                                            <tr className="bg-gray-200 font-bold border-b border-gray-300">
                                                <td className="p-4 border-r border-gray-300">Net Package Cost (Per Head)</td>
                                                <td className="p-4 border-r border-gray-300 text-center text-blue-800">INR {opt.netCostPerPerson.toLocaleString('en-IN')}</td>
                                                <td className="p-4 text-center text-blue-800">{child ? `INR ${child.netCost.toLocaleString('en-IN')}` : "-"}</td>
                                            </tr>
                                            <tr className="border-b border-gray-200">
                                                <td className="p-4 border-r border-gray-200 italic">Flight Cost Indicator</td>
                                                <td className="p-4 border-r border-gray-200 text-center">{opt.addOnCost > 0 ? `INR ${opt.addOnCost.toLocaleString('en-IN')}` : "Excluded"}</td>
                                                <td className="p-4 text-center">{opt.addOnCost > 0 ? `INR ${opt.addOnCost.toLocaleString('en-IN')}` : "Excluded"}</td>
                                            </tr>
                                            <tr className="border-b border-gray-200">
                                                <td className="p-4 border-r border-gray-200 font-medium">Net Payable Amount (Category Total)</td>
                                                <td className="p-4 border-r border-gray-200 text-center">INR {adultSubtotal.toLocaleString('en-IN')} <span className="text-sm text-gray-500">(x{adultCount})</span></td>
                                                <td className="p-4 text-center">{child ? `INR ${childSubtotal.toLocaleString('en-IN')} (x1)` : "-"}</td>
                                            </tr>
                                            <tr className="bg-red-50 border-t-2 border-red-200">
                                                <td colSpan={2} className="p-4 text-right font-bold text-gray-700 uppercase tracking-wide">Grand Total (Inc. Taxes)</td>
                                                <td className="p-4 text-center font-black text-2xl text-red-600">INR {grandTotal.toLocaleString('en-IN')}/-</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            );
                        })}
                    </div>


                    <div className="space-y-4 p-8 bg-gray-900 rounded-xl border border-gray-700 mb-10 text-white" style={{ fontSize: '15pt' }}>
                        <p className="flex justify-between items-center">
                            <span>💰 Total Package Cost (Group):</span>
                            <span className="font-bold text-green-400 text-2xl">₹ <EditableField value={totalAmount} onSave={v => handleUpdate('totalAmount', Number(v))} isNumeric />/-</span>
                        </p>
                        <div className="flex justify-between items-center text-blue-300">
                            <span>✅ Payments Received:</span>
                            <div className="flex items-center gap-4">
                                <span className="font-bold text-xl">₹ <EditableField value={amountReceived} onSave={v => handleUpdate('amountReceived', Number(v))} isNumeric />/-</span>
                                <button
                                    onClick={onSyncPayment}
                                    title="Sync from Payment Ledger"
                                    className="text-white bg-blue-700 hover:bg-blue-600 px-3 py-1 rounded-full text-xs font-bold transition flex items-center gap-1 shadow-md"
                                >
                                    🔄 Sync
                                </button>
                            </div>
                        </div>
                        <p className="flex justify-between items-center text-red-400 font-bold border-t border-gray-700 pt-4 mt-4">
                            <span>💳 Balance Outstanding:</span>
                            <span className="text-3xl">₹ {balanceAmount.toLocaleString('en-IN')}/-</span>
                        </p>
                    </div>

                    <h3 className="text-2xl font-bold mb-6 text-gray-800 border-b-4 border-red-500 pb-1 w-fit" style={{ fontSize: '16pt' }}>❌ Exclusions</h3>
                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10" style={{ fontSize: '13pt' }}>
                        {data.exclusions && data.exclusions.map((exclusion, index) => (
                            <li key={index} className="flex items-start bg-red-50 p-3 rounded-lg border border-red-100 text-gray-800">
                                <span className="mr-3 text-red-600 font-bold text-lg">✕</span>
                                <EditableField value={exclusion.replace(/^(➡️ ?|❌ ?)/, '')} onSave={(v) => handleExclusionUpdate(index, v)} />
                            </li>
                        ))}
                    </ul>

                    <div className="bg-gray-100 p-8 rounded-2xl border-2 border-gray-200 mb-10 text-gray-800" style={{ fontSize: '14pt' }}>
                        <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                            🏦 Payment Transfer Details
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div>
                                <p className="text-gray-500 text-xs uppercase font-bold tracking-widest mb-1">Account Holder</p>
                                <p className="font-bold text-xl text-blue-900">tripexplore.in</p>
                            </div>
                            <div>
                                <p className="text-gray-500 text-xs uppercase font-bold tracking-widest mb-1">Account Number</p>
                                <p className="font-bold font-mono text-2xl">2612421112</p>
                            </div>
                            <div>
                                <p className="text-gray-500 text-xs uppercase font-bold tracking-widest mb-1">Bank Name</p>
                                <p className="font-bold text-xl">Kotak Mahindra Bank</p>
                            </div>
                            <div>
                                <p className="text-gray-500 text-xs uppercase font-bold tracking-widest mb-1">IFSC Code</p>
                                <p className="font-bold font-mono text-xl text-red-700">KKBK0000463</p>
                            </div>
                            <div>
                                <p className="text-gray-500 text-xs uppercase font-bold tracking-widest mb-1">Account Type</p>
                                <p className="font-bold">Current Account</p>
                            </div>
                        </div>
                        <div className="border-t-2 border-dashed border-gray-300 my-8 pt-6 text-center">
                            <p className="font-bold text-gray-400 text-sm mb-2">SCAN & PAY OR GPAY</p>
                            <p className="font-bold text-3xl text-green-700">GPAY: 9841291289</p>
                        </div>
                    </div>

                    <div className="space-y-6 text-center text-gray-800 mt-16" style={{ fontSize: '14pt' }}>
                        <p className="italic text-gray-500">📞 For further details or booking confirmation, feel free to contact us anytime.</p>
                        <p className="font-bold text-xl">💌 Best Regards,</p>
                        <p className="font-black text-3xl text-blue-900 tracking-tight">Vishwanathan</p>
                        <p className="text-blue-700 font-bold">+91-8884016046</p>

                        <div className="flex justify-center gap-6 mt-6">
                            <a href="tel:8884016046" className="hover:scale-105 transition">
                                <img src="https://res.cloudinary.com/dnauowwb0/image/upload/v1767504923/Call-Now-Button_gq6urr.png" alt="Call Now" className="h-12" />
                            </a>
                            <a href="https://wa.me/918884016046" target="_blank" rel="noopener noreferrer" className="hover:scale-105 transition">
                                <img src="https://res.cloudinary.com/dnauowwb0/image/upload/v1767504923/Whatsapp-Button_kuwlcf.png" alt="WhatsApp" className="h-12" />
                            </a>
                        </div>
                    </div>

                    <div className="text-center text-gray-600 mt-20 pt-10 border-t-2 border-gray-100" style={{ fontSize: '12pt' }}>
                        <p className="font-lexend font-bold italic">
                            🤝In <span className="underline">collaboration</span> with our trusted partners at <span className="underline bg-yellow-400 text-black px-2 rounded">TripExplore</span> – crafting seamless travel experiences together.
                        </p>
                        <p className="mt-3">
                            🔗 Website: <a href="http://www.tripexplore.in" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-bold">www.tripexplore.in</a>
                        </p>
                    </div>

                    <img src={HEADER_IMG_URL} alt="Footer Banner" className="w-full mt-10 rounded-b-md" style={{ maxHeight: '120px', objectFit: 'cover' }} />
                </div>

                {/* History Sidebar */}
                <div className="w-48 border-l border-gray-700 p-4 bg-gray-900/50 flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                        <h4 className="text-xs font-bold text-gray-400 uppercase">Revision History</h4>
                        {onSyncDrive && (
                            <button
                                onClick={onSyncDrive}
                                title="Sync from Google Drive"
                                className="text-blue-400 hover:text-white transition"
                            >
                                🔄
                            </button>
                        )}
                    </div>
                    <div className="space-y-3 overflow-y-auto max-h-[400px]">
                        {data.history && data.history.length > 0 ? (
                            data.history.map((snap) => (
                                <div key={snap.id} className="bg-gray-800 p-2 rounded border border-gray-600 hover:bg-gray-700 cursor-pointer relative group" onClick={() => onRestoreRevision(snap)}>
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="font-bold text-white text-xs">{snap.revision}</span>
                                        <button
                                            onClick={(e) => handleDeleteClick(e, snap.id)}
                                            className="text-gray-500 hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                            title="Delete Revision"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                            </svg>
                                        </button>
                                    </div>
                                    <span className="text-[10px] text-gray-500 block">{new Date(snap.timestamp).toLocaleDateString()}</span>
                                    <span className="text-[10px] text-gray-500 block">{new Date(snap.timestamp).toLocaleTimeString()}</span>
                                </div>
                            ))
                        ) : (
                            <p className="text-gray-500 text-xs italic">No saved revisions.</p>
                        )}
                    </div>

                    {/* Cloud Revisions */}
                    {data.driveRevisions && data.driveRevisions.length > 0 && (
                        <div className="mt-6 border-t border-gray-700 pt-4">
                            <h4 className="text-xs font-bold text-green-400 uppercase mb-3">Cloud Backups</h4>
                            <div className="space-y-2">
                                {data.driveRevisions.map((file) => (
                                    <a
                                        key={file.id}
                                        href={file.webViewLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block bg-gray-800 p-2 rounded border border-gray-700 hover:bg-gray-700 text-xs text-gray-300 flex items-center gap-2"
                                    >
                                        <span>{file.name.endsWith('.docx') ? '📝' : '📄'}</span>
                                        <div className="overflow-hidden text-ellipsis whitespace-nowrap w-24">
                                            {file.name}
                                        </div>
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default QuotationPreview;
