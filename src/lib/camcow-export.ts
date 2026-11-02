import { loadXlsx } from './load-xlsx';
import { shareCosts, type StockCost } from './camcow-costs';
import { buyerAccounts, type Buyer } from './camcow-buyers';
import { cowTrail } from './camcow-trail';
import type { Holding } from './camcow-stock';

type Cell = string | number;
export interface CamcowSheet { name: string; rows: Cell[][]; widths: number[] }

/** The sheets of the CamCow stock workbook (English headers, like the other Excel files). Pure, so it can be tested. */
export function camcowSheets(holdings: Holding[], buyers: Buyer[], costs: StockCost[], today: string, batchName: (id?: string) => string = id => id ?? ''): CamcowSheet[] {
  const costOf = shareCosts(holdings, costs).perCow;
  const trails = holdings.map(h => cowTrail(h, today, costOf.get(h.cowId) ?? 0)).sort((a, b) => a.collectedOn.localeCompare(b.collectedOn) || a.cowId.localeCompare(b.cowId));
  const held = trails.filter(t => t.status === 'Held');
  const sold = trails.filter(t => t.status === 'Sold');
  const lost = trails.filter(t => t.status === 'Lost');
  const accounts = buyerAccounts(holdings, buyers);
  return [
    {
      name: 'In stock',
      widths: [18, 22, 22, 14, 14, 16, 12, 18],
      rows: [
        ['Animal', 'From farm', 'Batch', 'Collected', 'Weight (kg)', 'Collection price (៛)', 'Days in stock', 'Holding costs so far (៛)'],
        ...held.map(t => [t.cowId, t.farm, batchName(t.batchId), t.collectedOn, t.collectionWeight, t.collectionTotal, t.daysHeld, t.holdingCost]),
      ],
    },
    {
      name: 'Sold',
      widths: [18, 22, 14, 14, 26, 14, 14, 16, 16, 12, 18, 18, 14],
      rows: [
        ['Animal', 'From farm', 'Collected', 'Sold on', 'Buyer', 'Collection weight (kg)', 'Sale weight (kg)', 'Collection price (៛)', 'Price per kg (៛)', 'Days in stock', 'Sale total (៛)', 'Holding costs (៛)', 'Margin after costs (៛)'],
        ...sold.map(t => [t.cowId, t.farm, t.collectedOn, t.soldOn ?? '', t.buyer ?? '', t.collectionWeight, t.saleWeight ?? 0, t.collectionTotal, t.salePerKg ?? 0, t.daysHeld, t.saleTotal ?? 0, t.holdingCost, t.marginAfterCosts ?? 0]),
      ],
    },
    {
      name: 'Lost',
      widths: [18, 22, 14, 14, 18, 18, 30],
      rows: [
        ['Animal', 'From farm', 'Collected', 'Lost on', 'Collection price (៛)', 'Holding costs (៛)', 'Note'],
        ...lost.map(t => [t.cowId, t.farm, t.collectedOn, t.lostOn ?? '', t.collectionTotal, t.holdingCost, t.note]),
      ],
    },
    {
      name: 'Buyers',
      widths: [28, 16, 16, 24, 10, 14, 18, 18, 14],
      rows: [
        ['Buyer', 'Kind', 'Phone', 'Place', 'Active', 'Cattle', 'Sold (៛)', 'Margin before costs (៛)', 'Last sale'],
        ...accounts.map(a => [a.buyer.name, a.buyer.kind, a.buyer.phone, a.buyer.location, a.buyer.active ? 'Yes' : 'No', a.head, a.sold, a.margin, a.lastSaleOn ?? '']),
      ],
    },
    {
      name: 'Costs',
      widths: [14, 14, 18, 40],
      rows: [
        ['Day', 'For', 'Amount (៛)', 'Note'],
        ...[...costs].sort((a, b) => a.date.localeCompare(b.date)).map(c => [c.date, c.kind, c.amount, c.note]),
      ],
    },
  ];
}

/** Downloads the CamCow stock workbook. */
export async function exportCamcowStock(holdings: Holding[], buyers: Buyer[], costs: StockCost[], today: string, batchName?: (id?: string) => string) {
  const xlsx = await loadXlsx();
  const book = xlsx.utils.book_new();
  for (const s of camcowSheets(holdings, buyers, costs, today, batchName)) {
    const sheet = xlsx.utils.aoa_to_sheet(s.rows);
    sheet['!cols'] = s.widths.map(wch => ({ wch }));
    xlsx.utils.book_append_sheet(book, sheet, s.name);
  }
  xlsx.writeFile(book, `CamCow_Stock_${today}.xlsx`);
}
