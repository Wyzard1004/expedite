import { query } from '@/lib/db';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Process a single review to calculate its unbiased quality rating (1-5)
 * Returns a rating that evaluates the quality of the hotel experience described in the review
 */
export async function processReviewLLMRating(reviewId: number, reviewText: string): Promise<{
  success: boolean;
  llm_rating?: number;
  reasoning?: string;
  error?: string;
}> {
  try {
    console.log(`[Review LLM] Analyzing review ${reviewId}...`);

    // Use LLM to analyze the review and provide an unbiased quality rating
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

    // Parse LLM response
    const content = response.choices[0].message.content || '';
    let ratingData;

    try {
      // Extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      ratingData = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error(`[Review LLM] Failed to parse response for review ${reviewId}: ${content}`);
      return { success: false, error: 'Failed to parse LLM analysis' };
    }

    // Validate and clamp rating between 1-5
    const llmRating = Math.max(1, Math.min(5, Math.round(ratingData.rating * 2) / 2));

    // Update review with LLM rating
    await query(
      `UPDATE reviews 
       SET llm_rating = $1, llm_rating_updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [llmRating, reviewId]
    );

    console.log(`[Review LLM] ✓ Review ${reviewId} rated: ${llmRating}/5`);

    return {
      success: true,
      llm_rating: llmRating,
      reasoning: ratingData.reasoning,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Review LLM] Error processing review ${reviewId}: ${errorMessage}`);
    return { success: false, error: errorMessage };
  }
}

/**
 * Calculate hotel LLM rating as the average of all review LLM ratings
 */
export async function calculateHotelLLMRating(hotelId: number): Promise<{
  success: boolean;
  llm_rating?: number;
  review_count?: number;
  error?: string;
}> {
  try {
    // Get all reviews with LLM ratings for this hotel
    const result = await query(
      `SELECT AVG(llm_rating) as avg_rating, COUNT(*) as total_reviews, 
              COUNT(CASE WHEN llm_rating IS NOT NULL THEN 1 END) as rated_reviews
       FROM reviews
       WHERE hotel_id = $1 AND llm_rating IS NOT NULL`,
      [hotelId]
    );

    const { avg_rating, total_reviews, rated_reviews } = result.rows[0];

    if (!avg_rating || rated_reviews === 0) {
      console.log(`[Review LLM] Hotel ${hotelId}: No rated reviews yet`);
      return { success: true, llm_rating: undefined, review_count: 0 };
    }

    const llmRating = Math.round(parseFloat(avg_rating) * 2) / 2; // Round to nearest 0.5

    // Update hotel with calculated LLM rating
    await query(
      `UPDATE hotels 
       SET llm_rating = $1, llm_rating_updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [llmRating, hotelId]
    );

    console.log(
      `[Review LLM] ✓ Hotel ${hotelId} LLM rating: ${llmRating}/5 (${rated_reviews}/${total_reviews} reviews)`
    );

    return {
      success: true,
      llm_rating: llmRating,
      review_count: rated_reviews,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Review LLM] Error calculating hotel rating for ${hotelId}: ${errorMessage}`);
    return { success: false, error: errorMessage };
  }
}
