import { Pool, QueryResult } from 'pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// Create a connection pool - reuse across requests
const pool = new Pool({
  connectionString,
  max: 20, // Max connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export async function query(text: string, params?: any[]): Promise<QueryResult> {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === 'development') {
      console.log('Executed query', { text, duration, rows: result.rowCount });
    }
    return result;
  } catch (error) {
    console.error('Database query error', { text, error });
    throw error;
  }
}

export async function getClient() {
  return pool.connect();
}

export default pool;
