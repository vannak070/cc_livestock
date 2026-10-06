/**
 * A request from a farm for a higher cattle limit, and the record of every
 * change to a farm's limit (see src/lib/farm-limit.ts).
 */
export interface FarmLimitRequest {
  id: string;
  farmLocation: string;
  /** How many more cattle the farm asks for. */
  extra: number;
  reason: string;
  status: 'pending' | 'approved' | 'declined';
  requestedBy: string;
  createdAt: string;
  decidedBy?: string;
  decidedAt?: string;
  decisionNote?: string;
  /** The limit set when the request was approved. */
  newLimit?: number;
}

export interface FarmLimitChange {
  id: string;
  farmLocation: string;
  oldLimit: number;
  newLimit: number;
  changedBy: string;
  changedAt: string;
  reason: string;
  /** The request this change answered, when there was one. */
  requestId?: string;
}
