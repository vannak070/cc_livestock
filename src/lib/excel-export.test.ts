import { describe, expect, it, vi } from 'vitest';
import * as xlsx from 'xlsx';

const written: { book?: xlsx.WorkBook } = {};
vi.mock('xlsx', async importOriginal => {
  const real = await importOriginal<typeof import('xlsx')>();
  return { ...real, writeFile: (wb: xlsx.WorkBook) => { written.book = wb; } };
});
import { exportToExcel, periodText } from './excel-export';

describe('periodText', () => {
  it('words the filters', () => {
    expect(periodText('2026-01-01', '2026-03-31')).toBe('2026-01-01 to 2026-03-31');
    expect(periodText('2026-01-01', '')).toBe('From 2026-01-01');
    expect(periodText('', '2026-03-31')).toBe('Up to 2026-03-31');
    expect(periodText()).toBe('All dates');
  });
});

describe('exportToExcel heading', () => {
  it('puts the title block above the table', async () => {
    await exportToExcel({ filename: 'x', title: 'Sales', farm: '', period: 'All dates', data: [{ a: 1 }], columns: [{ header: 'A', key: 'a' }] });
    const rows = xlsx.utils.sheet_to_json<unknown[]>(written.book!.Sheets[written.book!.SheetNames[0]], { header: 1 });
    expect(rows[0]).toEqual(['CC Livestock', 'Sales']);
    expect(rows[1]).toEqual(['Farm', 'All farms']);
    expect(rows[5]).toEqual(['A']);
    expect(rows[6]).toEqual([1]);
  });
});
