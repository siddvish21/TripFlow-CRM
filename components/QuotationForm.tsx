import React, { useRef } from 'react';

interface QuotationFormProps {
  rawText: string;
  setRawText: (text: string) => void;
  margin: number;
  setMargin: (margin: number) => void;
  onGenerate: () => void;
  isLoading: boolean;
  error: string | null;
  onImport: (docFile: File | null, imgFile: File | null) => void;
}

const exampleText = `Trip to Kerala for Mr. and Mrs. Sharma, 2 pax, 1 room.
Dates: 1st Dec to 6th Dec.
Duration: 5 nights 6 days.
Looking for 4-star hotels.
Itinerary:
Day 1: Arrive Cochin, transfer to Munnar.
Day 2: Munnar sightseeing, see tea gardens.
Day 3: Munnar to Thekkady, see Periyar National Park.
Day 4: Thekkady to Alleppey, stay in houseboat.
Day 5: Alleppey to Cochin, sightseeing.
Day 6: Departure from Cochin.
Need a private sedan for the whole trip.
Meal plan: Breakfast and Dinner.
Inclusions: Accommodation, transport, meals as specified, houseboat stay.`;

const QuotationForm: React.FC<QuotationFormProps> = ({
  rawText,
  setRawText,
  margin,
  setMargin,
  onGenerate,
  isLoading,
  error,
  onImport
}) => {
  const docInputRef = useRef<HTMLInputElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);

  const handleImportClick = () => {
      const docFile = docInputRef.current?.files?.[0] || null;
      const imgFile = imgInputRef.current?.files?.[0] || null;
      
      if (!docFile && !imgFile) {
          alert("Please select at least one file to import.");
          return;
      }
      onImport(docFile, imgFile);
  };

  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg flex flex-col h-full">
      {/* IMPORT SECTION */}
      <div className="bg-gray-900/50 p-4 rounded border border-gray-700 mb-6">
          <h2 className="text-sm font-bold text-blue-400 mb-3 flex items-center">
             📂 Import / Restore Existing Quote
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                  <label className="block text-xs text-gray-500 mb-1">Select Quotation (.docx)</label>
                  <input ref={docInputRef} type="file" accept=".docx" className="w-full text-xs text-gray-400 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-gray-700 file:text-white hover:file:bg-gray-600" />
              </div>
              <div>
                  <label className="block text-xs text-gray-500 mb-1">Select Financial Snip (Image)</label>
                  <input ref={imgInputRef} type="file" accept="image/png, image/jpeg, image/jpg" className="w-full text-xs text-gray-400 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-gray-700 file:text-white hover:file:bg-gray-600" />
              </div>
          </div>
          <button 
            onClick={handleImportClick}
            disabled={isLoading}
            className="w-full mt-3 bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs font-bold py-2 rounded transition"
          >
              {isLoading ? 'Processing Files...' : 'Import Files'}
          </button>
      </div>

      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-300">1. Input Details</h2>
        <button 
            onClick={() => setRawText(exampleText)}
            className="bg-gray-700 text-gray-300 text-sm font-bold py-1 px-3 rounded-md hover:bg-gray-600 transition duration-150 ease-in-out"
        >
            Load Example
        </button>
      </div>
      
      <div className="mb-4 flex-1 flex flex-col">
        <label htmlFor="raw-text" className="block text-sm font-medium text-gray-400 mb-2">
          Paste your raw itinerary text below
        </label>
        <textarea
          id="raw-text"
          className="w-full p-3 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out bg-gray-700 text-gray-200 flex-1 resize-none min-h-[200px]"
          placeholder="e.g., Trip to Paris for Mr. Smith, 5 days, see Eiffel Tower, Louvre museum, eat croissants... or click 'Load Example'."
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
        />
      </div>

      <div className="mb-4">
        <label htmlFor="margin" className="block text-sm font-medium text-gray-400 mb-2">
            Margin (%)
        </label>
        <input
            type="number"
            id="margin"
            value={margin}
            onChange={(e) => setMargin(Number(e.target.value))}
            className="w-full p-3 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out bg-gray-700 text-gray-200"
            placeholder="e.g., 15"
        />
      </div>
      
      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      <button
        onClick={onGenerate}
        disabled={isLoading}
        className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition duration-150 ease-in-out flex items-center justify-center"
      >
        {isLoading ? (
          <>
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Generating...
          </>
        ) : (
          '✨ Generate Quotation'
        )}
      </button>
    </div>
  );
};

export default QuotationForm;