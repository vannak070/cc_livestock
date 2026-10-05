import { pool, connectWithRetry } from '../../config/database';

async function addUserFarmLocation() {
  console.log("=== Running database migration: Add farm_location column to users ===");

  await connectWithRetry(5, 1000);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Add farm_location column if it doesn't exist
    await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS farm_location VARCHAR(100);
    `);

    await client.query('COMMIT');
    console.log('[PostgreSQL Migration] Successfully added farm_location column to users table.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[Migration Error] Failed to add farm_location column:', error instanceof Error ? error.message : error);
    throw error;
  } finally {
    client.release();
    process.exit(0);
  }
}

addUserFarmLocation().catch(err => {
  console.error("Fatal migration error:", err);
  process.exit(1);
});
