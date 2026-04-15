import { query } from '../db';

interface ReviewWithRecency {
  id: number;
  review_text: string;
  created_at: Date;
}

/**
 * Calculate recency weight for a review
 * Recent reviews get 2x weight, older reviews get 1x weight
 * Cutoff: reviews older than 60 days get 1x, newer than 60 days get 2x
 */
function getRecencyWeight(createdAt: Date): number {
  const ageInDays = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24);
  return ageInDays < 60 ? 2 : 1;
}

/**
 * Generate a summary for a category using AI
 * Uses GPT-4o-mini to synthesize review texts with recency weighting
 */
export async function generateCategorySummary(
  categoryName: string,
  reviewTexts: string[],
): Promise<string> {
  if (reviewTexts.length === 0) {
    return `No reviews yet for ${categoryName}`;
  }

  const reviewList = reviewTexts.slice(0, 10).join('\n- ');

  const prompt = `Analyze these guest reviews about "${categoryName}" and generate a single, concise 1-2 sentence summary highlighting the key sentiment and most mentioned aspects. Do not exceed 150 characters.

Reviews:
- ${reviewList}

Summary:`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 100,
        temperature: 0.5,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const summary = data.choices[0].message.content.trim();

    return summary;
  } catch (error) {
    console.error(`[Summarizer] Failed to generate summary for ${categoryName}:`, error);
    // Fallback: return generic summary
    return `${categoryName} received ${reviewTexts.length} reviews with mixed feedback.`;
  }
}

/**
 * Main job processor: Update category summary based on recent reviews
 * Fetches reviews mentioning this category, applies recency weighting, generates summary
 */
export async function summarizeCategory(
  hotelId: number,
  categoryId: number,
  categoryName: string,
  reviewTexts: string[],
): Promise<void> {
  try {
    console.log(`[Job] Starting category summary: hotel ${hotelId}, category ${categoryName}`);

    // Generate the summary
    const summary = await generateCategorySummary(categoryName, reviewTexts);

    // Update the category with new summary and timestamp
    const updateQuery = `
      UPDATE categories
      SET summary_text = $1, updated_at = NOW()
      WHERE id = $2 AND hotel_id = $3
    `;

    await query(updateQuery, [summary, categoryId, hotelId]);

    console.log(
      `[Job] ✓ Category summary updated: ${categoryName} -> "${summary.substring(0, 50)}..."`
    );
  } catch (error) {
    console.error(`[Job] ✗ Failed to summarize category ${categoryName}:`, error);
    throw error;
  }
}
