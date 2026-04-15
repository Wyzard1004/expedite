import { NextRequest, NextResponse } from 'next/server';
import { findDataGaps, getDataGapStats } from '@/lib/dataGapEngine';

interface DataGapResponse {
  hotel_id: number;
  gaps: Array<{
    category_id: number;
    category_name: string;
    gap_type: 'missing' | 'stale';
    last_review_date: string | null;
    days_since_last_review: number | null;
    priority_score: number;
    reason: string;
  }>;
  stats: {
    total_categories: number;
    mentioned_categories: number;
    missing_categories: number;
    stale_categories: number;
    coverage_percentage: number;
  };
  error?: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<DataGapResponse>> {
  try {
    const { id } = await params;
    const hotelId = parseInt(id, 10);
    const limit = request.nextUrl.searchParams.get('limit') || '2';
    const limitNum = Math.min(parseInt(limit, 10), 10); // Max 10 to prevent abuse

    if (isNaN(hotelId) || hotelId < 1) {
      return NextResponse.json(
        {
          hotel_id: hotelId,
          gaps: [],
          stats: {
            total_categories: 0,
            mentioned_categories: 0,
            missing_categories: 0,
            stale_categories: 0,
            coverage_percentage: 0,
          },
          error: 'Invalid hotel ID',
        },
        { status: 400 },
      );
    }

    // Get data gaps and stats
    const gaps = await findDataGaps(hotelId, limitNum);
    const stats = await getDataGapStats(hotelId);

    return NextResponse.json({
      hotel_id: hotelId,
      gaps,
      stats,
    });
  } catch (error) {
    console.error('Error fetching data gaps:', error);
    return NextResponse.json(
      {
        hotel_id: parseInt((await params).id || '-1', 10),
        gaps: [],
        stats: {
          total_categories: 0,
          mentioned_categories: 0,
          missing_categories: 0,
          stale_categories: 0,
          coverage_percentage: 0,
        },
        error: 'Internal server error',
      },
      { status: 500 },
    );
  }
}
