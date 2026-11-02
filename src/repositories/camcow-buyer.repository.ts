import { randomUUID } from 'crypto';
import { PoolClient, QueryResultRow } from 'pg';
import { query } from '../config/database';
import type { Buyer, BuyerInput } from '../lib/camcow-buyers';

/** Buyers of CamCow stock (migration 030). */
export class CamcowBuyerRepository {
  private run(sql: string, params: unknown[], client?: PoolClient) {
    return client ? client.query(sql, params) : query(sql, params);
  }

  private mapBuyer(r: QueryResultRow): Buyer {
    return { id: r.id, name: r.name, kind: r.kind, phone: r.phone, location: r.location, note: r.note, active: r.active };
  }
  async buyers(client?: PoolClient): Promise<Buyer[]> {
    return (await this.run('SELECT * FROM camcow_buyers ORDER BY lower(name)', [], client)).rows.map(r => this.mapBuyer(r));
  }
  async buyer(id: string, client?: PoolClient): Promise<Buyer | null> {
    const res = await this.run('SELECT * FROM camcow_buyers WHERE id = $1', [id], client);
    return res.rows[0] ? this.mapBuyer(res.rows[0]) : null;
  }
  async insertBuyer(i: BuyerInput, by: string, client?: PoolClient): Promise<Buyer> {
    const id = `BUY-${randomUUID().slice(0, 10)}`;
    await this.run(
      'INSERT INTO camcow_buyers (id, name, kind, phone, location, note, active, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
      [id, i.name.trim(), i.kind, (i.phone ?? '').trim(), (i.location ?? '').trim(), (i.note ?? '').trim(), i.active ?? true, by], client
    );
    return (await this.buyer(id, client))!;
  }

  /** Changes a buyer; the name kept on their sales follows a rename. */
  async updateBuyer(id: string, i: BuyerInput, client: PoolClient): Promise<void> {
    await client.query(
      'UPDATE camcow_buyers SET name = $2, kind = $3, phone = $4, location = $5, note = $6, active = $7, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [id, i.name.trim(), i.kind, (i.phone ?? '').trim(), (i.location ?? '').trim(), (i.note ?? '').trim(), i.active ?? true]
    );
    await client.query('UPDATE camcow_holdings SET buyer = $2 WHERE buyer_id = $1', [id, i.name.trim()]);
  }
}

export const camcowBuyerRepository = new CamcowBuyerRepository();
