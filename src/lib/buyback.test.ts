import { describe, expect, it } from 'vitest';
import { BUYBACK_BUYER, isBuybackSale } from './buyback';

describe('isBuybackSale', () => {
  it('knows a sale to CC Livestock, however it is spelled', () => {
    expect(isBuybackSale({ buyer: BUYBACK_BUYER })).toBe(true);
    expect(['cc livestock', ' CamCow ', 'Cam Cow', 'ខេម ខោវ'].every(buyer => isBuybackSale({ buyer }))).toBe(true);
  });
  it('is false for any other buyer or none', () => {
    expect([isBuybackSale({ buyer: 'Local Market' }), isBuybackSale({ buyer: 'Sok Trader' }), isBuybackSale({})].every(x => x === false)).toBe(true);
  });
});
