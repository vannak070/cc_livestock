import { withTransaction } from '../config/database';
import { camcowHoldingRepository } from '../repositories/camcow-holding.repository';
import { camcowCostRepository } from '../repositories/camcow-cost.repository';
import { costProblem, type CostInput, type StockCost } from '../lib/camcow-costs';
import { camcowBuyerRepository } from '../repositories/camcow-buyer.repository';
import { buyerProblem, type Buyer, type BuyerInput } from '../lib/camcow-buyers';
import { Actor, AuthzError } from '../lib/authz';
import { farmToday } from '../lib/daily-feed';
import { isBuybackSale } from '../lib/buyback';
import { canManageCamcowStock, canSeeCamcowStock, lostProblem, saleProblem, type Holding, type SaleInput } from '../lib/camcow-stock';

/**
 * The cattle CC Livestock holds after collecting them from farms (src/lib/camcow-stock.ts). Super Admin and Admin write;
 * Management reads. The animal's own stock record is never moved, so the farm's records keep working.
 */
export class CamcowStockService {
  private assertSee(actor: Actor) {
    if (!canSeeCamcowStock(actor)) throw new AuthzError('Only Super Admin, Admin and Management can see the CamCow stock.', 403);
  }
  private assertWrite(actor: Actor) {
    if (!canManageCamcowStock(actor)) throw new AuthzError('Only a Super Admin or Admin can change the CamCow stock.', 403);
  }

  async view(actor: Actor): Promise<{ holdings: Holding[]; buyers: Buyer[]; costs: StockCost[] }> {
    this.assertSee(actor);
    const [holdings, buyers, costs] = await Promise.all([camcowHoldingRepository.all(), camcowBuyerRepository.buyers(), camcowCostRepository.all()]);
    return { holdings, buyers, costs };
  }

  /** Adds a buyer, or changes one when `input.id` is set. Buyers are never deleted (their sales keep them); set them inactive instead. */
  async saveBuyer(actor: Actor, input: BuyerInput): Promise<Buyer> {
    this.assertWrite(actor);
    return withTransaction(async client => {
      const all = await camcowBuyerRepository.buyers(client);
      const problem = buyerProblem(input, all.filter(b => b.id !== input.id).map(b => b.name));
      if (problem) throw new Error(problem);
      if (!input.id) return camcowBuyerRepository.insertBuyer(input, actor.name, client);
      if (!all.some(b => b.id === input.id)) throw new Error('This buyer was not found.');
      await camcowBuyerRepository.updateBuyer(input.id, input, client);
      return (await camcowBuyerRepository.buyer(input.id, client))!;
    });
  }

  /** Records a cost of keeping cattle at the stock site. It is shared between the animals in stock on its date. */
  async addCost(actor: Actor, input: CostInput): Promise<void> {
    this.assertWrite(actor);
    const problem = costProblem(input, farmToday());
    if (problem) throw new Error(problem);
    await camcowCostRepository.insert(input, actor.name);
  }

  /** Removes a cost that was recorded by mistake. */
  async deleteCost(actor: Actor, id: string): Promise<void> {
    this.assertWrite(actor);
    if (!(await camcowCostRepository.find(id))) throw new Error('This cost was not found.');
    await camcowCostRepository.remove(id);
  }

  /** Brings collected cattle (sold to CC Livestock) into stock. Animals already in stock are skipped. */
  async receive(actor: Actor, cowIds: string[]): Promise<{ received: number }> {
    this.assertWrite(actor);
    if (!Array.isArray(cowIds) || cowIds.length === 0) throw new Error('Choose the cattle to receive.');
    if (cowIds.length > 1000) throw new Error('Receive at most 1,000 animals at a time.');
    const ids = [...new Set(cowIds)];
    return withTransaction(async client => {
      const sales = await camcowHoldingRepository.salesOf(ids, client);
      let received = 0;
      for (const id of ids) {
        const collection = sales.find(s => s.cowId === id && isBuybackSale({ buyer: s.buyer }));
        if (!collection) throw new Error(`${id} has not been sold to CC Livestock, so it cannot be received.`);
        if (await camcowHoldingRepository.insert(collection, actor.name, client)) received++;
      }
      return { received };
    });
  }

  /** Sells animals in stock on to a buyer, by scale. */
  async sell(actor: Actor, input: SaleInput): Promise<{ sold: number; total: number }> {
    this.assertWrite(actor);
    const today = farmToday();
    return withTransaction(async client => {
      const rows = await camcowHoldingRepository.lock(Array.isArray(input.cowIds) ? input.cowIds : [], client);
      const held = new Set(rows.filter(r => r.status === 'Held').map(r => r.cowId));
      const problem = saleProblem(input, held, today);
      if (problem) throw new Error(problem);
      const buyer = await camcowBuyerRepository.buyer(input.buyerId, client);
      if (!buyer) throw new Error('This buyer was not found. Choose the buyer again.');
      if (!buyer.active) throw new Error('This buyer is not active. Make the buyer active first.');
      let total = 0;
      for (const id of input.cowIds) {
        const weight = input.weights[id];
        const sum = Math.round(weight * input.pricePerKg);
        total += sum;
        await camcowHoldingRepository.markSold(id, { soldOn: input.date, buyerId: buyer.id, buyer: buyer.name, weight, pricePerKg: input.pricePerKg, total: sum }, actor.name, client);
      }
      return { sold: input.cowIds.length, total };
    });
  }

  /** Marks animals in stock as lost (died, ...). What CC Livestock paid for them shows as a loss. */
  async markLost(actor: Actor, cowIds: string[], date: string, note: string): Promise<{ lost: number }> {
    this.assertWrite(actor);
    const today = farmToday();
    return withTransaction(async client => {
      const rows = await camcowHoldingRepository.lock(Array.isArray(cowIds) ? cowIds : [], client);
      const held = new Set(rows.filter(r => r.status === 'Held').map(r => r.cowId));
      const problem = lostProblem(cowIds, date, note, held, today);
      if (problem) throw new Error(problem);
      for (const id of cowIds) await camcowHoldingRepository.markLost(id, date, (note ?? '').trim(), actor.name, client);
      return { lost: cowIds.length };
    });
  }
}

export const camcowStockService = new CamcowStockService();
