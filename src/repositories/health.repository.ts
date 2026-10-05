import { query } from '../config/database';
import { HealthLogItem } from '../lib/types';
import { PoolClient, QueryResultRow } from 'pg';
import { FarmScope, farmMatchSql } from '../lib/farm-scope';

export class HealthRepository {
  private async executeQuery(sql: string, params?: unknown[], client?: PoolClient) {
    if (client) {
      return client.query(sql, params);
    }
    return query(sql, params);
  }

  private mapRowToHealthLog(row: QueryResultRow): HealthLogItem {
    return {
      id: row.id,
      cowId: row.cow_id,
      type: row.type,
      name: row.name,
      date: row.date ? new Date(row.date).toISOString() : new Date().toISOString(),
      administeredBy: row.administered_by || '',
      cost: parseFloat(row.cost || 0),
      notes: row.notes || ''
    };
  }

  /** With a scope, only rows for that farm's cattle; without one, everything. */
  async findAll(scope?: FarmScope): Promise<HealthLogItem[]> {
    const match = scope && farmMatchSql('s.location', scope.farmLocation, 1);
    const res = await query(
      `SELECT t.* FROM health_logs t ${match ? `WHERE t.cow_id IN (SELECT s.id FROM stock s WHERE ${match.sql})` : ''} ORDER BY t.date DESC`,
      match?.params
    );
    return res.rows.map(row => this.mapRowToHealthLog(row));
  }

  async findById(id: string): Promise<HealthLogItem | null> {
    const res = await query('SELECT * FROM health_logs WHERE id = $1', [id]);
    if (res.rows.length === 0) return null;
    return this.mapRowToHealthLog(res.rows[0]);
  }

  async create(log: Omit<HealthLogItem, 'id'> & { id?: string }, client?: PoolClient): Promise<HealthLogItem> {
    const id = log.id || `HL-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    const sql = `
      INSERT INTO health_logs (id, cow_id, type, name, date, administered_by, cost, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    const params = [
      id,
      log.cowId,
      log.type,
      log.name,
      log.date ? new Date(log.date) : new Date(),
      log.administeredBy || '',
      log.cost || 0,
      log.notes || ''
    ];

    const res = await this.executeQuery(sql, params, client);
    return this.mapRowToHealthLog(res.rows[0]);
  }

  async update(id: string, updates: Partial<HealthLogItem>, client?: PoolClient): Promise<HealthLogItem> {
    const fields: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (updates.type !== undefined) { fields.push(`type = $${idx++}`); params.push(updates.type); }
    if (updates.name !== undefined) { fields.push(`name = $${idx++}`); params.push(updates.name); }
    if (updates.date !== undefined) { fields.push(`date = $${idx++}`); params.push(new Date(updates.date)); }
    if (updates.administeredBy !== undefined) { fields.push(`administered_by = $${idx++}`); params.push(updates.administeredBy); }
    if (updates.cost !== undefined) { fields.push(`cost = $${idx++}`); params.push(updates.cost); }
    if (updates.notes !== undefined) { fields.push(`notes = $${idx++}`); params.push(updates.notes); }

    if (fields.length === 0) {
      const existing = await this.findById(id);
      if (!existing) throw new Error(`Health log ${id} not found`);
      return existing;
    }

    params.push(id);
    const sql = `UPDATE health_logs SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`;
    const res = await this.executeQuery(sql, params, client);
    if (res.rows.length === 0) throw new Error(`Health log ${id} not found`);

    return this.mapRowToHealthLog(res.rows[0]);
  }

  async delete(id: string, client?: PoolClient): Promise<boolean> {
    const res = await this.executeQuery('DELETE FROM health_logs WHERE id = $1 RETURNING id', [id], client);
    return res.rows.length > 0;
  }
}

export const healthRepository = new HealthRepository();
