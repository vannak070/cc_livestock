import { loadXlsx } from './load-xlsx';

export interface ExcelExportColumn<T = unknown> {
  header: string;
  key: keyof T | string;
  // The cell value is whatever `key` points at (date string, number, array, ...), so
  // each column's formatter decides how to read it. Deliberately untyped here.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  formatter?: (val: any, row: T) => string | number;
  width?: number;
}

export interface ExportToExcelOptions<T = unknown> {
  filename: string;
  sheetName?: string;
  data: T[];
  columns: ExcelExportColumn<T>[];
  /** A heading block above the table (title, farm, period, date), the same on every export. Left out when no title is given. */
  title?: string;
  /** The farm the rows are for; 'All farms' when empty. */
  farm?: string;
  /** What the rows cover, for example from `periodText(start, end)`. */
  period?: string;
}

/** "2026-01-01 to 2026-03-31", "From 2026-01-01", "Up to 2026-03-31" or 'All dates'. */
export function periodText(start?: string, end?: string): string {
  if (start && end) return `${start} to ${end}`;
  if (start) return `From ${start}`;
  if (end) return `Up to ${end}`;
  return 'All dates';
}

/**
 * Export data array to a downloadable .xlsx Excel spreadsheet file
 */
export async function exportToExcel<T = unknown>({
  filename,
  sheetName = 'Sheet1',
  data,
  columns,
  title,
  farm,
  period
}: ExportToExcelOptions<T>) {
  if (!data || data.length === 0) {
    alert('No data available to export.');
    return;
  }
  const xlsx = await loadXlsx();

  // Map raw data array to formatted sheet rows
  const formattedRows = data.map(row => {
    const formattedObj: Record<string, unknown> = {};
    columns.forEach(col => {
      let rawVal: unknown;
      if (typeof col.key === 'string' && col.key.includes('.')) {
        // Support nested keys like 'cow.id'
        const parts = col.key.split('.');
        rawVal = parts.reduce<unknown>((acc, part) => (acc ? (acc as Record<string, unknown>)[part] : undefined), row);
      } else {
        rawVal = (row as Record<string | number | symbol, unknown>)[col.key];
      }

      if (col.formatter) {
        formattedObj[col.header] = col.formatter(rawVal, row);
      } else {
        formattedObj[col.header] = rawVal ?? '';
      }
    });
    return formattedObj;
  });

  // Create worksheet & workbook
  const head: string[][] = title
    ? [['CC Livestock', title], ['Farm', farm || 'All farms'], ['Period', period || 'All dates'], ['Report date', new Date().toISOString().slice(0, 10)], []]
    : [];
  const worksheet = xlsx.utils.aoa_to_sheet(head);
  xlsx.utils.sheet_add_json(worksheet, formattedRows, { header: columns.map(c => c.header), origin: head.length ? `A${head.length + 1}` : 'A1' });

  // Auto-calculate column widths
  const colWidths = columns.map(col => {
    let maxLen = col.header.toString().length;
    formattedRows.forEach(r => {
      const cell = r[col.header];
      const valStr = cell !== undefined && cell !== null ? String(cell) : '';
      if (valStr.length > maxLen) {
        maxLen = valStr.length;
      }
    });
    return { wch: Math.max(maxLen + 4, col.width || 12) };
  });

  worksheet['!cols'] = colWidths;

  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, sheetName);

  // Ensure file extension ends with .xlsx
  const safeFilename = filename.toLowerCase().endsWith('.xlsx')
    ? filename
    : `${filename}.xlsx`;

  // Write and trigger download
  xlsx.writeFile(workbook, safeFilename);
}
