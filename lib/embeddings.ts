/**
 * Embedding utilities for AI-powered search
 * Uses OpenAI's text-embedding-3-small model
 */

/**
 * Create a text embedding using OpenAI's text-embedding-3-small
 * @param text - Text to embed
 * @returns Embedding vector as number array, or null on error
 */
export async function getEmbedding(text: string): Promise<number[] | null> {
  try {
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
      console.error(`[Embeddings] OpenAI error: ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error('[Embeddings] Error creating embedding:', error);
    return null;
  }
}
