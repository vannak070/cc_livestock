import { PoolClient, QueryResultRow } from 'pg';
import { query } from '../config/database';
import type { FarmLimitChange, FarmLimitRequest } from '../lib/types';
import { FarmScope, farmMatchSql } from '../lib/farm-scope';

const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : undefined);

/** Requests for a higher cattle limit, and the record of every limit change. */
export class FarmLimitRepository {
  private run(sql: string, params: unknown[], client?: PoolClient) {
    return client ? client.query(sql, params) : query(sql, params);
  }

  private request(row: QueryResultRow): FarmLimitRequest {
    return {
      id: row.id,
      farmLocation: row.farm_location,
      extra: Number(row.extra),
      reason: row.reason || '',
      status: row.status,
      requestedBy: row.requested_by || '',
      createdAt: iso(row.created_at)!,
      ...(row.decided_by ? { decidedBy: row.decided_by } : {}),
      ...(row.decided_at ? { decidedAt: iso(row.decided_at) } : {}),
      ...(row.decision_note ? { decisionNote: row.decision_note } : {}),
      ...(row.new_limit !== null && row.new_limit !== undefined ? { newLimit: Number(row.new_limit) } : {}),
    };
  }

  private change(row: QueryResultRow): FarmLimitChange {
    return {
      id: row.id,
      farmLocation: row.farm_location,
      oldLimit: Number(row.old_limit),
      newLimit: Number(row.new_limit),
      changedBy: row.changed_by || '',
      changedAt: iso(row.changed_at)!,
      reason: row.reason || '',
      ...(row.request_id ? { requestId: row.request_id } : {}),
    };
  }

  /** With a scope, only that farm's; newest first. */
  async findRequests(scope?: FarmScope): Promise<FarmLimitRequest[]> {
    const match = scope && farmMatchSql('farm_location', scope.farmLocation, 1);
    const res = await query(`SELECT * FROM farm_limit_requests ${match ? `WHERE ${match.sql}` : ''} ORDER BY created_at DESC`, match?.params);
    return res.rows.map(r => this.request(r));
  }

  async findChanges(scope?: FarmScope): Promise<FarmLimitChange[]> {
    const match = scope && farmMatchSql('farm_location', scope.farmLocation, 1);
    const res = await query(`SELECT * FROM farm_limit_changes ${match ? `WHERE ${match.sql}` : ''} ORDER BY changed_at DESC`, match?.params);
    return res.rows.map(r => this.change(r));
  }

  async findRequestById(id: string, client?: PoolClient): Promise<FarmLimitRequest | null> {
    const res = await this.run('SELECT * FROM farm_limit_requests WHERE id = $1', [id], client);
    return res.rows.length ? this.request(res.rows[0]) : null;
  }

  async pendingFor(farm: string): Promise<FarmLimitRequest | null> {
    const res = await query(`SELECT * FROM farm_limit_requests WHERE farm_location = $1 AND status = 'pending' ORDER BY created_at DESC LIMIT 1`, [farm]);
    return res.rows.length ? this.request(res.rows[0]) : null;
  }

  async createRequest(r: Pick<FarmLimitRequest, 'id' | 'farmLocation' | 'extra' | 'reason' | 'requestedBy'>): Promise<FarmLimitRequest> {
    const res = await query(
      `INSERT INTO farm_limit_requests (id, farm_location, extra, reason, requested_by) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [r.id, r.farmLocation, r.extra, r.reason, r.requestedBy]
    );
    return this.request(res.rows[0]);
  }

  /** Records the decision only while the request is still pending; returns false when someone decided it first. */
  async decide(id: string, d: { status: 'approved' | 'declined'; decidedBy: string; note: string; newLimit?: number }, client?: PoolClient): Promise<boolean> {
    const res = await this.run(
      `UPDATE farm_limit_requests SET status = $2, decided_by = $3, decided_at = NOW(), decision_note = $4, new_limit = $5
       WHERE id = $1 AND status = 'pending' RETURNING id`,
      [id, d.status, d.decidedBy, d.note, d.newLimit ?? null],
      client
    );
    return (res.rowCount ?? 0) > 0;
  }

  async logChange(c: Omit<FarmLimitChange, 'changedAt'>, client?: PoolClient): Promise<void> {
    await this.run(
      `INSERT INTO farm_limit_changes (id, farm_location, old_limit, new_limit, changed_by, reason, request_id) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [c.id, c.farmLocation, c.oldLimit, c.newLimit, c.changedBy, c.reason, c.requestId ?? null],
      client
    );
  }
}

export const farmLimitRepository = new FarmLimitRepository();
