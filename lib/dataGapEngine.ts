import { query } from './db';

interface DataGap {
  category_id: number;
  category_name: string;
  gap_type: 'missing' | 'stale';
  last_review_date: string | null;
  days_since_last_review: number | null;
  priority_score: number;
  reason: string;
}

/**
 * Data Gap Engine
 *
 * Identifies categories (amenities) that are either:
 * 1. MISSING - No reviews mention this amenity for the hotel
 * 2. STALE - Last review is older than 6 months (180 days)
 *
 * Returns top gaps to ask guests about, ranked by priority
 */

const STALE_THRESHOLD_DAYS = 180; // 6 months
const MISSING_PRIORITY_BOOST = 2; // Missing categories get higher priority

export async function findDataGaps(hotelId: number, limit: number = 2): Promise<DataGap[]> {
  try {
    // Step 1: Get all categories mentioned in ANY reviews for this hotel
    const hotelCategoriesResult = await query(
      `SELECT DISTINCT c.id, c.name
       FROM categories c
       JOIN review_categories rc ON c.id = rc.category_id
       JOIN reviews r ON rc.review_id = r.id
       WHERE r.hotel_id = $1`,
      [hotelId],
    );

    const mentionedCategoryIds = new Set(hotelCategoriesResult.rows.map((r) => r.id));

    // Step 2: Find ALL categories that exist in the database
    const allCategoriesResult = await query(
      `SELECT id, name FROM categories ORDER BY name`,
    );

    const allCategories = allCategoriesResult.rows;

    // Step 3: For each category, determine if it's missing or stale
    const gaps: DataGap[] = [];

    for (const category of allCategories) {
      if (mentionedCategoryIds.has(category.id)) {
        // Category is mentioned - check if it's stale
        const staleCheckResult = await query(
          `SELECT MAX(r.created_at) as last_review_date
           FROM reviews r
           JOIN review_categories rc ON r.id = rc.review_id
           WHERE r.hotel_id = $1 AND rc.category_id = $2`,
          [hotelId, category.id],
        );

        const lastReviewDate = staleCheckResult.rows[0]?.last_review_date;

        if (lastReviewDate) {
          const daysSinceLastReview = Math.floor(
            (Date.now() - new Date(lastReviewDate).getTime()) / (1000 * 60 * 60 * 24),
          );

          if (daysSinceLastReview > STALE_THRESHOLD_DAYS) {
            const gap: DataGap = {
              category_id: category.id,
              category_name: category.name,
              gap_type: 'stale',
              last_review_date: lastReviewDate,
              days_since_last_review: daysSinceLastReview,
              priority_score: daysSinceLastReview / 30, // Score increases with age
              reason: `No recent reviews about ${category.name} (last mentioned ${daysSinceLastReview} days ago)`,
            };
            gaps.push(gap);
          }
        }
      } else {
        // Category is NOT mentioned - it's missing
        // Boost priority for completely missing categories
        const gap: DataGap = {
          category_id: category.id,
          category_name: category.name,
          gap_type: 'missing',
          last_review_date: null,
          days_since_last_review: null,
          priority_score: 999 + MISSING_PRIORITY_BOOST, // Missing categories have highest priority
          reason: `No reviews mention ${category.name}`,
        };
        gaps.push(gap);
      }
    }

    // Step 4: Sort by priority (descending) and return top N
    const sortedGaps = gaps.sort((a, b) => b.priority_score - a.priority_score);

    return sortedGaps.slice(0, limit);
  } catch (error) {
    console.error('Error finding data gaps:', error);
    throw error;
  }
}

/**
 * Find high-priority missing categories
 * (categories that exist in the system but have NO reviews for this hotel)
 */
export async function findMissingCategories(hotelId: number, limit: number = 5): Promise<DataGap[]> {
  try {
    const gaps = await findDataGaps(hotelId, 100);
    const missingGaps = gaps.filter((gap) => gap.gap_type === 'missing');
    return missingGaps.slice(0, limit);
  } catch (error) {
    console.error('Error finding missing categories:', error);
    throw error;
  }
}

/**
 * Find stale categories
 * (categories with reviews old > 6 months)
 */
export async function findStaleCategories(hotelId: number, limit: number = 5): Promise<DataGap[]> {
  try {
    const gaps = await findDataGaps(hotelId, 100);
    const staleGaps = gaps.filter((gap) => gap.gap_type === 'stale');
    return staleGaps.slice(0, limit);
  } catch (error) {
    console.error('Error finding stale categories:', error);
    throw error;
  }
}

/**
 * Get statistics about data gaps for a hotel
 */
export async function getDataGapStats(hotelId: number): Promise<{
  total_categories: number;
  mentioned_categories: number;
  missing_categories: number;
  stale_categories: number;
  coverage_percentage: number;
}> {
  try {
    // Total categories in system
    const totalResult = await query(`SELECT COUNT(*) as count FROM categories`);
    const total_categories = parseInt(totalResult.rows[0].count, 10);

    // Categories mentioned for this hotel
    const mentionedResult = await query(
      `SELECT COUNT(DISTINCT rc.category_id) as count
       FROM review_categories rc
       JOIN reviews r ON rc.review_id = r.id
       WHERE r.hotel_id = $1`,
      [hotelId],
    );
    const mentioned_categories = parseInt(mentionedResult.rows[0].count, 10);

    // Stale categories
    const staleGaps = await findStaleCategories(hotelId, 1000);
    const stale_categories = staleGaps.length;

    const missing_categories = total_categories - mentioned_categories;
    const coverage_percentage = Math.round((mentioned_categories / total_categories) * 100);

    return {
      total_categories,
      mentioned_categories,
      missing_categories,
      stale_categories,
      coverage_percentage,
    };
  } catch (error) {
    console.error('Error getting data gap stats:', error);
    throw error;
  }
}
