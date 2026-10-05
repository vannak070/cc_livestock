import { localDay } from '../lib/local-day';
import { query } from '../config/database';
import { BatchItem } from '../lib/types';
import { PoolClient, QueryResultRow } from 'pg';
import { FarmScope, farmMatchSql } from '../lib/farm-scope';

export class BatchRepository {

  private async executeQuery(sql: string, params?: unknown[], client?: PoolClient) {
    if (client) {
      return client.query(sql, params);
    }
    return query(sql, params);
  }

  private mapRowToBatch(row: QueryResultRow, cowIds: string[] = []): BatchItem {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      startDate: row.start_date ? new Date(row.start_date).toISOString() : new Date().toISOString(),
      status: row.status || 'Active',
      cowIds,
      notes: row.notes || '',
      feedingProgram: row.feeding_program || undefined,
      farmLocation: row.farm_location || undefined,
      expectedSellingPrice: row.expected_selling_price ? Number(row.expected_selling_price) : undefined,
      sellingTargetDate: localDay(row.selling_target_date),
      saleReview: row.sale_review || undefined
    };
  }

  /**
   * With a scope, cattle lists are cut down to that farm's cattle, and a batch
   * is kept if it belongs to the farm, belongs to no farm, or still holds at
   * least one of the farm's cattle (same rule as scopeDataForActor).
   */
  async findAll(scope?: FarmScope): Promise<BatchItem[]> {
    let batchRes, cowRes;
    if (scope) {
      const own = farmMatchSql('b.farm_location', scope.farmLocation, 1);
      const cow = farmMatchSql('s.location', scope.farmLocation, 1);
      batchRes = await query(
        `SELECT b.* FROM batches b
         WHERE ${own.sql}
            OR COALESCE(b.farm_location, '') = ''
            OR EXISTS (SELECT 1 FROM batch_cows bc JOIN stock s ON s.id = bc.cow_id WHERE bc.batch_id = b.id AND ${cow.sql})
         ORDER BY b.created_at DESC`,
        own.params
      );
      cowRes = await query(
        `SELECT bc.batch_id, bc.cow_id FROM batch_cows bc JOIN stock s ON s.id = bc.cow_id WHERE ${cow.sql}`,
        cow.params
      );
    } else {
      batchRes = await query('SELECT * FROM batches ORDER BY created_at DESC');
      cowRes = await query('SELECT batch_id, cow_id FROM batch_cows');
    }

    const cowMap: Record<string, string[]> = {};
    for (const r of cowRes.rows) {
      if (!cowMap[r.batch_id]) cowMap[r.batch_id] = [];
      cowMap[r.batch_id].push(r.cow_id);
    }

    return batchRes.rows.map(row => this.mapRowToBatch(row, cowMap[row.id] || []));
  }

  async findById(id: string, client?: PoolClient): Promise<BatchItem | null> {
    const batchRes = await this.executeQuery('SELECT * FROM batches WHERE id = $1', [id], client);
    if (batchRes.rows.length === 0) return null;

    const cowRes = await this.executeQuery('SELECT cow_id FROM batch_cows WHERE batch_id = $1', [id], client);
    const cowIds = cowRes.rows.map(r => r.cow_id);

    return this.mapRowToBatch(batchRes.rows[0], cowIds);
  }

  async create(batch: Omit<BatchItem, 'cowIds'>, client?: PoolClient): Promise<BatchItem> {
    const sql = `
      INSERT INTO batches (id, name, type, start_date, status, notes, feeding_program, farm_location, expected_selling_price, selling_target_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        type = EXCLUDED.type,
        start_date = EXCLUDED.start_date,
        status = EXCLUDED.status,
        notes = EXCLUDED.notes,
        feeding_program = COALESCE(EXCLUDED.feeding_program, batches.feeding_program),
        farm_location = COALESCE(EXCLUDED.farm_location, batches.farm_location),
        expected_selling_price = COALESCE(EXCLUDED.expected_selling_price, batches.expected_selling_price),
        selling_target_date = COALESCE(EXCLUDED.selling_target_date, batches.selling_target_date)
      RETURNING *
    `;
    const params = [
      batch.id,
      batch.name,
      batch.type,
      batch.startDate ? new Date(batch.startDate) : new Date(),
      batch.status || 'Active',
      batch.notes || '',
      batch.feedingProgram ? JSON.stringify(batch.feedingProgram) : null,
      batch.farmLocation || null,
      batch.expectedSellingPrice !== undefined && batch.expectedSellingPrice !== null ? Number(batch.expectedSellingPrice) : null,
      batch.sellingTargetDate ? new Date(batch.sellingTargetDate) : null
    ];

    const res = await this.executeQuery(sql, params, client);
    return this.mapRowToBatch(res.rows[0], []);
  }

  async update(id: string, updates: Partial<BatchItem>, client?: PoolClient): Promise<BatchItem> {
    const existing = await this.findById(id);
    if (!existing) throw new Error(`Batch ${id} not found`);

    const fields: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (updates.name !== undefined) { fields.push(`name = $${idx++}`); params.push(updates.name); }
    if (updates.type !== undefined) { fields.push(`type = $${idx++}`); params.push(updates.type); }
    if (updates.startDate !== undefined) { fields.push(`start_date = $${idx++}`); params.push(new Date(updates.startDate)); }
    if (updates.status !== undefined) { fields.push(`status = $${idx++}`); params.push(updates.status); }
    if (updates.notes !== undefined) { fields.push(`notes = $${idx++}`); params.push(updates.notes); }
    if (updates.feedingProgram !== undefined) { fields.push(`feeding_program = $${idx++}`); params.push(updates.feedingProgram ? JSON.stringify(updates.feedingProgram) : null); }
    if (updates.farmLocation !== undefined) { fields.push(`farm_location = $${idx++}`); params.push(updates.farmLocation || null); }
    if (updates.expectedSellingPrice !== undefined) { fields.push(`expected_selling_price = $${idx++}`); params.push(updates.expectedSellingPrice !== null ? Number(updates.expectedSellingPrice) : null); }
    if (updates.saleReview !== undefined) { fields.push(`sale_review = $${idx++}`); params.push(updates.saleReview ? JSON.stringify(updates.saleReview) : null); }
    if (updates.sellingTargetDate !== undefined) { fields.push(`selling_target_date = $${idx++}`); params.push(updates.sellingTargetDate ? new Date(updates.sellingTargetDate) : null); }

    if (fields.length > 0) {
      params.push(id);
      await this.executeQuery(`UPDATE batches SET ${fields.join(', ')} WHERE id = $${idx}`, params, client);
    }

    return (await this.findById(id, client))!;
  }

  async assignCows(batchId: string, cowIds: string[], client?: PoolClient): Promise<BatchItem> {
    if (cowIds.length > 0) {
      await this.executeQuery('DELETE FROM batch_cows WHERE cow_id = ANY($1)', [cowIds], client);
    }

    for (const cowId of cowIds) {
      await this.executeQuery(
        'INSERT INTO batch_cows (batch_id, cow_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [batchId, cowId],
        client
      );
    }

    return (await this.findById(batchId, client))!;
  }

  async removeCow(batchId: string, cowId: string, client?: PoolClient): Promise<BatchItem> {
    await this.executeQuery('DELETE FROM batch_cows WHERE batch_id = $1 AND cow_id = $2', [batchId, cowId], client);
    return (await this.findById(batchId, client))!;
  }

  /** Moves a batch to another farm; with `moveCattle`, its cattle still on the farm (status Active) go too. Returns how many cattle moved. */
  async moveToFarm(batchId: string, farm: string, moveCattle: boolean, client: PoolClient): Promise<number> {
    await this.executeQuery('UPDATE batches SET farm_location = $1 WHERE id = $2', [farm, batchId], client);
    if (!moveCattle) return 0;
    const res = await this.executeQuery(
      `UPDATE stock SET location = $1
       WHERE id IN (SELECT cow_id FROM batch_cows WHERE batch_id = $2)
         AND lower(status) = 'active'`,
      [farm, batchId],
      client
    );
    return res.rowCount ?? 0;
  }

  async delete(id: string, client?: PoolClient): Promise<boolean> {
    const res = await this.executeQuery('DELETE FROM batches WHERE id = $1 RETURNING id', [id], client);
    return res.rows.length > 0;
  }
}

export const batchRepository = new BatchRepository();
