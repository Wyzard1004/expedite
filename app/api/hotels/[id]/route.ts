import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

interface Hotel {
  id: number;
  name: string;
  location: string;
  description: string;
  created_at: string;
}

interface Review {
  id: number;
  hotel_id: number;
  guest_name: string;
  content: string;
  created_at: string;
  categories: string[];
}

interface Category {
  id: number;
  name: string;
  description: string;
}

interface HotelResponse {
  hotel: Hotel | null;
  categories: Category[];
  reviews: Review[];
  error?: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<HotelResponse>> {
  try {
    const { id } = await params;
    const hotelId = parseInt(id, 10);

    if (isNaN(hotelId)) {
      return NextResponse.json(
        { hotel: null, categories: [], reviews: [], error: 'Invalid hotel ID' },
        { status: 400 },
      );
    }

    // Fetch hotel details
    const hotelResult = await query('SELECT * FROM hotels WHERE id = $1', [hotelId]);

    if (hotelResult.rows.length === 0) {
      return NextResponse.json(
        { hotel: null, categories: [], reviews: [], error: 'Hotel not found' },
        { status: 404 },
      );
    }

    const hotel: Hotel = hotelResult.rows[0];

    // Fetch all categories for this hotel (from reviews)
    const categoriesResult = await query(
      `SELECT DISTINCT c.id, c.name, c.description
       FROM categories c
       JOIN review_categories rc ON c.id = rc.category_id
       JOIN reviews r ON rc.review_id = r.id
       WHERE r.hotel_id = $1
       ORDER BY c.name`,
      [hotelId],
    );

    const categories: Category[] = categoriesResult.rows;

    // Fetch reviews with their categories
    const reviewsResult = await query(
      `SELECT r.id, r.hotel_id, r.guest_name, r.content, r.created_at
       FROM reviews r
       WHERE r.hotel_id = $1
       ORDER BY r.created_at DESC
       LIMIT 50`,
      [hotelId],
    );

    // For each review, get its categories
    const reviews: Review[] = await Promise.all(
      reviewsResult.rows.map(async (review) => {
        const reviewCategoriesResult = await query(
          `SELECT c.name
           FROM categories c
           JOIN review_categories rc ON c.id = rc.category_id
           WHERE rc.review_id = $1`,
          [review.id],
        );

        return {
          ...review,
          categories: reviewCategoriesResult.rows.map((row) => row.name),
        };
      }),
    );

    return NextResponse.json({
      hotel,
      categories,
      reviews,
    });
  } catch (error) {
    console.error('Error fetching hotel:', error);
    return NextResponse.json(
      { hotel: null, categories: [], reviews: [], error: 'Internal server error' },
      { status: 500 },
    );
  }
}
