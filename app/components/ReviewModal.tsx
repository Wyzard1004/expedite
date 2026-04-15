'use client';

import { useState } from 'react';
import TextReviewForm from './TextReviewForm';
import VoiceReviewUI from './VoiceReviewUI';

interface ReviewModalProps {
  hotelId: number;
  hotelName: string;
  dataGaps: Array<{ category_id: number; category_name: string }>;
  onClose: () => void;
  onSubmitSuccess?: () => void;
}

export default function ReviewModal({
  hotelId,
  hotelName,
  dataGaps,
  onClose,
  onSubmitSuccess,
}: ReviewModalProps) {
  const [activeTab, setActiveTab] = useState<'text' | 'voice'>('text');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-96 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Leave a Review</h2>
            <p className="text-slate-600 text-sm mt-1">for {hotelName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors text-2xl font-bold w-8 h-8 flex items-center justify-center"
          >
            ×
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-200 px-6 pt-4">
          <button
            onClick={() => setActiveTab('text')}
            className={`px-4 py-2 font-medium transition-colors border-b-2 ${
              activeTab === 'text'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            📝 Text Review
          </button>
          <button
            onClick={() => setActiveTab('voice')}
            className={`px-4 py-2 font-medium transition-colors border-b-2 ${
              activeTab === 'voice'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            🎤 Voice Review
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'text' ? (
            <TextReviewForm
              hotelId={hotelId}
              hotelName={hotelName}
              dataGaps={dataGaps}
              onClose={onClose}
              onSubmitSuccess={onSubmitSuccess}
            />
          ) : (
            <VoiceReviewUI
              hotelId={hotelId}
              hotelName={hotelName}
              dataGaps={dataGaps}
              onClose={onClose}
              onSubmitSuccess={onSubmitSuccess}
            />
          )}
        </div>
      </div>
    </div>
  );
}
