/**
 * Discrepancy Detector
 * Analyzes review text to find contradictions with known hotel amenities
 * Example: Review says "no pool" but hotel DB says "has pool" → Flag it
 */

import { query } from './db';

export interface DetectedDiscrepancy {
  category: string;
  sentiment: 'positive' | 'negative' | 'missing';
  confidence: number;
  description: string;
}

/**
 * Use GPT to analyze review for amenity mentions
 * Returns what amenities are mentioned and sentiment about each
 */
export async function analyzeReviewForAmenities(
  reviewText: string
): Promise<DetectedDiscrepancy[]> {
  const prompt = `Analyze this hotel review and identify amenity mentions. For each amenity, note whether it's mentioned positively, negatively, or is missing.

Review: "${reviewText}"

Return ONLY a JSON array with this structure:
[
  {
    "category": "pool",
    "sentiment": "negative",
    "confidence": 0.95,
    "description": "Review mentions pool was not available or broken"
  },
  {
    "category": "wifi",
    "sentiment": "positive",
    "confidence": 0.9,
    "description": "Guest praised the WiFi quality"
  }
]

Only include amenities the review actually mentions. If no amenities mentioned, return empty array [].`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data: any = await response.json();
    const content = data.choices?.[0]?.message?.content || '[]';

    try {
      let jsonText = content.trim();
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```json?\n?/g, '').replace(/```/g, '');
      }
      const amenities = JSON.parse(jsonText);
      return Array.isArray(amenities) ? amenities : [];
    } catch {
      console.warn('[Discrepancy] Failed to parse amenity analysis:', content);
      return [];
    }
  } catch (error) {
    console.error('[Discrepancy] Failed to analyze amenities:', error);
    return [];
  }
}

/**
 * Check if review sentiment contradicts what hotel advertises
 * Formula: If review says "no X" but hotel has category X → flag as discrepancy
 */
export async function detectDiscrepancies(
  hotelId: number,
  reviewText: string,
  reviewId: number
): Promise<void> {
  try {
    // Get amenities mentioned in review
    const mentionedAmenities = await analyzeReviewForAmenities(reviewText);

    // Get categories hotel supposedly has
    const hotelCategoriesResult = await query(
      `SELECT DISTINCT c.id, c.name 
       FROM categories c
       INNER JOIN review_categories rc ON c.id = rc.category_id
       INNER JOIN reviews r ON rc.review_id = r.id
       WHERE r.hotel_id = $1
       GROUP BY c.id, c.name
       HAVING COUNT(r.id) > 0`,
      [hotelId]
    );

    const knownCategories = new Map(hotelCategoriesResult.rows.map((row: any) => [
      row.name.toLowerCase(),
      row.id,
    ]));

    console.log(`[Discrepancy] Analyzing review ${reviewId} for hotel ${hotelId}`);

    // Check for contradictions
    for (const mention of mentionedAmenities) {
      const categoryName = mention.category.toLowerCase();
      const categoryId = knownCategories.get(categoryName);

      if (!categoryId) {
        // Category not in database at all - skip
        continue;
      }

      // Check if sentiment contradicts known positive reviews
      if (mention.sentiment === 'negative' && mention.confidence > 0.75) {
        // Guest said something negative about an amenity that hotel claims to have
        const flagDescription = `Review mentions: "${mention.description}" (confidence: ${Math.round(mention.confidence * 100)}%)`;

        // Check if similar flag already exists for this hotel/category
        const existingFlag = await query(
          `SELECT id FROM amenity_flags 
           WHERE hotel_id = $1 AND category_id = $2 AND resolved = false
           LIMIT 1`,
          [hotelId, categoryId]
        );

        if (existingFlag.rows.length === 0) {
          // Create new flag
          await query(
            `INSERT INTO amenity_flags (hotel_id, category_id, review_id, flag_type, description)
             VALUES ($1, $2, $3, $4, $5)`,
            [hotelId, categoryId, reviewId, 'contradiction', flagDescription]
          );

          console.log(
            `[Discrepancy] ⚠️  Flagged: ${mention.category} contradiction for hotel ${hotelId}`
          );
        }
      }
    }
  } catch (error) {
    console.error('[Discrepancy] Error detecting discrepancies:', error);
    // Don't throw - discrepancy detection shouldn't block review submission
  }
}

/**
 * Get all unresolved discrepancies for a hotel
 */
export async function getHotelDiscrepancies(hotelId: number) {
  try {
    const result = await query(
      `SELECT 
        af.id,
        af.hotel_id,
        af.category_id,
        c.name as category_name,
        af.flag_type,
        af.description,
        af.resolved,
        af.created_at,
        r.content as review_excerpt
       FROM amenity_flags af
       INNER JOIN categories c ON af.category_id = c.id
       LEFT JOIN reviews r ON af.review_id = r.id
       WHERE af.hotel_id = $1
       ORDER BY af.resolved ASC, af.created_at DESC`,
      [hotelId]
    );

    return result.rows;
  } catch (error) {
    console.error('[Discrepancy] Error fetching discrepancies:', error);
    return [];
  }
}

/**
 * Mark a discrepancy as resolved
 */
export async function resolveDiscrepancy(flagId: number): Promise<boolean> {
  try {
    const result = await query(
      `UPDATE amenity_flags 
       SET resolved = true, updated_at = NOW()
       WHERE id = $1`,
      [flagId]
    );

    return (result.rowCount ?? 0) > 0;
  } catch (error) {
    console.error('[Discrepancy] Error resolving discrepancy:', error);
    return false;
  }
}
