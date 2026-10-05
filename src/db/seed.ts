import fs from 'fs';
import path from 'path';
import { pool, connectWithRetry } from '../config/database';
import { resetDatabase } from './migrate';
import { getDbData } from '../lib/db';
import { generateTempPassword } from '../lib/generate-temp-password';
import { hashPassword, isBcryptHash } from '../lib/password';

async function seedDatabase() {
  console.log('=== Livestock ERP Database Seeding Script ===');
  
  // Ensure DB connection is established
  await connectWithRetry(5, 1000);

  console.log('[Seed] Dropping all tables and re-applying migrations (local development only)...');
  await resetDatabase();
  console.log('[Seed] Database schema ready.');

  // Load JSON database data
  const data = await getDbData();
  console.log(`[Seed] Loaded db.json - Stock: ${data.stock.length}, Weight: ${data.weightTracking.length}, Sales: ${data.salesTracking.length}, Batches: ${data.batches.length}, Health Logs: ${data.healthLogs.length}`);

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Master Settings
    console.log('[Seed] Populating master_settings...');
    await client.query(
      'INSERT INTO master_settings (key, data) VALUES ($1, $2)',
      ['master_setup', JSON.stringify(data.settings)]
    );

    // 2. Users
    console.log('[Seed] Populating users...');
    for (const u of data.settings.users || []) {
      // Passwords must be stored as bcrypt hashes: login verifies with
      // bcrypt.compare() and has no plaintext path, so a raw string written
      // here would lock that account out permanently. Values that are
      // already hashed are passed through untouched.
      const raw = u.password || generateTempPassword();
      const stored = isBcryptHash(raw) ? raw : await hashPassword(raw);
      await client.query(
        `INSERT INTO users (id, name, email, role, status, password)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET name=$2, email=$3, role=$4, status=$5, password=$6`,
        [u.id, u.name, u.email, u.role, u.status || 'Active', stored]
      );
    }

    // 3. Stock
    console.log('[Seed] Populating stock table...');
    for (const s of data.stock) {
      await client.query(
        `INSERT INTO stock (
          id, no, breed, sex, age, weight, owner_name, location, phone, buy_type,
          unit_price, total_price, health_status, status, purchase_date, remark, purchase_type, payment_method
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        ON CONFLICT (id) DO NOTHING`,
        [
          s.id,
          s.no || '',
          s.breed || '',
          s.sex || '',
          s.age || '',
          s.weight || 0,
          s.ownerName || '',
          s.location || '',
          s.phone || '',
          s.buyType || '',
          s.unitPrice || 0,
          s.totalPrice || 0,
          s.healthStatus || 'Good',
          s.status || 'Active',
          s.purchaseDate ? new Date(s.purchaseDate) : null,
          s.remark || '',
          s.purchaseType || '',
          s.paymentMethod || ''
        ]
      );
    }

    // 4. Weight Tracking History
    console.log('[Seed] Populating weight_tracking table...');
    for (const w of data.weightTracking) {
      // Check if cow exists in stock
      const cowRes = await client.query('SELECT id FROM stock WHERE id = $1', [w.cowId]);
      if (cowRes.rows.length > 0) {
        await client.query(
          `INSERT INTO weight_tracking (
            cow_id, breed, age, old_weight, current_weight, gain_loss, health_status, status, tracking_date
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            w.cowId,
            w.breed || '',
            w.age || '',
            w.oldWeight || 0,
            w.currentWeight || 0,
            w.gainLoss || 0,
            w.healthStatus || 'Good',
            w.status || 'Active',
            w.trackingDate ? new Date(w.trackingDate) : new Date()
          ]
        );
      }
    }

    // 5. Sales Tracking
    console.log('[Seed] Populating sales_tracking table...');
    for (const st of data.salesTracking) {
      const cowRes = await client.query('SELECT id FROM stock WHERE id = $1', [st.cowId]);
      if (cowRes.rows.length > 0) {
        await client.query(
          `INSERT INTO sales_tracking (
            cow_id, breed, age, weight, unit_price, total_price, status, sales_date, sale_type, buyer
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            st.cowId,
            st.breed || '',
            st.age || '',
            st.weight || 0,
            st.unitPrice || 0,
            st.totalPrice || 0,
            st.status || 'Sold',
            st.salesDate ? new Date(st.salesDate) : new Date(),
            st.saleType || 'Lumpsum',
            st.buyer || 'Local Market'
          ]
        );
      }
    }

    // 6. Batches & Batch Cows
    console.log('[Seed] Populating batches and batch_cows tables...');
    for (const b of data.batches) {
      await client.query(
        `INSERT INTO batches (id, name, type, start_date, status, notes)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO NOTHING`,
        [
          b.id,
          b.name,
          b.type,
          b.startDate ? new Date(b.startDate) : new Date(),
          b.status || 'Active',
          b.notes || ''
        ]
      );

      for (const cowId of b.cowIds || []) {
        const cowRes = await client.query('SELECT id FROM stock WHERE id = $1', [cowId]);
        if (cowRes.rows.length > 0) {
          await client.query(
            `INSERT INTO batch_cows (batch_id, cow_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [b.id, cowId]
          );
        }
      }
    }

    // 7. Health Logs
    console.log('[Seed] Populating health_logs table...');
    for (const h of data.healthLogs) {
      const cowRes = await client.query('SELECT id FROM stock WHERE id = $1', [h.cowId]);
      if (cowRes.rows.length > 0) {
        await client.query(
          `INSERT INTO health_logs (id, cow_id, type, name, date, administered_by, cost, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id) DO NOTHING`,
          [
            h.id,
            h.cowId,
            h.type,
            h.name,
            h.date ? new Date(h.date) : new Date(),
            h.administeredBy || '',
            h.cost || 0,
            h.notes || ''
          ]
        );
      }
    }

    await client.query('COMMIT');
    console.log('=== PostgreSQL Database Seeding Completed Successfully! ===');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[Seed Error] Database seeding failed:', error instanceof Error ? error.message : error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seedDatabase().catch((err) => {
  console.error('[Seed Fatal]', err);
  process.exit(1);
});
