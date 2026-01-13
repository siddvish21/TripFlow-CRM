import React, { useState, useRef, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { generateTestimonialFeedback } from '../services/geminiService';
import { TestimonialState, TestimonialRevision } from '../types';

interface TestimonialGeneratorProps {
    initialClientName?: string;
    initialDestination?: string;
    state?: TestimonialState;
    onChange?: (newState: TestimonialState) => void;
    onClose?: () => void;
}

const TestimonialGenerator: React.FC<TestimonialGeneratorProps> = ({ 
    initialClientName = '', 
    initialDestination = '', 
    state,
    onChange,
    onClose 
}) => {
    // Local state for UI Only (if not managed by parent, although we want it managed by parent)
    // We'll use a local fallback if state prop isn't provided, but strictly we expect it now.
    
    const [clientName, setClientName] = useState(state?.currentClientName || initialClientName);
    const [destination, setDestination] = useState(state?.currentDestination || initialDestination);
    const [uploadedImage, setUploadedImage] = useState<string | null>(state?.currentImage || null);
    const [selectedFeedback, setSelectedFeedback] = useState(state?.currentFeedback || 'Our trip was wonderful! Excellent hotels, smooth planning, and a perfectly managed itinerary. Everything was comfortable and hassle-free throughout.');
    
    const [feedbackEmphasis, setFeedbackEmphasis] = useState('');
    const [generatedOptions, setGeneratedOptions] = useState<string[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    
    const posterRef = useRef<HTMLDivElement>(null);

    // Sync from props if external state changes (e.g. revision restore)
    useEffect(() => {
        if (state) {
            setClientName(state.currentClientName || initialClientName);
            setDestination(state.currentDestination || initialDestination);
            if (state.currentImage) setUploadedImage(state.currentImage);
            if (state.currentFeedback) setSelectedFeedback(state.currentFeedback);
        }
    }, [state, initialClientName, initialDestination]);

    // Update parent state on changes
    const updateParent = (updates: Partial<TestimonialState>) => {
        if (onChange && state) {
            onChange({ ...state, ...updates });
        }
    };

    const handleClientNameChange = (val: string) => {
        setClientName(val);
        updateParent({ currentClientName: val });
    };

    const handleDestinationChange = (val: string) => {
        setDestination(val);
        updateParent({ currentDestination: val });
    };

    const handleFeedbackChange = (val: string) => {
        setSelectedFeedback(val);
        updateParent({ currentFeedback: val });
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const reader = new FileReader();
            reader.onload = (event) => {
                if (event.target?.result) {
                    const result = event.target.result as string;
                    setUploadedImage(result);
                    updateParent({ currentImage: result });
                }
            };
            reader.readAsDataURL(e.target.files[0]);
        }
    };

    const handleGenerateFeedback = async () => {
        setIsGenerating(true);
        try {
            const options = await generateTestimonialFeedback(destination, feedbackEmphasis);
            setGeneratedOptions(options);
            if (options.length > 0) {
                handleFeedbackChange(options[0]);
            }
        } catch (error) {
            alert('Failed to generate feedback');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownload = async () => {
        if (posterRef.current) {
            try {
                const canvas = await html2canvas(posterRef.current, {
                    scale: 2,
                    useCORS: true,
                    backgroundColor: null,
                });
                
                const image = canvas.toDataURL("image/png");
                const link = document.createElement("a");
                link.href = image;
                link.download = `Testimonial_${clientName.replace(/\s+/g, '_')}.png`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } catch (error) {
                console.error("Download failed", error);
                alert("Failed to download poster.");
            }
        }
    };

    const handleSaveRevision = () => {
        if (!state || !onChange) return;
        
        const newRevision: TestimonialRevision = {
            id: Date.now().toString(),
            clientName,
            destination,
            feedback: selectedFeedback,
            image: uploadedImage || undefined,
            createdAt: Date.now()
        };

        const newHistory = [newRevision, ...(state.history || [])];
        onChange({ ...state, history: newHistory });
        alert("Revision saved!");
    };

    const handleRestoreRevision = (rev: TestimonialRevision) => {
        if (!confirm("Restore this version? Current unsaved changes will be replaced.")) return;
        
        setClientName(rev.clientName);
        setDestination(rev.destination);
        setSelectedFeedback(rev.feedback);
        if (rev.image) setUploadedImage(rev.image);
        
        updateParent({
            currentClientName: rev.clientName,
            currentDestination: rev.destination,
            currentFeedback: rev.feedback,
            currentImage: rev.image || null
        });
    };

    const handleDeleteRevision = (id: string) => {
        if (!state || !onChange) return;
        if (!confirm("Delete this revision?")) return;
        
        const newHistory = state.history.filter(h => h.id !== id);
        onChange({ ...state, history: newHistory });
    };

    return (
        <div className="flex flex-col lg:flex-row gap-8 h-full p-6 text-gray-800">
            {/* Google Fonts Injection */}
            <style>
                {`
                @import url('https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Playfair+Display:ital,wght@0,400;0,700;1,400&display=swap');
                
                /* Font Classes */
                .font-montserrat { font-family: 'Montserrat', sans-serif; }
                .font-hello-paris { font-family: 'Playfair Display', serif; } /* Fallback for Hello Paris */
                `}
            </style>

            {/* LEFT: Controls */}
            <div className="w-full lg:w-1/3 flex flex-col gap-6 overflow-y-auto">
                <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
                    <div className="flex justify-between items-center mb-4 border-b pb-2">
                        <h2 className="text-xl font-bold text-gray-900">Poster Settings</h2>
                        <button 
                            onClick={handleSaveRevision}
                            className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition"
                        >
                            💾 Save Rev
                        </button>
                    </div>
                    
                    {/* Image Upload */}
                    <div className="mb-4">
                        <label className="block text-sm font-semibold mb-2">Trip Photo</label>
                        <input 
                            type="file" 
                            accept="image/*" 
                            onChange={handleImageUpload}
                            className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        />
                    </div>

                    {/* Text Inputs */}
                    <div className="mb-4">
                        <label className="block text-sm font-semibold mb-1">Client Name</label>
                        <input 
                            type="text" 
                            value={clientName} 
                            onChange={(e) => handleClientNameChange(e.target.value)}
                            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                    
                    <div className="mb-4">
                        <label className="block text-sm font-semibold mb-1">Destination Header</label>
                        <input 
                            type="text" 
                            value={destination} 
                            onChange={(e) => handleDestinationChange(e.target.value)}
                            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                </div>

                {/* AI Feedback Generator */}
                <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
                    <h2 className="text-xl font-bold mb-4 text-gray-900 border-b pb-2">AI Feedback Generator</h2>
                    
                    <div className="mb-4">
                        <label className="block text-sm font-semibold mb-1">Emphasis (e.g. "Great hotels", "Smooth transfers")</label>
                        <textarea 
                            value={feedbackEmphasis}
                            onChange={(e) => setFeedbackEmphasis(e.target.value)}
                            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none min-h-[60px]"
                            placeholder="What should the feedback focus on?"
                        />
                    </div>

                    <button 
                        onClick={handleGenerateFeedback}
                        disabled={isGenerating}
                        className="w-full bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700 transition disabled:opacity-50 mb-4"
                    >
                        {isGenerating ? 'Generating...' : 'Generate Options'}
                    </button>

                    {generatedOptions.length > 0 && (
                        <div className="space-y-2 mb-4">
                            <label className="block text-sm font-semibold">Select Option:</label>
                            {generatedOptions.map((opt, idx) => (
                                <div 
                                    key={idx} 
                                    onClick={() => handleFeedbackChange(opt)}
                                    className={`p-3 text-sm border rounded cursor-pointer hover:bg-gray-50 ${selectedFeedback === opt ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200'}`}
                                >
                                    {opt}
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="mb-2">
                        <label className="block text-sm font-semibold mb-1">Selected Feedback (Editable)</label>
                        <textarea 
                            value={selectedFeedback}
                            onChange={(e) => handleFeedbackChange(e.target.value)}
                            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none min-h-[100px]"
                        />
                    </div>
                </div>

                {/* History Section */}
                {state && state.history && state.history.length > 0 && (
                    <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 max-h-[300px] overflow-y-auto">
                        <h2 className="text-xl font-bold mb-4 text-gray-900 border-b pb-2">Revision History</h2>
                        <div className="space-y-3">
                            {state.history.map((rev) => (
                                <div key={rev.id} className="p-3 bg-gray-50 rounded border flex justify-between items-start">
                                    <div>
                                        <div className="font-bold text-sm">{rev.clientName}</div>
                                        <div className="text-xs text-gray-500">{new Date(rev.createdAt).toLocaleString()}</div>
                                        <div className="text-xs text-gray-600 mt-1 truncate w-40">{rev.feedback}</div>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <button 
                                            onClick={() => handleRestoreRevision(rev)}
                                            className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200"
                                        >
                                            Restore
                                        </button>
                                        <button 
                                            onClick={() => handleDeleteRevision(rev.id)}
                                            className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}


                <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
                     <button 
                        onClick={handleDownload}
                        className="w-full bg-green-600 text-white py-3 rounded text-lg font-bold hover:bg-green-700 transition shadow-md flex items-center justify-center gap-2"
                    >
                        <span>📥</span> Download Poster PNG
                    </button>
                </div>
            </div>

            {/* RIGHT: Live Preview */}
            <div className="flex-1 bg-gray-900 rounded-xl p-8 flex items-center justify-center overflow-auto border border-gray-700">
                
                {/* POSTER CANVAS */}
                <div 
                    ref={posterRef}
                    className="relative bg-[#1a1a1a] w-[600px] h-[800px] shadow-2xl overflow-hidden flex flex-col shrink-0"
                    style={{
                        background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)'
                    }}
                >
                    {/* Background Accents */}
                    {/* Left Gold Block */}
                    <div className="absolute top-[300px] left-0 w-[200px] h-[300px] bg-[#C5A059] opacity-90 z-0"></div>
                     {/* Right Green Block */}
                    <div className="absolute top-[300px] right-0 w-[200px] h-[400px] bg-[#8FBC8F] opacity-90 z-0"></div>

                    {/* TOP CONTENT (Z-10) */}
                    <div className="relative z-10 w-full text-center pt-8 pb-4">
                        <p className="text-white text-sm font-montserrat tracking-[0.3em] uppercase mb-2">CHECK LIST TRIPS</p>
                        <h1 className="text-white text-5xl font-hello-paris mb-2 drop-shadow-lg">CLIENT TESTIMONIAL</h1>
                        <h2 className="text-white text-3xl font-hello-paris italic tracking-wide">{destination}</h2>
                    </div>

                    {/* FLOATING CARD */}
                    <div className="relative z-20 mx-auto mt-4 w-[480px] bg-[#F5F5DC] rounded-xl shadow-2xl p-4 flex flex-col items-center">
                        {/* Header Row */}
                        <div className="w-full flex items-center justify-between mb-3 px-2">
                             <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-[#C5A059]"></div> {/* Avatar placeholder */}
                                <span className="font-bold text-gray-800 text-lg font-montserrat">{clientName}</span>
                             </div>
                             <div className="flex gap-1 text-[#C5A059] text-xl">
                                 {'★'.repeat(5)}
                             </div>
                        </div>

                        {/* Image */}
                        <div className="w-full h-[320px] bg-gray-300 rounded overflow-hidden mb-4 relative">
                            {uploadedImage ? (
                                <img src={uploadedImage} alt="Trip" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-500 bg-gray-200">
                                    <span>Upload Image</span>
                                </div>
                            )}
                        </div>

                        {/* Quote */}
                        <div className="w-full flex-1 flex flex-col justify-center px-4">
                            <p className="text-center text-gray-800 italic text-lg leading-relaxed font-montserrat">
                                "{selectedFeedback}"
                            </p>
                        </div>

                        {/* Signature */}
                        <div className="w-full text-right mt-3 px-4 pb-2">
                            <span className="text-gray-900 text-lg font-montserrat">~ {clientName.split(' ')[0]}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TestimonialGenerator;
