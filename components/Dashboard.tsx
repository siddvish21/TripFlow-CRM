
import React, { useState } from 'react';
import { Lead } from '../types';
import { analyzeLeadIntent } from '../services/geminiService';

interface DashboardProps {
    leads: Lead[];
    onOpenLead: (leadId: number) => void;
    onCreateLead: (lead: Lead) => void;
    onUpdateLead: (lead: Lead) => void;
    onDeleteLead: (leadId: number) => void;
    onOpenSettings: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ leads, onOpenLead, onCreateLead, onUpdateLead, onDeleteLead, onOpenSettings }) => {
    const [showModal, setShowModal] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<{ id: number, score: string, action: string } | null>(null);
    const [analyzingId, setAnalyzingId] = useState<number | null>(null);

    // Form State (for both Create and Edit)
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState<Partial<Lead>>({
        name: '', phone: '', email: '', status: 'New', destination: '', travelDate: '', pax: 2, budget: '', notes: ''
    });

    const handleOpenCreateModal = () => {
        setIsEditing(false);
        setFormData({ name: '', phone: '', email: '', status: 'New', destination: '', travelDate: '', pax: 2, budget: '', notes: '' });
        setShowModal(true);
    };

    const handleOpenEditModal = (e: React.MouseEvent, lead: Lead) => {
        e.stopPropagation();
        setIsEditing(true);
        setFormData({ ...lead });
        setShowModal(true);
    };

    const handleSave = () => {
        if (!formData.name) return alert("Name is required");

        if (isEditing && formData.id) {
            onUpdateLead(formData as Lead);
        } else {
            onCreateLead({
                ...formData as Lead,
                createdAt: Date.now()
            });
        }

        setShowModal(false);
        setFormData({ name: '', phone: '', email: '', status: 'New', destination: '', travelDate: '', pax: 2, budget: '', notes: '' });
        setIsEditing(false);
    };

    const handleDelete = (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        if (confirm("Are you sure you want to delete this lead and all associated data?")) {
            onDeleteLead(id);
        }
    };

    const handleAnalyze = async (e: React.MouseEvent, lead: Lead) => {
        e.stopPropagation();
        setAnalyzingId(lead.id!);
        try {
            const result = await analyzeLeadIntent(lead.notes, lead.budget, lead.destination);
            setAnalysisResult({ id: lead.id!, ...result });
        } catch (error) {
            alert("Analysis failed.");
        } finally {
            setAnalyzingId(null);
        }
    }

    return (
        <div className="max-w-7xl mx-auto p-6 fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
                <div>
                    <h2 className="text-4xl font-extrabold text-white tracking-tight mb-1">
                        Workspace <span className="text-blue-500">Dashboard</span>
                    </h2>
                    <p className="text-gray-400 font-medium">Manage your travel inquiries and AI-powered quotations.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={onOpenSettings}
                        className="bg-slate-800 hover:bg-slate-700 text-gray-300 font-bold py-3.5 px-6 rounded-2xl border border-white/5 flex items-center transition-all hover:scale-105 active:scale-95 shadow-lg"
                        title="Global Settings"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Agency Profile
                    </button>
                    <button
                        onClick={handleOpenCreateModal}
                        className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 px-8 rounded-2xl shadow-xl shadow-blue-900/30 flex items-center transition-all hover:scale-105 active:scale-95"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Create New Inquiry
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {leads.map(lead => (
                    <div
                        key={lead.id}
                        onClick={() => onOpenLead(lead.id!)}
                        className="glass-panel rounded-3xl p-7 cursor-pointer hover:border-blue-500/50 transition-all group relative flex flex-col hover:shadow-2xl hover:shadow-blue-900/10 hover:-translate-y-1"
                    >
                        <div className="flex justify-between items-start mb-6">
                            <div className="flex flex-col">
                                <h3 className="text-2xl font-bold text-white group-hover:text-blue-400 transition-colors truncate max-w-[180px]">{lead.name}</h3>
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">ID: #{lead.id?.toString().slice(-4)}</p>
                            </div>
                            <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider ${lead.status === 'New' ? 'badge-new' :
                                lead.status === 'Quoted' ? 'badge-quoted' :
                                    lead.status === 'Converted' ? 'badge-converted' :
                                        'bg-gray-800 text-gray-400 border border-gray-700'
                                }`}>
                                {lead.status}
                            </span>
                        </div>

                        <div className="space-y-4 text-sm text-gray-300 flex-1">
                            <div className="flex items-center gap-3">
                                <div className="bg-gray-900/50 p-2 rounded-lg text-gray-400">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                </div>
                                <span className="font-semibold">{lead.destination || 'Not Specified'}</span>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="bg-gray-900/50 p-2 rounded-lg text-gray-400">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <span className="font-semibold">{lead.travelDate || 'Dates Pending'}</span>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="bg-gray-900/50 p-2 rounded-lg text-gray-400 text-xs font-bold leading-none">
                                    {lead.pax}
                                </div>
                                <span className="font-semibold">{lead.pax} x Travelers</span>
                                <span className="mx-2 text-gray-700">|</span>
                                <span className="text-blue-400 font-bold">{lead.budget || 'N/A'}</span>
                            </div>

                            {lead.notes && (
                                <div className="mt-4 text-xs text-gray-400 italic bg-black/20 p-3 rounded-2xl border border-white/5 line-clamp-2">
                                    "{lead.notes}"
                                </div>
                            )}
                        </div>

                        {analysisResult && analysisResult.id === lead.id && (
                            <div className="mt-6 p-4 bg-blue-500/10 rounded-2xl border border-blue-500/20 text-xs fade-in">
                                <div className="flex justify-between font-black mb-2 uppercase tracking-widest leading-none">
                                    <span className="text-blue-400">AI Analysis</span>
                                    <span className={analysisResult.score === 'Hot' ? 'text-orange-400' : 'text-blue-300'}>{analysisResult.score} Lead</span>
                                </div>
                                <p className="text-gray-300 font-medium leading-relaxed">{analysisResult.action}</p>
                            </div>
                        )}

                        <div className="flex justify-between items-center mt-6 pt-6 border-t border-white/5">
                            <div className="flex gap-3">
                                <button
                                    onClick={(e) => handleAnalyze(e, lead)}
                                    disabled={analyzingId === lead.id}
                                    className="text-[10px] font-black uppercase tracking-wider bg-white/5 hover:bg-white/10 text-white px-3 py-2 rounded-xl transition-colors disabled:opacity-50"
                                >
                                    {analyzingId === lead.id ? 'Analyzing...' : '🤖 AI Insight'}
                                </button>
                                <button
                                    onClick={(e) => handleOpenEditModal(e, lead)}
                                    className="text-[10px] font-black uppercase tracking-wider bg-white/5 hover:bg-white/10 text-white px-3 py-2 rounded-xl transition-colors"
                                >
                                    ✏️ Edit
                                </button>
                            </div>

                            <button
                                onClick={(e) => handleDelete(e, lead.id!)}
                                className="text-gray-600 hover:text-red-400 transition-colors p-2 hover:bg-red-400/10 rounded-xl"
                                title="Delete Lead"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                            </button>
                        </div>
                    </div>
                ))}

                {leads.length === 0 && (
                    <div className="col-span-full text-center py-24 bg-white/5 rounded-[40px] border-2 border-dashed border-white/10">
                        <div className="bg-gray-800 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 text-4xl">
                            📂
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-2">No active inquiries</h3>
                        <p className="text-gray-500 max-w-xs mx-auto">Create your first lead to start generating AI-powered travel quotations.</p>
                    </div>
                )}
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-[100] p-4 fade-in">
                    <div className="bg-slate-900 rounded-[32px] w-full max-w-lg border border-white/10 p-8 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-cyan-500"></div>

                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-3xl font-extrabold text-white tracking-tight">
                                {isEditing ? 'Update' : 'New'} <span className="text-blue-500">Lead</span>
                            </h3>
                            <button onClick={() => setShowModal(false)} className="bg-white/5 hover:bg-white/10 p-2 rounded-xl transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="space-y-5">
                            <div className="group">
                                <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-2 ml-1">Client Name</label>
                                <input
                                    type="text" placeholder="e.g. John Doe *"
                                    value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-white focus:outline-none focus:border-blue-500 transition-all font-medium"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="group">
                                    <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-2 ml-1">Destination</label>
                                    <input
                                        type="text" placeholder="e.g. Bali"
                                        value={formData.destination} onChange={e => setFormData({ ...formData, destination: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-white focus:outline-none focus:border-blue-500 transition-all font-medium"
                                    />
                                </div>
                                <div className="group">
                                    <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-2 ml-1">Mobile / WhatsApp</label>
                                    <input
                                        type="text" placeholder="+1..."
                                        value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-white focus:outline-none focus:border-blue-500 transition-all font-medium"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="group">
                                    <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-2 ml-1">Pax Count</label>
                                    <input
                                        type="number"
                                        value={formData.pax} onChange={e => setFormData({ ...formData, pax: parseInt(e.target.value) })}
                                        className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-white focus:outline-none focus:border-blue-500 transition-all font-medium"
                                    />
                                </div>
                                <div className="group">
                                    <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-2 ml-1">Travel Date</label>
                                    <input
                                        type="text" placeholder="e.g. June 2024"
                                        value={formData.travelDate} onChange={e => setFormData({ ...formData, travelDate: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-white focus:outline-none focus:border-blue-500 transition-all font-medium"
                                    />
                                </div>
                            </div>

                            <div className="group">
                                <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-2 ml-1">Requirement Notes</label>
                                <textarea
                                    placeholder="Budget, specific hotels, flight preferences..."
                                    value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                    className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-white h-28 focus:outline-none focus:border-blue-500 transition-all font-medium resize-none"
                                />
                            </div>
                        </div>

                        <div className="flex gap-4 mt-10">
                            <button
                                onClick={() => setShowModal(false)}
                                className="flex-1 px-4 py-4 text-gray-400 hover:text-white font-bold transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                className="flex-[2] bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest py-4 rounded-2xl shadow-xl shadow-blue-900/20 transition-all active:scale-95"
                            >
                                {isEditing ? 'Update Inquiry' : 'Create Inquiry'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
