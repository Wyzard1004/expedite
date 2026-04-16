import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface RouteParams {
  id: string;
}

interface RouteContext {
  params: Promise<RouteParams>;
}

/**
 * POST /api/hotels/[id]/llm-rating
 * Calculate unbiased rating from reviews using LLM
 * Removes leniency bias by analyzing sentiment, credibility, and objective concerns
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    const hotelId = parseInt(id, 10);

    if (!hotelId || isNaN(hotelId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid hotel ID' },
        { status: 400 }
      );
    }

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
      return NextResponse.json(
        { success: false, error: 'No reviews found for this hotel' },
        { status: 404 }
      );
    }

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
      console.error('Failed to parse LLM response:', content);
      return NextResponse.json(
        { success: false, error: 'Failed to parse LLM analysis' },
        { status: 500 }
      );
    }

    const llmRating = Math.min(5, Math.max(1, ratingData.rating));

    // Update hotel with LLM rating
    await query(
      `UPDATE hotels 
       SET llm_rating = $1, llm_rating_updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [llmRating, hotelId]
    );

    return NextResponse.json(
      {
        success: true,
        llm_rating: llmRating,
        reasoning: ratingData.reasoning,
        credibility_score: ratingData.credibility_score,
        key_issues: ratingData.key_issues || [],
        key_strengths: ratingData.key_strengths || [],
        reviews_analyzed: reviewsResult.rows.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error calculating LLM rating:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/hotels/[id]/llm-rating
 * Retrieve cached LLM rating for a hotel
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    const hotelId = parseInt(id, 10);

    if (!hotelId || isNaN(hotelId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid hotel ID' },
        { status: 400 }
      );
    }

    const result = await query(
      `SELECT llm_rating, llm_rating_updated_at
       FROM hotels
       WHERE id = $1`,
      [hotelId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Hotel not found' },
        { status: 404 }
      );
    }

    const { llm_rating, llm_rating_updated_at } = result.rows[0];

    return NextResponse.json(
      {
        success: true,
        llm_rating,
        llm_rating_updated_at,
        available: llm_rating !== null,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching LLM rating:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
