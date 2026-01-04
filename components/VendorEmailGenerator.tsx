
import React, { useState, useRef, useEffect } from 'react';
import { generateVendorEmail, modifyEmailWithAI } from '../services/geminiService';
import { sendGmail, listGmailThreads, getGmailThread, getGmailSignature } from '../services/gmailService';
import { signInToGoogle, getIsSignedIn, getUserEmail } from '../services/googleDriveService'; // Import Auth Helpers
import { EmailState, GmailThread, GmailMessage } from '../types';

interface VendorEmailGeneratorProps {
    state: EmailState;
    onChange: (newState: EmailState) => void;
}

const VendorEmailGenerator: React.FC<VendorEmailGeneratorProps> = ({ state, onChange }) => {
    // Local state for the generation input
    const [requirements, setRequirements] = useState('');
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);

    // AI Chat State
    const [chatInput, setChatInput] = useState('');
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [isChatLoading, setIsChatLoading] = useState(false);

    // Inbox & Linking State
    const [showInbox, setShowInbox] = useState(false);
    const [inboxThreads, setInboxThreads] = useState<GmailThread[]>([]);
    const [loadingInbox, setLoadingInbox] = useState(false);
    const [loadingThread, setLoadingThread] = useState(false);
    const [userSignature, setUserSignature] = useState('');

    // Auth State
    const [isSignedIn, setIsSignedIn] = useState(false);
    const [userEmail, setUserEmail] = useState<string | null>(null);

    const editorRef = useRef<HTMLDivElement>(null);

    // Check Auth Status on Mount
    useEffect(() => {
        const checkAuth = async () => {
            const signedIn = await getIsSignedIn();
            setIsSignedIn(signedIn);
            if (signedIn) {
                const email = await getUserEmail();
                setUserEmail(email);
                getGmailSignature().then(setUserSignature);
            }
        };
        checkAuth();
    }, []);

    const handleGoogleSignIn = async () => {
        try {
            await signInToGoogle();
            setIsSignedIn(true);
            const email = await getUserEmail();
            setUserEmail(email);
            getGmailSignature().then(setUserSignature);
            alert("Signed in successfully!");
        } catch (e: any) {
            alert("Sign in failed: " + e.message);
        }
    };

    // Sync contentEditable with state
    useEffect(() => {
        if (editorRef.current && editorRef.current.innerHTML !== state.currentDraft) {
            editorRef.current.innerHTML = state.currentDraft;
        }
    }, [state.currentDraft]);

    // Refresh Linked Thread on Mount if exists
    useEffect(() => {
        if (state.linkedThreadId && !state.cachedThread) {
            refreshLinkedThread(state.linkedThreadId);
        }
    }, [state.linkedThreadId]);

    const handleContentChange = (e: React.FormEvent<HTMLDivElement>) => {
        const newHtml = e.currentTarget.innerHTML;
        onChange({ ...state, currentDraft: newHtml });
    };

    // Auto-append signature when signature loads and draft is empty
    useEffect(() => {
        if (userSignature && (!state.currentDraft || state.currentDraft === '<br>')) {
            const sigBlock = `<br/><br/><div id="signature">${userSignature}</div>`;
            onChange({ ...state, currentDraft: sigBlock });
        }
    }, [userSignature]);

    const handleGenerate = async () => {
        if (!requirements.trim()) return;
        setLoading(true);
        try {
            const result = await generateVendorEmail(requirements);

            const bodyWithSig = `
                ${result.htmlBody}
                <br/><br/>
                <div id="signature">${userSignature}</div>
            `;

            // Save to history
            const newRevision = {
                id: Date.now(),
                subject: result.subject,
                content: bodyWithSig,
                type: 'Vendor Request' as const
            };

            onChange({
                ...state,
                subject: result.subject,
                currentDraft: bodyWithSig,
                history: [newRevision, ...(state.history || [])]
            });

        } catch (e) {
            console.error(e);
            alert("Failed to generate email");
        } finally {
            setLoading(false);
        }
    };

    const insertSignature = () => {
        if (!userSignature) return;
        const newContent = state.currentDraft + `<br/><br/><div id="signature">${userSignature}</div>`;
        onChange({ ...state, currentDraft: newContent });
    };

    const handleSendEmail = async () => {
        if (!state.recipient || !state.subject || !state.currentDraft) {
            alert("Please fill in To, Subject and Body fields.");
            return;
        }
        setSending(true);
        try {
            // FORCE WRAP: Apply the requested formatting to the entire email body
            // This ensures that whether manual or AI-generated, specifically Verdana/Large is enforced.
            const finalBody = `
                <div style="font-family: Verdana, sans-serif; font-size: large; color: #000000;">
                    ${state.currentDraft}
                </div>
            `;

            // If replying to a thread, pass threadId
            await sendGmail(state.recipient, state.subject, finalBody, state.linkedThreadId);

            alert("✅ Email Sent Successfully!");

            // If linked, refresh the thread to show sent message (might take a second to appear)
            if (state.linkedThreadId) {
                setTimeout(() => refreshLinkedThread(state.linkedThreadId!), 2000);
            }

        } catch (e: any) {
            console.error(e);
            alert(`Failed to send email: ${e.message}`);
        } finally {
            setSending(false);
        }
    }

    const loadRevision = (rev: any) => {
        if (confirm("Load this revision? Current unsaved changes will be lost.")) {
            onChange({ ...state, currentDraft: rev.content, subject: rev.subject || state.subject });
        }
    };

    // AI Chat Logic
    const handleAIChat = async () => {
        if (!chatInput.trim() || !state.currentDraft) return;
        setIsChatLoading(true);
        try {
            const newBody = await modifyEmailWithAI(state.currentDraft, chatInput);
            onChange({ ...state, currentDraft: newBody });
            setChatInput('');
        } catch (e) {
            alert("AI Modification Failed");
        } finally {
            setIsChatLoading(false);
        }
    }

    // --- GMAIL INBOX LOGIC ---
    const handleOpenInbox = async () => {
        setShowInbox(true);
        setLoadingInbox(true);
        try {
            const threads = await listGmailThreads();
            setInboxThreads(threads);
        } catch (e: any) {
            console.error(e);
            alert("Failed to load Inbox. Make sure you signed in.");
        } finally {
            setLoadingInbox(false);
        }
    }

    const handleLinkThread = async (threadId: string) => {
        setShowInbox(false);
        setLoadingThread(true);
        try {
            const fullThread = await getGmailThread(threadId);
            onChange({ ...state, linkedThreadId: threadId, cachedThread: fullThread });

            // Auto-fill subject from thread if empty
            if (!state.subject && fullThread.messages && fullThread.messages.length > 0) {
                const headers = fullThread.messages[0].payload?.headers;
                const subject = headers?.find((h: any) => h.name === 'Subject')?.value;
                if (subject) onChange({ ...state, linkedThreadId: threadId, cachedThread: fullThread, subject: subject });
            }

        } catch (e) {
            alert("Failed to link thread.");
        } finally {
            setLoadingThread(false);
        }
    }

    const refreshLinkedThread = async (threadId: string) => {
        setLoadingThread(true);
        try {
            const fullThread = await getGmailThread(threadId);
            onChange({ ...state, cachedThread: fullThread });
        } catch (e) {
            console.error("Refresh failed", e);
        } finally {
            setLoadingThread(false);
        }
    }

    const unlinkThread = () => {
        if (confirm("Unlink current email thread?")) {
            onChange({ ...state, linkedThreadId: undefined, cachedThread: undefined });
        }
    }

    const getMessageBody = (msg: GmailMessage) => {
        // Try to find HTML part, else Plain Text
        const parts = msg.payload?.parts;
        let bodyData = msg.payload?.body?.data;

        if (parts) {
            const htmlPart = parts.find((p: any) => p.mimeType === 'text/html');
            const textPart = parts.find((p: any) => p.mimeType === 'text/plain');
            if (htmlPart && htmlPart.body?.data) bodyData = htmlPart.body.data;
            else if (textPart && textPart.body?.data) bodyData = textPart.body.data;
        }

        if (bodyData) {
            // Decode Base64URL
            return decodeURIComponent(escape(window.atob(bodyData.replace(/-/g, '+').replace(/_/g, '/'))));
        }
        return msg.snippet;
    }

    return (
        <div className="bg-gray-800 rounded-lg shadow-lg p-6 h-full flex flex-col relative">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-300">📧 Email Client & Generator</h2>
                <div className="flex gap-2">
                    <button
                        onClick={handleOpenInbox}
                        className="bg-green-700 hover:bg-green-600 text-white px-3 py-1 rounded text-sm font-bold flex items-center gap-1"
                    >
                        🔗 Link Thread
                    </button>
                    <button
                        onClick={() => setIsChatOpen(!isChatOpen)}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded text-sm font-bold flex items-center"
                    >
                        🤖 AI Editor
                    </button>
                    <span className="text-xs text-gray-500 flex items-center">{state.history?.length || 0} Revisions</span>

                    {/* Google Sign In Status */}
                    {isSignedIn ? (
                        <div className="flex items-center gap-2 bg-green-900/50 px-3 py-1 rounded border border-green-700/50">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                            <span className="text-xs text-green-200 font-mono hidden xl:block" title={userEmail || ''}>
                                {userEmail ? (userEmail.length > 20 ? userEmail.substring(0, 18) + '..' : userEmail) : 'Connected'}
                            </span>
                        </div>
                    ) : (
                        <button
                            onClick={handleGoogleSignIn}
                            className="bg-white text-gray-900 hover:bg-gray-100 px-3 py-1 rounded text-sm font-bold flex items-center gap-2 border border-gray-300"
                        >
                            <svg className="w-4 h-4" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                            Sign In
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 h-[calc(100vh-200px)]">

                {/* Left Column: Inputs & History */}
                <div className="lg:col-span-4 space-y-4 flex flex-col h-full overflow-hidden">
                    <div className="bg-gray-900 p-4 rounded border border-gray-700">
                        <h3 className="text-sm font-bold text-gray-400 mb-2">Generate New Draft</h3>
                        <textarea
                            value={requirements}
                            onChange={(e) => setRequirements(e.target.value)}
                            placeholder="e.g. 2 pax to Seoul, 3 nights Lotte Hotel, need DMZ tour..."
                            className="w-full h-32 p-3 bg-gray-800 text-gray-200 border border-gray-600 rounded text-sm resize-none"
                        />
                        <button
                            onClick={handleGenerate}
                            disabled={loading || !requirements.trim()}
                            className="w-full mt-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-bold py-2 rounded text-sm"
                        >
                            {loading ? 'Generating...' : '✨ Generate Draft'}
                        </button>
                    </div>

                    {/* Revision History */}
                    <div className="flex-1 overflow-y-auto bg-gray-900/50 rounded border border-gray-700 p-2">
                        <h3 className="text-xs font-bold text-gray-400 mb-2 uppercase">History</h3>
                        <div className="space-y-2">
                            {state.history?.map((rev) => (
                                <div key={rev.id} onClick={() => loadRevision(rev)} className="p-2 bg-gray-800 hover:bg-gray-700 rounded cursor-pointer text-xs border border-gray-700">
                                    <div className="flex justify-between text-gray-500 mb-1">
                                        <span>{new Date(rev.id).toLocaleTimeString()}</span>
                                        <span>{rev.type}</span>
                                    </div>
                                    <div className="text-gray-300 font-bold truncate">{rev.subject}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Column: Email Editor AND Thread View */}
                <div className="lg:col-span-8 flex flex-col h-full gap-4">

                    {/* Linked Thread View */}
                    {state.linkedThreadId && (
                        <div className="flex-1 bg-gray-900 rounded border border-gray-700 flex flex-col overflow-hidden max-h-[40%]">
                            <div className="bg-gray-800 p-2 flex justify-between items-center border-b border-gray-700">
                                <span className="text-xs font-bold text-gray-400 uppercase">🔗 Linked Conversation</span>
                                <div className="flex gap-2">
                                    <button onClick={() => refreshLinkedThread(state.linkedThreadId!)} className="text-xs text-blue-400 hover:underline">Refresh</button>
                                    <button onClick={unlinkThread} className="text-xs text-red-400 hover:underline">Unlink</button>
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                {loadingThread ? (
                                    <p className="text-center text-gray-500">Loading thread...</p>
                                ) : (
                                    state.cachedThread?.messages?.map((msg) => {
                                        const fromHeader = msg.payload?.headers.find((h: any) => h.name === 'From');
                                        const dateHeader = msg.payload?.headers.find((h: any) => h.name === 'Date');
                                        return (
                                            <div key={msg.id} className="bg-gray-800 p-3 rounded border border-gray-700">
                                                <div className="flex justify-between text-xs text-gray-500 mb-1">
                                                    <span className="font-bold text-gray-300">{fromHeader?.value.replace(/<.*>/, '')}</span>
                                                    <span>{dateHeader ? new Date(dateHeader.value).toLocaleString() : ''}</span>
                                                </div>
                                                <div className="text-sm text-gray-300 whitespace-pre-wrap font-sans overflow-hidden" style={{ maxHeight: '150px' }}>
                                                    <div dangerouslySetInnerHTML={{ __html: getMessageBody(msg) }} />
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    )}

                    {/* Email Editor */}
                    <div className="bg-white text-gray-900 rounded border border-gray-700 flex flex-col overflow-hidden flex-1">
                        {/* Header Inputs */}
                        <div className="bg-gray-100 p-4 border-b border-gray-300 space-y-2">
                            <div className="flex items-center">
                                <span className="w-16 text-gray-500 font-bold text-sm">To:</span>
                                <input
                                    type="email"
                                    value={state.recipient}
                                    onChange={e => onChange({ ...state, recipient: e.target.value })}
                                    className="flex-1 bg-white border border-gray-300 rounded px-2 py-1 text-sm outline-none focus:border-blue-500"
                                    placeholder="vendor@example.com"
                                />
                            </div>
                            <div className="flex items-center">
                                <span className="w-16 text-gray-500 font-bold text-sm">Subject:</span>
                                <input
                                    type="text"
                                    value={state.subject}
                                    onChange={e => onChange({ ...state, subject: e.target.value })}
                                    className="flex-1 bg-white border border-gray-300 rounded px-2 py-1 text-sm outline-none focus:border-blue-500"
                                    placeholder="Subject Line"
                                />
                            </div>
                        </div>

                        {/* Rich Text Editor */}
                        <div className="flex-1 relative overflow-y-auto">
                            <div
                                ref={editorRef}
                                className="w-full h-full p-6 outline-none"
                                style={{
                                    minHeight: '300px',
                                    fontFamily: 'Verdana, sans-serif',
                                    fontSize: 'large'
                                }}
                                contentEditable
                                onInput={handleContentChange}
                            />
                            {!state.currentDraft && (
                                <div className="absolute top-6 left-6 text-gray-400 italic pointer-events-none" style={{ fontFamily: 'Verdana, sans-serif', fontSize: 'large' }}>
                                    Email body will appear here...
                                </div>
                            )}
                        </div>

                        {/* Footer Actions */}
                        <div className="bg-gray-100 p-3 border-t border-gray-300 flex justify-between gap-3">
                            {userSignature && (
                                <button onClick={insertSignature} className="text-xs text-blue-600 font-bold hover:underline">
                                    + Insert Signature
                                </button>
                            )}
                            <div className="flex gap-3">
                                <button className="text-gray-600 hover:text-gray-900 text-sm font-bold">Discard</button>
                                <button
                                    onClick={handleSendEmail}
                                    disabled={sending}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded font-bold shadow flex items-center"
                                >
                                    {sending ? 'Sending...' : (state.linkedThreadId ? 'Reply to Thread' : 'Send Email')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Floating AI Chat Assistant */}
            {isChatOpen && (
                <div className="absolute bottom-6 right-6 w-80 bg-gray-800 border border-gray-600 shadow-2xl rounded-lg overflow-hidden flex flex-col z-50">
                    <div className="bg-blue-700 p-3 flex justify-between items-center text-white font-bold">
                        <span>🤖 AI Email Editor</span>
                        <button onClick={() => setIsChatOpen(false)}>✕</button>
                    </div>
                    <div className="p-4 bg-gray-900 h-48 overflow-y-auto text-sm text-gray-300">
                        <p className="mb-2">How can I modify this email?</p>
                        <p className="text-xs text-gray-500 italic">e.g. "Make the tone more urgent", "Add a request for cancellation policy"</p>
                    </div>
                    <div className="p-2 bg-gray-800 border-t border-gray-700 flex">
                        <input
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            className="flex-1 bg-gray-700 text-white text-xs p-2 rounded mr-2"
                            placeholder="Instruction..."
                            onKeyDown={e => e.key === 'Enter' && handleAIChat()}
                        />
                        <button
                            onClick={handleAIChat}
                            disabled={isChatLoading}
                            className="bg-blue-600 text-white px-3 rounded text-xs"
                        >
                            {isChatLoading ? '...' : 'Go'}
                        </button>
                    </div>
                </div>
            )}

            {/* INBOX MODAL */}
            {showInbox && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-6">
                    <div className="bg-gray-800 rounded-lg w-full max-w-2xl h-[80vh] flex flex-col border border-gray-600">
                        <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-white">📥 Inbox (Recent)</h3>
                            <button onClick={() => setShowInbox(false)} className="text-gray-400 hover:text-white">✕</button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {loadingInbox ? (
                                <p className="text-center text-gray-500 py-10">Loading emails...</p>
                            ) : inboxThreads.length > 0 ? (
                                inboxThreads.map(thread => (
                                    <div key={thread.id} onClick={() => handleLinkThread(thread.id)} className="bg-gray-700 p-3 rounded cursor-pointer hover:bg-gray-600 transition">
                                        <p className="text-sm font-bold text-white truncate">{thread.snippet}</p>
                                        <p className="text-xs text-gray-400 mt-1">ID: {thread.id}</p>
                                    </div>
                                ))
                            ) : (
                                <p className="text-center text-gray-500 py-10">No recent emails found or not signed in.</p>
                            )}
                        </div>
                        <div className="p-4 border-t border-gray-700 bg-gray-900 text-xs text-gray-500 text-center">
                            Select a thread to link it to this inquiry workspace.
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VendorEmailGenerator;
