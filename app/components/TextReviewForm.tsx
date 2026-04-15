'use client';

import { useState } from 'react';
import MagicEnhanceButton from './MagicEnhanceButton';
import FollowUpQuestion from './FollowUpQuestion';
import OneClickTags from './OneClickTags';

interface TextReviewFormProps {
  hotelId: number;
  hotelName: string;
  dataGaps: Array<{ category_id: number; category_name: string }>;
  onClose: () => void;
  onSubmitSuccess?: () => void;
}

interface FollowUpState {
  question: string;
  gaps_mentioned: string[];
  gaps_missing: string[];
}

export default function TextReviewForm({
  hotelId,
  hotelName,
  dataGaps,
  onClose,
  onSubmitSuccess,
}: TextReviewFormProps) {
  const [initialText, setInitialText] = useState('');
  const [enhancedText, setEnhancedText] = useState('');
  const [enhancing, setEnhancing] = useState(false);
  const [followUp, setFollowUp] = useState<FollowUpState | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleEnhance = async () => {
    if (!initialText.trim()) {
      setError('Please write something first');
      return;
    }

    try {
      setEnhancing(true);
      setError(null);

      // Call Magic Enhance API
      const enhanceRes = await fetch('/api/reviews/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: initialText }),
      });

      if (!enhanceRes.ok) {
        throw new Error('Failed to enhance review');
      }

      const enhanceData = await enhanceRes.json();
      setEnhancedText(enhanceData.enhanced_text);

      // Get follow-up question
      const followUpRes = await fetch('/api/reviews/followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hotel_id: hotelId,
          initial_text: initialText,
          enhanced_text: enhanceData.enhanced_text,
        }),
      });

      if (followUpRes.ok) {
        const followUpData = await followUpRes.json();
        setFollowUp(followUpData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setEnhancing(false);
    }
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setError(null);

      const reviewText = enhancedText || initialText;
      if (!reviewText.trim()) {
        setError('Please write or enhance a review');
        return;
      }

      const submitRes = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hotel_id: hotelId,
          review_text: reviewText,
          source: 'text',
          tags: selectedTags,
          gaps_mentioned: followUp?.gaps_mentioned || [],
        }),
      });

      if (!submitRes.ok) {
        throw new Error('Failed to submit review');
      }

      setSuccess(true);
      setTimeout(() => {
        onSubmitSuccess?.();
        onClose();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="p-6 text-center">
        <div className="text-4xl mb-3">✅</div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">Thank you for your review!</h3>
        <p className="text-slate-600">Your feedback helps us improve {hotelName}</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      {/* Ideas to Cover */}
      {dataGaps.length > 0 && (
        <div className="bg-blue-50 p-4 rounded border-l-4 border-blue-500">
          <p className="text-sm font-semibold text-blue-900 mb-2">💡 Ideas to Cover:</p>
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

      {/* Initial Text Input */}
      <div>
        <label className="block text-sm font-medium text-slate-900 mb-2">
          Tell us about your stay
        </label>
        <textarea
          value={initialText}
          onChange={(e) => setInitialText(e.target.value)}
          placeholder="Be yourself! You can be casual or detailed. Mention what you liked, what could be better, anything that stands out..."
          className="w-full h-32 p-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          disabled={submitting}
        />
        <p className="text-xs text-slate-500 mt-1">{initialText.length} characters</p>
      </div>

      {/* Magic Enhance Button */}
      <MagicEnhanceButton
        disabled={!initialText.trim() || enhancing || submitting}
        loading={enhancing}
        onClick={handleEnhance}
      />

      {/* Enhanced Text Preview */}
      {enhancedText && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded border-l-4 border-green-500">
          <p className="text-xs font-semibold text-green-900 mb-2">✨ Enhanced Preview:</p>
          <p className="text-sm text-green-800">{enhancedText}</p>
        </div>
      )}

      {/* Follow-up Question */}
      {followUp && (
        <FollowUpQuestion
          question={followUp.question}
          gapsMissing={followUp.gaps_missing}
          onResponse={(response) => {
            setSelectedTags([...selectedTags, response]);
          }}
        />
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 p-3 rounded border-l-4 border-red-500">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4">
        <button
          onClick={onClose}
          disabled={submitting}
          className="flex-1 px-4 py-2 border border-slate-300 hover:border-slate-400 text-slate-700 font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting || (!initialText.trim() && !enhancedText.trim())}
          className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              ✓ Submit Review
            </>
          )}
        </button>
      </div>
    </div>
  );
}
