import { beforeEach, describe, expect, it, vi } from 'vitest';

const repo = vi.hoisted(() => ({
  programs: vi.fn(), tasks: vi.fn(), events: vi.fn(), findProgram: vi.fn(), openProgramOf: vi.fn(), insertProgram: vi.fn(), updateProgram: vi.fn(),
  setProgramStatus: vi.fn(), findTask: vi.fn(), insertTask: vi.fn(), refreshUntouched: vi.fn(), deleteTask: vi.fn(), updateTask: vi.fn(), addEvent: vi.fn(), lockFarm: vi.fn(),
}));
const batches = vi.hoisted(() => ({ findAll: vi.fn() }));
const stockRepo = vi.hoisted(() => ({ findAll: vi.fn() }));
const plans = vi.hoisted(() => ({ findAll: vi.fn() }));
const settings = vi.hoisted(() => ({ getSettings: vi.fn() }));
vi.mock('../config/database', () => ({ withTransaction: async (fn: (c: unknown) => unknown) => fn({ tx: true }), query: vi.fn() }));
vi.mock('../repositories/ops-program.repository', () => ({ opsProgramRepository: repo }));
vi.mock('../repositories/batch.repository', () => ({ batchRepository: batches }));
vi.mock('../repositories/stock.repository', () => ({ stockRepository: stockRepo }));
vi.mock('../repositories/proposal-plan.repository', () => ({ proposalPlanRepository: plans }));
vi.mock('../repositories/settings.repository', () => ({ settingsRepository: settings }));

import { OpsProgramService } from './ops-program.service';
import { AuthzError } from '../lib/authz';
import { DEFAULT_PLAN } from '../lib/proposal-plan';
import { taskKey, type Task } from '../lib/ops-program';
import type { UserRoleItem } from '../lib/types';

const service = new OpsProgramService();
const person = (role: string) => ({ id: role, name: `${role} Person`, email: 'p@x.test', role, status: 'Active' }) as UserRoleItem;
const admin = person('Admin');
const management = person('Management');
const setup = { farm: 'SNR Farm', planSlot: 1, startDate: '2099-01-05', headPerCycle: 10 };

const task = (over: Partial<Task> = {}): Task => ({
  id: 'OT-1', programId: 'FP-1', kind: 'sell_to_farm', cycleKey: 'c0', product: '', dueDate: '2099-01-05', originalDueDate: '2099-01-05', plannedHead: 10, plannedKg: 3000, pricePerKg: 11000, plannedValue: 33_000_000,
  reason: '', owner: '', notes: '', updatedBy: '', updatedAt: '', ...over,
});
const program = (over = {}) => ({ id: 'FP-1', farm: 'SNR Farm', planSlot: 1, planName: 'Plan 1', plan: DEFAULT_PLAN, startDate: '2099-01-05', headPerCycle: 10, status: 'Active', createdBy: '', createdAt: '', updatedBy: '', updatedAt: '', ...over });

beforeEach(() => {
  [repo, batches, stockRepo, plans, settings].forEach(m => Object.values(m).forEach(f => f.mockReset()));
  settings.getSettings.mockResolvedValue({ farms: [{ name: 'SNR Farm', capacity: 200 }] });
  plans.findAll.mockResolvedValue([{ slot: 1, name: 'Plan 1', params: DEFAULT_PLAN }]);
  batches.findAll.mockResolvedValue([]);
  stockRepo.findAll.mockResolvedValue([]);
  repo.openProgramOf.mockResolvedValue(null);
  repo.findProgram.mockResolvedValue(program());
  repo.tasks.mockResolvedValue([]);
  repo.programs.mockResolvedValue([]);
  repo.events.mockResolvedValue([]);
  repo.findTask.mockResolvedValue(task());
});

describe('who may do what', () => {
  it('lets Management read programs, tasks and history', async () => {
    await expect(service.view(management)).resolves.toEqual({ programs: [], tasks: [], events: [] });
  });
  it.each(['Company', 'Farm Owner', 'Farm Staff', 'Veterinarian'])('a %s cannot see programs', async role => {
    await expect(service.view(person(role))).rejects.toBeInstanceOf(AuthzError);
  });
  it('Management cannot set up, refresh, pause or work tasks', async () => {
    await expect(service.createProgram(management, setup)).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.refreshProgram(management, 'FP-1')).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.setProgramStatus(management, 'FP-1', 'Paused')).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.changeTask(management, 'OT-1', { action: 'start' })).rejects.toMatchObject({ statusCode: 403 });
    expect(repo.insertProgram).not.toHaveBeenCalled();
    expect(repo.updateTask).not.toHaveBeenCalled();
  });
});

describe('ownerView', () => {
  const owner = { ...person('Farm Owner'), farmLocation: 'SNR Farm' } as UserRoleItem;
  beforeEach(() => {
    repo.programs.mockResolvedValue([program(), program({ id: 'FP-2', farm: 'Other Farm' }), program({ id: 'FP-3', status: 'Closed' })]);
    repo.tasks.mockImplementation(async (id: string) => [task({ programId: id, owner: 'Dara', notes: 'private', reason: 'truck' })]);
  });
  it('gives a Farm Owner only their own farm\'s open program and tasks, without the office\'s notes', async () => {
    const v = await service.ownerView(owner);
    expect(v.programs.map(p => p.id)).toEqual(['FP-1']);
    expect(v.tasks).toHaveLength(1);
    expect(v.tasks[0]).toMatchObject({ programId: 'FP-1', owner: '', notes: '', reason: '' });
  });
  it('refuses anyone who is not a Farm Owner with a farm', async () => {
    await expect(service.ownerView(person('Farm Staff'))).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.ownerView(person('Farm Owner'))).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.ownerView({ ...management, farmLocation: 'SNR Farm' } as UserRoleItem)).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('createProgram', () => {
  it('makes the program and its tasks from the Planning plan, with a history line for each', async () => {
    const r = await service.createProgram(admin, setup);
    expect(repo.insertProgram).toHaveBeenCalledWith(expect.objectContaining({ farm: 'SNR Farm', planSlot: 1, planName: 'Plan 1', headPerCycle: 10, status: 'Active', createdBy: 'Admin Person' }), expect.anything());
    // 12 sales to the farm + 9 buy-backs
    expect(repo.insertTask).toHaveBeenCalledTimes(21);
    expect(repo.addEvent).toHaveBeenCalledTimes(21);
    expect(r).toMatchObject({ tasks: 21, undatedBatches: [] });
  });

  it('refuses an unknown farm, an unknown plan and a bad setup', async () => {
    await expect(service.createProgram(admin, { ...setup, farm: 'Nowhere' })).rejects.toThrow(/farm/i);
    await expect(service.createProgram(admin, { ...setup, planSlot: 7 })).rejects.toThrow(/Planning plans/);
    await expect(service.createProgram(admin, { ...setup, headPerCycle: 0 })).rejects.toThrow(/cattle/i);
    expect(repo.insertProgram).not.toHaveBeenCalled();
  });

  it('refuses a second open program for the farm', async () => {
    repo.openProgramOf.mockResolvedValue(program());
    await expect(service.createProgram(admin, setup)).rejects.toThrow(/already has a program/);
    expect(repo.insertProgram).not.toHaveBeenCalled();
  });

  it('turns a batch already on the farm into a running cycle, and reports a batch with no selling date', async () => {
    batches.findAll.mockResolvedValue([
      { id: 'B1', name: 'Batch01', status: 'Active', farmLocation: 'SNR Farm', cowIds: ['A', 'B'], sellingTargetDate: '2099-02-10' },
      { id: 'B2', name: 'Batch02', status: 'Active', farmLocation: 'SNR Farm', cowIds: ['C'] },
      { id: 'B3', name: 'Other farm', status: 'Active', farmLocation: 'Other', cowIds: ['D'], sellingTargetDate: '2099-02-10' },
    ]);
    stockRepo.findAll.mockResolvedValue(['A', 'B', 'C', 'D'].map(id => ({ id, status: 'Active', weight: 300, location: 'SNR Farm' })));
    const r = await service.createProgram(admin, setup);
    expect(r.undatedBatches).toEqual(['Batch02']);
    const keys = repo.insertTask.mock.calls.map(c => `${c[2].kind}|${c[2].cycleKey}`);
    expect(keys).toContain('buy_back|b:B1');
    expect(keys).toContain('sell_to_farm|r:B1');
    expect(keys.some(k => k.includes('B2') || k.includes('B3'))).toBe(false);
  });

  it('does not count a batch that started on or after the program start (its own cycle already has tasks)', async () => {
    batches.findAll.mockResolvedValue([
      { id: 'OLD', name: 'Old', status: 'Active', farmLocation: 'SNR Farm', cowIds: ['A'], startDate: '2098-12-01T00:00:00.000Z', sellingTargetDate: '2099-03-10' },
      { id: 'NEW', name: 'New', status: 'Active', farmLocation: 'SNR Farm', cowIds: ['B'], startDate: '2099-01-05T00:00:00.000Z', sellingTargetDate: '2099-05-05' },
    ]);
    stockRepo.findAll.mockResolvedValue(['A', 'B'].map(id => ({ id, status: 'Active', weight: 300, location: 'SNR Farm' })));
    await service.createProgram(admin, setup);
    const keys = repo.insertTask.mock.calls.map(c => `${c[2].kind}|${c[2].cycleKey}`);
    expect(keys).toContain('buy_back|b:OLD');
    expect(keys.some(k => k.includes('NEW'))).toBe(false);
  });

  it('warns when the farm\'s cattle limit cannot cover the cattle the program sells (sold cattle still use a place)', async () => {
    settings.getSettings.mockResolvedValue({ farms: [{ name: 'SNR Farm', capacity: 80 }] });
    stockRepo.findAll.mockResolvedValue(Array.from({ length: 55 }, (_, i) => ({ id: `C${i}`, status: 'Active', location: 'SNR Farm' })));
    const r = await service.createProgram(admin, setup);
    expect(r.limit).toEqual({ needed: 120, placesLeft: 25, enough: false, monthsCovered: 2 });
  });
});

describe('refreshProgram', () => {
  const seedKeys = async () => {
    await service.createProgram(admin, setup);
    return repo.insertTask.mock.calls.map(c => c[2]);
  };

  it('keeps tasks operations worked, updates untouched future ones, adds new ones and removes obsolete untouched ones', async () => {
    const seeds = await seedKeys();
    repo.insertTask.mockClear(); repo.addEvent.mockClear();
    const touched = task({ id: 'T-touched', ...seeds[0], programId: 'FP-1', manualState: 'postponed', dueDate: '2099-03-01' });
    const untouched = task({ id: 'T-untouched', ...seeds[1], programId: 'FP-1' });
    const obsolete = task({ id: 'T-obsolete', cycleKey: 'c99', programId: 'FP-1' });
    const pastUntouched = task({ id: 'T-past', cycleKey: 'c98', programId: 'FP-1', dueDate: '2020-01-01', originalDueDate: '2020-01-01' });
    repo.tasks.mockResolvedValue([touched, untouched, obsolete, pastUntouched]);

    await service.refreshProgram(admin, 'FP-1', { headPerCycle: 12 });

    expect(repo.updateProgram).toHaveBeenCalledWith('FP-1', expect.objectContaining({ headPerCycle: 12 }), 'Admin Person', expect.anything());
    const touchedKey = taskKey(touched);
    expect(repo.refreshUntouched.mock.calls.map(c => c[0])).not.toContain('T-touched');
    expect(repo.refreshUntouched.mock.calls.map(c => c[0])).toContain('T-untouched');
    expect(repo.deleteTask.mock.calls.map(c => c[0])).toEqual(['T-obsolete']);
    // everything else the plan wants is created (the touched and untouched ones already exist)
    expect(repo.insertTask.mock.calls.every(c => taskKey(c[2]) !== touchedKey)).toBe(true);
    expect(repo.insertTask.mock.calls.length).toBe(21 - 2);
  });

  it('refuses a closed program and an unknown plan', async () => {
    repo.findProgram.mockResolvedValue(program({ status: 'Closed' }));
    await expect(service.refreshProgram(admin, 'FP-1')).rejects.toThrow(/closed/);
    repo.findProgram.mockResolvedValue(program());
    await expect(service.refreshProgram(admin, 'FP-1', { planSlot: 9 })).rejects.toThrow(/Planning plans/);
  });
});

describe('changeTask', () => {
  it('needs a reason to postpone, then moves the date, keeps the first date and writes history', async () => {
    await expect(service.changeTask(admin, 'OT-1', { action: 'postpone', newDueDate: '2099-01-20', reason: '' })).rejects.toThrow(/why/);
    expect(repo.updateTask).not.toHaveBeenCalled();
    await service.changeTask(admin, 'OT-1', { action: 'postpone', newDueDate: '2099-01-20', reason: 'Truck broke' });
    expect(repo.updateTask).toHaveBeenCalledWith('OT-1', expect.objectContaining({ dueDate: '2099-01-20', manualState: 'postponed', reason: 'Truck broke' }), 'Admin Person', expect.anything());
    expect(repo.addEvent).toHaveBeenCalledWith('OT-1', 'Admin Person', 'postpone', expect.stringContaining('2099-01-05 → 2099-01-20'), expect.anything());
  });

  it('marks a task done by hand with who and when, and starts one with an owner', async () => {
    await service.changeTask(admin, 'OT-1', { action: 'done', note: 'Registered all 10', doneOn: '2020-01-05' });
    expect(repo.updateTask).toHaveBeenLastCalledWith('OT-1', expect.objectContaining({ manualState: 'done_by_hand', doneOn: '2020-01-05', doneBy: 'Admin Person' }), 'Admin Person', expect.anything());
    await service.changeTask(admin, 'OT-1', { action: 'start', owner: 'Dara' });
    expect(repo.updateTask).toHaveBeenLastCalledWith('OT-1', expect.objectContaining({ manualState: 'in_progress', owner: 'Dara' }), 'Admin Person', expect.anything());
  });

  it('adjusts head and scales the weight and value, with the reason in the history', async () => {
    await service.changeTask(admin, 'OT-1', { action: 'adjust', plannedHead: 5, reason: 'Only 5 available' });
    expect(repo.updateTask).toHaveBeenCalledWith('OT-1', expect.objectContaining({ plannedHead: 5, plannedKg: 1500, plannedValue: 16_500_000 }), 'Admin Person', expect.anything());
    expect(repo.addEvent).toHaveBeenCalledWith('OT-1', 'Admin Person', 'adjust', expect.stringContaining('Only 5 available'), expect.anything());
  });

  it('cancels with a reason and reopens', async () => {
    await service.changeTask(admin, 'OT-1', { action: 'cancel', reason: 'Farm paused' });
    expect(repo.updateTask).toHaveBeenLastCalledWith('OT-1', expect.objectContaining({ manualState: 'cancelled', reason: 'Farm paused' }), 'Admin Person', expect.anything());
    repo.findTask.mockResolvedValue(task({ manualState: 'cancelled' }));
    await expect(service.changeTask(admin, 'OT-1', { action: 'start' })).rejects.toThrow(/Reopen/);
    await service.changeTask(admin, 'OT-1', { action: 'reopen' });
    expect(repo.updateTask).toHaveBeenLastCalledWith('OT-1', expect.objectContaining({ manualState: null, reason: '' }), 'Admin Person', expect.anything());
  });

  it('refuses changes to an unknown task or in a closed program', async () => {
    repo.findTask.mockResolvedValue(null);
    await expect(service.changeTask(admin, 'OT-X', { action: 'start' })).rejects.toThrow(/no longer exists/);
    repo.findTask.mockResolvedValue(task());
    repo.findProgram.mockResolvedValue(program({ status: 'Closed' }));
    await expect(service.changeTask(admin, 'OT-1', { action: 'start' })).rejects.toThrow(/closed/);
  });
});

describe('setProgramStatus', () => {
  it('pauses and closes, but never reopens a closed program', async () => {
    await service.setProgramStatus(admin, 'FP-1', 'Paused');
    expect(repo.setProgramStatus).toHaveBeenCalledWith('FP-1', 'Paused', 'Admin Person', expect.anything());
    repo.findProgram.mockResolvedValue(program({ status: 'Closed' }));
    await expect(service.setProgramStatus(admin, 'FP-1', 'Active')).rejects.toThrow(/closed/i);
  });
});
