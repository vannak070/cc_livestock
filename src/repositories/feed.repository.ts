import { query } from '../config/database';
import { FeedProductItem, FeedStockTransaction, FeedTransactionType } from '../types/feed.types';
import { PoolClient } from 'pg';

const DEFAULT_FEED_PRODUCTS: FeedProductItem[] = [
  {
    id: 'PROD-F01',
    name: 'DSR-16 Concentrate Feed',
    category: 'Concentrate',
    unit: 'bag',
    weightPerUnit: 30,
    unitCost: 2000,
    minThresholdBags: 50,
    minThresholdKg: 1500,
    description: 'High-protein commercial fattening concentrate ration (30kg/bag).',
    supplier: 'CP Cambodia',
    status: 'Active'
  }
];

export class FeedRepository {
  private schemaEnsured = false;

  private async executeQuery(sql: string, params?: unknown[], client?: PoolClient) {
    if (client) {
      return client.query(sql, params);
    }
    return query(sql, params);
  }

  /** Tables come from src/db/migrations/sql; this only seeds the default catalogue into an empty one. */
  async ensureSchema(): Promise<void> {
    if (this.schemaEnsured) return;
    this.schemaEnsured = true;
    // Check if products table is empty and seed defaults if so
    const checkRes = await query(`SELECT COUNT(*) FROM feed_products`);
    if (parseInt(checkRes.rows[0].count, 10) === 0) {
      for (const prod of DEFAULT_FEED_PRODUCTS) {
        await this.saveProduct(prod);
      }
    }
  }

  async getProducts(): Promise<FeedProductItem[]> {
    await this.ensureSchema();
    const res = await query(`SELECT * FROM feed_products ORDER BY id ASC`);
    return res.rows.map(row => {
      const wtUnit = parseFloat(String(row.weight_per_unit || 30));
      const uCost = parseFloat(String(row.unit_cost || 0));
      const cBagRaw = parseFloat(String(row.cost_per_bag || 0));
      const cBag = cBagRaw > 0 ? cBagRaw : (uCost * wtUnit);

      return {
        id: String(row.id),
        name: String(row.name),
        category: String(row.category),
        unit: String(row.unit),
        weightPerUnit: wtUnit,
        unitCost: uCost,
        costType: (row.cost_type as 'per_bag' | 'per_kg') || 'per_bag',
        costPerBag: cBag,
        minThresholdBags: parseFloat(String(row.min_threshold_bags || 50)),
        minThresholdKg: parseFloat(String(row.min_threshold_kg || 1500)),
        description: row.description ? String(row.description) : undefined,
        supplier: row.supplier ? String(row.supplier) : undefined,
        status: row.status === 'Inactive' ? 'Inactive' : 'Active',
        trackStock: row.track_stock !== false,
        ownerFarm: row.owner_farm ? String(row.owner_farm) : undefined,
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : undefined
      };
    });
  }

  async saveProduct(product: FeedProductItem, client?: PoolClient): Promise<FeedProductItem> {
    await this.ensureSchema();
    const sql = `
      INSERT INTO feed_products (
        id, name, category, unit, weight_per_unit, unit_cost, cost_type, cost_per_bag,
        min_threshold_bags, min_threshold_kg, description, supplier, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        category = EXCLUDED.category,
        unit = EXCLUDED.unit,
        weight_per_unit = EXCLUDED.weight_per_unit,
        unit_cost = EXCLUDED.unit_cost,
        cost_type = EXCLUDED.cost_type,
        cost_per_bag = EXCLUDED.cost_per_bag,
        min_threshold_bags = EXCLUDED.min_threshold_bags,
        min_threshold_kg = EXCLUDED.min_threshold_kg,
        description = EXCLUDED.description,
        supplier = EXCLUDED.supplier,
        status = EXCLUDED.status;
    `;
    const params = [
      product.id,
      product.name,
      product.category,
      product.unit || 'bag',
      product.weightPerUnit || 30,
      product.unitCost || 0,
      product.costType || 'per_bag',
      product.costPerBag || (product.unitCost || 0) * (product.weightPerUnit || 30),
      product.minThresholdBags || 50,
      product.minThresholdKg || (product.minThresholdBags || 50) * (product.weightPerUnit || 30),
      product.description || null,
      product.supplier || null,
      product.status || 'Active'
    ];
    await this.executeQuery(sql, params, client);
    // Written separately so saving bought feed keeps working on a database that has not had migration 007 yet.
    if (product.trackStock === false || product.trackStock === true) {
      await this.executeQuery('UPDATE feed_products SET track_stock = $1 WHERE id = $2', [product.trackStock, product.id], client)
        .catch(err => {
          if (product.trackStock === false) throw new Error(`Could not mark ${product.name} as grown on the farm: run "npm run safe-migrate" first (${err instanceof Error ? err.message : err}).`);
        });
    }
    // Same approach for the owner farm (migration 009).
    await this.executeQuery('UPDATE feed_products SET owner_farm = $1 WHERE id = $2', [product.ownerFarm || null, product.id], client)
      .catch(err => {
        if (product.ownerFarm) throw new Error(`Could not save ${product.name} for ${product.ownerFarm}: run "npm run safe-migrate" first (${err instanceof Error ? err.message : err}).`);
      });
    return product;
  }

  async deleteProduct(productId: string): Promise<void> {
    await query(`DELETE FROM feed_products WHERE id = $1`, [productId]);
  }

  async getTransactions(): Promise<FeedStockTransaction[]> {
    await this.ensureSchema();
    const res = await query(`SELECT * FROM feed_transactions ORDER BY date DESC, created_at DESC`);
    return res.rows.map(row => ({
      id: String(row.id),
      date: row.date ? new Date(row.date).toISOString() : new Date().toISOString(),
      productId: String(row.product_id),
      productName: String(row.product_name),
      type: String(row.type) as FeedTransactionType,
      quantityBags: parseFloat(String(row.quantity_bags || 0)),
      quantityKg: parseFloat(String(row.quantity_kg || 0)),
      unitCost: parseFloat(String(row.unit_cost || 0)),
      totalCost: parseFloat(String(row.total_cost || 0)),
      sourceFarm: row.source_farm ? String(row.source_farm) : undefined,
      targetFarm: row.target_farm ? String(row.target_farm) : undefined,
      referenceNo: row.reference_no ? String(row.reference_no) : undefined,
      recordedBy: row.recorded_by ? String(row.recorded_by) : undefined,
      notes: row.notes ? String(row.notes) : undefined,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : undefined
    }));
  }

  async addTransaction(tx: FeedStockTransaction, client?: PoolClient): Promise<FeedStockTransaction> {
    await this.insertTransaction(tx, false, client);
    return tx;
  }

  /** Inserts unless a transaction with the same unique reference already exists. Returns whether a row was written. */
  async addTransactionIfNew(tx: FeedStockTransaction, client?: PoolClient): Promise<boolean> {
    return this.insertTransaction(tx, true, client);
  }

  /**
   * Replaces what is stored for one batch on one day: removes that day's
   * estimate and any earlier record, then writes the new record rows.
   */
  async replaceDailyFeed(autoPrefix: string, dailyPrefix: string, rows: FeedStockTransaction[], client: PoolClient): Promise<void> {
    await this.executeQuery(
      'DELETE FROM feed_transactions WHERE left(reference_no, length($1)) = $1 OR left(reference_no, length($2)) = $2',
      [autoPrefix, dailyPrefix],
      client
    );
    for (const row of rows) await this.insertTransaction(row, false, client);
  }

  private async insertTransaction(tx: FeedStockTransaction, skipIfExists: boolean, client?: PoolClient): Promise<boolean> {
    await this.ensureSchema();
    const sql = `
      INSERT INTO feed_transactions (
        id, date, product_id, product_name, type, quantity_bags, 
        quantity_kg, unit_cost, total_cost, source_farm, target_farm, 
        reference_no, recorded_by, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)${skipIfExists ? ' ON CONFLICT DO NOTHING' : ''};
    `;
    const params = [
      tx.id,
      tx.date ? new Date(tx.date) : new Date(),
      tx.productId,
      tx.productName,
      tx.type,
      tx.quantityBags || 0,
      tx.quantityKg || 0,
      tx.unitCost || 0,
      tx.totalCost || 0,
      tx.sourceFarm || null,
      tx.targetFarm || null,
      tx.referenceNo || null,
      tx.recordedBy || null,
      tx.notes || null
    ];
    const res = await this.executeQuery(sql, params, client);
    return (res.rowCount ?? 0) > 0;
  }
}

export const feedRepository = new FeedRepository();
