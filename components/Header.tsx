
import React from 'react';
import logo from '../assets/logo.jpg';

interface HeaderProps {
    showBack?: boolean;
    onBack?: () => void;
    onSave?: () => void;
    isSaving?: boolean;
}

const Header: React.FC<HeaderProps> = ({ showBack, onBack, onSave, isSaving }) => {
    return (
        <header className="glass-nav sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex justify-between items-center">
                <div className="flex items-center gap-6">
                    {showBack && (
                        <button
                            onClick={onBack}
                            className="group flex items-center text-sm font-semibold text-gray-400 hover:text-white transition-all"
                        >
                            <div className="bg-gray-800 p-1.5 rounded-lg mr-2 group-hover:bg-gray-700 transition-colors border border-gray-700">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                                </svg>
                            </div>
                            Dashboard
                        </button>
                    )}
                    <div className="flex items-center gap-3">
                        <img src={logo} alt="TripFlow CRM" className="h-10 w-10 rounded-lg shadow-lg border border-gray-700" />
                        <div className="flex flex-col">
                            <h1 className="text-xl md:text-2xl font-extrabold tracking-tight gradient-text leading-tight">
                                TripFlow CRM
                            </h1>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {onSave && (
                        <button
                            onClick={onSave}
                            disabled={isSaving}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center shadow-lg shadow-blue-900/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                        >
                            {isSaving ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Saving...
                                </>
                            ) : '💾 Save Work'}
                        </button>
                    )}

                    {!onSave && (
                        <div className="hidden md:flex flex-col items-end">
                            <span className="text-xs font-bold text-gray-400">Powered by SID</span>
                            <span className="text-[10px] text-gray-600">Travel Industry OS</span>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Header;
