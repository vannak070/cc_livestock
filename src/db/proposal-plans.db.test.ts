import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { pool } from '../config/database';
import { resetDatabase } from './migrate';
import { proposalPlanService } from '../services/proposal-plan.service';
import { DEFAULT_PLAN } from '../lib/proposal-plan';

// Integration test: needs RUN_DB_TESTS=1 and a database whose name ends in `_test` (it drops every table).
const enabled = process.env.RUN_DB_TESTS === '1' && /_test$/.test(process.env.DB_NAME || '');

describe.skipIf(!enabled)('planning scenarios (Plan 1 to Plan 10)', () => {
  beforeAll(async () => { await resetDatabase(); });
  afterAll(() => pool.end());

  it('carries the old single plan over as Plan 1, and does so only once', async () => {
    const old = { ...DEFAULT_PLAN, targetStockLevel: 123 };
    await pool.query("INSERT INTO proposal_plan (id, params) VALUES ('current', $1)", [JSON.stringify(old)]);
    const sql = fs.readFileSync(path.join(__dirname, 'migrations', 'sql', '004_proposal_plans.sql'), 'utf8');
    await pool.query(sql);
    let plans = await proposalPlanService.getPlans();
    expect(plans).toHaveLength(1);
    expect(plans[0]).toMatchObject({ slot: 1, name: 'Plan 1', params: old });
    // Running it again must not overwrite what was saved since.
    await proposalPlanService.savePlan(1, 'Kept', { ...DEFAULT_PLAN, targetStockLevel: 5 }, 'Tester');
    await pool.query(sql);
    plans = await proposalPlanService.getPlans();
    expect(plans[0]).toMatchObject({ name: 'Kept', updatedBy: 'Tester' });
    expect(plans[0].params.targetStockLevel).toBe(5);
  });

  it('saves into any slot, names it, and replaces it on a second save', async () => {
    await proposalPlanService.savePlan(10, '  Big farm  ', DEFAULT_PLAN, 'Tester');
    await proposalPlanService.savePlan(3, '', DEFAULT_PLAN);
    let plans = await proposalPlanService.getPlans();
    expect(plans.map(p => [p.slot, p.name])).toEqual([[1, 'Kept'], [3, 'Plan 3'], [10, 'Big farm']]);
    await proposalPlanService.savePlan(10, 'Bigger', { ...DEFAULT_PLAN, targetStockLevel: 900 });
    plans = await proposalPlanService.getPlans();
    expect(plans.find(p => p.slot === 10)).toMatchObject({ name: 'Bigger' });
    expect(plans.find(p => p.slot === 10)!.params.targetStockLevel).toBe(900);
    expect(plans).toHaveLength(3);
  });

  it('refuses a slot outside 1 to 10 and invalid numbers, in the service and in the database', async () => {
    await expect(proposalPlanService.savePlan(0, 'x', DEFAULT_PLAN)).rejects.toThrow(/1 to 10/);
    await expect(proposalPlanService.savePlan(11, 'x', DEFAULT_PLAN)).rejects.toThrow(/1 to 10/);
    await expect(proposalPlanService.savePlan(2.5, 'x', DEFAULT_PLAN)).rejects.toThrow(/1 to 10/);
    await expect(proposalPlanService.savePlan(2, 'x', { ...DEFAULT_PLAN, targetStockLevel: -1 })).rejects.toThrow(/not valid/);
    await expect(pool.query("INSERT INTO proposal_plans (slot, name, params) VALUES (11, 'x', '{}')")).rejects.toThrow(/check/i);
  });

  it('deletes a plan', async () => {
    expect(await proposalPlanService.deletePlan(3)).toBe(true);
    expect(await proposalPlanService.deletePlan(3)).toBe(false);
    expect((await proposalPlanService.getPlans()).map(p => p.slot)).toEqual([1, 10]);
  });
});
