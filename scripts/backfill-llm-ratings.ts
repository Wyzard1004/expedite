#!/usr/bin/env node

/**
 * scripts/backfill-llm-ratings.ts
 * 
 * Backfill LLM hotel ratings for all hotels without ratings or with stale ratings
 * Usage: npx ts-node scripts/backfill-llm-ratings.ts [--process] [--limit 10]
 * 
 * Options:
 *   --process    Process queued jobs immediately (blocks until complete)
 *   --limit N    Maximum number of hotels to backfill (default: all)
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
 * Process LLM hotel rating synchronously
 */
async function processLLMHotelRating(hotelId: number): Promise<{
  success: boolean;
  llm_rating?: number;
  reasoning?: string;
  error?: string;
}> {
  try {
    console.log(`[Backfill] Analyzing reviews for hotel ${hotelId}...`);

    // Fetch all reviews for this hotel
    const reviewsResult = await query(
      `SELECT id, content, guest_name, created_at
       FROM reviews
       WHERE hotel_id = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [hotelId]
    );

    if (reviewsResult.rows.length === 0) {
      return { success: false, error: 'No reviews found for this hotel' };
    }

    console.log(
      `[Backfill] Found ${reviewsResult.rows.length} reviews for hotel ${hotelId}`
    );

    // Prepare review summaries for LLM
    const reviewTexts = reviewsResult.rows
      .map((r: any) => `"${r.content}"`)
      .join('\n\n');

    // Use LLM to analyze reviews and calculate unbiased rating
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert hotel quality analyst. Your task is to provide an unbiased rating that removes common leniency bias tendencies. 

Key instructions:
1. Guests often inflate ratings due to politeness or reluctance to complain - adjust for this
2. Focus on OBJECTIVE issues (cleanliness, maintenance, noise, amenities) rather than subjective preferences
3. Weight credible specifics heavily (e.g., "broken AC in room 302" is more valuable than "nice place")
4. Identify patterns - if multiple guests mention the same issue, it's critical
5. Be skeptical of extremely positive reviews with generic language
6. Consider staff/service issues as significant quality markers
7. Provide a rating from 1-5 that reflects TRUE quality, not inflated guest sentiment

Return ONLY a JSON object with:
{
  "rating": <number 1-5>,
  "reasoning": "<brief explanation of key factors>",
  "credibility_score": <0-100>,
  "key_issues": [<list of objective issues found>],
  "key_strengths": [<list of objective strengths found>]
}`,
        },
        {
          role: 'user',
          content: `Analyze these ${reviewsResult.rows.length} reviews and provide an unbiased quality rating:\n\n${reviewTexts}`,
        },
      ],
      temperature: 0.5,
    });

    // Parse LLM response
    const content = response.choices[0].message.content || '';
    let ratingData;

    try {
      // Extract JSON from the response (handle cases where there's extra text)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      ratingData = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error(`[Backfill] Failed to parse LLM response: ${content}`);
      return { success: false, error: 'Failed to parse LLM analysis' };
    }

    const llmRating = Math.min(5, Math.max(1, ratingData.rating));

    // Update hotel with LLM rating
    await query(
      `UPDATE hotels 
       SET llm_rating = $1, llm_rating_updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [llmRating, hotelId]
    );

    console.log(
      `[Backfill] ✓ Calculated LLM rating for hotel ${hotelId}: ${llmRating}/5`
    );

    return {
      success: true,
      llm_rating: llmRating,
      reasoning: ratingData.reasoning,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Backfill] Error processing hotel ${hotelId}: ${errorMessage}`);
    return { success: false, error: errorMessage };
  }
}

async function main() {
  console.log('[Backfill] Starting LLM rating backfill process...');

  const args = process.argv.slice(2);
  const shouldProcess = args.includes('--process');
  const limitIndex = args.indexOf('--limit');
  const limit = limitIndex !== -1 ? parseInt(args[limitIndex + 1], 10) : null;

  try {
    // Find all hotels without LLM ratings or with stale ratings
    let query_str = `
      SELECT id, name FROM hotels 
      WHERE llm_rating IS NULL OR llm_rating_updated_at < NOW() - INTERVAL '7 days'
      ORDER BY COALESCE(llm_rating_updated_at, created_at) ASC
    `;

    if (limit) {
      query_str += ` LIMIT ${limit}`;
    }

    const result = await query(query_str, []);
    const hotels = result.rows;

    console.log(`[Backfill] Found ${hotels.length} hotels needing LLM ratings`);

    if (hotels.length === 0) {
      console.log('[Backfill] ✓ All hotels have current LLM ratings');
      process.exit(0);
    }

    console.log(
      `[Backfill] ${shouldProcess ? 'Processing' : 'Queuing'} ${hotels.length} hotels...`
    );

    let queued = 0;
    let processed = 0;
    let failed = 0;

    for (let i = 0; i < hotels.length; i++) {
      const hotel = hotels[i];
      const progress = `[${i + 1}/${hotels.length}]`;

      try {
        if (shouldProcess) {
          // Process immediately (synchronous)
          console.log(`${progress} Processing hotel ${hotel.id} (${hotel.name})...`);

          const result = await processLLMHotelRating(hotel.id);

          if (result.success) {
            console.log(
              `${progress} ✓ Hotel ${hotel.id}: Rating ${result.llm_rating}/5`
            );
            processed++;
          } else {
            console.error(
              `${progress} ✗ Hotel ${hotel.id}: ${result.error}`
            );
            failed++;
          }
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`${progress} ✗ Hotel ${hotel.id}: ${errorMsg}`);
        failed++;
      }
    }

    console.log('\n[Backfill] ========== SUMMARY ==========');
    if (shouldProcess) {
      console.log(`✓ Processed: ${processed} hotels`);
      console.log(`✗ Failed: ${failed} hotels`);
    }

    console.log('[Backfill] ✓ Backfill complete');
    await pool.end();
    process.exit(failed > 0 ? 1 : 0);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Backfill] Fatal error:', errorMsg);
    await pool.end();
    process.exit(1);
  }
}

main();
