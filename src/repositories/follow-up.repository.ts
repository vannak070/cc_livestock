import { PoolClient, QueryResultRow } from 'pg';
import { query } from '../config/database';
import type { CattleFollowUp, FollowUpAction } from '../lib/types';
import { FarmScope, farmMatchSql } from '../lib/farm-scope';
import { localDay } from '../lib/local-day';

const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : undefined);

/** Next actions recorded for long-stay cattle (migration 015). */
export class FollowUpRepository {
  private run(sql: string, params: unknown[], client?: PoolClient) {
    return client ? client.query(sql, params) : query(sql, params);
  }

  private map(row: QueryResultRow): CattleFollowUp {
    return {
      id: row.id,
      cowId: row.cow_id,
      action: row.action as FollowUpAction,
      note: row.note || '',
      ...(row.due_date ? { dueDate: localDay(row.due_date) } : {}),
      createdBy: row.created_by || '',
      createdAt: iso(row.created_at)!,
      ...(row.done_at ? { doneAt: iso(row.done_at) } : {}),
      ...(row.done_by ? { doneBy: row.done_by } : {}),
    };
  }

  /** With a scope, only follow-ups of that farm's cattle. */
  async findAll(scope?: FarmScope): Promise<CattleFollowUp[]> {
    const match = scope && farmMatchSql('s.location', scope.farmLocation, 1);
    const res = await query(
      `SELECT f.* FROM cattle_follow_ups f ${match ? `WHERE f.cow_id IN (SELECT s.id FROM stock s WHERE ${match.sql})` : ''} ORDER BY f.created_at DESC`,
      match?.params
    );
    return res.rows.map(r => this.map(r));
  }

  async findById(id: string): Promise<CattleFollowUp | null> {
    const res = await query('SELECT * FROM cattle_follow_ups WHERE id = $1', [id]);
    return res.rows[0] ? this.map(res.rows[0]) : null;
  }

  async create(f: Omit<CattleFollowUp, 'createdAt' | 'doneAt' | 'doneBy'>, client?: PoolClient): Promise<void> {
    await this.run(
      'INSERT INTO cattle_follow_ups (id, cow_id, action, note, due_date, created_by) VALUES ($1, $2, $3, $4, $5, $6)',
      [f.id, f.cowId, f.action, f.note, f.dueDate || null, f.createdBy],
      client
    );
  }

  /** Marks every open follow-up of an animal done (used when a newer one replaces it). */
  async closeOpenFor(cowId: string, by: string, client?: PoolClient): Promise<void> {
    await this.run('UPDATE cattle_follow_ups SET done_at = CURRENT_TIMESTAMP, done_by = $2 WHERE cow_id = $1 AND done_at IS NULL', [cowId, by], client);
  }

  /** Marks one follow-up done; false when it was already done. */
  async markDone(id: string, by: string): Promise<boolean> {
    const res = await query('UPDATE cattle_follow_ups SET done_at = CURRENT_TIMESTAMP, done_by = $2 WHERE id = $1 AND done_at IS NULL', [id, by]);
    return (res.rowCount ?? 0) > 0;
  }
}

export const followUpRepository = new FollowUpRepository();
