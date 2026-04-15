'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Hotel {
  id: number;
  name: string;
  location: string;
  description: string;
  review_count: number;
}

export default function HotelsPage() {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHotels = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/hotels');
        if (!res.ok) throw new Error('Failed to fetch hotels');
        const data = await res.json();
        setHotels(data.hotels || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchHotels();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-white rounded-lg shadow"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-lg shadow p-8 border-l-4 border-red-500">
            <h1 className="text-2xl font-bold text-red-600">Error</h1>
            <p className="text-slate-600 mt-2">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto p-6">
          <h1 className="text-4xl font-bold text-slate-900">🏨 Hotels</h1>
          <p className="text-slate-600 mt-2">Explore hotels and help us improve their data</p>
        </div>
      </div>

      {/* Hotels Grid */}
      <div className="max-w-6xl mx-auto p-4">
        {hotels.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-slate-600">No hotels found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {hotels.map((hotel) => (
              <Link
                key={hotel.id}
                href={`/hotels/${hotel.id}`}
                className="bg-white rounded-lg shadow hover:shadow-lg hover:scale-105 transition-all overflow-hidden group"
              >
                <div className="p-6">
                  <h2 className="text-xl font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                    {hotel.name || 'Hotel'}
                  </h2>
                  <p className="text-slate-600 text-sm mt-1">📍 {hotel.location}</p>
                  <p className="text-slate-700 text-sm mt-3 line-clamp-2">{hotel.description}</p>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-xs text-slate-500">⭐ {hotel.review_count} reviews</span>
                    <span className="text-blue-600 group-hover:translate-x-1 transition-transform">→</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
