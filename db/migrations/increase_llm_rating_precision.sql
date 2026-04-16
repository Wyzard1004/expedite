-- Migration to increase decimal precision for LLM ratings
-- Allow 2 decimal places instead of 1 to store exact values without rounding

ALTER TABLE reviews 
  ALTER COLUMN llm_rating TYPE DECIMAL(3,2);
