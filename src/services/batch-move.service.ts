import { withTransaction } from '../config/database';
import { batchRepository } from '../repositories/batch.repository';
import { settingsRepository } from '../repositories/settings.repository';
import { stockService } from './stock.service';
import { Actor } from '../lib/authz';
import { farmGuard } from '../lib/farm-guard';

/**
 * Moving a batch to another farm (with its cattle), and moving one animal to
 * another batch. Each is one transaction, so a batch and its cattle never end
 * up on different farms halfway through.
 */
export class BatchMoveService {
  /** Only office accounts move a batch between farms; a farm account stays on its own farm. */
  async moveToFarm(actor: Actor, batchId: string, farm: string, moveCattle: boolean): Promise<{ cattleMoved: number }> {
    farmGuard.notFarmBound(actor);
    const target = (farm || '').trim();
    const settings = await settingsRepository.getSettings();
    if (!(settings.farms || []).some(f => f.name === target)) throw new Error('Choose a farm from the list.');
    const batch = await batchRepository.findById(batchId);
    if (!batch) throw new Error('That batch no longer exists.');
    if (batch.farmLocation === target) return { cattleMoved: 0 };
    const cattleMoved = await withTransaction(client => batchRepository.moveToFarm(batchId, target, moveCattle, client));
    return { cattleMoved };
  }

  /** Moves an animal still on the farm into another active batch on the same farm. */
  async moveCow(actor: Actor, cowId: string, fromBatchId: string, toBatchId: string): Promise<void> {
    if (fromBatchId === toBatchId) throw new Error('Choose a different batch.');
    await farmGuard.cows(actor, [cowId]);
    await farmGuard.batch(actor, fromBatchId);
    await farmGuard.batch(actor, toBatchId);
    const [from, to, stock] = await Promise.all([batchRepository.findById(fromBatchId), batchRepository.findById(toBatchId), stockService.getAllStock()]);
    const cow = stock.find(c => c.id === cowId);
    if (!cow) throw new Error('That animal no longer exists.');
    if ((cow.status || '').toLowerCase() !== 'active') throw new Error('Only animals still on the farm can move to another batch.');
    if (!from || !(from.cowIds || []).includes(cowId)) throw new Error('That animal is no longer in this batch. Reload the page and try again.');
    if (!to) throw new Error('That batch no longer exists.');
    if (to.status !== 'Active') throw new Error(`${to.name} is closed. Choose an active batch.`);
    if (to.farmLocation && cow.location !== to.farmLocation) throw new Error(`${to.name} is on ${to.farmLocation}, but this animal is on ${cow.location}. Move the batch or the animal first.`);
    // assignCows takes the animal out of every other batch first, so it is only ever in one.
    await withTransaction(client => batchRepository.assignCows(toBatchId, [cowId], client));
  }
}

export const batchMoveService = new BatchMoveService();
