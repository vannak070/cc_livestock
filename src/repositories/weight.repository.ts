import { query } from '../config/database';
import { WeightRecord } from '../lib/xlsx-parser';
import { PoolClient, QueryResultRow } from 'pg';
import { FarmScope, farmMatchSql } from '../lib/farm-scope';

export class WeightRepository {
  private async executeQuery(sql: string, params?: unknown[], client?: PoolClient) {
    if (client) {
      return client.query(sql, params);
    }
    return query(sql, params);
  }

  private mapRowToWeightRecord(row: QueryResultRow): WeightRecord {
    return {
      cowId: row.cow_id,
      breed: row.breed || '',
      age: row.age || '',
      oldWeight: parseFloat(row.old_weight || 0),
      currentWeight: parseFloat(row.current_weight || 0),
      gainLoss: parseFloat(row.gain_loss || 0),
      healthStatus: row.health_status || 'Good',
      status: row.status || 'Active',
      trackingDate: row.tracking_date ? new Date(row.tracking_date).toISOString() : null
    };
  }

  /** With a scope, only rows for that farm's cattle; without one, everything. */
  async findAll(scope?: FarmScope): Promise<WeightRecord[]> {
    const match = scope && farmMatchSql('s.location', scope.farmLocation, 1);
    const res = await query(
      `SELECT t.* FROM weight_tracking t ${match ? `WHERE t.cow_id IN (SELECT s.id FROM stock s WHERE ${match.sql})` : ''} ORDER BY t.tracking_date ASC, t.id ASC`,
      match?.params
    );
    return res.rows.map(row => this.mapRowToWeightRecord(row));
  }

  async findByCowId(cowId: string): Promise<WeightRecord[]> {
    const res = await query('SELECT * FROM weight_tracking WHERE cow_id = $1 ORDER BY tracking_date ASC, id ASC', [cowId]);
    return res.rows.map(row => this.mapRowToWeightRecord(row));
  }

  async create(record: WeightRecord, client?: PoolClient): Promise<WeightRecord> {
    const sql = `
      INSERT INTO weight_tracking (
        cow_id, breed, age, old_weight, current_weight, gain_loss, health_status, status, tracking_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    const params = [
      record.cowId,
      record.breed || '',
      record.age || '',
      record.oldWeight || 0,
      record.currentWeight || 0,
      record.gainLoss || 0,
      record.healthStatus || 'Good',
      record.status || 'Active',
      record.trackingDate ? new Date(record.trackingDate) : new Date()
    ];

    const res = await this.executeQuery(sql, params, client);
    return this.mapRowToWeightRecord(res.rows[0]);
  }

  async update(cowId: string, trackingDate: string, currentWeight: number, healthStatus: string, client?: PoolClient): Promise<WeightRecord | null> {
    const findRes = await this.executeQuery(
      'SELECT old_weight FROM weight_tracking WHERE cow_id = $1 AND tracking_date = $2',
      [cowId, new Date(trackingDate)],
      client
    );
    
    const oldWeight = findRes.rows.length > 0 ? parseFloat(findRes.rows[0].old_weight) : 0;
    const gainLoss = oldWeight > 0 ? (currentWeight - oldWeight) / oldWeight : 0;

    const sql = `
      UPDATE weight_tracking
      SET current_weight = $1, health_status = $2, gain_loss = $3
      WHERE cow_id = $4 AND tracking_date = $5
      RETURNING *
    `;
    const res = await this.executeQuery(sql, [currentWeight, healthStatus, gainLoss, cowId, new Date(trackingDate)], client);
    if (res.rows.length === 0) return null;
    return this.mapRowToWeightRecord(res.rows[0]);
  }

  async delete(cowId: string, trackingDate: string, client?: PoolClient): Promise<boolean> {
    const res = await this.executeQuery(
      'DELETE FROM weight_tracking WHERE cow_id = $1 AND tracking_date = $2 RETURNING id',
      [cowId, new Date(trackingDate)],
      client
    );
    return res.rows.length > 0;
  }
}

export const weightRepository = new WeightRepository();
