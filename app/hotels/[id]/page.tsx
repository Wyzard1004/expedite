'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Hotel {
  id: number;
  name: string;
  location: string;
  description: string;
}

interface Review {
  id: number;
  guest_name: string;
  content: string;
  created_at: string;
  categories: string[];
}

interface Category {
  id: number;
  name: string;
}

interface DataGap {
  category_id: number;
  category_name: string;
  gap_type: 'missing' | 'stale';
  reason: string;
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function HotelPage({ params }: PageProps) {
  const [hotelId, setHotelId] = useState<number | null>(null);
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [gaps, setGaps] = useState<DataGap[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);

  // Get hotel ID from params
  useEffect(() => {
    (async () => {
      const { id } = await params;
      setHotelId(parseInt(id, 10));
    })();
  }, [params]);

  // Fetch hotel data and gaps once we have the ID
  useEffect(() => {
    if (!hotelId) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch hotel details, categories, and reviews
        const hotelRes = await fetch(`/api/hotels/${hotelId}`);
        if (!hotelRes.ok) {
          throw new Error('Failed to fetch hotel');
        }
        const hotelData = await hotelRes.json();
        setHotel(hotelData.hotel);
        setCategories(hotelData.categories);
        setReviews(hotelData.reviews);

        // Fetch data gaps (top 2)
        const gapsRes = await fetch(`/api/hotels/${hotelId}/gaps?limit=2`);
        if (gapsRes.ok) {
          const gapsData = await gapsRes.json();
          setGaps(gapsData.gaps);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [hotelId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow p-8">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-slate-200 rounded w-3/4"></div>
              <div className="h-4 bg-slate-200 rounded w-1/2"></div>
              <div className="space-y-3 mt-6">
                <div className="h-4 bg-slate-200 rounded"></div>
                <div className="h-4 bg-slate-200 rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !hotel) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow p-8 border-l-4 border-red-500">
            <h1 className="text-2xl font-bold text-red-600">Error</h1>
            <p className="text-slate-600 mt-2">{error || 'Hotel not found'}</p>
            <Link href="/hotels" className="text-blue-600 hover:underline mt-4 inline-block">
              ← Back to Hotels
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto p-4">
          <Link href="/hotels" className="text-blue-600 hover:underline text-sm mb-4 inline-block">
            ← Back to Hotels
          </Link>
          <h1 className="text-4xl font-bold text-slate-900">{hotel.name || 'Hotel'}</h1>
          <p className="text-slate-600 mt-2">📍 {hotel.location}</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-6">
        {/* Hero Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-3">About This Hotel</h2>
          <p className="text-slate-700 leading-relaxed">{hotel.description}</p>
        </div>

        {/* Data Gaps / "Ideas to Cover" Section */}
        {gaps.length > 0 && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-500 rounded-lg p-6 shadow-sm">
            <div className="flex items-start space-x-3">
              <div className="text-2xl">💡</div>
              <div>
                <h2 className="text-lg font-semibold text-blue-900 mb-3">Help Us Learn More!</h2>
                <p className="text-blue-800 text-sm mb-4">
                  We'd love to know about these aspects of the hotel:
                </p>
                <div className="space-y-2">
                  {gaps.map((gap) => (
                    <div key={gap.category_id} className="text-blue-800">
                      <span className="font-medium">📌 {gap.category_name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Leave a Review CTA */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Share Your Experience</h2>
              <p className="text-slate-600 text-sm mt-1">Tell us about your stay at {hotel.name}</p>
            </div>
            <button
              onClick={() => setShowReviewModal(true)}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              Leave a Review
            </button>
          </div>
        </div>

        {/* Amenities / Categories Section */}
        {categories.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">
              📋 Mentioned Amenities ({categories.length})
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded text-sm transition-colors"
                >
                  ✓ {category.name}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Reviews */}
        {reviews.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">⭐ Recent Reviews ({reviews.length})</h2>
            <div className="space-y-4">
              {reviews.slice(0, 3).map((review) => (
                <div key={review.id} className="border-l-4 border-slate-300 pl-4 py-2">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-medium text-slate-900">{review.guest_name}</span>
                    <span className="text-xs text-slate-500">
                      {new Date(review.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-slate-700 text-sm mb-2">{review.content}</p>
                  {review.categories.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {review.categories.slice(0, 3).map((cat) => (
                        <span key={cat} className="text-xs bg-slate-200 text-slate-700 px-2 py-1 rounded">
                          {cat}
                        </span>
                      ))}
                      {review.categories.length > 3 && (
                        <span className="text-xs text-slate-600">+{review.categories.length - 3} more</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {reviews.length > 3 && (
                <button className="text-blue-600 hover:underline text-sm font-medium mt-4">
                  View all {reviews.length} reviews →
                </button>
              )}
            </div>
          </div>
        )}

        {/* Empty State */}
        {reviews.length === 0 && (
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <p className="text-slate-600">No reviews yet. Be the first to share your experience!</p>
          </div>
        )}
      </div>

      {/* Review Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full max-h-96 overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Leave a Review</h2>
              <p className="text-slate-600 text-sm mb-4">Coming in Phase 2.4+</p>

              {/* Show suggestions */}
              {gaps.length > 0 && (
                <div className="bg-blue-50 p-3 rounded mb-4">
                  <p className="text-xs font-semibold text-blue-900 mb-2">💡 Consider Mentioning:</p>
                  <ul className="text-xs text-blue-800 space-y-1">
                    {gaps.map((gap) => (
                      <li key={gap.category_id}>• {gap.category_name}</li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="text-slate-600 text-sm mb-4">
                The full review editor with text, voice, and AI features will be available in Phase 2.4+
              </p>

              <button
                onClick={() => setShowReviewModal(false)}
                className="w-full px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-900 font-medium rounded transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
