import 'dotenv/config';
import { config } from 'dotenv';
import { Pool } from 'pg';
import path from 'path';

// Load environment variables from .env.local
config({ path: path.resolve(process.cwd(), '.env.local') });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const pool = new Pool({
  connectionString,
});

async function clearDatabase() {
  const client = await pool.connect();

  try {
    console.log('🗑️  Clearing database...');

    // Clear tables in reverse order of dependencies
    const tables = [
      'job_queue',
      'review_embeddings',
      'amenity_flags',
      'review_categories',
      'reviews',
      'categories',
      'hotels',
    ];

    for (const table of tables) {
      try {
        await client.query(`DELETE FROM ${table}`);
        // Try to reset sequence
        try {
          await client.query(`ALTER SEQUENCE ${table}_id_seq RESTART WITH 1`);
        } catch {
          // Sequence might not exist, that's ok
        }
        console.log(`✓ Cleared ${table}`);
      } catch (error: any) {
        // Table might not exist, that's ok
        if (!error.message.includes('does not exist')) {
          console.warn(`⚠️  Error clearing ${table}:`, error.message);
        }
      }
    }

    // Clear embedding vectors explicitly
    try {
      await client.query(`UPDATE reviews SET embedding = NULL`);
      console.log('✓ Cleared embedding vectors');
    } catch (error: any) {
      // Table might not exist, that's ok
      if (!error.message.includes('does not exist')) {
        console.warn(`⚠️  Error clearing embeddings:`, error.message);
      }
    }

    console.log('✅ Database cleared successfully');
  } catch (error) {
    console.error('❌ Error clearing database:', error);
    throw error;
  } finally {
    client.release();
  }
}

clearDatabase()
  .then(() => {
    console.log('\n💡 Next step: Run "npm run seed" to re-seed the database');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to clear database:', error);
    process.exit(1);
  });
