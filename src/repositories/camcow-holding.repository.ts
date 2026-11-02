import { PoolClient, QueryResultRow } from 'pg';
import { query } from '../config/database';
import { localDay } from '../lib/local-day';
import type { Holding } from '../lib/camcow-stock';

const day = (v: unknown) => localDay(v as Date | string | null | undefined);
const num = (v: unknown) => (v === null || v === undefined ? undefined : Number(v));

/** A collection found in the sales: the animal, its farm, the batch it was in and what CC Livestock paid. */
export interface Collection { cowId: string; farm: string; batchId?: string; buyer: string; salesDate: string; weight: number; total: number }

/** Cattle held by CC Livestock after a collection (migration 029). One row per animal. */
export class CamcowHoldingRepository {
  private run(sql: string, params: unknown[], client?: PoolClient) {
    return client ? client.query(sql, params) : query(sql, params);
  }

  private map(r: QueryResultRow): Holding {
    return {
      cowId: r.cow_id,
      sourceFarm: r.source_farm,
      ...(r.batch_id ? { batchId: r.batch_id } : {}),
      collectedOn: day(r.collected_on)!,
      collectionWeight: Number(r.collection_weight),
      collectionTotal: Number(r.collection_total),
      status: r.status,
      ...(r.sold_on ? { soldOn: day(r.sold_on)! } : {}),
      ...(r.buyer ? { buyer: r.buyer } : {}),
      ...(r.buyer_id ? { buyerId: r.buyer_id } : {}),
      ...(num(r.sale_weight) !== undefined ? { saleWeight: num(r.sale_weight) } : {}),
      ...(num(r.sale_price_per_kg) !== undefined ? { salePricePerKg: num(r.sale_price_per_kg) } : {}),
      ...(num(r.sale_total) !== undefined ? { saleTotal: num(r.sale_total) } : {}),
      ...(r.lost_on ? { lostOn: day(r.lost_on)! } : {}),
      note: r.note || '',
    };
  }

  async all(): Promise<Holding[]> {
    const res = await query('SELECT * FROM camcow_holdings ORDER BY collected_on DESC, cow_id');
    return res.rows.map(r => this.map(r));
  }

  /** The rows of these animals, locked for the change that follows. */
  async lock(cowIds: string[], client: PoolClient): Promise<Holding[]> {
    const res = await client.query('SELECT * FROM camcow_holdings WHERE cow_id = ANY($1) FOR UPDATE', [cowIds]);
    return res.rows.map(r => this.map(r));
  }

  /** The sales of these animals with their farm and batch (the latest sale of an animal first). */
  async salesOf(cowIds: string[], client?: PoolClient): Promise<Collection[]> {
    const res = await this.run(
      `SELECT s.cow_id, st.location AS farm, s.buyer, s.sales_date, s.weight, s.total_price,
              (SELECT bc.batch_id FROM batch_cows bc WHERE bc.cow_id = s.cow_id ORDER BY bc.batch_id LIMIT 1) AS batch_id
         FROM sales_tracking s JOIN stock st ON st.id = s.cow_id
        WHERE s.cow_id = ANY($1) ORDER BY s.sales_date DESC, s.id DESC`,
      [cowIds], client
    );
    return res.rows.map(r => ({ cowId: r.cow_id, farm: r.farm ?? '', ...(r.batch_id ? { batchId: r.batch_id } : {}), buyer: r.buyer ?? '', salesDate: day(r.sales_date) ?? '', weight: Number(r.weight) || 0, total: Number(r.total_price) || 0 }));
  }

  async insert(c: Collection, by: string, client: PoolClient): Promise<boolean> {
    const res = await client.query(
      `INSERT INTO camcow_holdings (cow_id, source_farm, batch_id, collected_on, collection_weight, collection_total, received_by, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$7) ON CONFLICT (cow_id) DO NOTHING`,
      [c.cowId, c.farm, c.batchId ?? null, c.salesDate, c.weight, c.total, by]
    );
    return (res.rowCount ?? 0) > 0;
  }

  async markSold(cowId: string, d: { soldOn: string; buyerId: string; buyer: string; weight: number; pricePerKg: number; total: number }, by: string, client: PoolClient) {
    await client.query(
      `UPDATE camcow_holdings SET status = 'Sold', sold_on = $2, buyer = $3, buyer_id = $8, sale_weight = $4, sale_price_per_kg = $5, sale_total = $6, updated_by = $7, updated_at = CURRENT_TIMESTAMP WHERE cow_id = $1`,
      [cowId, d.soldOn, d.buyer, d.weight, d.pricePerKg, d.total, by, d.buyerId]
    );
  }

  async markLost(cowId: string, lostOn: string, note: string, by: string, client: PoolClient) {
    await client.query(`UPDATE camcow_holdings SET status = 'Lost', lost_on = $2, note = $3, updated_by = $4, updated_at = CURRENT_TIMESTAMP WHERE cow_id = $1`, [cowId, lostOn, note, by]);
  }
}

export const camcowHoldingRepository = new CamcowHoldingRepository();
