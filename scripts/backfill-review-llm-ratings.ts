#!/usr/bin/env node

/**
 * scripts/backfill-review-llm-ratings.ts
 * 
 * Backfill all reviews with LLM quality ratings (1-5) using batched parallel processing
 * Then calculate hotel LLM ratings as the average of review ratings
 * 
 * Usage: npx ts-node scripts/backfill-review-llm-ratings.ts [--limit 1000] [--batch-size 5] [--clear]
 * 
 * Options:
 *   --limit N         Maximum number of reviews to process (default: all)
 *   --batch-size N    Number of reviews to process in parallel (default: 5, max: 10)
 *   --clear           Clear all llm_rating data before starting (safe restart)
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

if (!apiKey) {
  throw new Error('OPENAI_API_KEY environment variable is not set');
}

const pool = new Pool({
  connectionString,
});

const openai = new OpenAI({
  apiKey,
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
    const rating = Math.max(1, Math.min(5, Math.round(ratingData.rating * 2) / 2));

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
  results: Array<{ reviewId: number; success: boolean; rating?: number }>;
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

  return {
    processed,
    failed,
    results: results.map(r => ({
      reviewId: r.reviewId,
      success: r.success,
      rating: r.rating,
    })),
  };
}

/**
 * Calculate hotel LLM rating as average of review ratings
 */
async function calculateHotelRating(hotelId: number): Promise<number | null> {
  const result = await query(
    `SELECT AVG(llm_rating) as avg, COUNT(*) as total FROM reviews 
     WHERE hotel_id = $1 AND llm_rating IS NOT NULL`,
    [hotelId]
  );

  const { avg, total } = result.rows[0] || { avg: null, total: 0 };
  if (!avg || total === 0) return null;

  const rounded = Math.round(parseFloat(avg) * 2) / 2;
  await query(
    `UPDATE hotels SET llm_rating = $1, llm_rating_updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
    [rounded, hotelId]
  );

  return rounded;
}

/**
 * Clear all LLM ratings (for safe restart)
 */
async function clearLLMRatings(): Promise<void> {
  console.log('[Backfill] Clearing all existing LLM ratings...');
  await query('UPDATE reviews SET llm_rating = NULL, llm_rating_updated_at = NULL');
  await query('UPDATE hotels SET llm_rating = NULL, llm_rating_updated_at = NULL');
  console.log('[Backfill] ✓ Cleared all LLM ratings');
}

async function main() {
  const args = process.argv.slice(2);
  const limitIndex = args.indexOf('--limit');
  const batchSizeIndex = args.indexOf('--batch-size');
  const shouldClear = args.includes('--clear');

  const limit = limitIndex !== -1 ? parseInt(args[limitIndex + 1], 10) : null;
  const batchSize = Math.min(
    batchSizeIndex !== -1 ? parseInt(args[batchSizeIndex + 1], 32) : 32,
    32 // Cap at 32 to avoid rate limiting
  );

  console.log('[Backfill] Starting review LLM rating backfill...');
  console.log(`[Backfill] Batch size: ${batchSize} (parallel processing)`);

  try {
    // Clear if requested (safe restart)
    if (shouldClear) {
      await clearLLMRatings();
    }

    // Get all reviews without LLM ratings
    let sql = 'SELECT id, hotel_id, content FROM reviews WHERE llm_rating IS NULL ORDER BY created_at ASC';
    if (limit) {
      sql += ` LIMIT ${limit}`;
    }

    const result = await query(sql, []);
    const reviews = result.rows;

    console.log(`[Backfill] Found ${reviews.length} reviews needing LLM ratings`);

    if (reviews.length === 0) {
      console.log('[Backfill] ✓ All reviews have LLM ratings');
      await pool.end();
      process.exit(0);
    }

    let totalProcessed = 0;
    let totalFailed = 0;
    const hotelIds = new Set<number>();

    // Process in batches
    for (let i = 0; i < reviews.length; i += batchSize) {
      const batch = reviews.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(reviews.length / batchSize);

      console.log(
        `\n[Backfill] Batch ${batchNum}/${totalBatches} - Processing ${batch.length} reviews...`
      );

      const batchResult = await processBatch(batch);
      totalProcessed += batchResult.processed;
      totalFailed += batchResult.failed;

      // Track affected hotels
      for (const review of batch) {
        hotelIds.add(review.hotel_id);
      }

      const progress = Math.min(((i + batchSize) / reviews.length) * 100, 100);
      console.log(
        `[Backfill] Progress: ${progress.toFixed(1)}% | Processed: ${totalProcessed} | Failed: ${totalFailed}`
      );

      // Add small delay between batches to avoid rate limiting
      if (i + batchSize < reviews.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Recalculate hotel ratings for all affected hotels
    console.log(`\n[Backfill] Recalculating ${hotelIds.size} hotel LLM ratings...`);
    const hotelArray = Array.from(hotelIds);
    let hotelsCalcCount = 0;

    for (let i = 0; i < hotelArray.length; i++) {
      const hotelId = hotelArray[i];
      try {
        const rating = await calculateHotelRating(hotelId);
        if (rating) {
          hotelsCalcCount++;
        }
      } catch (error) {
        console.error(`[Backfill] Error calculating hotel ${hotelId} rating:`, error);
      }

      // Show progress every 10 hotels
      if ((i + 1) % 10 === 0) {
        console.log(
          `[Backfill] Hotel progress: ${(((i + 1) / hotelArray.length) * 100).toFixed(1)}%`
        );
      }
    }

    console.log('\n[Backfill] ========== FINAL SUMMARY ==========');
    console.log(`✓ Reviews processed: ${totalProcessed}`);
    console.log(`✗ Reviews failed: ${totalFailed}`);
    console.log(`📊 Hotels updated: ${hotelsCalcCount}`);
    console.log(`⏱️  Final rating count: ${totalProcessed}/${reviews.length}`);

    console.log('[Backfill] ✓ Backfill complete');
    await pool.end();
    process.exit(totalFailed > 0 ? 1 : 0);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Backfill] Fatal error:', errorMsg);
    await pool.end();
    process.exit(1);
  }
}

main();
