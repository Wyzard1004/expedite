-- Add review upvotes table (for helpful/not helpful voting)
CREATE TABLE IF NOT EXISTS review_ratings (
  id SERIAL PRIMARY KEY,
  review_id INTEGER NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  guest_session_id VARCHAR(255),
  is_helpful BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(review_id, guest_session_id)
);

-- Add helper columns to reviews for upvote tracking (denormalized for performance)
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS upvotes INTEGER DEFAULT 0;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS downvotes INTEGER DEFAULT 0;

-- Add LLM rating for individual reviews (1-5 scale, unbiased analysis)
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS llm_rating DECIMAL(2,1);
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS llm_rating_updated_at TIMESTAMP;

-- Add hotel rating columns (from original data)
ALTER TABLE hotels ADD COLUMN IF NOT EXISTS star_rating INTEGER;
ALTER TABLE hotels ADD COLUMN IF NOT EXISTS guest_rating DECIMAL(3,2);

-- Add calculated LLM hotel rating (average of review LLM ratings)
ALTER TABLE hotels ADD COLUMN IF NOT EXISTS llm_rating DECIMAL(3,2);
ALTER TABLE hotels ADD COLUMN IF NOT EXISTS llm_rating_updated_at TIMESTAMP;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_review_ratings_review_id ON review_ratings(review_id);
CREATE INDEX IF NOT EXISTS idx_review_ratings_session_id ON review_ratings(guest_session_id);
CREATE INDEX IF NOT EXISTS idx_reviews_llm_rating ON reviews(llm_rating DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_hotel_id_llm ON reviews(hotel_id, llm_rating DESC);
CREATE INDEX IF NOT EXISTS idx_hotels_star_rating ON hotels(star_rating DESC);
CREATE INDEX IF NOT EXISTS idx_hotels_guest_rating ON hotels(guest_rating DESC);
CREATE INDEX IF NOT EXISTS idx_hotels_llm_rating ON hotels(llm_rating DESC);
