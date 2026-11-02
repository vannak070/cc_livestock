import type { PoolClient } from 'pg';
import { query } from '../config/database';
import type { EarlierReceipt } from '../lib/receipt-import';

export interface ReceiptImportRow {
  invoiceNo: string;
  invoiceKey: string;
  seller: string;
  receiptDate: string;
  farm: string;
  head: number;
  totalKg: number;
  totalAmount: number;
  cowIds: string[];
  file?: { name: string; type: string; data: Buffer } | null;
  importedBy: string;
}

/** A receipt still counts while any of its cattle has a live registration (an admin removing all of them frees it). */
const LIVE = `EXISTS (SELECT 1 FROM cattle_registrations r WHERE r.cow_id = ANY(ri.cow_ids) AND r.removed_at IS NULL)`;
const EARLIER = `ri.id, ri.invoice_no, ri.seller, to_char(ri.receipt_date, 'YYYY-MM-DD') AS receipt_date, ri.farm_location, ri.head, ri.imported_by`;

const toEarlier = (r: Record<string, unknown>): EarlierReceipt => ({
  id: String(r.id),
  invoiceNo: String(r.invoice_no ?? ''),
  seller: String(r.seller ?? ''),
  receiptDate: String(r.receipt_date ?? ''),
  farm: String(r.farm_location ?? ''),
  head: Number(r.head ?? 0),
  importedBy: String(r.imported_by ?? ''),
});

/** Supplier receipts registered through Cattle -> Upload (migration 034). */
export class ReceiptImportRepository {
  private run(sql: string, params: unknown[], client?: PoolClient) {
    return client ? client.query(sql, params) : query(sql, params);
  }

  /** Waits for anyone registering the same receipt right now, until this transaction ends (no double registration). */
  async lock(key: string, client: PoolClient): Promise<void> {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`receipt:${key}`]);
  }

  /** The same number from the same seller, still registered. */
  async findSame(invoiceKey: string, client?: PoolClient): Promise<EarlierReceipt | null> {
    if (!invoiceKey) return null;
    const res = await this.run(`SELECT ${EARLIER} FROM receipt_imports ri WHERE ri.invoice_key = $1 AND ${LIVE} ORDER BY ri.imported_at LIMIT 1`, [invoiceKey], client);
    return res.rows[0] ? toEarlier(res.rows[0]) : null;
  }

  /** A receipt without a number with the same seller, date, head and total, still registered. */
  async findSimilar(seller: string, receiptDate: string, head: number, totalAmount: number, client?: PoolClient): Promise<EarlierReceipt | null> {
    const res = await this.run(
      `SELECT ${EARLIER} FROM receipt_imports ri
        WHERE ri.invoice_key = '' AND LOWER(BTRIM(ri.seller)) = LOWER(BTRIM($1)) AND ri.receipt_date = $2 AND ri.head = $3 AND ri.total_amount = $4 AND ${LIVE}
        ORDER BY ri.imported_at LIMIT 1`,
      [seller, receiptDate, head, totalAmount], client,
    );
    return res.rows[0] ? toEarlier(res.rows[0]) : null;
  }

  async insert(row: ReceiptImportRow, client: PoolClient): Promise<string> {
    const id = `RCPT-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    await client.query(
      `INSERT INTO receipt_imports (id, invoice_no, invoice_key, seller, receipt_date, farm_location, head, total_kg, total_amount, cow_ids, file_name, file_type, file_data, imported_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [id, row.invoiceNo, row.invoiceKey, row.seller, row.receiptDate, row.farm, row.head, row.totalKg, row.totalAmount, row.cowIds,
        row.file?.name ?? null, row.file?.type ?? null, row.file?.data ?? null, row.importedBy],
    );
    return id;
  }

  /** The receipt an animal was registered from (without the file), or null. */
  async findByCow(cowId: string): Promise<(EarlierReceipt & { hasFile: boolean }) | null> {
    const res = await query(`SELECT ${EARLIER}, (ri.file_data IS NOT NULL) AS has_file FROM receipt_imports ri WHERE $1 = ANY(ri.cow_ids) ORDER BY ri.imported_at DESC LIMIT 1`, [cowId]);
    return res.rows[0] ? { ...toEarlier(res.rows[0]), hasFile: Boolean(res.rows[0].has_file) } : null;
  }

  async getFile(id: string): Promise<{ name: string; type: string; data: Buffer } | null> {
    const res = await query('SELECT file_name, file_type, file_data FROM receipt_imports WHERE id = $1 AND file_data IS NOT NULL', [id]);
    const r = res.rows[0];
    return r ? { name: String(r.file_name ?? 'receipt'), type: String(r.file_type ?? 'application/octet-stream'), data: r.file_data as Buffer } : null;
  }
}

export const receiptImportRepository = new ReceiptImportRepository();
