import { randomUUID } from 'crypto';
import type { PoolClient } from 'pg';
import { withTransaction } from '../config/database';
import { farmLimitRepository } from '../repositories/farm-limit.repository';
import { farmRepository } from '../repositories/farm.repository';
import { settingsRepository } from '../repositories/settings.repository';
import { telegramService } from './telegram.service';
import { Actor, AuthzError, can } from '../lib/authz';
import { farmGuard } from '../lib/farm-guard';
import { alertSettings, escapeHtml } from '../lib/alerts';
import { canSetLimits, limitBlock, limitBlockMessage, limitDecisionProblem, limitOf, limitRequestProblem, type LimitRequestInput } from '../lib/farm-limit';
import type { FarmItem, FarmLimitRequest } from '../lib/types';

const newId = (prefix: string) => `${prefix}-${randomUUID().slice(0, 8).toUpperCase()}`;
const norm = (s?: string) => (s ?? '').trim().toLowerCase();

/**
 * Farm cattle limits on the server: the check before cattle go onto a farm,
 * a farm's request for more, and a Super Admin's or Admin's decision.
 */
export class FarmLimitService {
  private async farm(name: string): Promise<FarmItem | null> {
    const settings = await settingsRepository.getSettings();
    return (settings.farms || []).find(f => norm(f.name) === norm(name)) ?? null;
  }

  /** Refuses when `adding` more cattle would go over the farm's limit (or it has none). Unknown farms are left to other checks. */
  async assertRoom(farmName: string | undefined | null, adding = 1, client?: PoolClient): Promise<void> {
    if (!farmName || adding <= 0) return;
    const farm = await this.farm(farmName);
    if (!farm) return;
    const used = await farmRepository.countRegisteredCattle(farm.name, client);
    const block = limitBlock(farm, used, adding);
    if (block) throw new Error(limitBlockMessage(block, adding));
  }

  /** A farm asks for a higher limit. Farm accounts ask for their own farm only; one request can wait per farm. */
  async request(actor: Actor, input: LimitRequestInput): Promise<FarmLimitRequest> {
    if (!can(actor, 'stock_create') && !can(actor, 'farms_manage')) throw new AuthzError('You do not have permission to ask for more cattle.', 403);
    const settings = await settingsRepository.getSettings();
    const problem = limitRequestProblem(input, settings.farms || []);
    if (problem) throw new Error(problem);
    const farm = (settings.farms || []).find(f => norm(f.name) === norm(input.farm))!;
    farmGuard.requireLocation(actor, farm.name);
    const waiting = await farmLimitRepository.pendingFor(farm.name);
    if (waiting) throw new Error(`${farm.name} already has a request waiting (for ${waiting.extra} more). An Admin will answer it.`);
    const created = await farmLimitRepository.createRequest({
      id: newId('LIMREQ'), farmLocation: farm.name, extra: input.extra, reason: input.reason.trim(), requestedBy: actor.name,
    });
    await this.tellAdmins(created, farm).catch(() => undefined); // a failed message never loses the request
    return created;
  }

  /** Telegram, when alerts are switched on: a short note for the admins. */
  private async tellAdmins(r: FarmLimitRequest, farm: FarmItem): Promise<void> {
    if (!telegramService.isConfigured()) return;
    const cfg = alertSettings(await settingsRepository.getSettings());
    if (!cfg.telegramEnabled || !cfg.chatId) return;
    const used = await farmRepository.countRegisteredCattle(farm.name);
    const text = [
      `<b>${escapeHtml(farm.name)}</b> asks for <b>${r.extra}</b> more cattle.`,
      `Limit ${limitOf(farm)}, ${used} registered. Asked by ${escapeHtml(r.requestedBy)}.`,
      r.reason ? `Reason: ${escapeHtml(r.reason)}` : '',
      'A Super Admin or Admin can answer it on the Farms page.',
    ].filter(Boolean).join('\n');
    await telegramService.send(cfg.chatId, text);
  }

  /** Approve (setting the new limit) or decline a request. Super Admin and Admin only. */
  async decide(actor: Actor, id: string, approve: boolean, newLimit: number, note: string): Promise<void> {
    if (!canSetLimits(actor)) throw new AuthzError('Only a Super Admin or Admin can answer a request for more cattle.', 403);
    const request = await farmLimitRepository.findRequestById(id);
    if (!request) throw new Error('That request no longer exists.');
    if (request.status !== 'pending') throw new Error('That request was already answered. Reload the page.');
    const cleanNote = (note ?? '').trim().slice(0, 500);
    if (!approve) {
      if (!(await farmLimitRepository.decide(id, { status: 'declined', decidedBy: actor.name, note: cleanNote }))) throw new Error('That request was already answered. Reload the page.');
      return;
    }
    const settings = await settingsRepository.getSettings();
    const farm = (settings.farms || []).find(f => norm(f.name) === norm(request.farmLocation));
    if (!farm) throw new Error(`${request.farmLocation} is not a farm any more.`);
    const used = await farmRepository.countRegisteredCattle(farm.name);
    const problem = limitDecisionProblem(true, newLimit, used);
    if (problem) throw new Error(problem);
    await withTransaction(async client => {
      if (!(await farmLimitRepository.decide(id, { status: 'approved', decidedBy: actor.name, note: cleanNote, newLimit }, client))) {
        throw new Error('That request was already answered. Reload the page.');
      }
      const farms = (settings.farms || []).map(f => (f.id === farm.id ? { ...f, capacity: newLimit } : f));
      await settingsRepository.patchBlob({ farms }, client);
      await farmLimitRepository.logChange({
        id: newId('LIMCHG'), farmLocation: farm.name, oldLimit: limitOf(farm), newLimit, changedBy: actor.name,
        reason: cleanNote || request.reason, requestId: id,
      }, client);
    });
  }

  /** Records a limit set or changed on the farm itself (Farms, Edit farm). */
  async logDirectChange(actor: Actor, farmName: string, oldLimit: number, newLimit: number, client?: PoolClient): Promise<void> {
    if (oldLimit === newLimit) return;
    await farmLimitRepository.logChange({ id: newId('LIMCHG'), farmLocation: farmName, oldLimit, newLimit, changedBy: actor.name, reason: '' }, client);
  }
}

export const farmLimitService = new FarmLimitService();
