'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface Discrepancy {
  id: number;
  hotel_id: number;
  category_id: number;
  category_name: string;
  flag_type: string;
  description: string;
  resolved: boolean;
  created_at: string;
  review_excerpt?: string;
}

interface Hotel {
  id: number;
  name: string;
  location: string;
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const hotelId = searchParams.get('hotel_id');

  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [selectedHotelId, setSelectedHotelId] = useState<number | null>(
    hotelId ? parseInt(hotelId, 10) : null
  );
  const [discrepancies, setDiscrepancies] = useState<Discrepancy[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('open');

  // Fetch available hotels
  useEffect(() => {
    const fetchHotels = async () => {
      try {
        const res = await fetch('/api/hotels');
        const data = await res.json();
        setHotels(data.hotels || []);

        // If no hotel selected but we have hotels, select the first one
        if (!selectedHotelId && data.hotels?.length > 0) {
          setSelectedHotelId(data.hotels[0].id);
        }
      } catch (err) {
        console.error('Failed to fetch hotels:', err);
      }
    };

    fetchHotels();
  }, [selectedHotelId]);

  // Fetch discrepancies for selected hotel
  useEffect(() => {
    if (!selectedHotelId) return;

    const fetchDiscrepancies = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/admin/discrepancies?hotel_id=${selectedHotelId}`);
        const data = await res.json();

        if (data.success) {
          setDiscrepancies(data.discrepancies || []);
        }
      } catch (err) {
        console.error('Failed to fetch discrepancies:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDiscrepancies();
  }, [selectedHotelId]);

  const handleResolve = async (flagId: number) => {
    try {
      const res = await fetch('/api/admin/discrepancies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flag_id: flagId }),
      });

      if (res.ok) {
        // Update local state
        setDiscrepancies((prev) =>
          prev.map((d) => (d.id === flagId ? { ...d, resolved: true } : d))
        );
      }
    } catch (err) {
      console.error('Failed to resolve discrepancy:', err);
    }
  };

  const filteredDiscrepancies = discrepancies.filter((d) => {
    if (filter === 'open') return !d.resolved;
    if (filter === 'resolved') return d.resolved;
    return true;
  });

  const selectedHotel = hotels.find((h) => h.id === selectedHotelId);
  const unresolvedCount = discrepancies.filter((d) => !d.resolved).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto p-6">
          <Link href="/" className="text-blue-600 hover:text-blue-700 transition-colors text-sm font-medium flex items-center gap-1 mb-4">
            🏠 Home
          </Link>
          <h1 className="text-4xl font-bold text-slate-900">Host Dashboard</h1>
          <p className="text-slate-600 mt-2">
            Review data discrepancies and manage property information
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {/* Hotel Selector */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <label className="block text-sm font-semibold text-slate-900 mb-3">
            Select Your Hotel:
          </label>
          <select
            value={selectedHotelId || ''}
            onChange={(e) => setSelectedHotelId(parseInt(e.target.value, 10))}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Choose a hotel...</option>
            {hotels.map((hotel) => (
              <option key={hotel.id} value={hotel.id}>
                {hotel.name} ({hotel.location})
              </option>
            ))}
          </select>
        </div>

        {selectedHotel && (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-lg shadow p-6 border-l-4 border-orange-500">
                <p className="text-sm text-slate-600">Open Issues</p>
                <p className="text-3xl font-bold text-orange-600 mt-2">{unresolvedCount}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
                <p className="text-sm text-slate-600">Resolved</p>
                <p className="text-3xl font-bold text-green-600 mt-2">
                  {discrepancies.filter((d) => d.resolved).length}
                </p>
              </div>
              <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
                <p className="text-sm text-slate-600">Total Issues</p>
                <p className="text-3xl font-bold text-blue-600 mt-2">{discrepancies.length}</p>
              </div>
            </div>

            {/* Filter Buttons */}
            <div className="flex gap-3 mb-6">
              {(['all', 'open', 'resolved'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    filter === f
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-slate-700 border border-slate-300 hover:border-slate-400'
                  }`}
                >
                  {f === 'all' && 'All'}
                  {f === 'open' && 'Open'}
                  {f === 'resolved' && '✅ Resolved'}
                </button>
              ))}
            </div>

            {/* Issues List */}
            <div className="space-y-4">
              {loading ? (
                <div className="bg-white rounded-lg shadow p-8 text-center">
                  <div className="animate-pulse">
                    <p className="text-slate-600">Loading discrepancies...</p>
                  </div>
                </div>
              ) : filteredDiscrepancies.length === 0 ? (
                <div className="bg-white rounded-lg shadow p-8 text-center">
                  <p className="text-slate-600">
                    {filter === 'open'
                      ? "Excellent! No open issues for this hotel. 🎉"
                      : 'No discrepancies found.'}
                  </p>
                </div>
              ) : (
                filteredDiscrepancies.map((issue) => (
                  <div
                    key={issue.id}
                    className={`bg-white rounded-lg shadow p-6 border-l-4 ${
                      issue.resolved ? 'border-green-500 opacity-75' : 'border-orange-500'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-slate-900">
                          {issue.resolved && '✅ '}{' '}
                          <span className="text-blue-600">{issue.category_name}</span>
                        </h3>
                        <p className="text-sm text-slate-500 mt-1">
                          {new Date(issue.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          issue.flag_type === 'contradiction'
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {issue.flag_type}
                      </span>
                    </div>

                    <p className="text-slate-700 mb-3">{issue.description}</p>

                    {issue.review_excerpt && (
                      <div className="bg-slate-50 p-3 rounded border-l-2 border-slate-300 mb-4">
                        <p className="text-xs text-slate-600 font-semibold mb-1">Guest said:</p>
                        <p className="text-sm text-slate-700 italic">
                          "{issue.review_excerpt.substring(0, 150)}
                          {issue.review_excerpt.length > 150 ? '...' : ''}"
                        </p>
                      </div>
                    )}

                    {!issue.resolved && (
                      <button
                        onClick={() => handleResolve(issue.id)}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
                      >
                        Mark as Resolved
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {!selectedHotelId && hotels.length === 0 && (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-slate-600">No hotels found. Please add some hotels first.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function HostDashboard() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-100 p-6">Loading...</div>}>
      <DashboardContent />
    </Suspense>
  );
}
