import 'dotenv/config';
import { config } from 'dotenv';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import OpenAI from 'openai';

// Load environment variables from .env.local
config({ path: path.resolve(process.cwd(), '.env.local') });

const connectionString = process.env.DATABASE_URL;
const openaiApiKey = process.env.OPENAI_API_KEY;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

if (!openaiApiKey) {
  throw new Error('OPENAI_API_KEY environment variable is not set');
}

const pool = new Pool({
  connectionString,
});

const openai = new OpenAI({
  apiKey: openaiApiKey,
});

interface DescriptionRow {
  eg_property_id: string;
  [key: string]: string;
}

interface ReviewRow {
  eg_property_id: string;
  acquisition_date: string;
  lob: string;
  rating: string;
  review_title: string;
  review_text: string;
}

interface ExtractedCategories {
  categories: string[];
  summary: string;
}

let requestCount = 0;
let rateLimitWaitTime = 0;

async function extractCategoriesFromReview(reviewText: string, existingCategories: Set<string>): Promise<ExtractedCategories> {
  const existingCategoriesList = Array.from(existingCategories)
    .map((cat) => `"${cat}"`)
    .join(', ');

  // Scale the number of keywords based on review length
  const minKeywords = 1;
  const maxKeywords = 10;

  const prompt = `Extract ${minKeywords}-${maxKeywords} key amenities or features mentioned in this hotel review. Try to capture ALL important aspects mentioned, even if they seem similar.
You MUST only extract from the list of EXISTING categories if they match the review content: [${existingCategoriesList}]
If a review mentions something not in the existing list, you may add a NEW category only if it's NOT similar to existing ones. 
It is OKAY to have some overlap, but avoid adding categories that are essentially duplicates of existing ones. 
If you add a new category, it should be clearly distinct from existing categories. A review can have multiple categories, but only add new ones if they are truly unique and not just a rephrasing of existing categories.
Return JSON only: {"categories": ["wifi", "service"], "summary": "brief phrase"}

Review: "${reviewText.substring(0, 500)}"`;

  try {
    // Check if we need to wait for rate limits
    if (rateLimitWaitTime > 0) {
      const waitMs = Math.min(rateLimitWaitTime, 60000); // Max 60 seconds
      console.log(`  ⏳ Rate limit: waiting ${waitMs}ms...`);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      rateLimitWaitTime = 0;
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 150,
      temperature: 0.3,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    requestCount++;

    const content = response.choices[0].message.content;
    if (content) {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    }

    return { categories: [], summary: '' };
  } catch (error) {
    const err = error as { status?: number; headers?: Record<string, string> };
    if (err.status === 429) {
      // Rate limit hit - exponential backoff
      rateLimitWaitTime = Math.min((parseInt(err.headers?.['retry-after'] as string) || 60) * 1000, 60000);
      console.warn(`⚠ Rate limited! Retrying after ${rateLimitWaitTime}ms`);
      return extractCategoriesFromReview(reviewText, existingCategories); // Retry
    }
    console.warn('⚠ LLM extraction failed, using empty categories');
    return { categories: [], summary: '' };
  }
}

async function seedDatabase() {
  try {
    console.log('🌱 Starting optimized parallel seeding...\n');

    const descriptionPath = path.join(process.cwd(), 'data', 'Description_PROC.csv');
    const reviewsPath = path.join(process.cwd(), 'data', 'Reviews_PROC.csv');

    const descriptionData = fs.readFileSync(descriptionPath, 'utf-8');
    const reviewsData = fs.readFileSync(reviewsPath, 'utf-8');

    const descriptions: DescriptionRow[] = parse(descriptionData, {
      columns: true,
      skip_empty_lines: true,
    }) as DescriptionRow[];

    const reviews: ReviewRow[] = parse(reviewsData, {
      columns: true,
      skip_empty_lines: true,
    }) as ReviewRow[];

    console.log(`✓ Parsed ${descriptions.length} hotels and ${reviews.length} reviews`);

    // Insert hotels - ALL of them, not just first 5
    const hotelIds = new Map<string, number>();

    for (const desc of descriptions) {
      // Process ALL hotels
      const location = `${desc.city}${desc.province ? ', ' + desc.province : ''}${desc.country ? ', ' + desc.country : ''}`;

      const result = await pool.query(
        `INSERT INTO hotels (name, location, description) 
         VALUES ($1, $2, $3) 
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [desc.eg_property_id, location, desc.property_description || desc.area_description],
      );

      if (result.rows.length > 0) {
        hotelIds.set(desc.eg_property_id, result.rows[0].id as number);
      }
    }

    console.log(`✓ Inserted ${hotelIds.size} hotels\n`);

    const createdCategories = new Map<string, number>();

    // Fetch existing categories from database
    const existingCategoriesResult = await pool.query(`SELECT name FROM categories`);
    const existingCategories = new Set(
      existingCategoriesResult.rows.map((row: {name: string}) => row.name.toLowerCase())
    );

    console.log(`📚 Found ${existingCategories.size} existing categories in database\n`);

    // Initialize createdCategories with existing ones
    for (const row of existingCategoriesResult.rows) {
      const categoryResult = await pool.query(`SELECT id FROM categories WHERE name = $1`, [row.name]);
      if (categoryResult.rows.length > 0) {
        createdCategories.set(row.name.toLowerCase(), categoryResult.rows[0].id as number);
      }
    }

    // Process reviews in parallel batches - ALL available reviews for seeded hotels
    const reviewsForSeeding = reviews.filter((r) => hotelIds.has(r.eg_property_id) && r.review_text);

    console.log(`📝 Processing ${reviewsForSeeding.length} reviews in parallel batches...\n`);

    const batchSize = 32; // 32 concurrent requests
    let processedCount = 0;
    const startTime = Date.now();

    for (let i = 0; i < reviewsForSeeding.length; i += batchSize) {
      const batch = reviewsForSeeding.slice(i, i + batchSize);

      // Process batch in parallel
      const results = await Promise.all(
        batch.map(async (review) => {
          const hotelId = hotelIds.get(review.eg_property_id)!;
          const extracted = await extractCategoriesFromReview(review.review_text, existingCategories);

          // Insert review
          const reviewResult = await pool.query(
            `INSERT INTO reviews (hotel_id, guest_name, content) 
             VALUES ($1, $2, $3) 
             RETURNING id`,
            [hotelId, 'Guest', review.review_text],
          );

          if (reviewResult.rows.length > 0) {
            return {
              reviewId: reviewResult.rows[0].id,
              categories: extracted.categories,
            };
          }
          return null;
        }),
      );

      // Link reviews to categories
      for (const result of results) {
        if (result) {
          for (const categoryName of result.categories) {
            let categoryId = createdCategories.get(categoryName.toLowerCase());

            if (!categoryId) {
              const categoryResult = await pool.query(
                `INSERT INTO categories (name, description) 
                 VALUES ($1, $2) 
                 ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
                 RETURNING id`,
                [categoryName, 'Mentioned in guest reviews'],
              );

              if (categoryResult.rows.length > 0) {
                categoryId = categoryResult.rows[0].id as number;
                createdCategories.set(categoryName.toLowerCase(), categoryId);
              }
            }

            if (categoryId) {
              await pool.query(
                `INSERT INTO review_categories (review_id, category_id) 
                 VALUES ($1, $2) 
                 ON CONFLICT DO NOTHING`,
                [result.reviewId, categoryId],
              );
            }
          }
        }
      }

      processedCount += batch.length;
      const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
      const rps = (processedCount / ((Date.now() - startTime) / 1000)).toFixed(1);
      console.log(`  ✓ Batch ${Math.ceil(i / batchSize) + 1}: ${processedCount}/${reviewsForSeeding.length} reviews processed (${rps} req/s) [${elapsedSec}s elapsed]`);
    }

    console.log(
      `\n✓ Inserted ${processedCount} reviews with ${createdCategories.size} LLM-extracted categories (${requestCount} API requests)`,
    );

    // Create amenity flags
    const hotelArray = Array.from(hotelIds.entries()).slice(0, 3);
    const allCategories = Array.from(createdCategories.entries());

    for (let i = 0; i < hotelArray.length && allCategories.length > 0; i++) {
      const [, hotelId] = hotelArray[i];
      const randomCategory = allCategories[Math.floor(Math.random() * allCategories.length)];
      const [, categoryId] = randomCategory;

      await pool.query(
        `INSERT INTO amenity_flags (hotel_id, category_id, flag_type, description) 
         VALUES ($1, $2, $3, $4) 
         ON CONFLICT DO NOTHING`,
        [hotelId, categoryId, 'stale', 'No recent reviews about this topic - data may be outdated'],
      );
    }

    console.log('✓ Created sample amenity flags for stale data');
    console.log('✅ Database seeding complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seedDatabase();
