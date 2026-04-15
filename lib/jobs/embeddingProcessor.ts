import { query } from '../db';

/**
 * Create text embedding using OpenAI text-embedding-3-small
 */
async function createEmbedding(text: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI embedding error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

/**
 * Process a batch of review embeddings asynchronously
 * Fetches review text, generates embeddings, stores in review_embeddings table
 */
export async function processEmbeddingBatch(reviewIds: number[]): Promise<void> {
  try {
    console.log(`[Job] Starting embedding batch processing for ${reviewIds.length} reviews`);

    // Fetch review texts
    const reviewsQuery = `
      SELECT id, review_text FROM reviews WHERE id = ANY($1)
    `;
    const result = await query(reviewsQuery, [reviewIds]);

    const reviews = result.rows;
    let processed = 0;
    let failed = 0;

    // Process each review
    for (const review of reviews) {
      try {
        const embedding = await createEmbedding(review.review_text);

        // Store or update embedding
        const embedQuery = `
          INSERT INTO review_embeddings (review_id, embedding)
          VALUES ($1, $2)
          ON CONFLICT (review_id) DO UPDATE
          SET embedding = $2, updated_at = NOW()
        `;

        await query(embedQuery, [review.id, JSON.stringify(embedding)]);
        processed++;
      } catch (error) {
        console.error(`[Job] Failed to embed review ${review.id}:`, error);
        failed++;
      }
    }

    console.log(
      `[Job] ✓ Embedding batch complete: ${processed} processed, ${failed} failed out of ${reviewIds.length}`
    );
  } catch (error) {
    console.error(`[Job] ✗ Embedding batch processing failed:`, error);
    throw error;
  }
}
