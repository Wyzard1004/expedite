'use client';

import { useState } from 'react';

interface StarRatingProps {
  reviewId: number;
  currentRating?: number;
  ratingCount?: number;
  onRatingSubmit?: (rating: number) => void;
  readonly?: boolean;
}

export default function StarRating({
  reviewId,
  currentRating = 0,
  ratingCount = 0,
  onRatingSubmit,
  readonly = false,
}: StarRatingProps) {
  const [hoverRating, setHoverRating] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userRating, setUserRating] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleStarClick = async (rating: number) => {
    if (readonly || isSubmitting) return;

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
          stars: rating,
          session_id: sessionId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit rating');
      }

      const data = await response.json();
      setUserRating(rating);
      onRatingSubmit?.(rating);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rate review');
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayRating = userRating || currentRating || 0;

  return (
    <div className="flex items-center gap-3">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={() => handleStarClick(star)}
            onMouseEnter={() => !readonly && setHoverRating(star)}
            onMouseLeave={() => !readonly && setHoverRating(0)}
            disabled={readonly || isSubmitting}
            className={`text-2xl transition-all ${
              (hoverRating || displayRating) >= star
                ? 'text-yellow-400 scale-110'
                : 'text-slate-300 scale-100'
            } ${readonly ? 'cursor-default' : 'cursor-pointer hover:scale-125'} disabled:opacity-50`}
          >
            ★
          </button>
        ))}
      </div>

      {(displayRating > 0 || ratingCount > 0) && (
        <div className="flex items-center gap-1 text-sm">
          <span className="font-semibold text-slate-900">
            {displayRating > 0 ? displayRating.toFixed(1) : '—'}
          </span>
          <span className="text-slate-500">({ratingCount})</span>
        </div>
      )}

      {error && <span className="text-xs text-red-600">{error}</span>}
      {isSubmitting && <span className="text-xs text-slate-500">Submitting...</span>}
    </div>
  );
}
