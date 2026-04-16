'use client';

import { useState } from 'react';

interface FollowUpQuestionProps {
  question: string;
  gapsMissing: string[];
  onResponse: (response: string, comment?: string) => void;
}

export default function FollowUpQuestion({
  question,
  gapsMissing,
  onResponse,
}: FollowUpQuestionProps) {
  const [selectedResponse, setSelectedResponse] = useState<string | null>(null);
  const [comment, setComment] = useState('');

  const handleResponse = (response: string) => {
    setSelectedResponse(response);
    onResponse(response, comment || undefined);
  };

  return (
    <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-4 rounded border-l-4 border-amber-500 space-y-3">
      <div className="mb-3">
        <p className="text-sm font-semibold text-amber-900 mb-1">🤔 One More Thing:</p>
        <p className="text-sm text-amber-800">{question}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => handleResponse('Answer: Yes')}
          className={`px-3 py-1 text-xs font-medium rounded transition-all ${
            selectedResponse === 'Answer: Yes'
              ? 'bg-green-600 text-white shadow-md scale-105'
              : 'bg-green-100 hover:bg-green-200 text-green-800 hover:scale-105'
          }`}
        >
          👍 Yes {selectedResponse === 'Answer: Yes' && '✓'}
        </button>
        <button
          onClick={() => handleResponse('Answer: No')}
          className={`px-3 py-1 text-xs font-medium rounded transition-all ${
            selectedResponse === 'Answer: No'
              ? 'bg-red-600 text-white shadow-md scale-105'
              : 'bg-red-100 hover:bg-red-200 text-red-800 hover:scale-105'
          }`}
        >
          👎 No {selectedResponse === 'Answer: No' && '✓'}
        </button>
        <button
          onClick={() => handleResponse('Answer: Skip')}
          className={`px-3 py-1 text-xs font-medium rounded transition-all ${
            selectedResponse === 'Answer: Skip'
              ? 'bg-slate-600 text-white shadow-md scale-105'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-700 hover:scale-105'
          }`}
        >
          ⏭️ Skip {selectedResponse === 'Answer: Skip' && '✓'}
        </button>
      </div>

      {/* Optional Comment */}
      <div className="mt-3 pt-3 border-t border-amber-200">
        <label className="text-xs font-semibold text-amber-900 mb-1 block">
          💬 Add a comment (optional):
        </label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Tell us more about your answer..."
          className="w-full px-2 py-1.5 text-xs border border-amber-200 rounded bg-white text-amber-900 placeholder-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
          rows={2}
        />
      </div>
    </div>
  );
}
