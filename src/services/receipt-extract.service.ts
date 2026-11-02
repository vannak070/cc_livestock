import { RECEIPT_PROMPT, RECEIPT_SCHEMA, draftFromExtraction, type ReceiptDraft } from '../lib/receipt-import';

export const RECEIPT_MEDIA_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] as const;
type ReceiptMedia = (typeof RECEIPT_MEDIA_TYPES)[number];
/** The largest file read, in bytes before base64 (the page shrinks photos first, so this mostly limits PDFs). */
export const RECEIPT_MAX_BYTES = 6 * 1024 * 1024;

const MODEL = 'claude-opus-5-5';
const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';
const TIMEOUT_MS = 120_000;

const isMedia = (t: string): t is ReceiptMedia => (RECEIPT_MEDIA_TYPES as readonly string[]).includes(t);

/**
 * Sends one receipt (PDF or photo) to Claude and returns the rows it read. This
 * is the only place the app talks to the AI service; the key stays on the
 * server (ANTHROPIC_API_KEY) and is never sent to the browser or logged.
 */
export async function extractReceipt(file: { mediaType: string; base64: string }): Promise<ReceiptDraft> {
  if (!isMedia(file.mediaType)) throw new Error('Choose a PDF or a photo (JPG, PNG or WebP) of the receipt.');
  if (file.base64.length * 0.75 > RECEIPT_MAX_BYTES) throw new Error('That file is too big. Use a file under 6 MB, or a clearer photo of one page.');
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('Reading receipts is not switched on yet. An administrator must add ANTHROPIC_API_KEY to the server settings.');

  const source = { type: 'base64' as const, data: file.base64 };
  const block = file.mediaType === 'application/pdf'
    ? { type: 'document', source: { ...source, media_type: 'application/pdf' } }
    : { type: 'image', source: { ...source, media_type: file.mediaType } };

  // A plain HTTPS call to the Messages API: no SDK package to install, and the key only ever leaves this server.
  let res: Response;
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': API_VERSION },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 16000,
        output_config: { effort: 'medium', format: { type: 'json_schema', schema: RECEIPT_SCHEMA } },
        messages: [{ role: 'user', content: [block, { type: 'text', text: RECEIPT_PROMPT }] }],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new Error('Could not reach the receipt reader. Check the internet connection and try again.');
  }
  if (res.status === 401 || res.status === 403) throw new Error('The receipt reader key is not accepted. Ask an administrator to check ANTHROPIC_API_KEY.');
  if (res.status === 429 || res.status === 529) throw new Error('The receipt reader is busy. Please try again in a minute.');
  if (!res.ok) throw new Error('The receipt reader could not read that file. Please try again, or use a clearer photo.');

  const response = (await res.json().catch(() => null)) as { stop_reason?: string; content?: { type: string; text?: string }[] } | null;
  if (!response) throw new Error('The receipt reader gave an answer that could not be used. Please try again.');
  if (response.stop_reason === 'refusal') throw new Error('The receipt reader declined this file. Try a clearer photo of the receipt.');
  if (response.stop_reason === 'max_tokens') throw new Error('The receipt is too long to read in one go. Try a photo of part of it.');
  const text = response.content?.find(b => b.type === 'text')?.text ?? '';
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new Error('The receipt reader gave an answer that could not be used. Please try again.'); }
  const draft = draftFromExtraction(parsed);
  if (draft.rows.length === 0) throw new Error('No cattle were found on that file. Is it the receipt with the list of animals?');
  return draft;
}
