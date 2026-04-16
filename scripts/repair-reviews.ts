/**
 * Repair Script: Categorize and Embed Missing Reviews
 *
 * This script finds reviews that are:
 * 1. Uncategorized (no entries in review_categories)
 * 2. Unembedded (embedding column is NULL)
 *
 * Then it:
 * 1. Categorizes uncategorized reviews
 * 2. Generates embeddings for unembedded reviews
 * 3. Reports progress and completion
 */

import 'dotenv/config';
import { config } from 'dotenv';
import path from 'path';
import { Pool } from 'pg';

// Load environment variables from .env.local
config({ path: path.resolve(process.cwd(), '.env.local') });

const connectionString = process.env.DATABASE_URL;
const apiKey = process.env.OPENAI_API_KEY;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

if (!apiKey) {
  throw new Error('OPENAI_API_KEY environment variable is not set');
}

const pool = new Pool({
  connectionString,
});

/**
 * Categorize a review using GPT
 */
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

    let jsonText = content.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```json?\n?/g, '').replace(/```/g, '');
    }
    const categories = JSON.parse(jsonText);
    return Array.isArray(categories) ? categories : [];
  } catch (error) {
    console.error('Error categorizing review:', error);
    return [];
  }
}

/**
 * Generate embedding for review text
 */
async function generateEmbedding(text: string): Promise<number[] | null> {
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
    return data.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    return null;
  }
}

/**
 * Main repair process
 */
async function repairReviews() {
  try {
    console.log('🔧 Starting review repair process...\n');

    // Find uncategorized reviews
    const uncategorizedResult = await pool.query(`
      SELECT r.id, r.content, r.created_at
      FROM reviews r
      WHERE r.id NOT IN (
        SELECT DISTINCT review_id FROM review_categories
      )
      ORDER BY r.created_at DESC
    `);

    const uncategorizedReviews = uncategorizedResult.rows;
    console.log(`📋 Found ${uncategorizedReviews.length} uncategorized reviews`);

    // Find unembedded reviews
    const unembeddedResult = await pool.query(`
      SELECT r.id, r.content, r.created_at
      FROM reviews r
      WHERE r.embedding IS NULL
      ORDER BY r.created_at DESC
    `);

    const unembeddedReviews = unembeddedResult.rows;
    console.log(`📊 Found ${unembeddedReviews.length} unembedded reviews\n`);

    let categorizedCount = 0;
    let embeddedCount = 0;
    let errors = 0;

    // Process uncategorized reviews
    if (uncategorizedReviews.length > 0) {
      console.log('🏷️  Categorizing uncategorized reviews...');

      for (let i = 0; i < uncategorizedReviews.length; i++) {
        const review = uncategorizedReviews[i];

        try {
          const categories = await categorizeReview(review.content);

          if (categories.length > 0) {
            // Get or create categories and link to review
            for (const categoryName of categories) {
              // Check if category exists
              const categoryCheck = await pool.query(
                'SELECT id FROM categories WHERE LOWER(name) = LOWER($1)',
                [categoryName]
              );

              let categoryId: number;
              if (categoryCheck.rows.length > 0) {
                categoryId = categoryCheck.rows[0].id;
              } else {
                // Create new category
                const newCategory = await pool.query(
                  'INSERT INTO categories (name, description) VALUES ($1, $2) RETURNING id',
                  [categoryName, 'Auto-categorized from reviews']
                );
                categoryId = newCategory.rows[0].id;
              }

              // Link review to category
              await pool.query(
                'INSERT INTO review_categories (review_id, category_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                [review.id, categoryId]
              );
            }

            categorizedCount++;
          }

          // Progress update every 10 reviews
          if ((i + 1) % 10 === 0) {
            console.log(`  ✓ Categorized ${i + 1}/${uncategorizedReviews.length}`);
          }

          // Rate limiting
          await new Promise((resolve) => setTimeout(resolve, 50));
        } catch (err) {
          console.error(`  ❌ Error categorizing review ${review.id}:`, err);
          errors++;
        }
      }

      console.log(`✓ Categorized ${categorizedCount} reviews\n`);
    }

    // Process unembedded reviews
    if (unembeddedReviews.length > 0) {
      console.log('🔢 Generating embeddings for unembedded reviews...');

      for (let i = 0; i < unembeddedReviews.length; i++) {
        const review = unembeddedReviews[i];

        try {
          const embedding = await generateEmbedding(review.content);

          if (embedding && embedding.length > 0) {
            // Store embedding in pgvector format
            const embeddingStr = `[${embedding.join(',')}]`;
            await pool.query(
              'UPDATE reviews SET embedding = $1::vector WHERE id = $2',
              [embeddingStr, review.id]
            );
            embeddedCount++;
          }

          // Progress update
          if ((i + 1) % 50 === 0 || i === unembeddedReviews.length - 1) {
            console.log(`  ✓ Generated embeddings ${i + 1}/${unembeddedReviews.length}`);
          }

          // Rate limiting
          await new Promise((resolve) => setTimeout(resolve, 50));
        } catch (err) {
          console.error(`  ❌ Error embedding review ${review.id}:`, err);
          errors++;
        }
      }

      console.log(`✓ Generated embeddings for ${embeddedCount} reviews\n`);
    }

    // Summary
    console.log('═══════════════════════════════════════');
    console.log('✅ Repair Complete!');
    console.log(`   • Categorized: ${categorizedCount} reviews`);
    console.log(`   • Embedded: ${embeddedCount} reviews`);
    console.log(`   • Errors: ${errors}`);
    console.log('═══════════════════════════════════════\n');

    // Final check
    const finalCheck = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM reviews) as total_reviews,
        (SELECT COUNT(DISTINCT review_id) FROM review_categories) as categorized_reviews,
        (SELECT COUNT(*) FROM reviews WHERE embedding IS NOT NULL) as embedded_reviews
    `);

    const stats = finalCheck.rows[0];
    console.log('📊 Final Statistics:');
    console.log(`   • Total reviews: ${stats.total_reviews}`);
    console.log(`   • Categorized: ${stats.categorized_reviews} (${((stats.categorized_reviews / stats.total_reviews) * 100).toFixed(1)}%)`);
    console.log(`   • Embedded: ${stats.embedded_reviews} (${((stats.embedded_reviews / stats.total_reviews) * 100).toFixed(1)}%)`);
    console.log();

    process.exit(0);
  } catch (error) {
    console.error('❌ Repair failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

repairReviews();
