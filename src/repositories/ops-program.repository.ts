import { PoolClient, QueryResultRow } from 'pg';
import { query } from '../config/database';
import type { ManualState, Task, TaskKind, TaskSeed } from '../lib/ops-program';
import { localDay } from '../lib/local-day';
import type { ProposalPlanParams } from '../types/proposal.types';

const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : '');
// DATE columns come back as local-midnight Dates: read them with localDay, not toISOString.
const day = (v: unknown) => localDay(v as Date | string | null | undefined);
const num = (v: unknown) => (v === null || v === undefined ? undefined : Number(v));

export type ProgramStatus = 'Active' | 'Paused' | 'Closed';

export interface FarmProgram {
  id: string;
  farm: string;
  planSlot: number;
  planName: string;
  /** The plan's numbers as of the last refresh. */
  plan: ProposalPlanParams;
  startDate: string;
  headPerCycle: number;
  purchasePricePerKg?: number;
  buybackPricePerKg?: number;
  status: ProgramStatus;
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
}

export interface TaskEvent { id: number; taskId: string; at: string; by: string; action: string; note: string }

export type NewProgram = Omit<FarmProgram, 'createdAt' | 'updatedAt' | 'updatedBy'>;

/** Farm programs, their tasks and the history of each task (migration 027). */
export class OpsProgramRepository {
  private run(sql: string, params: unknown[], client?: PoolClient) {
    return client ? client.query(sql, params) : query(sql, params);
  }

  private mapProgram(r: QueryResultRow): FarmProgram {
    return {
      id: r.id,
      farm: r.farm_location,
      planSlot: Number(r.plan_slot),
      planName: r.plan_name || '',
      plan: r.plan_params as ProposalPlanParams,
      startDate: day(r.start_date)!,
      headPerCycle: Number(r.head_per_cycle),
      ...(r.purchase_price_per_kg !== null ? { purchasePricePerKg: Number(r.purchase_price_per_kg) } : {}),
      ...(r.buyback_price_per_kg !== null ? { buybackPricePerKg: Number(r.buyback_price_per_kg) } : {}),
      status: r.status,
      createdBy: r.created_by || '',
      createdAt: iso(r.created_at),
      updatedBy: r.updated_by || '',
      updatedAt: iso(r.updated_at),
    };
  }

  private mapTask(r: QueryResultRow): Task {
    return {
      id: r.id,
      programId: r.program_id,
      kind: r.kind as TaskKind,
      cycleKey: r.cycle_key,
      product: r.product || '',
      ...(r.batch_id ? { batchId: r.batch_id } : {}),
      dueDate: day(r.due_date)!,
      originalDueDate: day(r.original_due_date)!,
      ...(num(r.planned_head) !== undefined ? { plannedHead: num(r.planned_head) } : {}),
      ...(num(r.planned_kg) !== undefined ? { plannedKg: num(r.planned_kg) } : {}),
      ...(num(r.price_per_kg) !== undefined ? { pricePerKg: num(r.price_per_kg) } : {}),
      ...(num(r.planned_value) !== undefined ? { plannedValue: num(r.planned_value) } : {}),
      ...(r.manual_state ? { manualState: r.manual_state as ManualState } : {}),
      reason: r.reason || '',
      owner: r.owner || '',
      notes: r.notes || '',
      ...(r.done_on ? { doneOn: day(r.done_on) } : {}),
      ...(r.done_by ? { doneBy: r.done_by } : {}),
      updatedBy: r.updated_by || '',
      updatedAt: iso(r.updated_at),
    };
  }

  /** Serialises changes to one farm's program (and its tasks). */
  async lockFarm(farm: string, client: PoolClient): Promise<void> {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`farm_programs:${farm.toLowerCase()}`]);
  }

  async programs(): Promise<FarmProgram[]> {
    const res = await query("SELECT * FROM farm_programs ORDER BY (status = 'Closed'), lower(farm_location), created_at");
    return res.rows.map(r => this.mapProgram(r));
  }

  async findProgram(id: string, client?: PoolClient, forUpdate = false): Promise<FarmProgram | null> {
    const res = await this.run(`SELECT * FROM farm_programs WHERE id = $1${forUpdate ? ' FOR UPDATE' : ''}`, [id], client);
    return res.rows[0] ? this.mapProgram(res.rows[0]) : null;
  }

  /** The farm's open (not closed) program. */
  async openProgramOf(farm: string, client?: PoolClient): Promise<FarmProgram | null> {
    const res = await this.run("SELECT * FROM farm_programs WHERE lower(farm_location) = lower($1) AND status <> 'Closed'", [farm], client);
    return res.rows[0] ? this.mapProgram(res.rows[0]) : null;
  }

  async insertProgram(p: NewProgram, client: PoolClient): Promise<void> {
    await client.query(
      `INSERT INTO farm_programs (id, farm_location, plan_slot, plan_name, plan_params, start_date, head_per_cycle, purchase_price_per_kg, buyback_price_per_kg, status, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)`,
      [p.id, p.farm, p.planSlot, p.planName, JSON.stringify(p.plan), p.startDate, p.headPerCycle, p.purchasePricePerKg ?? null, p.buybackPricePerKg ?? null, p.status, p.createdBy]
    );
  }

  async updateProgram(id: string, p: Pick<FarmProgram, 'planSlot' | 'planName' | 'plan' | 'startDate' | 'headPerCycle' | 'purchasePricePerKg' | 'buybackPricePerKg'>, by: string, client: PoolClient): Promise<void> {
    await client.query(
      `UPDATE farm_programs SET plan_slot = $2, plan_name = $3, plan_params = $4, start_date = $5, head_per_cycle = $6,
         purchase_price_per_kg = $7, buyback_price_per_kg = $8, updated_by = $9, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [id, p.planSlot, p.planName, JSON.stringify(p.plan), p.startDate, p.headPerCycle, p.purchasePricePerKg ?? null, p.buybackPricePerKg ?? null, by]
    );
  }

  async setProgramStatus(id: string, status: ProgramStatus, by: string, client: PoolClient): Promise<void> {
    await client.query('UPDATE farm_programs SET status = $2, updated_by = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [id, status, by]);
  }

  async tasks(programId?: string, client?: PoolClient): Promise<Task[]> {
    const res = programId
      ? await this.run('SELECT * FROM ops_tasks WHERE program_id = $1 ORDER BY due_date, kind, cycle_key', [programId], client)
      : await this.run('SELECT * FROM ops_tasks ORDER BY due_date, kind, cycle_key', [], client);
    return res.rows.map(r => this.mapTask(r));
  }

  async findTask(id: string, client?: PoolClient, forUpdate = false): Promise<Task | null> {
    const res = await this.run(`SELECT * FROM ops_tasks WHERE id = $1${forUpdate ? ' FOR UPDATE' : ''}`, [id], client);
    return res.rows[0] ? this.mapTask(res.rows[0]) : null;
  }

  async insertTask(id: string, programId: string, t: TaskSeed, by: string, client: PoolClient): Promise<void> {
    await client.query(
      `INSERT INTO ops_tasks (id, program_id, kind, cycle_key, product, batch_id, due_date, original_due_date, planned_head, planned_kg, price_per_kg, planned_value, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $8, $9, $10, $11, $12)`,
      [id, programId, t.kind, t.cycleKey, t.product, t.batchId ?? null, t.dueDate, t.plannedHead ?? null, t.plannedKg ?? null, t.pricePerKg ?? null, t.plannedValue ?? null, by]
    );
  }

  /** A task nobody has touched follows the plan again: new date and numbers. */
  async refreshUntouched(id: string, t: TaskSeed, by: string, client: PoolClient): Promise<void> {
    await client.query(
      `UPDATE ops_tasks SET due_date = $2, original_due_date = $2, batch_id = $3, planned_head = $4, planned_kg = $5, price_per_kg = $6, planned_value = $7, updated_by = $8, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [id, t.dueDate, t.batchId ?? null, t.plannedHead ?? null, t.plannedKg ?? null, t.pricePerKg ?? null, t.plannedValue ?? null, by]
    );
  }

  async deleteTask(id: string, client: PoolClient): Promise<void> {
    await client.query('DELETE FROM ops_tasks WHERE id = $1', [id]);
  }

  /** Operations' own changes to a task. */
  async updateTask(id: string, c: {
    dueDate: string; manualState: ManualState | null; reason: string; owner: string; notes: string; doneOn: string | null; doneBy: string | null;
    plannedHead?: number | null; plannedKg?: number | null; pricePerKg?: number | null; plannedValue?: number | null;
  }, by: string, client: PoolClient): Promise<void> {
    await client.query(
      `UPDATE ops_tasks SET due_date = $2, manual_state = $3, reason = $4, owner = $5, notes = $6, done_on = $7, done_by = $8,
         planned_head = $9, planned_kg = $10, price_per_kg = $11, planned_value = $12, updated_by = $13, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [id, c.dueDate, c.manualState, c.reason, c.owner, c.notes, c.doneOn, c.doneBy, c.plannedHead ?? null, c.plannedKg ?? null, c.pricePerKg ?? null, c.plannedValue ?? null, by]
    );
  }

  async addEvent(taskId: string, by: string, action: string, note: string, client: PoolClient): Promise<void> {
    await client.query('INSERT INTO ops_task_events (task_id, by, action, note) VALUES ($1, $2, $3, $4)', [taskId, by, action, note]);
  }

  async events(): Promise<TaskEvent[]> {
    const res = await query('SELECT id, task_id, at, by, action, note FROM ops_task_events ORDER BY at, id');
    return res.rows.map(r => ({ id: Number(r.id), taskId: r.task_id, at: iso(r.at), by: r.by || '', action: r.action, note: r.note || '' }));
  }
}

export const opsProgramRepository = new OpsProgramRepository();
