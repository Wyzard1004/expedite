import { query } from '@/lib/db';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Process an LLM-based hotel rating job
 * Analyzes reviews to calculate an unbiased quality rating
 */
export async function processLLMHotelRating(hotelId: number): Promise<{
  success: boolean;
  llm_rating?: number;
  reasoning?: string;
  error?: string;
}> {
  try {
    console.log(`[LLM Processor] Starting LLM rating analysis for hotel ${hotelId}`);

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
      console.log(`[LLM Processor] No reviews found for hotel ${hotelId}`);
      return { success: false, error: 'No reviews found for this hotel' };
    }

    console.log(
      `[LLM Processor] Analyzing ${reviewsResult.rows.length} reviews for hotel ${hotelId}`
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
      console.error(`[LLM Processor] Failed to parse LLM response: ${content}`);
      return {
        success: false,
        error: 'Failed to parse LLM analysis',
      };
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
      `[LLM Processor] Successfully calculated LLM rating for hotel ${hotelId}: ${llmRating}`
    );

    return {
      success: true,
      llm_rating: llmRating,
      reasoning: ratingData.reasoning,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[LLM Processor] Error processing hotel ${hotelId}: ${errorMessage}`);
    return {
      success: false,
      error: errorMessage,
    };
  }
}
