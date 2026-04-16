import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { queueEmbeddingBatch, queueCategorySummarization } from '@/lib/queue';
import { detectDiscrepancies } from '@/lib/discrepancies';
import { getEmbedding } from '@/lib/embeddings';

const apiKey = process.env.OPENAI_API_KEY;

interface ReviewSubmission {
  hotel_id: number;
  review_text: string;
  source: 'text' | 'voice';
  tags?: string[];
  gaps_mentioned?: string[];
}

async function categorizeReview(reviewText: string): Promise<string[]> {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 200,
        messages: [
          {
            role: 'user',
            content: `Extract relevant hotel amenity/feature categories from this review. Return ONLY a JSON array of lowercase category names, no other text.

Review: "${reviewText}"

Example output: ["wifi", "staff", "breakfast", "pool", "bathroom"]

Output:`,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data: any = await response.json();
    const content = data.choices?.[0]?.message?.content || '[]';

    try {
      // Parse the JSON response - handle if it's wrapped in code blocks
      let jsonText = content.trim();
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```json?\n?/g, '').replace(/```/g, '');
      }
      const categories = JSON.parse(jsonText);
      return Array.isArray(categories) ? categories : [];
    } catch {
      console.warn('Failed to parse categories JSON:', content);
      return [];
    }
  } catch (error) {
    console.error('Error categorizing review:', error);
    return [];
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: ReviewSubmission = await request.json();
    const { hotel_id, review_text, gaps_mentioned } = body;

    // Validation
    if (!hotel_id || !review_text) {
      return NextResponse.json(
        { error: 'Missing required fields: hotel_id, review_text' },
        { status: 400 }
      );
    }

    // Verify hotel exists
    const hotelCheck = await query('SELECT id FROM hotels WHERE id = $1', [
      hotel_id,
    ]);
    if (hotelCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Hotel not found' },
        { status: 404 }
      );
    }

    // Categorize the review (in-request for now)
    const categories = await categorizeReview(review_text);

    // Save review to database
    const insertResult = await query(
      `INSERT INTO reviews (hotel_id, guest_name, content)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [
        hotel_id,
        'Guest', // Anonymous by default
        review_text,
      ]
    );

    const reviewId = insertResult.rows[0].id;

    // Link categories to review
    if (categories.length > 0) {
      // Find or create category records
      for (const categoryName of categories) {
        try {
          // Check if category exists
          const categoryCheck = await query(
            'SELECT id FROM categories WHERE LOWER(name) = LOWER($1)',
            [categoryName]
          );

          let categoryId: number;
          if (categoryCheck.rows.length > 0) {
            categoryId = categoryCheck.rows[0].id;
          } else {
            // Create new category
            const newCategory = await query(
              'INSERT INTO categories (name) VALUES ($1) RETURNING id',
              [categoryName]
            );
            categoryId = newCategory.rows[0].id;
          }

          // Link review to category
          await query(
            'INSERT INTO review_categories (review_id, category_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [reviewId, categoryId]
          );
        } catch (err) {
          console.warn(`Failed to link category ${categoryName}:`, err);
        }
      }
    }

    // Generate embedding synchronously
    try {
      console.log(`[API] Generating embedding for review ${reviewId}...`);
      const embedding = await getEmbedding(review_text);

      if (embedding && embedding.length > 0) {
        // Store embedding in pgvector format: [0.123,0.456,...]
        const embeddingStr = `[${embedding.join(',')}]`;
        await query('UPDATE reviews SET embedding = $1::vector WHERE id = $2', [
          embeddingStr,
          reviewId,
        ]);
        console.log(`[API] ✓ Embedding generated and stored for review ${reviewId}`);
      } else {
        console.warn(`[API] Failed to generate embedding for review ${reviewId}`);
      }
    } catch (err) {
      console.error(`[API] Error generating embedding for review ${reviewId}:`, err);
      // Don't fail the review submission if embedding fails
    }

    // Detect discrepancies asynchronously (fire and forget)
    detectDiscrepancies(hotel_id, review_text, reviewId).catch((error) => {
      console.error('[API] Failed to detect discrepancies:', error);
    });

    // Queue async processing (fire and forget) - for categorization jobs
    // Note: Embeddings are now generated synchronously above
    try {
      // Queue category summarization for each category
      if (categories.length > 0) {
        for (const categoryName of categories) {
          try {
            const categoryCheck = await query(
              'SELECT id FROM categories WHERE LOWER(name) = LOWER($1)',
              [categoryName]
            );

            if (categoryCheck.rows.length > 0) {
              const categoryId = categoryCheck.rows[0].id;

              // Fetch recent reviews for this category to summarize
              const recentReviews = await query(
                `SELECT r.content FROM reviews r
                 INNER JOIN review_categories rc ON r.id = rc.review_id
                 WHERE rc.category_id = $1
                 ORDER BY r.created_at DESC
                 LIMIT 10`,
                [categoryId]
              );

              const reviewTexts = recentReviews.rows.map((row) => row.content);

              queueCategorySummarization(
                hotel_id,
                categoryId,
                categoryName,
                reviewTexts
              ).catch((error) => {
                console.error(
                  `[API] Failed to queue category summary for ${categoryName}:`,
                  error
                );
              });
            }
          } catch (err) {
            console.warn(`[API] Failed to queue category summary ${categoryName}:`, err);
          }
        }
      }
    } catch (error) {
      console.error('[API] Failed to queue async jobs:', error);
      // Continue - queueing failures don't block the response
    }

    return NextResponse.json({
      success: true,
      review_id: reviewId,
      categories,
      message: 'Review submitted successfully',
    });
  } catch (error) {
    console.error('Error submitting review:', error);
    return NextResponse.json(
      { error: 'Failed to submit review' },
      { status: 500 }
    );
  }
}
