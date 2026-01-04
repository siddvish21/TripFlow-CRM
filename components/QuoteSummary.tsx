import React, { useMemo, useState, useEffect } from 'react';
import { QuotationData, QuotationSnapshot } from '../types';
import { generateQuoteSummaryText } from '../services/summaryGenerator';
import { generateSmartQuoteSummary } from '../services/geminiService';

interface QuoteSummaryProps {
  data: QuotationData | null;
}

const QuoteSummary: React.FC<QuoteSummaryProps> = ({ data }) => {
  const [selectedId, setSelectedId] = useState<string>('current');
  const [summaryContent, setSummaryContent] = useState<string>('');
  const [loadingAI, setLoadingAI] = useState(false);

  const revisions: QuotationSnapshot[] = useMemo(() => data?.history || [], [data]);

  const activeData: QuotationData | null = useMemo(() => {
    if (!data) return null;
    if (selectedId === 'current') return data;
    const snap = revisions.find(r => r.id === selectedId);
    return snap ? { ...snap.data, history: data.history } : data;
  }, [data, selectedId, revisions]);

  // Default to static generation when data changes
  useEffect(() => {
    if (activeData) {
      setSummaryContent(generateQuoteSummaryText(activeData));
    } else {
      setSummaryContent('');
    }
  }, [activeData]);

  const handleGenerateAI = async () => {
    if (!activeData) return;
    setLoadingAI(true);
    try {
      const smartSummary = await generateSmartQuoteSummary(activeData);
      setSummaryContent(smartSummary);
    } catch (e) {
      console.error(e);
      alert('Failed to generate AI summary. Ensure API key is set.');
    } finally {
      setLoadingAI(false);
    }
  };

  const copyToClipboard = async () => {
    if (!summaryContent) return;
    try {
      await navigator.clipboard.writeText(summaryContent);
      alert('Summary copied to clipboard');
    } catch {
      const ta = document.createElement('textarea');
      ta.value = summaryContent;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      alert('Summary copied to clipboard');
    }
  };

  const openWhatsApp = () => {
    if (!summaryContent) return;
    const url = `https://wa.me/?text=${encodeURIComponent(summaryContent)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="h-full overflow-y-auto p-4 flex flex-col">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">WhatsApp Quote Summary</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleGenerateAI}
            disabled={loadingAI || !activeData}
            className="bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 text-white px-3 py-1 rounded text-sm font-bold flex items-center gap-1"
          >
            {loadingAI ? 'Generating...' : '✨ Smart Summary'}
          </button>
          <button onClick={copyToClipboard} className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded text-sm font-bold">Copy</button>
          <button onClick={openWhatsApp} className="bg-green-600 hover:bg-green-500 text-white px-3 py-1 rounded text-sm font-bold">WhatsApp</button>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 mb-4">
        <label className="block text-sm font-bold text-gray-400 mb-2">Choose Revision</label>
        <select
          className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-gray-200 focus:outline-none focus:border-blue-500"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          <option value="current">Current (unsaved)</option>
          {revisions.map((r) => (
            <option key={r.id} value={r.id}>
              {r.revision} — {new Date(r.timestamp).toLocaleString()}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 flex-1 flex flex-col">
        <label className="block text-sm font-bold text-gray-400 mb-2">Summary Preview</label>
        <textarea
          value={summaryContent}
          onChange={(e) => setSummaryContent(e.target.value)}
          className="w-full flex-1 bg-gray-800 border border-gray-700 rounded p-3 text-gray-200 font-mono resize-none focus:outline-none focus:border-blue-500"
          style={{ minHeight: '300px' }}
        />
        <p className="text-xs text-gray-500 mt-2">
          {loadingAI ? 'AI is analyzing your itinerary...' : 'Short bullet points, simple English, WhatsApp-friendly.'}
        </p>
      </div>
    </div>
  );
};

export default QuoteSummary;