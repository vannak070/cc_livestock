import type { PoolClient } from 'pg';
import { query } from '../../config/database';

/** Helpers shared by the website repositories. */
export const iso = (v: unknown): string | undefined => (v ? new Date(v as string).toISOString() : undefined);
export const day = (v: unknown): string | undefined => {
  if (!v) return undefined;
  if (v instanceof Date) return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
  return String(v).slice(0, 10);
};
export const num = (v: unknown): number | undefined => (v === null || v === undefined ? undefined : Number(v));
export const ids = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);

export function run(sql: string, params: unknown[], client?: PoolClient) {
  return client ? client.query(sql, params) : query(sql, params);
}
