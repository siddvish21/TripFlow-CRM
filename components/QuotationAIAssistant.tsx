
import React, { useState, useRef, useEffect } from 'react';
import { modifyQuotationWithAI } from '../services/geminiService';
import { QuotationData } from '../types';

interface QuotationAIAssistantProps {
    quotationData: QuotationData | null;
    onUpdateQuotation: (newData: QuotationData) => void;
}

interface Message {
    id: number;
    sender: 'user' | 'ai';
    text: string;
}

const QuotationAIAssistant: React.FC<QuotationAIAssistantProps> = ({ quotationData, onUpdateQuotation }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        { id: 0, sender: 'ai', text: 'Hi! I can help you edit this quotation. Ask me to swap days, change hotels, or add activities.' }
    ]);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isOpen]);

    const handleSend = async () => {
        if (!input.trim() || !quotationData) return;
        
        const userMsg = input;
        setInput('');
        setMessages(prev => [...prev, { id: Date.now(), sender: 'user', text: userMsg }]);
        setIsLoading(true);

        try {
            const updatedData = await modifyQuotationWithAI(quotationData, userMsg);
            onUpdateQuotation(updatedData);
            setMessages(prev => [...prev, { id: Date.now() + 1, sender: 'ai', text: '✅ Changes applied successfully!' }]);
        } catch (error: any) {
            console.error(error);
            setMessages(prev => [...prev, { id: Date.now() + 1, sender: 'ai', text: '❌ Sorry, I couldn\'t process that change. Please try again.' }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    if (!quotationData) return null;

    return (
        <div className={`fixed bottom-6 right-6 z-40 flex flex-col items-end font-lexend ${isOpen ? '' : 'pointer-events-none'}`}>
            
            {/* Chat Window */}
            <div className={`bg-gray-800 border border-gray-600 shadow-2xl rounded-lg w-80 md:w-96 transition-all duration-300 overflow-hidden pointer-events-auto mb-4 ${isOpen ? 'opacity-100 translate-y-0 h-[500px]' : 'opacity-0 translate-y-10 h-0'}`}>
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-700 to-blue-600 p-3 flex justify-between items-center">
                    <h3 className="text-white font-bold flex items-center gap-2">
                        <span className="text-lg">🤖</span> AI Co-Pilot
                    </h3>
                    <button onClick={() => setIsOpen(false)} className="text-white hover:text-gray-200">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                    </button>
                </div>

                {/* Messages */}
                <div className="flex-1 bg-gray-900 p-4 overflow-y-auto h-[380px]">
                    {messages.map((msg) => (
                        <div key={msg.id} className={`mb-3 flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] rounded-lg p-3 text-sm ${msg.sender === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-gray-700 text-gray-200 rounded-bl-none'}`}>
                                {msg.text}
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                         <div className="flex justify-start mb-3">
                            <div className="bg-gray-700 rounded-lg p-3 text-gray-400 text-sm italic flex items-center gap-2">
                                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Making changes...
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="p-3 bg-gray-800 border-t border-gray-700 flex gap-2">
                    <input 
                        type="text" 
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Type your change..."
                        className="flex-1 bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        disabled={isLoading}
                    />
                    <button 
                        onClick={handleSend}
                        disabled={isLoading || !input.trim()}
                        className="bg-blue-600 hover:bg-blue-500 text-white p-2 rounded disabled:opacity-50"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Toggle Button */}
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className={`bg-blue-600 hover:bg-blue-500 text-white p-4 rounded-full shadow-lg transition-transform hover:scale-110 pointer-events-auto ${isOpen ? 'rotate-180' : ''}`}
                title="AI Assistant"
            >
                {isOpen ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                ) : (
                    <span className="text-2xl">🤖</span>
                )}
            </button>
        </div>
    );
};

export default QuotationAIAssistant;
