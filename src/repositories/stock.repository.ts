import { query } from '../config/database';
import { StockItem } from '../lib/xlsx-parser';
import { PoolClient, QueryResultRow } from 'pg';
import { FarmScope, farmMatchSql } from '../lib/farm-scope';

export class StockRepository {
  private async executeQuery(sql: string, params?: unknown[], client?: PoolClient) {
    if (client) {
      return client.query(sql, params);
    }
    return query(sql, params);
  }

  private mapRowToStock(row: QueryResultRow): StockItem {
    return {
      id: String(row.id),
      no: String(row.no),
      breed: String(row.breed || ''),
      sex: String(row.sex || ''),
      age: String(row.age || ''),
      weight: parseFloat(String(row.weight || 0)),
      ownerName: String(row.owner_name || ''),
      location: String(row.location || ''),
      phone: String(row.phone || ''),
      buyType: String(row.buy_type || ''),
      unitPrice: parseFloat(String(row.unit_price || 0)),
      totalPrice: parseFloat(String(row.total_price || 0)),
      healthStatus: String(row.health_status || 'Good'),
      status: String(row.status || 'Active'),
      purchaseDate: row.purchase_date ? new Date(String(row.purchase_date)).toISOString() : null,
      remark: String(row.remark || ''),
      purchaseType: String(row.purchase_type || ''),
      paymentMethod: String(row.payment_method || ''),
      imageUrl: row.image_url ? String(row.image_url) : undefined
    };
  }

  /** With a scope, only that farm's cattle; without one, everything. */
  async findAll(scope?: FarmScope): Promise<StockItem[]> {
    const match = scope && farmMatchSql('location', scope.farmLocation, 1);
    const res = await query(`SELECT * FROM stock ${match ? `WHERE ${match.sql}` : ''} ORDER BY created_at ASC`, match?.params);
    return res.rows.map(row => this.mapRowToStock(row));
  }

  async findById(id: string): Promise<StockItem | null> {
    const res = await query('SELECT * FROM stock WHERE id = $1', [id]);
    if (res.rows.length === 0) return null;
    return this.mapRowToStock(res.rows[0]);
  }

  async getMaxNo(): Promise<number> {
    const res = await query(`
      SELECT MAX(CAST(no AS INTEGER)) as max_no 
      FROM stock 
      WHERE no ~ '^[0-9]+$'
    `);
    return Number(res.rows[0]?.max_no) || 0;
  }

  async create(item: Omit<StockItem, 'no'> & { no?: string }, client?: PoolClient): Promise<StockItem> {
    const maxNo = await this.getMaxNo();
    const finalNo = item.no || String(maxNo + 1).padStart(2, '0');

    const sql = `
      INSERT INTO stock (
        id, no, breed, sex, age, weight, owner_name, location, phone, buy_type,
        unit_price, total_price, health_status, status, purchase_date, remark, purchase_type, payment_method, image_url
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING *
    `;

    const params: unknown[] = [
      item.id,
      finalNo,
      item.breed || '',
      item.sex || '',
      item.age || '',
      item.weight || 0,
      item.ownerName || '',
      item.location || '',
      item.phone || '',
      item.buyType || '',
      item.unitPrice || 0,
      item.totalPrice || 0,
      item.healthStatus || 'Good',
      item.status || 'Active',
      item.purchaseDate ? new Date(item.purchaseDate) : null,
      item.remark || '',
      item.purchaseType || '',
      item.paymentMethod || '',
      item.imageUrl || null
    ];

    const res = await this.executeQuery(sql, params, client);
    return this.mapRowToStock(res.rows[0]);
  }

  async update(id: string, updates: Partial<StockItem>, client?: PoolClient): Promise<StockItem> {
    const fields: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (updates.breed !== undefined) { fields.push(`breed = $${paramIndex++}`); params.push(updates.breed); }
    if (updates.sex !== undefined) { fields.push(`sex = $${paramIndex++}`); params.push(updates.sex); }
    if (updates.age !== undefined) { fields.push(`age = $${paramIndex++}`); params.push(updates.age); }
    if (updates.weight !== undefined) { fields.push(`weight = $${paramIndex++}`); params.push(updates.weight); }
    if (updates.ownerName !== undefined) { fields.push(`owner_name = $${paramIndex++}`); params.push(updates.ownerName); }
    if (updates.location !== undefined) { fields.push(`location = $${paramIndex++}`); params.push(updates.location); }
    if (updates.phone !== undefined) { fields.push(`phone = $${paramIndex++}`); params.push(updates.phone); }
    if (updates.buyType !== undefined) { fields.push(`buy_type = $${paramIndex++}`); params.push(updates.buyType); }
    if (updates.unitPrice !== undefined) { fields.push(`unit_price = $${paramIndex++}`); params.push(updates.unitPrice); }
    if (updates.totalPrice !== undefined) { fields.push(`total_price = $${paramIndex++}`); params.push(updates.totalPrice); }
    if (updates.healthStatus !== undefined) { fields.push(`health_status = $${paramIndex++}`); params.push(updates.healthStatus); }
    if (updates.status !== undefined) { fields.push(`status = $${paramIndex++}`); params.push(updates.status); }
    if (updates.purchaseDate !== undefined) { fields.push(`purchase_date = $${paramIndex++}`); params.push(updates.purchaseDate ? new Date(updates.purchaseDate) : null); }
    if (updates.remark !== undefined) { fields.push(`remark = $${paramIndex++}`); params.push(updates.remark); }
    if (updates.purchaseType !== undefined) { fields.push(`purchase_type = $${paramIndex++}`); params.push(updates.purchaseType); }
    if (updates.paymentMethod !== undefined) { fields.push(`payment_method = $${paramIndex++}`); params.push(updates.paymentMethod); }
    if (updates.imageUrl !== undefined) { fields.push(`image_url = $${paramIndex++}`); params.push(updates.imageUrl); }

    if (fields.length === 0) {
      const existing = await this.findById(id);
      if (!existing) throw new Error(`Cow with ID ${id} not found`);
      return existing;
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id);

    const sql = `UPDATE stock SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    const res = await this.executeQuery(sql, params, client);
    
    if (res.rows.length === 0) {
      throw new Error(`Cow with ID ${id} not found`);
    }

    return this.mapRowToStock(res.rows[0]);
  }

  async delete(id: string, client?: PoolClient): Promise<boolean> {
    const res = await this.executeQuery('DELETE FROM stock WHERE id = $1 RETURNING id', [id], client);
    return res.rows.length > 0;
  }

  async updateLocation(oldLocation: string, newLocation: string, client?: PoolClient): Promise<void> {
    const sql = `UPDATE stock SET location = $1 WHERE location = $2 OR location = $3`;
    await this.executeQuery(sql, [newLocation, oldLocation, oldLocation], client);
  }
}

export const stockRepository = new StockRepository();
