/**
 * The Cattle Inventory, Buy-Back & Financial Control Dashboard (the PDF the
 * user provided, CAmCOW_Cattle_Control_Dashboard_BLANK.pdf): every figure on
 * it, worked out from what the app knows. Browser-safe and pure.
 *
 * Rule from the PDF itself: unknown values are shown as TBC / Not recorded and
 * are never estimated. The app has no bank, ARDB financing or cash book yet, so
 * those figures are `null` here and the page shows "Not recorded". Money is in
 * riel (decided 2026-10-14).
 */
import type { StockItem, SalesRecord } from './xlsx-parser';
import type { BatchItem } from '../types/batch.types';
import { buybackSchedule, type BatchContract, type BuybackRow } from './action-plans';
import { addDays, farmToday } from './daily-feed';
import { shiftMonth } from './billing';
import { buildPlanBlock, planPricesByFarm, type PlanBlock, type ProgramRef, type TaskView } from './ops-view';

export type AlertLevel = 'green' | 'amber' | 'red' | 'grey';

export interface DashAlert {
  key: 'overdue' | 'due7' | 'cash' | 'missing' | 'unsold' | 'bank' | 'integrity' | 'tasks';
  level: AlertLevel;
  /** null = the app does not record this yet. */
  value: number | null;
}

export interface DashFarmer { id: string; name: string; withFarmer: number; boughtBack: number; overdue: number; remaining: number }
export interface DashUpcoming { batch: string; farm: string; dueDate?: string; days?: number; value?: number; estimate: boolean; bucket: BuybackRow['bucket'] }

export interface ControlDashboard {
  reportDate: string;
  periodStart: string;
  periodEnd: string;
  /** The farm everything is narrowed to, or null for all farms. */
  farm: string | null;
  inventory: {
    delivered: number; withFarmers: number; boughtBack: number; soldToBuyers: number | null; overdue: number;
    due7: number; due30: number; due60: number; heldByCamcow: number | null; missing: number;
  };
  buyback: {
    outstandingHead: number; contractValue: number; remaining: number; cash30Buybacks: number; noPriceHead: number;
    paymentsRegister: null; paymentsCash: null; difference: null; cash30All: null; extensionsPending: null;
  };
  alerts: DashAlert[];
  movement: { month: string; delivered: number; boughtBack: number }[];
  maturity: { overdue: number; d7: number; d30: number; d60: number; later: number; noDate: number };
  farmers: DashFarmer[];
  upcoming: DashUpcoming[];
  /** The farm programs' tasks: how the month's work stands against the action plan. null when no farm has a program. */
  plan: PlanBlock | null;
}

export interface DashInput {
  farms: { id?: string; name: string }[];
  batches: BatchItem[];
  stock: StockItem[];
  sales: SalesRecord[];
  contracts: BatchContract[];
  /** YYYY-MM the report is for. */
  month: string;
  today: string;
  farm?: string | null;
  /** What CC Livestock holds after collecting cattle (src/lib/camcow-stock.ts), when its stock is being tracked: filled into the inventory and the unsold alert. */
  camcow?: { held: number; sold: number; heldTooLong: number };
  /** The farm programs and their tasks (with status), when there are any. */
  ops?: { views: TaskView[]; programs: ProgramRef[] };
}

const monthOfDate = (date: string | null | undefined) => (date ? farmToday(new Date(date)).slice(0, 7) : '');
const isActive = (c: { status?: string }) => (c.status ?? '').toLowerCase() === 'active';
const sum = (rows: BuybackRow[], pick: (r: BuybackRow) => number) => rows.reduce((s, r) => s + pick(r), 0);

export function buildControlDashboard(input: DashInput): ControlDashboard {
  const { month, today, contracts } = input;
  const farm = input.farm || null;
  const inFarm = (name?: string) => !farm || name === farm;
  const stock = input.stock.filter(c => inFarm(c.location));
  const farmOf = new Map(input.stock.map(c => [c.id, c.location]));
  const sales = input.sales.filter(s => inFarm(farmOf.get(s.cowId)));
  const batches = input.batches.filter(b => inFarm(b.farmLocation));

  const first = `${month}-01`;
  const lastDay = addDays(`${shiftMonth(month, 1)}-01`, -1);
  const periodEnd = lastDay < today ? lastDay : today;
  const reportDate = periodEnd;

  // Price per kg: the batch's contract, else the price set on the batch, else the farm's plan price.
  const schedule = buybackSchedule(batches, input.stock, contracts, today, planPricesByFarm(input.ops?.programs ?? [])).filter(r => inFarm(r.farm));
  const head = (rows: BuybackRow[]) => sum(rows, r => r.head);
  const within = (maxDays: number) => schedule.filter(r => r.daysLeft !== undefined && r.daysLeft >= 0 && r.daysLeft <= maxDays);
  const overdueRows = schedule.filter(r => r.bucket === 'overdue');
  const priced = schedule.filter(r => r.value !== undefined);

  const active = stock.filter(isActive);
  const missing = active.filter(c => !(Number(c.weight) > 0)).length;
  const duplicateIds = stock.length - new Set(stock.map(c => c.id)).size;
  const dateConflicts = batches.filter(b => b.sellingTargetDate && b.startDate && b.sellingTargetDate.slice(0, 10) < b.startDate.slice(0, 10)).length;
  const integrity = duplicateIds + dateConflicts;
  const due7 = head(within(7));
  const opsPrograms = (input.ops?.programs ?? []).filter(p => inFarm(p.farm));
  const plan = input.ops ? buildPlanBlock(input.ops.views.filter(v => opsPrograms.some(p => p.id === v.task.programId)), opsPrograms, month, today) : null;

  const alerts: DashAlert[] = [
    { key: 'overdue', level: head(overdueRows) > 0 ? 'red' : 'green', value: head(overdueRows) },
    { key: 'due7', level: due7 > 0 ? 'amber' : 'green', value: due7 },
    { key: 'cash', level: 'grey', value: null },
    { key: 'missing', level: missing > 0 ? 'amber' : 'green', value: missing },
    // Cattle CC Livestock holds longer than the alert days without selling them on (grey while its stock is not tracked).
    { key: 'unsold', level: !input.camcow ? 'grey' : input.camcow.heldTooLong > 0 ? 'amber' : 'green', value: input.camcow ? input.camcow.heldTooLong : null },
    { key: 'bank', level: 'grey', value: null },
    { key: 'integrity', level: integrity > 0 ? 'amber' : 'green', value: integrity },
    // Tasks of the action plans that are late (grey when no farm has a program).
    { key: 'tasks', level: !plan ? 'grey' : plan.byStatus.late > 0 ? 'red' : 'green', value: plan ? plan.byStatus.late : null },
  ];

  // Twelve months ending with the month shown.
  const months = Array.from({ length: 12 }, (_, i) => shiftMonth(month, i - 11));
  const movement = months.map(m => ({
    month: m,
    delivered: stock.filter(c => monthOfDate(c.purchaseDate) === m).length,
    boughtBack: sales.filter(s => monthOfDate(s.salesDate) === m).length,
  }));

  const farmers: DashFarmer[] = input.farms
    .filter(f => inFarm(f.name))
    .map(f => {
      const mine = schedule.filter(r => r.farm === f.name);
      return {
        id: f.id ?? '',
        name: f.name,
        withFarmer: stock.filter(c => c.location === f.name && isActive(c)).length,
        boughtBack: sales.filter(s => farmOf.get(s.cowId) === f.name).length,
        overdue: head(mine.filter(r => r.bucket === 'overdue')),
        remaining: sum(mine, r => r.value ?? 0),
      };
    })
    .sort((a, b) => b.withFarmer - a.withFarmer || a.name.localeCompare(b.name))
    .slice(0, 10);

  return {
    reportDate, periodStart: first, periodEnd, farm,
    inventory: {
      delivered: stock.length,
      withFarmers: active.length,
      boughtBack: sales.length,
      soldToBuyers: input.camcow ? input.camcow.sold : null,
      overdue: head(overdueRows),
      due7,
      due30: head(within(30)),
      due60: head(within(60)),
      heldByCamcow: input.camcow ? input.camcow.held : null,
      missing,
    },
    buyback: {
      outstandingHead: head(schedule),
      contractValue: Math.round(sum(priced.filter(r => r.priceSource === 'contract'), r => r.value ?? 0)),
      remaining: Math.round(sum(priced, r => r.value ?? 0)),
      cash30Buybacks: Math.round(sum(priced.filter(r => r.daysLeft !== undefined && r.daysLeft <= 30), r => r.value ?? 0)),
      noPriceHead: head(schedule.filter(r => r.value === undefined)),
      paymentsRegister: null, paymentsCash: null, difference: null, cash30All: null, extensionsPending: null,
    },
    alerts,
    movement,
    maturity: {
      overdue: head(overdueRows),
      d7: head(schedule.filter(r => r.bucket === 'd7')),
      d30: head(schedule.filter(r => r.bucket === 'd30')),
      d60: head(schedule.filter(r => r.bucket === 'd60')),
      later: head(schedule.filter(r => r.bucket === 'later')),
      noDate: head(schedule.filter(r => r.bucket === 'noDate')),
    },
    farmers,
    upcoming: schedule.filter(r => r.bucket !== 'noDate').slice(0, 10).map(r => ({
      batch: r.batchName, farm: r.farm, dueDate: r.dueDate, days: r.daysLeft, value: r.value, estimate: r.priceIsEstimate, bucket: r.bucket,
    })),
    plan,
  };
}
