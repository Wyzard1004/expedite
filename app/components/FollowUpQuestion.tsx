'use client';

interface FollowUpQuestionProps {
  question: string;
  gapsMissing: string[];
  onResponse: (response: string) => void;
}

export default function FollowUpQuestion({
  question,
  gapsMissing,
  onResponse,
}: FollowUpQuestionProps) {
  return (
    <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-4 rounded border-l-4 border-amber-500">
      <div className="mb-3">
        <p className="text-sm font-semibold text-amber-900 mb-1">🤔 One More Thing:</p>
        <p className="text-sm text-amber-800">{question}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onResponse('Answer: Yes')}
          className="px-3 py-1 text-xs bg-green-100 hover:bg-green-200 text-green-800 font-medium rounded transition-colors"
        >
          👍 Yes
        </button>
        <button
          onClick={() => onResponse('Answer: No')}
          className="px-3 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-800 font-medium rounded transition-colors"
        >
          👎 No
        </button>
        <button
          onClick={() => onResponse('Answer: Skip')}
          className="px-3 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded transition-colors"
        >
          ⏭️ Skip
        </button>
      </div>
    </div>
  );
}
