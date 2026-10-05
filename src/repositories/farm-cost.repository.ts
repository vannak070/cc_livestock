import { query } from '../config/database';
import { FarmCostItem } from '../lib/types';
import { QueryResultRow } from 'pg';
import { FarmScope, farmMatchSql } from '../lib/farm-scope';

// The date goes out as text: node-pg turns a DATE into a local-midnight Date,
// which shifts the day once it is turned back into a UTC string.
const COLUMNS = `id, farm_location, category, amount, to_char(date, 'YYYY-MM-DD') AS day, note, recorded_by, created_at`;

export class FarmCostRepository {
  private mapRow(row: QueryResultRow): FarmCostItem {
    return {
      id: row.id,
      farmLocation: row.farm_location,
      category: row.category,
      amount: parseFloat(row.amount || 0),
      date: row.day,
      note: row.note || '',
      recordedBy: row.recorded_by || '',
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : undefined
    };
  }

  /** With a scope, only that farm's costs; without one, every farm's. Newest first. */
  async findAll(scope?: FarmScope): Promise<FarmCostItem[]> {
    const match = scope && farmMatchSql('farm_location', scope.farmLocation, 1);
    const res = await query(
      `SELECT ${COLUMNS} FROM farm_costs ${match ? `WHERE ${match.sql}` : ''} ORDER BY date DESC, created_at DESC`,
      match?.params
    );
    return res.rows.map(row => this.mapRow(row));
  }

  async findById(id: string): Promise<FarmCostItem | null> {
    const res = await query(`SELECT ${COLUMNS} FROM farm_costs WHERE id = $1`, [id]);
    return res.rows.length ? this.mapRow(res.rows[0]) : null;
  }

  async create(cost: Omit<FarmCostItem, 'createdAt'>): Promise<FarmCostItem> {
    const res = await query(
      `INSERT INTO farm_costs (id, farm_location, category, amount, date, note, recorded_by)
       VALUES ($1, $2, $3, $4, $5::date, $6, $7)
       RETURNING ${COLUMNS}`,
      [cost.id, cost.farmLocation, cost.category, cost.amount, cost.date, cost.note || '', cost.recordedBy || '']
    );
    return this.mapRow(res.rows[0]);
  }

  async delete(id: string): Promise<boolean> {
    const res = await query('DELETE FROM farm_costs WHERE id = $1 RETURNING id', [id]);
    return res.rows.length > 0;
  }
}

export const farmCostRepository = new FarmCostRepository();
