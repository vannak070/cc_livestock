import * as xlsx from 'xlsx';

export interface StockItem {
  id: string; // Cow_ID
  no: string;
  breed: string;
  sex: string;
  age: string;
  weight: number;
  ownerName: string;
  location: string;
  phone: string;
  buyType: string;
  unitPrice: number;
  totalPrice: number;
  healthStatus: string;
  status: string;
  purchaseDate: string | null;
  remark: string;
  purchaseType?: string;
  paymentMethod?: string;
  imageUrl?: string;
}

export interface WeightRecord {
  cowId: string;
  breed: string;
  age: string;
  oldWeight: number;
  currentWeight: number;
  gainLoss: number;
  healthStatus: string;
  status: string;
  trackingDate: string | null;
}

export interface SalesRecord {
  cowId: string;
  breed: string;
  age: string;
  weight: number;
  unitPrice: number;
  totalPrice: number;
  status: string;
  salesDate: string | null;
  saleType?: string;
  buyer?: string;
}

export interface CommonData {
  breeds: string[];
  healthStatuses: string[];
  statuses: string[];
  buyTypes: string[];
  sexes: string[];
}

export interface LivestockData {
  stock: StockItem[];
  weightTracking: WeightRecord[];
  salesTracking: SalesRecord[];
  common: CommonData;
}

// Convert Excel serial date to ISO string
type Cell = string | number | boolean | Date | null | undefined;

function parseExcelDate(val: Cell): string | null {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString();
  if (typeof val === 'number') {
    const date = new Date((val - 25569) * 86400 * 1000);
    return date.toISOString();
  }
  if (typeof val === 'string') {
    const parsed = Date.parse(val);
    if (!isNaN(parsed)) {
      return new Date(parsed).toISOString();
    }
  }
  return String(val);
}

export function parseExcelDatabase(filePath: string): LivestockData {
  const workbook = xlsx.readFile(filePath);

  // 1. Parse Stock
  const stockSheet = workbook.Sheets['Stock'];
  const stockRows = xlsx.utils.sheet_to_json<Cell[]>(stockSheet, { header: 1 });
  const stock: StockItem[] = [];
  let stockHeaderIdx = -1;

  for (let i = 0; i < stockRows.length; i++) {
    const row = stockRows[i];
    if (row && row.includes('Cow_ID')) {
      stockHeaderIdx = i;
      break;
    }
  }

  if (stockHeaderIdx !== -1) {
    const headers = stockRows[stockHeaderIdx];
    const cowIdIdx = headers.indexOf('Cow_ID');
    const noIdx = headers.indexOf('No.');
    const breedIdx = headers.indexOf('Breed');
    const sexIdx = headers.indexOf('Sex');
    const ageIdx = headers.indexOf('Age');
    const weightIdx = headers.indexOf('Weight (kg)');
    const ownerIdx = headers.indexOf('Owner Name');
    const locationIdx = headers.indexOf('Location');
    const phoneIdx = headers.indexOf('Phone Number');
    const buyTypeIdx = headers.indexOf('Buy Type');
    const unitPriceIdx = headers.indexOf('Unit Price');
    const totalPriceIdx = headers.indexOf('Total Price');
    const healthIdx = headers.indexOf('Health Status');
    const statusIdx = headers.indexOf('Status');
    const purchaseDateIdx = headers.indexOf('Purchase Date');
    const remarkIdx = headers.indexOf('REMARK');

    for (let i = stockHeaderIdx + 1; i < stockRows.length; i++) {
      const r = stockRows[i];
      if (!r || !r[cowIdIdx]) continue;
      stock.push({
        id: String(r[cowIdIdx]).trim(),
        no: r[noIdx] ? String(r[noIdx]).trim() : '',
        breed: r[breedIdx] ? String(r[breedIdx]).trim() : '',
        sex: r[sexIdx] ? String(r[sexIdx]).trim() : '',
        age: r[ageIdx] ? String(r[ageIdx]).trim() : '',
        weight: typeof r[weightIdx] === 'number' ? r[weightIdx] : parseFloat(String(r[weightIdx] || 0)),
        ownerName: r[ownerIdx] ? String(r[ownerIdx]).trim() : '',
        location: r[locationIdx] ? String(r[locationIdx]).trim() : '',
        phone: r[phoneIdx] ? String(r[phoneIdx]).trim() : '',
        buyType: r[buyTypeIdx] ? String(r[buyTypeIdx]).trim() : '',
        unitPrice: typeof r[unitPriceIdx] === 'number' ? r[unitPriceIdx] : parseFloat(String(r[unitPriceIdx] || 0)),
        totalPrice: typeof r[totalPriceIdx] === 'number' ? r[totalPriceIdx] : parseFloat(String(r[totalPriceIdx] || 0)),
        healthStatus: r[healthIdx] ? String(r[healthIdx]).trim() : '',
        status: r[statusIdx] ? String(r[statusIdx]).trim() : '',
        purchaseDate: parseExcelDate(r[purchaseDateIdx]),
        remark: r[remarkIdx] ? String(r[remarkIdx]).trim() : '',
      });
    }
  }

  // 2. Parse Weight Tracking
  const weightSheet = workbook.Sheets['Weight Tracking'];
  const weightRows = xlsx.utils.sheet_to_json<Cell[]>(weightSheet, { header: 1 });
  const weightTracking: WeightRecord[] = [];
  let weightHeaderIdx = -1;

  for (let i = 0; i < weightRows.length; i++) {
    const row = weightRows[i];
    if (row && row.includes('Cow_ID')) {
      weightHeaderIdx = i;
      break;
    }
  }

  if (weightHeaderIdx !== -1) {
    const headers = weightRows[weightHeaderIdx];
    const cowIdIdx = headers.indexOf('Cow_ID');
    const breedIdx = headers.indexOf('Breed');
    const ageIdx = headers.indexOf('Age');
    const oldWeightIdx = headers.indexOf('Old Weight (kg)');
    const currentWeightIdx = headers.indexOf('Current Weight (kg)');
    const healthIdx = headers.indexOf('Health Status');
    const statusIdx = headers.indexOf('Status');
    const trackingDateIdx = headers.indexOf('Tracking Date');

    for (let i = weightHeaderIdx + 1; i < weightRows.length; i++) {
      const r = weightRows[i];
      if (!r || !r[cowIdIdx]) continue;
      const oldW = typeof r[oldWeightIdx] === 'number' ? r[oldWeightIdx] : parseFloat(String(r[oldWeightIdx] || 0));
      const currW = typeof r[currentWeightIdx] === 'number' ? r[currentWeightIdx] : parseFloat(String(r[currentWeightIdx] || 0));
      const gainLoss = oldW > 0 ? (currW - oldW) / oldW : 0;

      weightTracking.push({
        cowId: String(r[cowIdIdx]).trim(),
        breed: r[breedIdx] ? String(r[breedIdx]).trim() : '',
        age: r[ageIdx] ? String(r[ageIdx]).trim() : '',
        oldWeight: oldW,
        currentWeight: currW,
        gainLoss: gainLoss,
        healthStatus: r[healthIdx] ? String(r[healthIdx]).trim() : '',
        status: r[statusIdx] ? String(r[statusIdx]).trim() : '',
        trackingDate: parseExcelDate(r[trackingDateIdx]),
      });
    }
  }

  // 3. Parse Sales Tracking
  const salesSheet = workbook.Sheets['Sales Tracking'];
  const salesRows = xlsx.utils.sheet_to_json<Cell[]>(salesSheet, { header: 1 });
  const salesTracking: SalesRecord[] = [];
  let salesHeaderIdx = -1;

  for (let i = 0; i < salesRows.length; i++) {
    const row = salesRows[i];
    if (row && row.includes('Cow_ID')) {
      salesHeaderIdx = i;
      break;
    }
  }

  if (salesHeaderIdx !== -1) {
    const headers = salesRows[salesHeaderIdx];
    const cowIdIdx = headers.indexOf('Cow_ID');
    const breedIdx = headers.indexOf('Breed');
    const ageIdx = headers.indexOf('Age');
    const weightIdx = headers.indexOf('Weight (kg)');
    const unitPriceIdx = headers.indexOf('Unit Price');
    const totalPriceIdx = headers.indexOf('Total Price');
    const statusIdx = headers.indexOf('Status');
    const salesDateIdx = headers.indexOf('Sales Date');

    for (let i = salesHeaderIdx + 1; i < salesRows.length; i++) {
      const r = salesRows[i];
      if (!r || !r[cowIdIdx]) continue;
      salesTracking.push({
        cowId: String(r[cowIdIdx]).trim(),
        breed: r[breedIdx] ? String(r[breedIdx]).trim() : '',
        age: r[ageIdx] ? String(r[ageIdx]).trim() : '',
        weight: typeof r[weightIdx] === 'number' ? r[weightIdx] : parseFloat(String(r[weightIdx] || 0)),
        unitPrice: typeof r[unitPriceIdx] === 'number' ? r[unitPriceIdx] : parseFloat(String(r[unitPriceIdx] || 0)),
        totalPrice: typeof r[totalPriceIdx] === 'number' ? r[totalPriceIdx] : parseFloat(String(r[totalPriceIdx] || 0)),
        status: r[statusIdx] ? String(r[statusIdx]).trim() : '',
        salesDate: parseExcelDate(r[salesDateIdx]),
      });
    }
  }

  // 4. Parse Common (Breed, Health Status, Status, Buy Type, Sex)
  const commonSheet = workbook.Sheets['Common'];
  const commonRows = xlsx.utils.sheet_to_json<Cell[]>(commonSheet, { header: 1 });
  const common: CommonData = {
    breeds: [],
    healthStatuses: [],
    statuses: [],
    buyTypes: [],
    sexes: []
  };

  let commonHeaderIdx = -1;
  for (let i = 0; i < commonRows.length; i++) {
    const row = commonRows[i];
    if (row && row.includes('Breed')) {
      commonHeaderIdx = i;
      break;
    }
  }

  if (commonHeaderIdx !== -1) {
    const headers = commonRows[commonHeaderIdx];
    const breedIdx = headers.indexOf('Breed');
    const healthIdx = headers.indexOf('Health Status');
    const statusIdx = headers.indexOf('Status');
    const buyIdx = headers.indexOf('Buy Type');
    const sexIdx = headers.indexOf('Sex');

    for (let i = commonHeaderIdx + 1; i < commonRows.length; i++) {
      const r = commonRows[i];
      if (!r) continue;
      if (r[breedIdx]) common.breeds.push(String(r[breedIdx]).trim());
      if (r[healthIdx]) common.healthStatuses.push(String(r[healthIdx]).trim());
      if (r[statusIdx]) common.statuses.push(String(r[statusIdx]).trim());
      if (r[buyIdx]) common.buyTypes.push(String(r[buyIdx]).trim());
      if (r[sexIdx]) common.sexes.push(String(r[sexIdx]).trim());
    }
  }

  // Deduplicate and filter empty
  common.breeds = [...new Set(common.breeds)].filter(Boolean);
  common.healthStatuses = [...new Set(common.healthStatuses)].filter(Boolean);
  common.statuses = [...new Set(common.statuses)].filter(Boolean);
  common.buyTypes = [...new Set(common.buyTypes)].filter(Boolean);
  common.sexes = [...new Set(common.sexes)].filter(Boolean);

  return { stock, weightTracking, salesTracking, common };
}
