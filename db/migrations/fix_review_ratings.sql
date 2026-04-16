-- Fix review_ratings table - add is_helpful column if it doesn't exist
-- and ensure the table structure is correct

-- First, create the table if it doesn't exist
CREATE TABLE IF NOT EXISTS review_ratings (
  id SERIAL PRIMARY KEY,
  review_id INTEGER NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  guest_session_id VARCHAR(255),
  is_helpful BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(review_id, guest_session_id)
);

-- Add the is_helpful column if it doesn't already exist
-- This handles the case where the table exists but the column is missing
ALTER TABLE review_ratings ADD COLUMN IF NOT EXISTS is_helpful BOOLEAN DEFAULT true;

-- Ensure indexes exist
CREATE INDEX IF NOT EXISTS idx_review_ratings_review_id ON review_ratings(review_id);
CREATE INDEX IF NOT EXISTS idx_review_ratings_session_id ON review_ratings(guest_session_id);

-- Ensure reviews table has the denormalized vote columns
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS upvotes INTEGER DEFAULT 0;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS downvotes INTEGER DEFAULT 0;

-- Ensure reviews table has LLM rating columns with proper precision
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS llm_rating DECIMAL(3,2);
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS llm_rating_updated_at TIMESTAMP;

-- Ensure hotels table has the rating columns
ALTER TABLE hotels ADD COLUMN IF NOT EXISTS star_rating INTEGER;
ALTER TABLE hotels ADD COLUMN IF NOT EXISTS guest_rating DECIMAL(3,2);
ALTER TABLE hotels ADD COLUMN IF NOT EXISTS llm_rating DECIMAL(3,2);
ALTER TABLE hotels ADD COLUMN IF NOT EXISTS llm_rating_updated_at TIMESTAMP;

-- Create performance indexes
CREATE INDEX IF NOT EXISTS idx_reviews_llm_rating ON reviews(llm_rating DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_hotel_id_llm ON reviews(hotel_id, llm_rating DESC);
CREATE INDEX IF NOT EXISTS idx_hotels_star_rating ON hotels(star_rating DESC);
CREATE INDEX IF NOT EXISTS idx_hotels_guest_rating ON hotels(guest_rating DESC);
CREATE INDEX IF NOT EXISTS idx_hotels_llm_rating ON hotels(llm_rating DESC);
