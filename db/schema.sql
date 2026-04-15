-- Enable pgvector extension for AI embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Hotels table
CREATE TABLE IF NOT EXISTS hotels (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  location VARCHAR(255),
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Categories table (for amenities/features)
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Reviews table with vector column for embeddings
CREATE TABLE IF NOT EXISTS reviews (
  id SERIAL PRIMARY KEY,
  hotel_id INTEGER NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  guest_name VARCHAR(255),
  content TEXT NOT NULL,
  embedding vector(1536), -- OpenAI's text-embedding-3-small dimension
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Review categories (junction table linking reviews to categories)
CREATE TABLE IF NOT EXISTS review_categories (
  id SERIAL PRIMARY KEY,
  review_id INTEGER NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(review_id, category_id)
);

-- Amenity flags (for discrepancies detected by Discrepancy Detector)
CREATE TABLE IF NOT EXISTS amenity_flags (
  id SERIAL PRIMARY KEY,
  hotel_id INTEGER NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  review_id INTEGER REFERENCES reviews(id) ON DELETE SET NULL,
  flag_type VARCHAR(50), -- 'missing', 'stale', 'contradiction'
  description TEXT,
  resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Category summaries (for Async Summarizer results)
CREATE TABLE IF NOT EXISTS category_summaries (
  id SERIAL PRIMARY KEY,
  hotel_id INTEGER NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  summary TEXT,
  review_count INTEGER DEFAULT 0,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(hotel_id, category_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_reviews_hotel_id ON reviews(hotel_id);
CREATE INDEX IF NOT EXISTS idx_reviews_embedding ON reviews USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_review_categories_review_id ON review_categories(review_id);
CREATE INDEX IF NOT EXISTS idx_review_categories_category_id ON review_categories(category_id);
CREATE INDEX IF NOT EXISTS idx_amenity_flags_hotel_id ON amenity_flags(hotel_id);
CREATE INDEX IF NOT EXISTS idx_amenity_flags_resolved ON amenity_flags(resolved);
CREATE INDEX IF NOT EXISTS idx_category_summaries_hotel_id ON category_summaries(hotel_id);
