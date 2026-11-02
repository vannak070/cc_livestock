/**
 * Adds the PRACTICE data (src/db/practice/practice-data.ts) to the LOCAL database: a Plan 2 farm program for every real
 * farm (each on its 3-day slot) and the records that line up with its action plan. Existing records are not changed or
 * deleted; the farms' cattle limits are raised to cover a year of Plan 2 intake (logged as limit changes, restored by
 * `npm run practice:remove`, which takes everything out again).
 *
 *   npm run practice:seed
 *
 * Refuses to run on anything but a local database, while the alert scheduler is on (feed records would send real
 * Telegram messages), when Planning plan 2 is missing, or when practice data is already there.
 */
import { pool, connectWithRetry } from '../../config/database';
import { dailyFeedService } from '../../services/daily-feed.service';
import { opsProgramService } from '../../services/ops-program.service';
import { proposalPlanRepository } from '../../repositories/proposal-plan.repository';
import { settingsRepository } from '../../repositories/settings.repository';
import { addDays, farmToday } from '../../lib/daily-feed';
import { taskViews, summaryOf } from '../../lib/ops-view';
import { buildPracticeData, DSR_PRODUCT, EXISTING, PRACTICE_ACTOR, PRACTICE_PREFIX, SCENARIOS } from './practice-data';
import { planFeedLines } from '../../lib/feed-lines';
import { BUYBACK_BUYER } from '../../lib/buyback';
import { stockRepository } from '../../repositories/stock.repository';
import { salesRepository } from '../../repositories/sales.repository';
import type { UserRoleItem } from '../../lib/types';

const PLAN_SLOT = 2;
const at = (day: string, hour = 3) => `${day}T${String(hour).padStart(2, '0')}:00:00.000Z`;

async function main() {
  const host = process.env.DB_HOST || 'localhost';
  if (process.env.NODE_ENV === 'production' || !['localhost', '127.0.0.1', '::1'].includes(host)) throw new Error('The practice data is for a local database only.');
  if (process.env.ALERTS_SCHEDULER === 'on') throw new Error('The alert scheduler is on: feed records could send real Telegram messages. Stop that server first.');
  await connectWithRetry(5, 1000);

  const already = await pool.query("SELECT 1 FROM stock WHERE id LIKE 'P2-%' UNION ALL SELECT 1 FROM farm_programs WHERE created_by = $1 LIMIT 1", [PRACTICE_ACTOR]);
  if (already.rows.length > 0) throw new Error('Practice data is already in this database. Run `npm run practice:remove` first if you want it again.');
  const plan = (await proposalPlanRepository.findAll()).find(p => p.slot === PLAN_SLOT);
  if (!plan) throw new Error(`Planning plan ${PLAN_SLOT} is not saved here.`);
  const adminRow = (await pool.query("SELECT id FROM users WHERE role IN ('Super Admin','Admin') AND status = 'Active' ORDER BY (role = 'Super Admin') DESC, id LIMIT 1")).rows[0];
  const adminUser = adminRow ? await settingsRepository.findUserById(adminRow.id) : null;
  if (!adminUser) throw new Error('There is no active Super Admin or Admin login to work the action plan as.');
  const actor = { ...adminUser, name: PRACTICE_ACTOR } as UserRoleItem;

  const today = farmToday();
  const d = buildPracticeData(today, plan.params);
  const feedPortion = planFeedLines(plan.params).filter(l => /dsr/i.test(l.name)).reduce((s, l) => s + l.kgPerHeadDay, 0) || 8;
  console.log(`[practice] Adding practice data for ${today} (Plan ${PLAN_SLOT}: ${plan.name}) to ${process.env.DB_NAME ?? 'cc_livestock'} on ${host}...`);

  // 1. The records, in one transaction: all of it or none of it.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const c of d.cows) {
      await client.query(
        `INSERT INTO stock (id, no, breed, sex, age, weight, owner_name, location, phone, buy_type, unit_price, total_price, health_status, status, purchase_date, remark, purchase_type, payment_method)
         VALUES ($1,$2,$3,$4,'18 months',$5,'CamCow',$6,'N/A','Weight',$7,$8,$9,$10,$11,'PRACTICE','Purchase','Bank Transfer')`,
        [c.id, c.no, c.breed, c.sex, c.weight, c.location, c.unitPrice, c.totalPrice, c.healthStatus, c.status, at(c.purchaseDate)]
      );
      await client.query('INSERT INTO cattle_registrations (cow_id, farm_location, registered_at, registered_by) VALUES ($1,$2,$3,$4)', [c.id, c.location, at(c.purchaseDate), PRACTICE_ACTOR]);
    }
    for (const w of d.weighings) {
      await client.query(
        "INSERT INTO weight_tracking (cow_id, breed, age, old_weight, current_weight, gain_loss, health_status, status, tracking_date) VALUES ($1,$2,'18 months',$3,$4,$5,$6,$7,$8)",
        [w.cowId, w.breed, w.oldWeight, w.currentWeight, w.gainLoss, w.healthStatus, w.status, at(w.date)]
      );
    }
    for (const h of d.health) {
      await client.query('INSERT INTO health_logs (id, cow_id, type, name, date, administered_by, cost, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [h.id, h.cowId, h.type, h.name, at(h.date), h.by, h.cost, h.notes]);
    }
    for (const b of d.batches) {
      const program = { notes: 'DSR-16 ration from the Plan 2 farm program.', status: 'Active', frequency: 'Once Daily', startDate: b.startDate, ingredients: [{ name: DSR_PRODUCT.name, unitCost: DSR_PRODUCT.unitCost, productId: DSR_PRODUCT.id, portionPerHead: feedPortion }] };
      await client.query(
        `INSERT INTO batches (id, name, type, start_date, status, notes, feeding_program, farm_location, expected_selling_price, selling_target_date)
         VALUES ($1,$2,'Fattening Program',$3,$4,$5,$6,$7,$8,$9)`,
        [b.id, b.name, at(b.startDate), b.status, 'Plan 2: bought back four months after it is sold to the farm.', JSON.stringify(program), b.farm, b.price, b.target]
      );
      for (const cowId of b.cowIds) await client.query('INSERT INTO batch_cows (batch_id, cow_id) VALUES ($1,$2)', [b.id, cowId]);
    }
    for (const s of d.sales) {
      await client.query(
        "INSERT INTO sales_tracking (cow_id, breed, age, weight, unit_price, total_price, status, sales_date, sale_type, buyer) VALUES ($1,$2,'22 months',$3,$4,$5,'Sold',$6,'Scale',$7)",
        [s.cowId, s.breed, s.weight, s.unitPrice, s.totalPrice, at(s.date, 5), BUYBACK_BUYER]
      );
    }
    for (const b of d.buyers) {
      await client.query('INSERT INTO camcow_buyers (id, name, kind, phone, location, created_by) VALUES ($1,$2,$3,$4,$5,$6)', [b.id, b.name, b.kind, b.phone, b.location, PRACTICE_ACTOR]);
    }
    for (const c of d.stockCosts) {
      await client.query('INSERT INTO camcow_costs (id, cost_date, kind, amount, note, recorded_by) VALUES ($1,$2,$3,$4,$5,$6)', [c.id, c.date, c.kind, c.amount, c.note, PRACTICE_ACTOR]);
    }
    for (const h of d.holdings) {
      await client.query(
        `INSERT INTO camcow_holdings (cow_id, source_farm, batch_id, collected_on, collection_weight, collection_total, status, sold_on, buyer, buyer_id, sale_weight, sale_price_per_kg, sale_total, lost_on, note, received_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$16,$10,$11,$12,$13,$14,$15,$15)`,
        [h.cowId, h.sourceFarm, h.batchId, h.collectedOn, h.collectionWeight, h.collectionTotal, h.status, h.soldOn ?? null, h.buyer ?? null, h.saleWeight ?? null, h.salePricePerKg ?? null, h.saleTotal ?? null, h.lostOn ?? null, h.note ?? '', PRACTICE_ACTOR, h.buyerId ?? null]
      );
    }
    for (const f of d.feedIns) {
      await client.query(
        `INSERT INTO feed_transactions (id, date, product_id, product_name, type, quantity_bags, quantity_kg, unit_cost, total_cost, source_farm, target_farm, reference_no, recorded_by, notes)
         VALUES ($1,$2,$3,$4,'STOCK_IN',$5,$6,$7,$8,'CC Livestock',$9,$10,$11,$12)`,
        [f.id, at(f.date), DSR_PRODUCT.id, DSR_PRODUCT.name, f.bags, f.kg, DSR_PRODUCT.unitCost, Math.round(f.kg * DSR_PRODUCT.unitCost), f.farm, f.id.replace(`${PRACTICE_PREFIX}TX-`, `${PRACTICE_PREFIX}REF-`), PRACTICE_ACTOR, f.note]
      );
    }
    for (const c of d.costs) {
      await client.query('INSERT INTO farm_costs (id, farm_location, category, amount, date, note, recorded_by) VALUES ($1,$2,$3,$4,$5,$6,$7)', [c.id, c.farm, c.category, c.amount, c.date, c.note, PRACTICE_ACTOR]);
    }
    // Every registered animal counts toward a farm's cattle limit, and Plan 2 takes 20 a month: raise the limit to cover a year.
    const settings = await settingsRepository.getSettings();
    const raised: string[] = [];
    const farmsNow = [...(settings.farms || [])];
    for (const spec of [...SCENARIOS, ...EXISTING]) {
      const i = farmsNow.findIndex(f => f.name === spec.farm);
      if (i < 0) continue;
      const existing = Number((await client.query('SELECT COUNT(*) AS n FROM stock WHERE location = $1 AND id NOT LIKE $2', [spec.farm, `${PRACTICE_PREFIX}%`])).rows[0].n);
      const needed = Math.ceil((existing + spec.head * 12 + 10) / 10) * 10;
      const old = Number(farmsNow[i].capacity) || 0;
      if (needed <= old) continue;
      farmsNow[i] = { ...farmsNow[i], capacity: needed };
      await client.query(
        'INSERT INTO farm_limit_changes (id, farm_location, old_limit, new_limit, changed_by, changed_at, reason) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [`${PRACTICE_PREFIX}LIMCHG-${spec.code}`, spec.farm, old, needed, PRACTICE_ACTOR, new Date().toISOString(), `Plan 2: ${spec.head} cattle a month for a year`]
      );
      raised.push(`${spec.farm} ${old} -> ${needed}`);
    }
    if (raised.length > 0) await settingsRepository.patchBlob({ farms: farmsNow }, client);
    console.log(`[practice] Cattle limits raised: ${raised.join(', ') || 'none needed'}.`);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  console.log(`[practice] Records added: ${d.cows.length} cattle, ${d.weighings.length} weighings, ${d.batches.length} batches, ${d.sales.length} buy-back sales, ${d.holdings.length} animals in CamCow stock records, ${d.health.length} health records, ${d.feedIns.length} DSR-16 stock-ins, ${d.costs.length} costs.`);

  // 2. The farm programs, made the way the app makes them (Planning plan 2), then what the office did by hand.
  for (const p of d.programs) {
    const made = await opsProgramService.createProgram(actor, { farm: p.farm, planSlot: PLAN_SLOT, startDate: p.startDate, headPerCycle: p.headPerCycle });
    console.log(`[practice] ${p.farm}: program from ${p.startDate}, ${p.headPerCycle} a month, ${made.tasks} tasks${made.limit && !made.limit.enough ? ` (limit covers ${made.limit.monthsCovered} of 12 months)` : ''}.`);
  }
  const view = await opsProgramService.view(actor);
  for (const c of d.changes) {
    const program = view.programs.find(p => p.farm === c.farm);
    const task = view.tasks.find(t => t.programId === program?.id && t.kind === c.kind && t.cycleKey === c.cycleKey);
    if (!task) { console.log(`[practice] No task ${c.cycleKey} on ${c.farm} to ${c.action}.`); continue; }
    if (c.action === 'postpone') await opsProgramService.changeTask(actor, task.id, { action: 'postpone', newDueDate: addDays(task.dueDate, c.days ?? 7), reason: c.reason ?? '' });
    else await opsProgramService.changeTask(actor, task.id, { action: 'start', owner: c.owner, note: c.note });
  }

  // 3. Feed written down day by day, through the service as the app does it (a farm whose stock ran out simply cannot).
  let days = 0, refused = 0;
  for (const f of d.feedDays) {
    try { await dailyFeedService.record(actor, { farm: f.farm, day: f.day, batches: f.batches.map(b => ({ batchId: b.batchId, items: [{ productId: DSR_PRODUCT.id, units: b.units }] })) }); days++; } catch { refused++; }
  }
  console.log(`[practice] Daily feed written for ${days} farm-days${refused ? ` (${refused} refused by the service)` : ''}.`);

  // 4. What Management will see.
  const after = await opsProgramService.view(actor);
  const [stock, sales] = await Promise.all([stockRepository.findAll(), salesRepository.findAll()]);
  const farmOf = new Map(after.programs.map(p => [p.id, p.farm]));
  const views = taskViews(after.tasks, farmOf, stock, sales, today);
  const sum = summaryOf(views);
  console.log('[practice] Task status across all programs:', JSON.stringify(sum.byStatus));
}

main()
  .catch(e => { console.error(`[practice] ${e instanceof Error ? e.message : e}`); process.exitCode = 1; })
  .finally(() => pool.end());
