import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../config/database';
import { resetDatabase } from './migrate';
import { receiptImportService } from '../services/receipt-import.service';
import { stockService } from '../services/stock.service';
import { settingsRepository } from '../repositories/settings.repository';
import type { Actor } from '../lib/authz';
import type { ReceiptRow, RegisterInput } from '../lib/receipt-import';

// Integration test: needs RUN_DB_TESTS=1 and a database whose name ends in `_test` (it drops every table).
const enabled = process.env.RUN_DB_TESTS === '1' && /_test$/.test(process.env.DB_NAME || '');

const admin = { id: 'ad', name: 'Office Admin', email: 'ad@x.com', role: 'Admin', status: 'Active' } as unknown as Actor;
const row = (printed: string, kg = 300): ReceiptRow => ({ printed, sex: 'Male', weightKg: kg, pricePerKg: 10000, lineTotal: kg * 10000 });
const receipt = (over: Partial<RegisterInput> = {}): RegisterInput => ({
  farm: 'SNR Farm', date: '2026-10-15', seller: 'Sok', invoiceNo: 'INV-42', prefix: 'CC-', breed: '', health: 'Good',
  rows: [row('1'), row('2')], ...over,
});
const pdf = { name: 'inv-42.pdf', type: 'application/pdf', base64: Buffer.from('%PDF-1.4 test receipt').toString('base64') };
const count = async (sql: string) => Number((await pool.query(sql)).rows[0].n);

describe.skipIf(!enabled)('receipts registered twice (migration 034)', () => {
  beforeAll(async () => { await resetDatabase(); });
  afterAll(() => pool.end());
  beforeEach(async () => {
    for (const t of ['receipt_imports', 'cattle_registrations', 'weight_tracking', 'stock']) await pool.query(`DELETE FROM ${t}`);
    await settingsRepository.patchBlob({ farms: [{ id: 'F1', name: 'SNR Farm', capacity: 100 }] });
  });

  it('keeps the receipt with its file, and blocks the same number from the same seller even with other tags', async () => {
    await receiptImportService.register(admin, receipt(), { file: pdf });
    expect(await count('SELECT count(*) n FROM stock')).toBe(2);
    const rec = (await pool.query("SELECT invoice_key, head, total_kg::float kg, total_amount::float amount, cow_ids, file_name, imported_by FROM receipt_imports")).rows;
    expect(rec).toEqual([{ invoice_key: 'inv-42|sok', head: 2, kg: 600, amount: 6_000_000, cow_ids: ['CC-1', 'CC-2'], file_name: 'inv-42.pdf', imported_by: 'Office Admin' }]);

    // Changing the tag prefix used to get the same receipt through: now the number itself is checked.
    await expect(receiptImportService.register(admin, receipt({ prefix: 'SNR-', invoiceNo: ' inv-42 ', seller: 'SOK' }), { confirmedDifferent: true }))
      .rejects.toThrow(/Receipt INV-42 from Sok was already registered on 2026-10-15: 2 cattle at SNR Farm/);
    expect(await count('SELECT count(*) n FROM stock')).toBe(2);
    expect(await count('SELECT count(*) n FROM cattle_registrations')).toBe(2); // nothing extra billed

    // The same number from another seller is a different receipt.
    await receiptImportService.register(admin, receipt({ seller: 'Vanna', prefix: 'VN-' }));
    expect(await count('SELECT count(*) n FROM stock')).toBe(4);
  });

  it('shows the check page what was registered before', async () => {
    await receiptImportService.register(admin, receipt());
    const check = await receiptImportService.check(admin, receipt({ prefix: 'XX-' }));
    expect(check.same).toMatchObject({ invoiceNo: 'INV-42', seller: 'Sok', receiptDate: '2026-10-15', farm: 'SNR Farm', head: 2, importedBy: 'Office Admin' });
    expect((await receiptImportService.check(admin, receipt({ invoiceNo: 'INV-43' }))).same).toBeNull();
  });

  it('asks before a receipt without a number that matches an earlier one goes in', async () => {
    await receiptImportService.register(admin, receipt({ invoiceNo: '' }));
    await expect(receiptImportService.register(admin, receipt({ invoiceNo: '', prefix: 'BB-' }))).rejects.toThrow(/This is a different receipt/);
    expect((await receiptImportService.check(admin, receipt({ invoiceNo: '', prefix: 'BB-' }))).similar).not.toBeNull();
    // A different count or date is not "the same".
    expect((await receiptImportService.check(admin, receipt({ invoiceNo: '', rows: [row('9')] }))).similar).toBeNull();
    await receiptImportService.register(admin, receipt({ invoiceNo: '', prefix: 'BB-' }), { confirmedDifferent: true });
    expect(await count('SELECT count(*) n FROM stock')).toBe(4);
  });

  it('frees a receipt again once an admin has removed all its cattle (registered by mistake)', async () => {
    await receiptImportService.register(admin, receipt());
    await stockService.deleteStock('CC-1', admin);
    await expect(receiptImportService.register(admin, receipt({ prefix: 'NN-' }))).rejects.toThrow(/already registered/); // one still registered
    await stockService.deleteStock('CC-2', admin);
    await receiptImportService.register(admin, receipt({ prefix: 'NN-' }));
    expect(await count("SELECT count(*) n FROM stock WHERE id LIKE 'NN-%'")).toBe(2);
  });

  it('lets only one of two people registering the same receipt at the same time through', async () => {
    const results = await Promise.allSettled([
      receiptImportService.register(admin, receipt({ prefix: 'PP-' })),
      receiptImportService.register(admin, receipt({ prefix: 'QQ-' })),
    ]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(await count('SELECT count(*) n FROM stock')).toBe(2);
    expect(await count('SELECT count(*) n FROM receipt_imports')).toBe(1);
  });

  it('gives an admin the receipt and its original file from an animal', async () => {
    await receiptImportService.register(admin, receipt(), { file: pdf });
    const info = await receiptImportService.receiptOfCow(admin, 'CC-2');
    expect(info).toMatchObject({ invoiceNo: 'INV-42', hasFile: true });
    const file = await receiptImportService.file(admin, info!.id);
    expect(file).toEqual(pdf);
    const staff = { ...admin, role: 'Farm Staff', farmLocation: 'SNR Farm' } as unknown as Actor;
    await expect(receiptImportService.file(staff, info!.id)).rejects.toThrow(/Super Admin or Admin/);
  });

  it('refuses a file that is not a receipt type', async () => {
    await expect(receiptImportService.register(admin, receipt(), { file: { name: 'x.exe', type: 'application/x-msdownload', base64: 'AAAA' } }))
      .rejects.toThrow(/PDF, a photo, or an Excel or CSV file/);
    expect(await count('SELECT count(*) n FROM stock')).toBe(0);
  });
});
