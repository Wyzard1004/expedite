'use client';

interface VoiceReviewUIProps {
  hotelId: number;
  hotelName: string;
  dataGaps: Array<{ category_id: number; category_name: string }>;
  onClose: () => void;
  onSubmitSuccess?: () => void;
}

export default function VoiceReviewUI({
  hotelId,
  hotelName,
  dataGaps,
  onClose,
  onSubmitSuccess,
}: VoiceReviewUIProps) {
  return (
    <div className="p-6 text-center">
      <div className="text-6xl mb-4">🎤</div>
      <h3 className="text-xl font-bold text-slate-900 mb-2">Voice Review Coming Soon</h3>
      <p className="text-slate-600 mb-6">Voice recording and AI-powered conversation will be available shortly.</p>

      {/* Data Gaps Info */}
      {dataGaps.length > 0 && (
        <div className="bg-blue-50 p-4 rounded border-l-4 border-blue-500 mb-6 text-left">
          <p className="text-sm font-semibold text-blue-900 mb-2">💡 Tell us about:</p>
          <div className="flex flex-wrap gap-2">
            {dataGaps.map((gap) => (
              <span
                key={gap.category_id}
                className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded"
              >
                {gap.category_name}
              </span>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={onClose}
        className="px-6 py-2 bg-slate-200 hover:bg-slate-300 text-slate-900 font-medium rounded-lg transition-colors"
      >
        Back to Text Review
      </button>
    </div>
  );
}
