// Registering cattle from a supplier's "Proof of Receipt" (a PDF or photo).
// Pure helpers: what the AI is asked to read, how its answer is cleaned, the
// checks the person sees before anything is saved, and the cattle records built
// from the checked list. No I/O, so the server and the page share the same rules.

import type { StockItem } from './xlsx-parser';

/**
 * The "Upload" button on the Cattle page (Super Admins and Admins). Switched on 2026-10-16 (user: "please enable Upload for
 * Cattle function"); set to false to hide it again.
 */
export const RECEIPT_IMPORT_ENABLED = true;

export const RECEIPT_MAX_ROWS = 200;
/** A rounding slack on a line total, in riel. */
const MONEY_SLACK = 1;
/** A rounding slack on the printed total weight, in kg. */
const KG_SLACK = 0.5;

export type ReceiptSex = 'Male' | 'Female' | '';

export interface ReceiptRow {
  /** The number printed on the receipt, without any prefix. */
  printed: string;
  sex: ReceiptSex;
  weightKg: number;
  pricePerKg: number;
  /** The line total printed on the receipt (riel). */
  lineTotal: number;
  /** This animal's breed; when missing the list's breed is used. */
  breed?: string;
}

export interface ReceiptDraft {
  invoiceNo: string;
  /** YYYY-MM-DD, or empty when the date could not be read. */
  date: string;
  seller: string;
  rows: ReceiptRow[];
  /** The totals printed at the foot of the receipt; 0 when not printed. */
  printedHead: number;
  printedKg: number;
  printedTotal: number;
}

/** What the AI must return. Numbers are 0 and text is empty when something is not on the receipt. */
export const RECEIPT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['invoiceNo', 'date', 'seller', 'rows', 'printedHead', 'printedKg', 'printedTotal'],
  properties: {
    invoiceNo: { type: 'string', description: 'Invoice or receipt number as printed, empty if none' },
    date: { type: 'string', description: 'Receipt date as YYYY-MM-DD, empty if unreadable' },
    seller: { type: 'string', description: 'Name of the supplier / seller as printed, empty if none' },
    rows: {
      type: 'array',
      description: 'One entry per animal, in the order printed',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['tag', 'sex', 'weightKg', 'pricePerKg', 'lineTotal'],
        properties: {
          tag: { type: 'string', description: 'The animal number / tag exactly as printed' },
          sex: { type: 'string', description: 'The sex exactly as printed (for example ឈ្មោល, ញី, Male, Female)' },
          weightKg: { type: 'number', description: 'Weight in kg' },
          pricePerKg: { type: 'number', description: 'Price per kg in riel' },
          lineTotal: { type: 'number', description: 'Line amount in riel as printed' },
        },
      },
    },
    printedHead: { type: 'number', description: 'Total number of animals printed in the footer, 0 if not printed' },
    printedKg: { type: 'number', description: 'Total weight in kg printed in the footer, 0 if not printed' },
    printedTotal: { type: 'number', description: 'Total amount in riel printed in the footer, 0 if not printed' },
  },
} as const;

export const RECEIPT_PROMPT = [
  'This is a cattle purchase receipt ("Proof of Receipt") from a supplier, as a photo or PDF. It may be in Khmer and English.',
  'Read it and return every animal row exactly as printed. Do not correct, guess or invent anything: copy the numbers as they appear.',
  'ឈ្មោល means male and ញី means female; copy the sex word as printed.',
  'Amounts are in Cambodian riel (KHR) unless the receipt says otherwise. If a dollar amount is printed beside it, ignore the dollar amount.',
  'Return the footer totals (number of animals, total kg, total amount in riel) separately from the rows. Use 0 or an empty string for anything that is not printed.',
].join('\n');

const KHMER_DIGITS = '០១២៣៤៥៦៧៨៩';
/** A number from a cell or the AI's answer: Khmer digits, thousands commas and a unit typed beside it ("350 kg", "11,000 ៛") are fine. */
const num = (v: unknown): number => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const s = String(v ?? '').replace(/[០-៩]/g, d => String(KHMER_DIGITS.indexOf(d))).replace(/[,\s]/g, '');
  const m = s.match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : 0;
};
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim());

/** Khmer and English words for the sex, to the app's stored values. Empty when unknown. */
export function sexFromPrinted(printed: string): ReceiptSex {
  const s = printed.trim().toLowerCase();
  if (!s) return '';
  if (s.includes('ឈ្មោល') || s === 'm' || s.startsWith('male') || s === 'bull' || s === 'ox') return 'Male';
  if (s.includes('ញី') || s === 'f' || s.startsWith('female') || s === 'cow' || s === 'heifer') return 'Female';
  return '';
}

/** Cleans what the AI returned (anything could be in it) into a draft the page can edit. */
export function draftFromExtraction(raw: unknown): ReceiptDraft {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const rows = (Array.isArray(o.rows) ? o.rows : []).slice(0, RECEIPT_MAX_ROWS).map((r): ReceiptRow => {
    const x = (r && typeof r === 'object' ? r : {}) as Record<string, unknown>;
    return { printed: str(x.tag), sex: sexFromPrinted(str(x.sex)), weightKg: num(x.weightKg), pricePerKg: num(x.pricePerKg), lineTotal: num(x.lineTotal) };
  });
  const date = str(o.date);
  return {
    invoiceNo: str(o.invoiceNo),
    date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '',
    seller: str(o.seller),
    rows,
    printedHead: Math.round(num(o.printedHead)),
    printedKg: num(o.printedKg),
    printedTotal: num(o.printedTotal),
  };
}

const HEADERS: Record<'tag' | 'tagWeak' | 'breed' | 'sex' | 'weight' | 'price' | 'total', string[]> = {
  tag: ['tag', 'cow id', 'cow_id', 'animal', 'ស្លាក'],
  // A plain running number (No., #) names the tag only when no clearer tag column exists.
  tagWeak: ['id', 'number', 'no.', 'no', 'លេខ', 'ល.រ'],
  breed: ['breed', 'ពូជ'],
  sex: ['sex', 'gender', 'ភេទ'],
  weight: ['weight', 'kg', 'ទម្ងន់', 'ទំងន់', 'គីឡូ'],
  price: ['price', 'unit', 'per kg', 'តម្លៃ', 'ថ្លៃ'],
  total: ['total', 'amount', 'សរុប', 'ទឹកប្រាក់', 'ចំនួនទឹកប្រាក់'],
};

/**
 * Which column holds what, from a header cell's text. `total` is tried first ("Total price" is a total), then `price` before
 * `weight` (the Khmer "price per kilo" header contains the word for kilo).
 */
function columnOf(cell: string): keyof typeof HEADERS | null {
  const c = cell.trim().toLowerCase();
  if (!c) return null;
  const hit = (k: keyof typeof HEADERS) => HEADERS[k].some(w => (w.length <= 3 ? c === w || c.startsWith(`${w} `) || c.startsWith(`${w}.`) : c.includes(w)));
  if (hit('total')) return 'total';
  for (const k of ['price', 'weight', 'breed', 'sex', 'tag', 'tagWeak'] as const) if (hit(k)) return k;
  return null;
}

/**
 * Cattle listed in an Excel or CSV sheet (rows of cells, as the sheet library returns them). The first row that names at least a tag
 * column and a weight column is the header; rows below it become animals; empty rows are skipped, and a "Total" footer row
 * gives the printed kg and amount the list is checked against (like a receipt's footer). Returns a draft for the same check
 * page as a receipt. Throws a reason a person can act on when no header is found.
 */
export function draftFromSheet(grid: unknown[][]): ReceiptDraft {
  let head = -1;
  let cols: Partial<Record<keyof typeof HEADERS, number>> = {};
  for (let i = 0; i < Math.min(grid.length, 30); i++) {
    const found: Partial<Record<keyof typeof HEADERS, number>> = {};
    (grid[i] ?? []).forEach((cell, j) => { const k = columnOf(str(cell)); if (k && found[k] === undefined) found[k] = j; });
    if (found.tag === undefined) found.tag = found.tagWeak;
    if (found.tag !== undefined && found.weight !== undefined) { head = i; cols = found; break; }
  }
  if (head < 0) throw new Error('The sheet needs a header row with at least a tag column and a weight (kg) column.');
  const at = (r: unknown[], k: keyof typeof HEADERS) => (cols[k] === undefined ? undefined : r[cols[k] as number]);
  const rows: ReceiptRow[] = [];
  let printedKg = 0;
  let printedTotal = 0;
  for (const r of grid.slice(head + 1)) {
    if (!r || r.every(c => str(c) === '')) continue;
    if (r.some(c => /^(total|sum|សរុប)/i.test(str(c)))) {
      printedKg = num(at(r, 'weight'));
      printedTotal = num(at(r, 'total'));
      continue;
    }
    const tag = str(at(r, 'tag'));
    if (!tag) continue;
    const weightKg = num(at(r, 'weight'));
    const pricePerKg = num(at(r, 'price'));
    const lineTotal = num(at(r, 'total')) || Math.round(weightKg * pricePerKg);
    const breed = str(at(r, 'breed'));
    rows.push({ printed: tag, sex: sexFromPrinted(str(at(r, 'sex'))), weightKg, pricePerKg, lineTotal, ...(breed ? { breed } : {}) });
    if (rows.length >= RECEIPT_MAX_ROWS) break;
  }
  if (rows.length === 0) throw new Error('No cattle were found in that sheet.');
  return { invoiceNo: '', date: '', seller: '', rows, printedHead: 0, printedKg, printedTotal };
}

/** The tag an animal is registered under: the prefix plus the number printed on the receipt. */
export const tagFor = (prefix: string, printed: string): string => `${prefix.trim()}${printed.trim()}`;

/** A reason a row cannot be saved. */
export type RowProblem = 'tag' | 'tagTwice' | 'tagUsed' | 'sex' | 'weight' | 'price' | 'lineTotal';

export interface TotalCheck { printed: number; counted: number; ok: boolean }

export interface ReceiptCheck {
  /** Problems per row, same order as the rows. Only 'lineTotal' is a warning; the rest stop saving. */
  rows: RowProblem[][];
  head: TotalCheck | null;
  kg: TotalCheck | null;
  amount: TotalCheck | null;
  /** The list is empty, or a row has a blocking problem. */
  blocked: boolean;
  /** Anything worth a second look: a total that does not match or a line total that does not add up. */
  needsLook: boolean;
}

export interface CheckInput {
  rows: ReceiptRow[];
  prefix: string;
  /** Tags already used by animals on the system. */
  existingTags: Iterable<string>;
  printedHead: number;
  printedKg: number;
  printedTotal: number;
}

const lineOf = (r: ReceiptRow) => r.weightKg * r.pricePerKg;

/** Every check the person sees on the "check the list" page, and again on the server before saving. */
export function checkReceipt(input: CheckInput): ReceiptCheck {
  const used = new Set([...input.existingTags].map(t => t.trim().toLowerCase()));
  const seen = new Map<string, number>();
  for (const r of input.rows) {
    const key = tagFor(input.prefix, r.printed).toLowerCase();
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  const rows = input.rows.map((r): RowProblem[] => {
    const out: RowProblem[] = [];
    const tag = tagFor(input.prefix, r.printed);
    if (!r.printed.trim() || tag.length <= 3) out.push('tag');
    else if ((seen.get(tag.toLowerCase()) ?? 0) > 1) out.push('tagTwice');
    else if (used.has(tag.toLowerCase())) out.push('tagUsed');
    if (!r.sex) out.push('sex');
    if (!(r.weightKg > 0)) out.push('weight');
    if (!(r.pricePerKg > 0)) out.push('price');
    if (r.weightKg > 0 && r.pricePerKg > 0 && Math.abs(lineOf(r) - r.lineTotal) > MONEY_SLACK) out.push('lineTotal');
    return out;
  });
  const total = (printed: number, counted: number, slack: number): TotalCheck | null =>
    printed > 0 ? { printed, counted, ok: Math.abs(printed - counted) <= slack } : null;
  const head = total(input.printedHead, input.rows.length, 0);
  const kg = total(input.printedKg, input.rows.reduce((s, r) => s + r.weightKg, 0), KG_SLACK);
  const amount = total(input.printedTotal, input.rows.reduce((s, r) => s + r.lineTotal, 0), MONEY_SLACK);
  const blocked = input.rows.length === 0 || rows.some(p => p.some(x => x !== 'lineTotal'));
  const needsLook = rows.some(p => p.includes('lineTotal')) || [head, kg, amount].some(t => t && !t.ok);
  return { rows, head, kg, amount, blocked, needsLook };
}

export interface RegisterInput {
  farm: string;
  /** YYYY-MM-DD the cattle arrived (the receipt date). */
  date: string;
  seller: string;
  invoiceNo: string;
  prefix: string;
  breed: string;
  health: string;
  rows: ReceiptRow[];
}

/** The cattle records for the checked list: bought by the kg, paid per the receipt. */
export function stockFromReceipt(input: RegisterInput): Omit<StockItem, 'no'>[] {
  return input.rows.map(r => ({
    id: tagFor(input.prefix, r.printed),
    breed: r.breed || input.breed,
    sex: r.sex,
    age: 'N/A',
    weight: r.weightKg,
    ownerName: input.seller.trim(),
    location: input.farm,
    phone: 'N/A',
    buyType: 'Weight',
    unitPrice: r.pricePerKg,
    totalPrice: Math.round(lineOf(r)),
    healthStatus: input.health,
    status: 'Active',
    purchaseDate: input.date,
    remark: input.invoiceNo.trim() ? `Receipt ${input.invoiceNo.trim()}` : '',
    purchaseType: 'Purchase',
    paymentMethod: 'N/A',
  }));
}

/** Why a request to register cannot go ahead, or null. The server uses it as its own check. */
export function registerProblem(input: RegisterInput, existingTags: Iterable<string>): string | null {
  if (!input.farm.trim()) return 'Choose the farm the cattle go to.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return 'Enter the date the cattle arrived.';
  if (input.rows.length === 0) return 'The list has no cattle.';
  if (input.rows.length > RECEIPT_MAX_ROWS) return `A receipt can have at most ${RECEIPT_MAX_ROWS} cattle.`;
  const check = checkReceipt({ rows: input.rows, prefix: input.prefix, existingTags, printedHead: 0, printedKg: 0, printedTotal: 0 });
  const bad = check.rows.findIndex(p => p.some(x => x !== 'lineTotal'));
  if (bad >= 0) return `Row ${bad + 1} needs fixing (${check.rows[bad].filter(x => x !== 'lineTotal').join(', ')}).`;
  return null;
}

// ─── The same receipt twice (migration 034, user choices 2026-10-28) ─────────

const squash = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * What makes two receipts "the same": the printed number and the seller, ignoring case and extra spaces. A receipt
 * without a number has no key ('') and is compared by seller, date, head and total instead (see SimilarReceipt).
 */
export const invoiceKey = (invoiceNo: string, seller: string): string => {
  const no = squash(invoiceNo);
  return no ? `${no}|${squash(seller)}` : '';
};

/** The original receipt file kept with the record (PDF, photo, Excel or CSV; at most 6 MB). */
export interface ReceiptFile { name: string; type: string; base64: string }

/** Head, kg and amount of a list as they are saved on the receipt record. */
export function receiptTotals(rows: ReceiptRow[]): { head: number; kg: number; amount: number } {
  return {
    head: rows.length,
    kg: Math.round(rows.reduce((s, r) => s + r.weightKg, 0) * 10) / 10,
    amount: Math.round(rows.reduce((s, r) => s + lineOf(r), 0)),
  };
}

/** A receipt registered before, as shown in the messages. */
export interface EarlierReceipt {
  id: string;
  invoiceNo: string;
  seller: string;
  /** YYYY-MM-DD */
  receiptDate: string;
  farm: string;
  head: number;
  importedBy: string;
}

export interface DuplicateCheck {
  /** The same number from the same seller, still registered: register is BLOCKED. */
  same: EarlierReceipt | null;
  /** No number, but seller, date, head and total match a receipt still registered: needs "This is a different receipt". */
  similar: EarlierReceipt | null;
}

const earlierText = (e: EarlierReceipt) =>
  `${e.receiptDate}: ${e.head} ${e.head === 1 ? 'animal' : 'cattle'} at ${e.farm}${e.importedBy ? `, by ${e.importedBy}` : ''}`;

/** Why the list cannot be registered as it is (the server's message), or null. */
export function duplicateProblem(check: DuplicateCheck, confirmedDifferent: boolean): string | null {
  if (check.same) {
    return `Receipt ${check.same.invoiceNo} from ${check.same.seller || 'this seller'} was already registered on ${earlierText(check.same)}. A receipt can only be registered once.`;
  }
  if (check.similar && !confirmedDifferent) {
    return `This looks like the receipt from ${check.similar.seller || 'this seller'} registered on ${earlierText(check.similar)}. If it is a different receipt, tick "This is a different receipt" and register again.`;
  }
  return null;
}
