import dotenv from 'dotenv';
import path from 'path';
import { Pool } from 'pg';

// Load environment variables FIRST
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function checkDatabaseStatus() {
  console.log('\n🔍 Checking Database Status...\n');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    // Test connection
    await pool.query('SELECT NOW()');
    
    // Hotels
    const hotelsResult = await pool.query('SELECT COUNT(*) as count FROM hotels');
    const hotelCount = hotelsResult.rows[0].count;
    console.log(`✅ Hotels: ${hotelCount}`);

    // Reviews
    const reviewsResult = await pool.query('SELECT COUNT(*) as count FROM reviews');
    const reviewCount = reviewsResult.rows[0].count;
    console.log(`✅ Reviews: ${reviewCount}`);

    // Categories
    const categoriesResult = await pool.query('SELECT COUNT(*) as count FROM categories');
    const categoryCount = categoriesResult.rows[0].count;
    console.log(`✅ Categories: ${categoryCount}`);

    // Review-Category Links
    const reviewCatsResult = await pool.query('SELECT COUNT(*) as count FROM review_categories');
    const reviewCatCount = reviewCatsResult.rows[0].count;
    console.log(`✅ Review-Category Links: ${reviewCatCount}`);

    // Amenity Flags
    const flagsResult = await pool.query('SELECT COUNT(*) as count FROM amenity_flags');
    const flagCount = flagsResult.rows[0].count;
    const unresolvedResult = await pool.query(
      'SELECT COUNT(*) as count FROM amenity_flags WHERE resolved = false'
    );
    const unresolvedCount = unresolvedResult.rows[0].count;
    console.log(`✅ Amenity Flags: ${flagCount} (${unresolvedCount} unresolved)`);

    // Category Summaries
    const summariesResult = await pool.query('SELECT COUNT(*) as count FROM category_summaries');
    const summaryCount = summariesResult.rows[0].count;
    console.log(`✅ Category Summaries: ${summaryCount}`);

    // Reviews with embeddings
    const embeddingsResult = await pool.query(
      'SELECT COUNT(*) as count FROM reviews WHERE embedding IS NOT NULL'
    );
    const embeddingCount = embeddingsResult.rows[0].count;
    console.log(`✅ Reviews with Embeddings: ${embeddingCount}/${reviewCount}`);

    // Hotel distribution
    if (hotelCount > 0) {
      const hotelReviewsResult = await pool.query(`
        SELECT h.name, h.location, COUNT(r.id) as review_count
        FROM hotels h
        LEFT JOIN reviews r ON h.id = r.hotel_id
        GROUP BY h.id, h.name, h.location
        ORDER BY review_count DESC
      `);
      console.log(`\n📊 Reviews by Hotel:`);
      hotelReviewsResult.rows.forEach((row) => {
        console.log(`   - ${row.name} (${row.location}): ${row.review_count} reviews`);
      });
    }

    // Database connection test
    const timeResult = await pool.query('SELECT NOW() as current_time');
    console.log(`\n✅ Database connection: OK`);
    console.log(`   Current server time: ${timeResult.rows[0].current_time}`);

    console.log('\n✅ All systems operational!\n');
  } catch (error) {
    console.error('\n❌ Database Status Check Failed:');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    await pool.end();
  }
}

checkDatabaseStatus();
