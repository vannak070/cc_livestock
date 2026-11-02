import { AuthzError, type Actor } from '../lib/authz';
import { canSetLimits } from '../lib/farm-limit';
import {
  duplicateProblem, invoiceKey, receiptTotals, registerProblem, stockFromReceipt,
  type DuplicateCheck, type EarlierReceipt, type ReceiptDraft, type ReceiptFile, type RegisterInput,
} from '../lib/receipt-import';
import type { StockItem } from '../lib/xlsx-parser';
import { receiptImportRepository } from '../repositories/receipt-import.repository';
import { extractReceipt } from './receipt-extract.service';
import { stockService } from './stock.service';

/** Reading receipts costs money and every registration is billed, so only a Super Admin or Admin does it. */
export const assertCanImportReceipts = (actor: Actor): void => {
  if (!canSetLimits(actor)) throw new AuthzError('Only a Super Admin or Admin can register cattle from a receipt.', 403);
};

/** The same 6 MB limit as the upload. */
export const RECEIPT_FILE_MAX_BYTES = 6 * 1024 * 1024;
const FILE_TYPES = /^(application\/pdf|image\/(jpeg|png|webp|heic|heif)|text\/csv|application\/vnd\.(ms-excel|openxmlformats-officedocument\.spreadsheetml\.sheet))$/;

function decodeFile(file: ReceiptFile | null | undefined): { name: string; type: string; data: Buffer } | null {
  if (!file || !file.base64) return null;
  const type = file.type || 'application/octet-stream';
  if (!FILE_TYPES.test(type)) throw new Error('The receipt file must be a PDF, a photo, or an Excel or CSV file.');
  const data = Buffer.from(file.base64, 'base64');
  if (data.length === 0) return null;
  if (data.length > RECEIPT_FILE_MAX_BYTES) throw new Error('The receipt file is larger than 6 MB.');
  return { name: (file.name || 'receipt').slice(0, 255), type, data };
}

/** Receipts without a number are locked per seller and date, so two similar ones cannot slip through at the same time. */
const lockKey = (input: RegisterInput, key: string) => key || `no-number|${input.seller.trim().toLowerCase()}|${input.date}`;

export class ReceiptImportService {
  async read(actor: Actor, file: { mediaType: string; base64: string }): Promise<ReceiptDraft> {
    assertCanImportReceipts(actor);
    return extractReceipt(file);
  }

  /** For the check page: was this receipt registered before? (The server checks again when registering.) */
  async check(actor: Actor, input: Pick<RegisterInput, 'invoiceNo' | 'seller' | 'date' | 'rows'>): Promise<DuplicateCheck> {
    assertCanImportReceipts(actor);
    return this.find(input);
  }

  private async find(input: Pick<RegisterInput, 'invoiceNo' | 'seller' | 'date' | 'rows'>, client?: Parameters<typeof receiptImportRepository.findSame>[1]): Promise<DuplicateCheck> {
    const key = invoiceKey(input.invoiceNo, input.seller);
    const same = await receiptImportRepository.findSame(key, client);
    if (key || !/^\d{4}-\d{2}-\d{2}$/.test(input.date) || input.rows.length === 0) return { same, similar: null };
    const t = receiptTotals(input.rows);
    return { same, similar: await receiptImportRepository.findSimilar(input.seller, input.date, t.head, t.amount, client) };
  }

  /**
   * Registers every animal on the checked list, or none if anything is wrong; in the same transaction refuses a
   * receipt registered before (see duplicateProblem) and saves the receipt record with its original file.
   */
  async register(actor: Actor, input: RegisterInput, options: { file?: ReceiptFile | null; confirmedDifferent?: boolean } = {}): Promise<StockItem[]> {
    assertCanImportReceipts(actor);
    const problem = registerProblem(input, []);
    if (problem) throw new Error(problem);
    const file = decodeFile(options.file);
    const key = invoiceKey(input.invoiceNo, input.seller);
    const totals = receiptTotals(input.rows);
    return stockService.createMany(stockFromReceipt(input), actor.name, {
      before: async client => {
        await receiptImportRepository.lock(lockKey(input, key), client);
        const found = duplicateProblem(await this.find(input, client), options.confirmedDifferent === true);
        if (found) throw new Error(found);
      },
      after: async (client, created) => {
        await receiptImportRepository.insert({
          invoiceNo: input.invoiceNo.trim(), invoiceKey: key, seller: input.seller.trim(), receiptDate: input.date, farm: input.farm,
          head: totals.head, totalKg: totals.kg, totalAmount: totals.amount, cowIds: created.map(c => c.id), file, importedBy: actor.name,
        }, client);
      },
    });
  }

  /** The receipt an animal came from, for its page (admins only). */
  async receiptOfCow(actor: Actor, cowId: string): Promise<(EarlierReceipt & { hasFile: boolean }) | null> {
    assertCanImportReceipts(actor);
    return receiptImportRepository.findByCow(cowId);
  }

  /** The kept original file (admins only). */
  async file(actor: Actor, id: string): Promise<ReceiptFile> {
    assertCanImportReceipts(actor);
    const f = await receiptImportRepository.getFile(id);
    if (!f) throw new Error('No file was kept for this receipt.');
    return { name: f.name, type: f.type, base64: f.data.toString('base64') };
  }
}

export const receiptImportService = new ReceiptImportService();
