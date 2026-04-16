import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

interface RatingRequest {
  review_id: number;
  helpful: boolean; // true = upvote, false = downvote
  session_id: string;
}

interface RatingResponse {
  success: boolean;
  message?: string;
  upvotes?: number;
  downvotes?: number;
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<RatingResponse>> {
  try {
    const body: RatingRequest = await request.json();
    const { review_id, helpful, session_id } = body;

    // Validation
    if (!review_id || helpful === undefined || !session_id) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: review_id, helpful, session_id' },
        { status: 400 },
      );
    }

    // Check if review exists
    const reviewCheck = await query('SELECT id FROM reviews WHERE id = $1', [review_id]);
    if (reviewCheck.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Review not found' },
        { status: 404 },
      );
    }

    // Insert or update rating
    try {
      // Convert helpful boolean to stars rating: true = 5, false = 1
      const starsRating = helpful ? 5 : 1;
      
      await query(
        `INSERT INTO review_ratings (review_id, guest_session_id, stars)
         VALUES ($1, $2, $3)
         ON CONFLICT (review_id, guest_session_id) 
         DO UPDATE SET stars = $3, created_at = CURRENT_TIMESTAMP`,
        [review_id, session_id, starsRating],
      );
    } catch (dbError) {
      const err = dbError as any;
      console.error('[API] Database error inserting rating:', {
        code: err.code,
        message: err.message,
        detail: err.detail,
      });
      return NextResponse.json(
        { 
          success: false, 
          error: `Database error: ${err.message}. The review_ratings table appears to have different columns than expected.` 
        },
        { status: 500 },
      );
    }

    // Calculate upvotes (5-star ratings) and downvotes (1-star ratings)
    const voteResult = await query(
      `SELECT 
         SUM(CASE WHEN stars = 5 THEN 1 ELSE 0 END)::INTEGER as upvotes,
         SUM(CASE WHEN stars = 1 THEN 1 ELSE 0 END)::INTEGER as downvotes
       FROM review_ratings
       WHERE review_id = $1`,
      [review_id],
    );

    const upvotes = voteResult.rows[0].upvotes || 0;
    const downvotes = voteResult.rows[0].downvotes || 0;

    // Update denormalized columns
    await query(
      `UPDATE reviews 
       SET upvotes = $1, downvotes = $2
       WHERE id = $3`,
      [upvotes, downvotes, review_id],
    );

    return NextResponse.json(
      {
        success: true,
        message: 'Vote submitted successfully',
        upvotes,
        downvotes,
      },
      { status: 200 },
    );
  } catch (error) {
    const err = error as any;
    console.error('[API] Error submitting vote:', {
      message: err?.message,
      code: err?.code,
      detail: err?.detail,
    });
    return NextResponse.json(
      { 
        success: false, 
        error: err?.message || 'Internal server error'
      },
      { status: 500 },
    );
  }
}

// GET helpful reviews (sorted by upvotes)
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const hotelId = searchParams.get('hotel_id');
    const limit = parseInt(searchParams.get('limit') || '5', 10);

    if (!hotelId) {
      return NextResponse.json(
        { error: 'Missing hotel_id parameter' },
        { status: 400 },
      );
    }

    // Get most helpful reviews (by upvotes)
    const result = await query(
      `SELECT 
         r.id,
         r.hotel_id,
         r.guest_name,
         r.content,
         r.created_at,
         r.upvotes,
         r.downvotes,
         ARRAY_AGG(c.name) as categories
       FROM reviews r
       LEFT JOIN review_categories rc ON r.id = rc.review_id
       LEFT JOIN categories c ON rc.category_id = c.id
       WHERE r.hotel_id = $1 AND r.upvotes > 0
       GROUP BY r.id
       ORDER BY r.upvotes DESC, r.downvotes ASC
       LIMIT $2`,
      [parseInt(hotelId, 10), limit],
    );

    const reviews = result.rows.map((row) => ({
      ...row,
      categories: row.categories.filter((cat: string | null) => cat !== null),
    }));

    return NextResponse.json({ reviews }, { status: 200 });
  } catch (error) {
    console.error('Error fetching helpful reviews:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
