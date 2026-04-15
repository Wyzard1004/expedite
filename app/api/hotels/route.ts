import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

interface Hotel {
  id: number;
  name: string;
  location: string;
  description: string;
  review_count?: number;
}

interface ListResponse {
  hotels: Hotel[];
  total: number;
  error?: string;
}

export async function GET(): Promise<NextResponse<ListResponse>> {
  try {
    // Fetch all hotels with review count
    const result = await query(
      `SELECT h.id, h.name, h.location, h.description, COUNT(r.id) as review_count
       FROM hotels h
       LEFT JOIN reviews r ON h.id = r.hotel_id
       GROUP BY h.id, h.name, h.location, h.description
       ORDER BY h.name`,
    );

    const hotels: Hotel[] = result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      location: row.location,
      description: row.description,
      review_count: parseInt(row.review_count, 10),
    }));

    return NextResponse.json({
      hotels,
      total: hotels.length,
    });
  } catch (error) {
    console.error('Error fetching hotels:', error);
    return NextResponse.json({ hotels: [], total: 0, error: 'Internal server error' }, { status: 500 });
  }
}
