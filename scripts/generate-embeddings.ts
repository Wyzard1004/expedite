import dotenv from 'dotenv';
import path from 'path';
import { Pool } from 'pg';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function generateEmbeddings() {
  console.log('\n📊 Generating Review Embeddings...\n');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    // Get all reviews without embeddings
    const reviewsResult = await pool.query(
      'SELECT id, content FROM reviews WHERE embedding IS NULL ORDER BY id LIMIT 100'
    );

    const reviews = reviewsResult.rows;
    console.log(`Found ${reviews.length} reviews without embeddings`);

    if (reviews.length === 0) {
      console.log('✅ All reviews already have embeddings!');
      await pool.end();
      return;
    }

    let successful = 0;
    let failed = 0;

    // Process each review to create embeddings
    for (let i = 0; i < reviews.length; i++) {
      const review = reviews[i];

      try {
        // Call OpenAI to generate embedding
        const response = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'text-embedding-3-small',
            input: review.content,
          }),
        });

        if (!response.ok) {
          throw new Error(`OpenAI API error: ${response.statusText}`);
        }

        const data = await response.json();
        const embedding = data.data[0].embedding;

        // Store embedding in database using pgvector format
        // pgvector expects vector as: [0.123,0.456,...] format
        const embeddingStr = `[${embedding.join(',')}]`;
        
        await pool.query(
          'UPDATE reviews SET embedding = $1::vector WHERE id = $2',
          [embeddingStr, review.id]
        );

        successful++;
        if ((i + 1) % 10 === 0 || i === reviews.length - 1) {
          console.log(`  Progress: ${i + 1}/${reviews.length} (${successful} done)`);
        }

        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (err) {
        console.error(`  ❌ Error processing review ${review.id}:`, err instanceof Error ? err.message : String(err));
        failed++;
      }
    }

    console.log(`\n✅ Batch complete: ${successful} successful, ${failed} failed`);

    // Show updated count
    const countResult = await pool.query(
      'SELECT COUNT(*) as count FROM reviews WHERE embedding IS NOT NULL'
    );
    const totalWithEmbeddings = countResult.rows[0].count;
    const totalReviews = await pool.query('SELECT COUNT(*) as count FROM reviews');
    const total = totalReviews.rows[0].count;

    console.log(`\n📈 Total embeddings: ${totalWithEmbeddings}/${total}`);
  } catch (error) {
    console.error('\n❌ Embedding generation failed:');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    await pool.end();
  }
}

generateEmbeddings();
