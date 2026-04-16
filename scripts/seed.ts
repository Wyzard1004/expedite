#!/usr/bin/env node

/**
 * scripts/seed.ts
 * 
 * Comprehensive seed script with LLM rating backfill
 * Automatically runs LLM rating processing on all reviews using batched parallel processing
 * 
 * Usage: npx ts-node scripts/seed.ts [--batch-size 5] [--skip-llm]
 * 
 * Options:
 *   --batch-size N    Number of reviews to process in parallel (default: 5, max: 10)
 *   --skip-llm        Skip LLM rating processing (just load CSV data)
 *   --clear-ratings   Clear all LLM ratings before restarting (safe restart option)
 */

import 'dotenv/config';
import { config } from 'dotenv';
import path from 'path';
import { Pool } from 'pg';
import OpenAI from 'openai';

// Load environment variables from .env.local
config({ path: path.resolve(process.cwd(), '.env.local') });

const connectionString = process.env.DATABASE_URL;
const apiKey = process.env.OPENAI_API_KEY;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const pool = new Pool({
  connectionString,
});

const openai = new OpenAI({
  apiKey: apiKey || '',
});

async function query(sql: string, params: any[] = []) {
  const result = await pool.query(sql, params);
  return result;
}

/**
 * Rate a single review using LLM (1-5 scale)
 */
async function rateReview(reviewId: number, reviewText: string): Promise<{
  success: boolean;
  reviewId: number;
  rating?: number;
  reasoning?: string;
  error?: string;
}> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert hotel quality evaluator. Your task is to rate the HOTEL QUALITY described in a guest review on a scale of 1-5.

CORE PRINCIPLE: Rate based on what problems are mentioned vs what positives are mentioned.

Rating formula:
- Count SPECIFIC negatives mentioned (broken things, problems, complaints, issues): bathroom lights out, roaches, rude staff, broken AC, etc.
- Count SPECIFIC positives mentioned (what works, what they liked): clean, comfortable, helpful staff, good food, nice views, etc.
- If MORE negatives than positives: 1-2
- If positives AND negatives mentioned roughly equal: 3
- If MORE positives than negatives, or only positives mentioned: 4-5
- If NO negatives mentioned at all: AT LEAST 4 (even if vague positive like "it was good" or "room was clean")

CRITICAL EXAMPLES:
- "it was good" with zero negatives = 4.0 (positive statement, no problems)
- "roaches in shower" with zero positives = 1.0 (serious problem, no offsetting positives)
- "room was clean" with zero negatives = 4.5 (positive statement, no problems)
- "clean rooms, helpful staff, nice views, except WiFi was slow" = 4.0 (3 positives, 1 negative)
- "terrible WiFi, but hot tubs were exceptional" = 3.5 (mixed: 1 major negative, 1 major positive)

Key instructions:
1. Count ACTUAL statements of problems or positives
2. Do NOT penalize brevity - "room was clean" is a positive fact, rate accordingly
3. Do NOT assume leniency on simple statements - they're just statements of fact
4. Major safety/cleanliness problems (roaches, mold, theft, etc.) = heavy weight toward 1-2
5. Minor issues (single broken item, temperature preference) = lighter weight
6. Vague positive with zero negatives = 4+ (not 1-2)

Rating scale:
1 = Major issues: safety hazards (pests, mold), serious cleanliness, hostile/incompetent staff, multiple broken amenities
2 = Significant issues: cleanliness problems, multiple broken things, unfriendly staff, major inconveniences
3 = Mixed: Some positives but also real issues mentioned (cleanliness lapses, minor maintenance, okay staff)
4 = Good: Mostly positives, zero serious problems, maybe 1 minor issue, or simple positive statements with no negatives
5 = Excellent: Multiple specific positives (clean, helpful, comfortable, good amenities, views), zero negatives mentioned

Return ONLY a JSON object:
{
  "rating": <integer 1-5>,
  "reasoning": "<brief explanation of positive vs negative balance>"
}`,
        },
        {
          role: 'user',
          content: `Rate the hotel quality described in this review:\n\n"${reviewText}"`,
        },
      ],
      temperature: 0.5,
    });

    const content = response.choices[0].message.content || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return { success: false, reviewId, error: 'No JSON in response' };
    }

    const ratingData = JSON.parse(jsonMatch[0]);
    const rating = Math.max(1, Math.min(5, parseFloat(ratingData.rating)));

    return {
      success: true,
      reviewId,
      rating,
      reasoning: ratingData.reasoning,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, reviewId, error: errorMsg };
  }
}

/**
 * Process a batch of reviews in parallel
 */
async function processBatch(reviewIds: Array<{ id: number; content: string }>): Promise<{
  processed: number;
  failed: number;
}> {
  const promises = reviewIds.map(({ id, content }) => rateReview(id, content));
  const results = await Promise.all(promises);

  let processed = 0;
  let failed = 0;

  for (const result of results) {
    if (result.success) {
      processed++;
      // Update review immediately
      await query(
        'UPDATE reviews SET llm_rating = $1, llm_rating_updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [result.rating, result.reviewId]
      );
    } else {
      failed++;
    }
  }

  return { processed, failed };
}

/**
 * Calculate hotel LLM rating as average of review ratings
 */
async function calculateHotelRatings(): Promise<number> {
  const result = await query(
    `UPDATE hotels SET llm_rating = (
       SELECT AVG(llm_rating) FROM reviews WHERE hotel_id = hotels.id AND llm_rating IS NOT NULL
     ), llm_rating_updated_at = CURRENT_TIMESTAMP
     WHERE id IN (SELECT DISTINCT hotel_id FROM reviews WHERE llm_rating IS NOT NULL)
     RETURNING id`
  );
  return result.rows.length;
}

/**
 * Clear all LLM ratings (for safe restart)
 */
async function clearLLMRatings(): Promise<void> {
  console.log('[Seed] Clearing all existing LLM ratings...');
  await query('UPDATE reviews SET llm_rating = NULL, llm_rating_updated_at = NULL');
  await query('UPDATE hotels SET llm_rating = NULL, llm_rating_updated_at = NULL');
  console.log('[Seed] ✓ Cleared all LLM ratings');
}

/**
 * Backfill LLM ratings for all reviews
 */
async function backfillLLMRatings(batchSize: number): Promise<void> {
  console.log(`\n[Seed] Starting LLM rating backfill (batch size: ${batchSize})...`);

  // Get all reviews without LLM ratings
  const result = await query(
    'SELECT id, hotel_id, content FROM reviews WHERE llm_rating IS NULL ORDER BY created_at ASC'
  );
  const reviews = result.rows;

  console.log(`[Seed] Found ${reviews.length} reviews needing LLM ratings`);

  if (reviews.length === 0) {
    console.log('[Seed] ✓ All reviews already have LLM ratings');
    return;
  }

  let totalProcessed = 0;
  let totalFailed = 0;

  // Process in batches
  for (let i = 0; i < reviews.length; i += batchSize) {
    const batch = reviews.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(reviews.length / batchSize);

    console.log(
      `[Seed] Batch ${batchNum}/${totalBatches} - Processing ${batch.length} reviews...`
    );

    const batchResult = await processBatch(batch);
    totalProcessed += batchResult.processed;
    totalFailed += batchResult.failed;

    const progress = Math.min(((i + batchSize) / reviews.length) * 100, 100);
    console.log(
      `[Seed] Progress: ${progress.toFixed(1)}% | Processed: ${totalProcessed} | Failed: ${totalFailed}`
    );

    // Add delay between batches to avoid rate limiting
    if (i + batchSize < reviews.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Recalculate hotel ratings
  console.log(`\n[Seed] Calculating hotel LLM ratings...`);
  const hotelsUpdated = await calculateHotelRatings();
  console.log(`[Seed] ✓ Updated ${hotelsUpdated} hotels`);

  console.log('\n[Seed] ========== LLM RATING SUMMARY ==========');
  console.log(`✓ Reviews processed: ${totalProcessed}`);
  console.log(`✗ Reviews failed: ${totalFailed}`);
  console.log(`📊 Hotels updated: ${hotelsUpdated}`);
}

async function main() {
  const args = process.argv.slice(2);
  const batchSizeIndex = args.indexOf('--batch-size');
  const skipLLM = args.includes('--skip-llm');
  const shouldClear = args.includes('--clear-ratings');

  const batchSize = Math.min(
    batchSizeIndex !== -1 ? parseInt(args[batchSizeIndex + 1], 10) : 5,
    10 // Cap at 10 to avoid rate limiting
  );

  console.log('[Seed] ========== DATABASE SEED SCRIPT ==========');
  console.log(`[Seed] Database: ${connectionString?.split('@')[1] || 'unknown'}`);
  console.log(`[Seed] LLM Processing: ${skipLLM ? 'SKIP' : `ENABLED (batch ${batchSize})`}`);

  try {
    // Clear ratings if requested
    if (shouldClear) {
      await clearLLMRatings();
    }

    // Run LLM backfill if not skipped
    if (!skipLLM) {
      await backfillLLMRatings(batchSize);
    }

    console.log('\n[Seed] ✓ Seeding complete');
    await pool.end();
    process.exit(0);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Seed] ✗ Fatal error:', errorMsg);
    await pool.end();
    process.exit(1);
  }
}

main();
