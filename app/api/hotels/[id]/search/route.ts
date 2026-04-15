import { query } from '@/lib/db';
import { getEmbedding } from '@/lib/embeddings';

interface SearchResult {
  id: number;
  content: string;
  guest_name: string;
  created_at: string;
  similarity: number;
}

interface SearchRequest {
  query: string;
  limit?: number;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const hotelId = parseInt(id, 10);

    if (isNaN(hotelId)) {
      return Response.json({ error: 'Invalid hotel ID' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const searchQuery = searchParams.get('q') || searchParams.get('query');
    const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 50);

    if (!searchQuery) {
      return Response.json({ error: 'Search query required' }, { status: 400 });
    }

    // Embed the search query
    const queryEmbedding = await getEmbedding(searchQuery);

    if (!queryEmbedding) {
      return Response.json(
        { error: 'Failed to embed search query' },
        { status: 500 }
      );
    }

    // Convert array to pgvector format: [0.123,0.456,...]
    const queryEmbeddingStr = `[${queryEmbedding.join(',')}]`;

    // Search reviews using vector similarity
    const result = await query(
      `
      SELECT
        r.id,
        r.content,
        r.guest_name,
        r.created_at,
        1 - (r.embedding <=> $1::vector) AS similarity
      FROM reviews r
      WHERE r.hotel_id = $2 AND r.embedding IS NOT NULL
      ORDER BY similarity DESC
      LIMIT $3
      `,
      [queryEmbeddingStr, hotelId, limit]
    );

    const results: SearchResult[] = result.rows.map((row) => ({
      id: row.id,
      content: row.content,
      guest_name: row.guest_name,
      created_at: row.created_at,
      similarity: row.similarity,
    }));

    return Response.json({
      success: true,
      hotel_id: hotelId,
      query: searchQuery,
      results,
      total: results.length,
    });
  } catch (error) {
    console.error('[API] Semantic search error:', error);
    return Response.json(
      { error: 'Failed to perform semantic search' },
      { status: 500 }
    );
  }
}
