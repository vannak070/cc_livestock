import { randomUUID } from 'crypto';
import type { PoolClient } from 'pg';
import { withTransaction } from '../config/database';
import { opsProgramRepository, type FarmProgram, type ProgramStatus, type TaskEvent } from '../repositories/ops-program.repository';
import { batchRepository } from '../repositories/batch.repository';
import { proposalPlanRepository } from '../repositories/proposal-plan.repository';
import { settingsRepository } from '../repositories/settings.repository';
import { stockRepository } from '../repositories/stock.repository';
import { Actor, AuthzError } from '../lib/authz';
import { farmToday, isDay } from '../lib/daily-feed';
import { limitState } from '../lib/farm-limit';
import {
  canManagePrograms, canSeePrograms, generateTasks, limitCheck, programProblem, taskChangeProblem, taskKey,
  type ProgramInput, type RunningBatch, type Task, type TaskChange, type TaskSeed,
} from '../lib/ops-program';

export interface OpsProgramsView {
  programs: FarmProgram[];
  tasks: Task[];
  events: TaskEvent[];
}

export interface ProgramSetup {
  farm: string;
  planSlot: number;
  startDate: string;
  headPerCycle: number;
  purchasePricePerKg?: number;
  buybackPricePerKg?: number;
  horizonMonths?: number;
}

export interface SetupResult {
  program: FarmProgram;
  /** Tasks now in the program. */
  tasks: number;
  /** Batches on the farm with no selling date (they make no task until a date is set). */
  undatedBatches: string[];
  /** The farm's cattle limit against the cattle the program will sell (every registered animal counts). */
  limit: ReturnType<typeof limitCheck> | null;
}

const newId = (prefix: string) => `${prefix}-${randomUUID()}`;

/**
 * Farm programs and their tasks (src/lib/ops-program.ts). Super Admin and Admin write; Management reads (no approval step).
 * A program is one farm + one Planning plan + a start date; the tasks come from the plan and are refreshed when the plan
 * or the start changes: tasks nobody has touched follow the plan, tasks operations changed or finished are kept.
 */
export class OpsProgramService {
  private assertSee(actor: Actor) {
    if (!canSeePrograms(actor)) throw new AuthzError('Only Super Admin, Admin and Management can see farm programs.', 403);
  }
  private assertWrite(actor: Actor) {
    if (!canManagePrograms(actor)) throw new AuthzError('Only a Super Admin or Admin can set up farm programs and work their tasks.', 403);
  }

  async view(actor: Actor): Promise<OpsProgramsView> {
    this.assertSee(actor);
    const [programs, tasks, events] = await Promise.all([opsProgramRepository.programs(), opsProgramRepository.tasks(), opsProgramRepository.events()]);
    return { programs, tasks, events };
  }

  /**
   * A Farm Owner's own farm: its open program and the tasks the money statement is worked out from (planned head and value by
   * date). Nothing else leaves the server: no owners, notes or reasons of the office's work, and never another farm.
   */
  async ownerView(actor: Actor): Promise<{ programs: FarmProgram[]; tasks: Task[] }> {
    const farm = (actor.farmLocation ?? '').trim();
    if (actor.role !== 'Farm Owner' || !farm) throw new AuthzError('Only a Farm Owner can see the money statement of their own farm.', 403);
    const programs = (await opsProgramRepository.programs()).filter(p => p.status !== 'Closed' && p.farm.toLowerCase() === farm.toLowerCase());
    const tasks = (await Promise.all(programs.map(p => opsProgramRepository.tasks(p.id)))).flat()
      .map(t => ({ ...t, reason: '', owner: '', notes: '', updatedBy: '' }));
    return { programs, tasks };
  }

  /**
   * The batches on the farm that still have cattle: running cycles whose buy-back and replacement the program tracks.
   * Only batches that started BEFORE the program's start day: a batch from a later monthly cycle is already covered by
   * that cycle's own tasks, and counting it again would double its buy-back.
   */
  private async runningBatches(farm: string, before: string): Promise<RunningBatch[]> {
    const [batches, stock] = await Promise.all([batchRepository.findAll(), stockRepository.findAll()]);
    const byId = new Map(stock.map(c => [c.id, c]));
    const out: RunningBatch[] = [];
    for (const b of batches) {
      if (b.status !== 'Active' || (b.farmLocation ?? '') !== farm) continue;
      if ((b.startDate ?? '').slice(0, 10) >= before) continue;
      const cattle = (b.cowIds ?? []).map(id => byId.get(id)).filter(c => !!c && (c.status ?? '').toLowerCase() === 'active');
      if (cattle.length === 0) continue;
      const due = b.sellingTargetDate ? b.sellingTargetDate.slice(0, 10) : undefined;
      out.push({ batchId: b.id, name: b.name, head: cattle.length, estKg: cattle.reduce((s, c) => s + (Number(c!.weight) || 0), 0), ...(due && isDay(due) ? { dueDate: due } : {}) });
    }
    return out;
  }

  private async planParams(slot: number) {
    const plan = (await proposalPlanRepository.findAll()).find(p => p.slot === slot);
    if (!plan) throw new Error('Choose one of the saved Planning plans.');
    return plan;
  }

  private toInput(s: ProgramSetup, plan: ProgramInput['plan']): ProgramInput {
    return { farm: s.farm, startDate: s.startDate, headPerCycle: s.headPerCycle, plan, purchasePricePerKg: s.purchasePricePerKg, buybackPricePerKg: s.buybackPricePerKg, horizonMonths: s.horizonMonths };
  }

  /** Brings the program's tasks in line with the plan: new ones made, untouched ones updated or removed, touched ones kept. */
  private async reconcile(programId: string, input: ProgramInput, running: RunningBatch[], by: string, client: PoolClient) {
    const today = farmToday();
    const gen = generateTasks(input, running);
    const existing = await opsProgramRepository.tasks(programId, client);
    const wanted = new Map<string, TaskSeed>(gen.tasks.map(t => [taskKey(t), t]));
    const have = new Map(existing.map(t => [taskKey(t), t]));
    for (const [key, seed] of wanted) {
      const old = have.get(key);
      if (!old) {
        const id = newId('OT');
        await opsProgramRepository.insertTask(id, programId, seed, by, client);
        await opsProgramRepository.addEvent(id, by, 'created', '', client);
      } else if (!old.manualState && old.dueDate >= today) {
        await opsProgramRepository.refreshUntouched(old.id, seed, by, client);
      }
    }
    for (const [key, old] of have) {
      if (wanted.has(key)) continue;
      // A task the plan no longer needs goes away only when nobody has worked it and it is still to come.
      if (!old.manualState && old.dueDate >= today) await opsProgramRepository.deleteTask(old.id, client);
    }
    return gen;
  }

  async createProgram(actor: Actor, setup: ProgramSetup): Promise<SetupResult> {
    this.assertWrite(actor);
    const settings = await settingsRepository.getSettings();
    const farm = (settings.farms || []).find(f => f.name === setup.farm);
    if (!farm) throw new Error('Choose a farm from the list.');
    const plan = await this.planParams(setup.planSlot);
    const input = this.toInput(setup, plan.params);
    const problem = programProblem(input);
    if (problem) throw new Error(problem);
    const running = await this.runningBatches(setup.farm, setup.startDate);
    const stock = await stockRepository.findAll();
    const limit = limitState(farm, stock);

    const id = newId('FP');
    const gen = await withTransaction(async client => {
      await opsProgramRepository.lockFarm(setup.farm, client);
      if (await opsProgramRepository.openProgramOf(setup.farm, client)) throw new Error(`${setup.farm} already has a program. Open it to change it, or close it first.`);
      await opsProgramRepository.insertProgram({
        id, farm: setup.farm, planSlot: plan.slot, planName: plan.name, plan: plan.params, startDate: setup.startDate, headPerCycle: setup.headPerCycle,
        ...(setup.purchasePricePerKg ? { purchasePricePerKg: setup.purchasePricePerKg } : {}), ...(setup.buybackPricePerKg ? { buybackPricePerKg: setup.buybackPricePerKg } : {}),
        status: 'Active', createdBy: actor.name,
      }, client);
      return this.reconcile(id, input, running, actor.name, client);
    });
    const program = (await opsProgramRepository.findProgram(id))!;
    return {
      program, tasks: gen.tasks.length, undatedBatches: gen.undated.map(b => b.name),
      limit: limit.limit > 0 ? limitCheck(limit.left, setup.headPerCycle, setup.horizonMonths, { startDate: setup.startDate, today: farmToday() }) : null,
    };
  }

  /** Re-reads the Planning plan (or applies new start / head / prices) and refreshes the tasks. */
  async refreshProgram(actor: Actor, programId: string, change: Partial<Omit<ProgramSetup, 'farm'>> = {}): Promise<SetupResult> {
    this.assertWrite(actor);
    const current = await opsProgramRepository.findProgram(programId);
    if (!current) throw new Error('That program no longer exists.');
    if (current.status === 'Closed') throw new Error('A closed program cannot be changed.');
    const slot = change.planSlot ?? current.planSlot;
    const plan = await this.planParams(slot);
    const setup: ProgramSetup = {
      farm: current.farm, planSlot: slot, startDate: change.startDate ?? current.startDate, headPerCycle: change.headPerCycle ?? current.headPerCycle,
      purchasePricePerKg: 'purchasePricePerKg' in change ? change.purchasePricePerKg : current.purchasePricePerKg,
      buybackPricePerKg: 'buybackPricePerKg' in change ? change.buybackPricePerKg : current.buybackPricePerKg,
      horizonMonths: change.horizonMonths,
    };
    const input = this.toInput(setup, plan.params);
    const problem = programProblem(input);
    if (problem) throw new Error(problem);
    const running = await this.runningBatches(current.farm, setup.startDate);
    const settings = await settingsRepository.getSettings();
    const farm = (settings.farms || []).find(f => f.name === current.farm);
    const limit = farm ? limitState(farm, await stockRepository.findAll()) : null;

    const gen = await withTransaction(async client => {
      await opsProgramRepository.lockFarm(current.farm, client);
      if (!(await opsProgramRepository.findProgram(programId, client, true))) throw new Error('That program no longer exists.');
      await opsProgramRepository.updateProgram(programId, { planSlot: plan.slot, planName: plan.name, plan: plan.params, startDate: setup.startDate, headPerCycle: setup.headPerCycle, purchasePricePerKg: setup.purchasePricePerKg, buybackPricePerKg: setup.buybackPricePerKg }, actor.name, client);
      return this.reconcile(programId, input, running, actor.name, client);
    });
    return {
      program: (await opsProgramRepository.findProgram(programId))!, tasks: gen.tasks.length, undatedBatches: gen.undated.map(b => b.name),
      limit: limit && limit.limit > 0 ? limitCheck(limit.left, setup.headPerCycle, setup.horizonMonths, { startDate: setup.startDate, today: farmToday() }) : null,
    };
  }

  async setProgramStatus(actor: Actor, programId: string, status: ProgramStatus): Promise<FarmProgram> {
    this.assertWrite(actor);
    if (!['Active', 'Paused', 'Closed'].includes(status)) throw new Error('Choose Active, Paused or Closed.');
    await withTransaction(async client => {
      const p = await opsProgramRepository.findProgram(programId, client, true);
      if (!p) throw new Error('That program no longer exists.');
      await opsProgramRepository.lockFarm(p.farm, client);
      if (p.status === 'Closed') throw new Error('A closed program cannot be opened again. Make a new one.');
      await opsProgramRepository.setProgramStatus(programId, status, actor.name, client);
    });
    return (await opsProgramRepository.findProgram(programId))!;
  }

  /** Operations work a task: start, postpone, cancel, mark done, adjust the plan for it, or add a note. */
  async changeTask(actor: Actor, taskId: string, change: TaskChange): Promise<Task> {
    this.assertWrite(actor);
    const today = farmToday();
    await withTransaction(async client => {
      const task = await opsProgramRepository.findTask(taskId, client, true);
      if (!task) throw new Error('That task no longer exists.');
      const program = await opsProgramRepository.findProgram(task.programId, client, true);
      if (!program || program.status === 'Closed') throw new Error('The program of this task is closed.');
      const problem = taskChangeProblem(task, change, today);
      if (problem) throw new Error(problem);

      const next = {
        dueDate: task.dueDate, manualState: task.manualState ?? null, reason: task.reason, owner: task.owner, notes: task.notes,
        doneOn: task.doneOn ?? null, doneBy: task.doneBy ?? null,
        plannedHead: task.plannedHead ?? null, plannedKg: task.plannedKg ?? null, pricePerKg: task.pricePerKg ?? null, plannedValue: task.plannedValue ?? null,
      };
      let note = '';
      switch (change.action) {
        case 'start': next.manualState = 'in_progress'; if (change.owner !== undefined) next.owner = change.owner.trim(); note = change.note?.trim() ?? ''; break;
        case 'postpone': note = `${task.dueDate} → ${change.newDueDate}. ${change.reason.trim()}`; next.dueDate = change.newDueDate; next.manualState = 'postponed'; next.reason = change.reason.trim(); break;
        case 'cancel': next.manualState = 'cancelled'; next.reason = change.reason.trim(); note = next.reason; break;
        case 'done': next.manualState = 'done_by_hand'; next.doneOn = change.doneOn ?? today; next.doneBy = actor.name; note = change.note.trim(); break;
        case 'reopen': next.manualState = null; next.doneOn = null; next.doneBy = null; next.reason = ''; break;
        case 'adjust': {
          const head = change.plannedHead ?? task.plannedHead;
          const kg = change.plannedKg ?? (change.plannedHead !== undefined && task.plannedHead && task.plannedKg ? Math.round(task.plannedKg * change.plannedHead / task.plannedHead) : task.plannedKg);
          const price = change.pricePerKg ?? task.pricePerKg;
          next.plannedHead = head ?? null; next.plannedKg = kg ?? null; next.pricePerKg = price ?? null;
          next.plannedValue = kg && price ? Math.round(kg * price) : task.plannedValue ?? null;
          note = `${[change.plannedHead !== undefined ? `head ${task.plannedHead ?? '–'} → ${change.plannedHead}` : '', change.plannedKg !== undefined ? `kg ${task.plannedKg ?? '–'} → ${change.plannedKg}` : '', change.pricePerKg !== undefined ? `price ${task.pricePerKg ?? '–'} → ${change.pricePerKg}` : ''].filter(Boolean).join(', ')}. ${change.reason.trim()}`;
          break;
        }
        case 'note': if (change.owner !== undefined) next.owner = change.owner.trim(); if (change.notes !== undefined) next.notes = change.notes.trim(); note = 'notes'; break;
      }
      await opsProgramRepository.updateTask(taskId, next, actor.name, client);
      await opsProgramRepository.addEvent(taskId, actor.name, change.action, note, client);
    });
    return (await opsProgramRepository.findTask(taskId))!;
  }
}

export const opsProgramService = new OpsProgramService();
