import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

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

async function createEmbedding(text: string): Promise<number[]> {
  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data: any = await response.json();
    return data.data?.[0]?.embedding || [];
  } catch (error) {
    console.error('Error creating embedding:', error);
    return [];
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: ReviewSubmission = await request.json();
    const { hotel_id, review_text, source, gaps_mentioned } = body;

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

    // Categorize the review
    const categories = await categorizeReview(review_text);

    // Create embedding
    const embedding = await createEmbedding(review_text);

    // Save review to database
    const insertResult = await query(
      `INSERT INTO reviews (hotel_id, guest_name, content, source, ai_generated_categories)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [
        hotel_id,
        'Guest', // Anonymous by default
        review_text,
        source || 'text',
        JSON.stringify(categories),
      ]
    );

    const reviewId = insertResult.rows[0].id;

    // Save embedding if we got one
    if (embedding.length > 0) {
      try {
        const embeddingStr = `[${embedding.join(',')}]`;
        await query(
          `INSERT INTO review_embeddings (review_id, embedding)
           VALUES ($1, $2)`,
          [reviewId, embeddingStr]
        );
      } catch (embeddingError) {
        console.warn('Failed to save embedding:', embeddingError);
        // Continue anyway - embedding is nice to have but not critical
      }
    }

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
