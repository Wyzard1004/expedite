import { NextRequest, NextResponse } from 'next/server';
import { getHotelDiscrepancies, resolveDiscrepancy } from '@/lib/discrepancies';

interface DiscrepancyResponse {
  success: boolean;
  hotel_id?: number;
  discrepancies?: any[];
  total?: number;
  error?: string;
}

/**
 * GET /api/admin/discrepancies?hotel_id=X
 * Get all discrepancies for a specific hotel
 */
export async function GET(request: NextRequest): Promise<NextResponse<DiscrepancyResponse>> {
  try {
    const { searchParams } = new URL(request.url);
    const hotelId = searchParams.get('hotel_id');

    if (!hotelId) {
      return NextResponse.json(
        { success: false, error: 'Missing hotel_id parameter' },
        { status: 400 }
      );
    }

    const discrepancies = await getHotelDiscrepancies(parseInt(hotelId, 10));

    return NextResponse.json({
      success: true,
      hotel_id: parseInt(hotelId, 10),
      discrepancies,
      total: discrepancies.length,
    });
  } catch (error) {
    console.error('[API] Error fetching discrepancies:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch discrepancies' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/discrepancies/resolve
 * Mark a discrepancy as resolved
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<{ success: boolean; error?: string }>> {
  try {
    const body = await request.json();
    const { flag_id } = body;

    if (!flag_id) {
      return NextResponse.json(
        { success: false, error: 'Missing flag_id' },
        { status: 400 }
      );
    }

    const resolved = await resolveDiscrepancy(flag_id);

    if (resolved) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { success: false, error: 'Flag not found or already resolved' },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error('[API] Error resolving discrepancy:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to resolve discrepancy' },
      { status: 500 }
    );
  }
}
