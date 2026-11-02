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
  /** The animal has a photo. The picture itself is not in the cattle list; it is fetched when a cattle page opens. */
  hasPhoto?: boolean;
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
