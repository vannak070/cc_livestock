import * as xlsx from 'xlsx';

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
}

/**
 * Export data array to a downloadable .xlsx Excel spreadsheet file
 */
export function exportToExcel<T = unknown>({
  filename,
  sheetName = 'Sheet1',
  data,
  columns
}: ExportToExcelOptions<T>) {
  if (!data || data.length === 0) {
    alert('No data available to export.');
    return;
  }

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
  const worksheet = xlsx.utils.json_to_sheet(formattedRows);

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
