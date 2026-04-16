import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { queueLLMHotelRating } from '@/lib/queue';

/**
 * POST /api/admin/llm-ratings/batch
 * Queue LLM rating calculations for one or more hotels
 * Query params:
 *   - hotel_ids: comma-separated list of hotel IDs (optional - if omitted, queues all hotels)
 *   - limit: number of hotels to process (default: 10)
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const hotelIdsParam = searchParams.get('hotel_ids');
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    let hotelIds: number[];

    if (hotelIdsParam) {
      // Process specific hotels
      hotelIds = hotelIdsParam.split(',').map((id) => parseInt(id.trim(), 10));
    } else {
      // Queue hotels with no LLM rating or stale ratings (older than 7 days)
      const result = await query(
        `SELECT id FROM hotels 
         WHERE llm_rating IS NULL OR llm_rating_updated_at < NOW() - INTERVAL '7 days'
         LIMIT $1`,
        [limit]
      );
      hotelIds = result.rows.map((row: any) => row.id);
    }

    if (hotelIds.length === 0) {
      return NextResponse.json(
        {
          success: true,
          message: 'No hotels to process',
          queued: 0,
        },
        { status: 200 }
      );
    }

    // Queue LLM rating jobs for each hotel
    const jobIds: string[] = [];
    for (const hotelId of hotelIds) {
      try {
        const jobId = await queueLLMHotelRating(hotelId);
        jobIds.push(jobId);
      } catch (error) {
        console.error(`Failed to queue LLM rating for hotel ${hotelId}:`, error);
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: `Queued ${jobIds.length} LLM rating jobs`,
        queued: jobIds.length,
        job_ids: jobIds,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error queueing LLM ratings:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/llm-ratings/status
 * Check LLM rating status for hotels
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const hotelId = searchParams.get('hotel_id');

    if (hotelId) {
      // Get status for specific hotel
      const result = await query(
        `SELECT id, name, llm_rating, llm_rating_updated_at
         FROM hotels
         WHERE id = $1`,
        [parseInt(hotelId, 10)]
      );

      if (result.rows.length === 0) {
        return NextResponse.json({ error: 'Hotel not found' }, { status: 404 });
      }

      const hotel = result.rows[0];
      return NextResponse.json(
        {
          success: true,
          hotel: {
            id: hotel.id,
            name: hotel.name,
            llm_rating: hotel.llm_rating,
            llm_rating_updated_at: hotel.llm_rating_updated_at,
            has_llm_rating: hotel.llm_rating !== null,
          },
        },
        { status: 200 }
      );
    } else {
      // Get summary of all hotels
      const result = await query(
        `SELECT 
           COUNT(*) as total_hotels,
           COUNT(CASE WHEN llm_rating IS NOT NULL THEN 1 END) as with_llm_rating,
           COUNT(CASE WHEN llm_rating IS NULL THEN 1 END) as without_llm_rating,
           COUNT(CASE WHEN llm_rating_updated_at < NOW() - INTERVAL '7 days' THEN 1 END) as stale_ratings
         FROM hotels`
      );

      const stats = result.rows[0];
      return NextResponse.json(
        {
          success: true,
          stats,
        },
        { status: 200 }
      );
    }
  } catch (error) {
    console.error('Error checking LLM ratings status:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
