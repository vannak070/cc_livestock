import { describe, expect, it } from 'vitest';
import { checkReceipt, draftFromExtraction, draftFromSheet, duplicateProblem, invoiceKey, receiptTotals, registerProblem, sexFromPrinted, stockFromReceipt, tagFor, type EarlierReceipt, type ReceiptRow } from './receipt-import';

// The sample receipt: 24 head, 7,251 kg (2,450 kg of males at 12,500 + 4,801 kg of females at 11,500) = 85,836,500 ៛.
const row = (printed: string, sex: 'Male' | 'Female', weightKg: number): ReceiptRow => {
  const pricePerKg = sex === 'Male' ? 12_500 : 11_500;
  return { printed, sex, weightKg, pricePerKg, lineTotal: weightKg * pricePerKg };
};
const sample = (): ReceiptRow[] => [
  ...Array.from({ length: 8 }, (_, i) => row(String(296 + i), 'Male', i < 7 ? 306 : 308)),   // 7×306 + 308 = 2,450
  ...Array.from({ length: 16 }, (_, i) => row(String(310 + i), 'Female', i < 15 ? 300 : 301)), // 15×300 + 301 = 4,801
];
const base = { prefix: 'CC-', existingTags: [] as string[], printedHead: 24, printedKg: 7251, printedTotal: 85_836_500 };

describe('sexFromPrinted', () => {
  it.each([['ឈ្មោល', 'Male'], ['ញី', 'Female'], ['Male', 'Male'], ['female', 'Female'], [' ញី ', 'Female'], ['', ''], ['?', '']])('%s → %s', (printed, sex) => {
    expect(sexFromPrinted(printed)).toBe(sex);
  });
});

describe('draftFromExtraction', () => {
  it('cleans what the AI returned', () => {
    const d = draftFromExtraction({
      invoiceNo: ' 202606-004 ', date: '2026-06-25', seller: 'Vannak ',
      rows: [{ tag: 296, sex: 'ឈ្មោល', weightKg: '306', pricePerKg: 12500, lineTotal: '3,825,000' }],
      printedHead: 24.0, printedKg: 7251, printedTotal: 85836500,
    });
    expect(d).toMatchObject({ invoiceNo: '202606-004', date: '2026-06-25', seller: 'Vannak', printedHead: 24 });
    expect(d.rows[0]).toEqual({ printed: '296', sex: 'Male', weightKg: 306, pricePerKg: 12500, lineTotal: 3_825_000 });
  });
  it('survives garbage and a date it cannot trust', () => {
    expect(draftFromExtraction(null)).toMatchObject({ rows: [], date: '', printedHead: 0 });
    expect(draftFromExtraction({ date: '25 Jun 2026', rows: 'x' })).toMatchObject({ date: '', rows: [] });
  });
});

describe('checkReceipt', () => {
  it('passes the sample receipt: totals match and every row is fine', () => {
    const c = checkReceipt({ ...base, rows: sample() });
    expect(c.blocked).toBe(false);
    expect(c.needsLook).toBe(false);
    expect(c.head).toEqual({ printed: 24, counted: 24, ok: true });
    expect(c.kg).toEqual({ printed: 7251, counted: 7251, ok: true });
    expect(c.amount).toEqual({ printed: 85_836_500, counted: 85_836_500, ok: true });
  });

  it('flags a missed row: head, kg and amount no longer match, but nothing blocks', () => {
    const c = checkReceipt({ ...base, rows: sample().slice(1) });
    expect(c.blocked).toBe(false);
    expect(c.needsLook).toBe(true);
    expect([c.head?.ok, c.kg?.ok, c.amount?.ok]).toEqual([false, false, false]);
  });

  it('blocks a missing sex, weight, price or tag', () => {
    const rows = sample();
    rows[0] = { ...rows[0], sex: '' };
    rows[1] = { ...rows[1], weightKg: 0 };
    rows[2] = { ...rows[2], pricePerKg: 0 };
    rows[3] = { ...rows[3], printed: '' };
    const c = checkReceipt({ ...base, rows });
    expect(c.blocked).toBe(true);
    expect(c.rows[0]).toContain('sex');
    expect(c.rows[1]).toContain('weight');
    expect(c.rows[2]).toContain('price');
    expect(c.rows[3]).toContain('tag');
  });

  it('blocks a tag printed twice and a tag already on the system', () => {
    const rows = sample();
    rows[1] = { ...rows[1], printed: rows[0].printed };
    const c = checkReceipt({ ...base, rows, existingTags: ['cc-320'] });
    expect(c.rows[0]).toContain('tagTwice');
    expect(c.rows[1]).toContain('tagTwice');
    expect(c.rows.flat()).toContain('tagUsed');
    expect(c.blocked).toBe(true);
  });

  it('only warns when a line total is not weight × price', () => {
    const rows = sample();
    rows[0] = { ...rows[0], lineTotal: rows[0].lineTotal + 5000 };
    const c = checkReceipt({ ...base, rows });
    expect(c.rows[0]).toEqual(['lineTotal']);
    expect(c.blocked).toBe(false);
    expect(c.needsLook).toBe(true);
  });

  it('an empty list is blocked, and an unprinted total is not checked', () => {
    expect(checkReceipt({ ...base, rows: [] }).blocked).toBe(true);
    const c = checkReceipt({ ...base, rows: sample(), printedHead: 0, printedKg: 0, printedTotal: 0 });
    expect([c.head, c.kg, c.amount]).toEqual([null, null, null]);
    expect(c.needsLook).toBe(false);
  });
});

describe('stockFromReceipt and registerProblem', () => {
  const input = { farm: 'SNR Farm', date: '2026-06-25', seller: ' Vannak ', invoiceNo: '202606-004', prefix: 'CC-', breed: '', health: 'Good', rows: sample() };

  it('builds bought-by-the-kg purchase records', () => {
    const items = stockFromReceipt(input);
    expect(items).toHaveLength(24);
    expect(items[0]).toMatchObject({ id: 'CC-296', sex: 'Male', weight: 306, unitPrice: 12_500, totalPrice: 3_825_000, buyType: 'Weight', purchaseType: 'Purchase', ownerName: 'Vannak', location: 'SNR Farm', purchaseDate: '2026-06-25', remark: 'Receipt 202606-004', status: 'Active' });
    expect(items.reduce((s, i) => s + i.totalPrice, 0)).toBe(85_836_500);
    expect(items.reduce((s, i) => s + i.weight, 0)).toBe(7251);
  });

  it('builds the tag from the prefix', () => {
    expect(tagFor(' CC- ', ' 296 ')).toBe('CC-296');
  });

  it('accepts a good list and refuses a bad one', () => {
    expect(registerProblem(input, [])).toBeNull();
    expect(registerProblem({ ...input, farm: '' }, [])).toMatch(/farm/i);
    expect(registerProblem({ ...input, date: '' }, [])).toMatch(/date/i);
    expect(registerProblem({ ...input, rows: [] }, [])).toMatch(/no cattle/i);
    expect(registerProblem(input, ['CC-296'])).toMatch(/Row 1/);
  });
});

describe('cattle listed in an Excel or CSV sheet', () => {
  it('reads the header row wherever it is and builds the rows below it', () => {
    const d = draftFromSheet([
      ['Cattle list'], [],
      ['No.', 'Cow ID', 'Sex', 'Weight (kg)', 'Price per kg', 'Total'],
      [1, '101', 'Male', 410.5, 13000, 5336500],
      [2, '102', 'ញី', '395', '13,000', ''],
      [],
      ['Total', '', '', 805.5, '', 10_471_500],
    ]);
    expect(d.rows).toEqual([
      { printed: '101', sex: 'Male', weightKg: 410.5, pricePerKg: 13000, lineTotal: 5336500 },
      { printed: '102', sex: 'Female', weightKg: 395, pricePerKg: 13000, lineTotal: 5135000 },
    ]);
    expect(d).toMatchObject({ invoiceNo: '', printedHead: 0, printedKg: 805.5, printedTotal: 10_471_500 });
  });
  it('needs only a tag and a weight column', () => {
    const d = draftFromSheet([['Tag', 'Weight'], ['A1', 400], ['', ''], ['A2', 380]]);
    expect(d.rows.map(r => [r.printed, r.weightKg, r.sex, r.pricePerKg])).toEqual([['A1', 400, '', 0], ['A2', 380, '', 0]]);
  });
  it('reads Khmer headers', () => {
    const d = draftFromSheet([['ស្លាក', 'ភេទ', 'ទម្ងន់', 'តម្លៃ'], ['7', 'ឈ្មោល', 300, 14000]]);
    expect(d.rows[0]).toMatchObject({ printed: '7', sex: 'Male', weightKg: 300, pricePerKg: 14000, lineTotal: 4_200_000 });
  });
  it('does not take the Khmer "price per kilo" column for the weight', () => {
    const d = draftFromSheet([['ល.រ', 'ស្លាក', 'ទម្ងន់ (គីឡូ)', 'តម្លៃក្នុង១គីឡូ', 'ទឹកប្រាក់សរុប'], [1, '501', 330, 11500, 3795000]]);
    expect(d.rows[0]).toMatchObject({ printed: '501', weightKg: 330, pricePerKg: 11500, lineTotal: 3795000 });
  });
  it('reads numbers typed with a unit or in Khmer digits', () => {
    const d = draftFromSheet([['Tag', 'Weight', 'Price'], ['C1', '350 kg', '11,000 ៛'], ['C2', '៣៥០', '៛10500']]);
    expect(d.rows.map(r => [r.weightKg, r.pricePerKg])).toEqual([[350, 11000], [350, 10500]]);
  });
  it('explains what is missing', () => {
    expect(() => draftFromSheet([['Name', 'Colour'], ['x', 'y']])).toThrow(/tag column and a weight/);
    expect(() => draftFromSheet([['Tag', 'Weight']])).toThrow(/No cattle/);
  });
});

describe('breed per animal', () => {
  const rows = [{ printed: '1', sex: 'Male' as const, weightKg: 300, pricePerKg: 12500, lineTotal: 3_750_000, breed: 'Brahman' }, { printed: '2', sex: 'Male' as const, weightKg: 300, pricePerKg: 12500, lineTotal: 3_750_000 }];
  it('uses the animal\'s own breed and falls back to the list\'s breed', () => {
    const out = stockFromReceipt({ farm: 'A', date: '2026-06-25', seller: '', invoiceNo: '', prefix: 'CC-', breed: 'Local', health: 'Good', rows });
    expect(out.map(c => c.breed)).toEqual(['Brahman', 'Local']);
  });
  it('reads a breed column from a sheet', () => {
    expect(draftFromSheet([['Tag', 'Weight', 'Breed'], ['1', 300, 'Brahman'], ['2', 310, '']]).rows.map(r => r.breed)).toEqual(['Brahman', undefined]);
  });
});

describe('the same receipt twice', () => {
  const earlier: EarlierReceipt = { id: 'R1', invoiceNo: 'INV-42', seller: 'Sok', receiptDate: '2026-10-15', farm: 'SNR Farm', head: 20, importedBy: 'Dara' };

  it('treats the same number from the same seller as the same receipt, ignoring case and spaces', () => {
    expect(invoiceKey(' inv-42 ', 'Sok  Dara')).toBe(invoiceKey('INV-42', 'sok dara'));
    expect(invoiceKey('INV-42', 'Sok')).not.toBe(invoiceKey('INV-42', 'Vanna'));
    expect(invoiceKey('', 'Sok')).toBe('');
  });

  it('adds up head, kg and amount as saved on the record', () => {
    const rows: ReceiptRow[] = [
      { printed: '1', sex: 'Male', weightKg: 300.25, pricePerKg: 10000, lineTotal: 0 },
      { printed: '2', sex: 'Female', weightKg: 250, pricePerKg: 11000, lineTotal: 0 },
    ];
    expect(receiptTotals(rows)).toEqual({ head: 2, kg: 550.3, amount: 5_752_500 });
  });

  it('blocks a known number, even when asked to go ahead', () => {
    expect(duplicateProblem({ same: earlier, similar: null }, true)).toMatch(/Receipt INV-42 from Sok was already registered on 2026-10-15: 20 cattle at SNR Farm, by Dara/);
  });

  it('asks before registering a receipt without a number that matches an earlier one', () => {
    const similar = { ...earlier, invoiceNo: '' };
    expect(duplicateProblem({ same: null, similar }, false)).toMatch(/This is a different receipt/);
    expect(duplicateProblem({ same: null, similar }, true)).toBeNull();
    expect(duplicateProblem({ same: null, similar: null }, false)).toBeNull();
  });
});

