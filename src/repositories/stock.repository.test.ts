import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('../config/database', () => db);

import { StockRepository } from './stock.repository';

const repo = new StockRepository();
const row = { id: 'CC-1', no: '1', breed: 'B', sex: 'Male', age: '1', weight: '250', owner_name: '', location: 'SNR Farm', phone: '', buy_type: '', unit_price: '0', total_price: '0', health_status: 'Good', status: 'Active', purchase_date: null, remark: '', purchase_type: '', payment_method: '' };

beforeEach(() => db.query.mockReset());

describe('cattle photos stay out of lists', () => {
  it('the list, one animal and several animals never ask the database for the picture', async () => {
    db.query.mockResolvedValue({ rows: [{ ...row, has_photo: true }] });
    await repo.findAll();
    await repo.findById('CC-1');
    await repo.findByIds(['CC-1']);
    for (const [sql] of db.query.mock.calls) {
      expect(sql).not.toMatch(/SELECT \*/);
      expect(sql).toMatch(/AS has_photo/);
      expect(sql).not.toMatch(/image_url,|, image_url\b(?! IS)/);
    }
  });

  it('says whether there is a photo, and carries no picture', async () => {
    db.query.mockResolvedValue({ rows: [{ ...row, has_photo: true }, { ...row, id: 'CC-2', has_photo: false }] });
    const [a, b] = await repo.findAll();
    expect(a.hasPhoto).toBe(true);
    expect(b.hasPhoto).toBe(false);
    expect(a.imageUrl).toBeUndefined();
  });

  it('reads one picture on demand', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ image_url: 'data:image/jpeg;base64,AAAA' }] });
    expect(await repo.findPhoto('CC-1')).toBe('data:image/jpeg;base64,AAAA');
    db.query.mockResolvedValueOnce({ rows: [{ image_url: null }] });
    expect(await repo.findPhoto('CC-1')).toBeNull();
    db.query.mockResolvedValueOnce({ rows: [] });
    expect(await repo.findPhoto('nope')).toBeNull();
  });
});
