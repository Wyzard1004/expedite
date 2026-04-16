'use client';

import { useState } from 'react';

interface UpvoteButtonProps {
  reviewId: number;
  initialUpvotes?: number;
  initialDownvotes?: number;
  onVoteSubmit?: (upvotes: number, downvotes: number) => void;
}

export default function UpvoteButton({
  reviewId,
  initialUpvotes = 0,
  initialDownvotes = 0,
  onVoteSubmit,
}: UpvoteButtonProps) {
  const [upvotes, setUpvotes] = useState(initialUpvotes);
  const [downvotes, setDownvotes] = useState(initialDownvotes);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userVote, setUserVote] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleVote = async (helpful: boolean) => {
    try {
      setIsSubmitting(true);
      setError(null);

      // Generate a session ID from browser storage
      let sessionId = localStorage.getItem('review_session_id');
      if (!sessionId) {
        sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        localStorage.setItem('review_session_id', sessionId);
      }

      const response = await fetch('/api/reviews/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          review_id: reviewId,
          helpful,
          session_id: sessionId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMsg = errorData?.error || 'Failed to submit vote';
        console.error('[UpvoteButton] Vote failed:', errorMsg);
        throw new Error(errorMsg);
      }

      const data = await response.json();
      setUpvotes(data.upvotes);
      setDownvotes(data.downvotes);
      setUserVote(helpful);
      onVoteSubmit?.(data.upvotes, data.downvotes);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to vote';
      console.error('[UpvoteButton] Error:', errorMsg);
      setError(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <div className="flex gap-2">
        <button
          onClick={() => handleVote(true)}
          disabled={isSubmitting}
          className={`px-3 py-1.5 rounded-lg font-medium transition-all text-sm ${
            userVote === true
              ? 'bg-green-600 text-white'
              : 'bg-slate-200 text-slate-700 hover:bg-green-100'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          👍 {upvotes > 0 ? upvotes : ''}
        </button>
        <button
          onClick={() => handleVote(false)}
          disabled={isSubmitting}
          className={`px-3 py-1.5 rounded-lg font-medium transition-all text-sm ${
            userVote === false
              ? 'bg-red-600 text-white'
              : 'bg-slate-200 text-slate-700 hover:bg-red-100'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          👎 {downvotes > 0 ? downvotes : ''}
        </button>
      </div>

      {error && <span className="text-xs text-red-600">{error}</span>}
      {isSubmitting && <span className="text-xs text-slate-500">Submitting...</span>}
    </div>
  );
}
