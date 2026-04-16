'use client';

import { useState } from 'react';
import UpvoteButton from './UpvoteButton';

interface SearchResult {
  id: number;
  content: string;
  guest_name: string;
  created_at: string;
  similarity: number;
  upvotes?: number;
  downvotes?: number;
  llm_rating?: number;
}

interface SemanticSearchUIProps {
  hotelId: number;
}

export default function SemanticSearchUI({ hotelId }: SemanticSearchUIProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!searchQuery.trim()) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }

    try {
      setIsSearching(true);
      setError(null);
      setHasSearched(true);

      const response = await fetch(
        `/api/hotels/${hotelId}/search?query=${encodeURIComponent(searchQuery.trim())}&limit=10`
      );

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json();
      setSearchResults(data.results || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setHasSearched(false);
    setError(null);
  };

  const getSimilarityColor = (similarity: number) => {
    if (similarity >= 0.8) return 'bg-green-100 text-green-800';
    if (similarity >= 0.6) return 'bg-blue-100 text-blue-800';
    if (similarity >= 0.4) return 'bg-yellow-100 text-yellow-800';
    return 'bg-orange-100 text-orange-800';
  };

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <form onSubmit={handleSearch} className="space-y-3">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search reviews by topic... (e.g., 'Is the pool heated?', 'Staff friendliness')"
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={!searchQuery.trim() || isSearching}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-lg font-medium transition-colors"
          >
            {isSearching ? '🔍 Searching...' : '🔍 Search'}
          </button>
          {hasSearched && (
            <span className="py-2 text-sm text-slate-600">
              Found {searchResults.length} relevant {searchResults.length === 1 ? 'review' : 'reviews'}
            </span>
          )}
        </div>
      </form>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {/* Search Results */}
      {hasSearched && (
        <div className="space-y-3">
          {searchResults.length === 0 ? (
            <div className="bg-slate-50 rounded-lg p-6 text-center text-slate-600">
              <p>No reviews found matching "{searchQuery}". Try a different search term.</p>
            </div>
          ) : (
            <>
              <div className="text-sm text-slate-600 mb-3">
                💡 <strong>Tip:</strong> Results are ranked by semantic relevance, not just keywords. Similarity score
                shows how closely each review matches your search.
              </div>
              <div className="space-y-3">
                {searchResults.map((result, index) => (
                  <div
                    key={result.id}
                    className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                  <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-3">
                          <span className="font-medium text-slate-900">{result.guest_name}</span>
                          <span className="text-xs text-slate-500">
                            {new Date(result.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="text-right flex flex-col items-end gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getSimilarityColor(result.similarity)}`}>
                            {(result.similarity * 100).toFixed(0)}% match
                          </span>
                          {result.llm_rating && (
                            <div className="flex items-center gap-1 bg-purple-100 rounded px-2 py-1">
                              <span className="text-sm font-semibold text-purple-700">{result.llm_rating}</span>
                              <span className="text-xs text-purple-600">/5</span>
                            </div>
                          )}
                        </div>
                        <UpvoteButton 
                          reviewId={result.id}
                          initialUpvotes={result.upvotes}
                          initialDownvotes={result.downvotes}
                        />
                      </div>
                    </div>
                    <p className="text-slate-700 text-sm leading-relaxed">{result.content}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
