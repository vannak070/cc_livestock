import { describe, expect, it } from 'vitest';
import { DEFAULT_ASSUMPTIONS, addMonths, bankSchedule, ccTrades, defaultTerms, herdPlan, parseLoanAssumptions, parseLoanTerms, simulateLoan } from './farm-loan';
import type { FarmLoanAssumptions, FarmLoanTerms } from './types';

// Cattle-only loans keep the numbers simple; "cattle, feed and interest" has its own tests.
const terms: FarmLoanTerms = { ...defaultTerms('2026-01'), bank: 'Bank', annualRatePct: 12, loanCovers: 'cattle' };
const a: FarmLoanAssumptions = { ...DEFAULT_ASSUMPTIONS, herdTarget: 100, fatteningDays: 120, initialWeightKg: 300, dailyGainKg: 1, buyPricePerKgKhr: 10000, sellPricePerKgKhr: 12000, feedCostPerHeadDayKhr: 5000, lastBuyMonth: 9 };

describe('addMonths', () => {
  it('moves across years both ways', () => {
    expect(addMonths('2026-11', 3)).toBe('2027-02');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2026-01', 23)).toBe('2027-12');
  });
});

describe('simulateLoan', () => {
  const plan = simulateLoan(terms, a);
  const m = (i: number) => plan.months[i - 1];

  it('runs two loan years when the loan renews', () => {
    expect(plan.months).toHaveLength(24);
    expect(m(1).month).toBe('2026-01');
    expect(m(13)).toMatchObject({ month: '2027-01', year: 2, monthInYear: 1 });
    expect(simulateLoan({ ...terms, autoRenew: false }, a).months).toHaveLength(12);
  });

  it('monthly trade: stocks up 25 a month, then every month sells what is ready and replaces it, all year', () => {
    expect(plan.fatteningMonths).toBe(4);
    expect(plan.headPerMonth).toBe(25);
    expect(plan.months.slice(0, 12).map(x => x.headBought)).toEqual(Array(12).fill(25));
    expect(plan.months.slice(0, 12).map(x => x.headSold)).toEqual([0, 0, 0, 25, 25, 25, 25, 25, 25, 25, 25, 25]);
    // The herd stays full from month 4, into year 2.
    expect(plan.months.slice(3, 24).every(x => x.headDays === 100 * 30)).toBe(true);
    // Each animal: 300 kg × 10,000 to buy; 420 kg × 12,000 when sold.
    expect(m(1).purchaseKhr).toBe(25 * 3_000_000);
    expect(m(4).salesKhr).toBe(25 * 420 * 12000);
  });

  it('pays the loan out once in month 1 (the cattle until the first sale), charges interest on it, and repays 20/30/50%', () => {
    // 100 cattle are bought before the first sale (25 a month, months 1-4) at 3,000,000 each; later ones are paid from sales.
    expect(m(1)).toMatchObject({ drawKhr: 300_000_000, interestKhr: 3_000_000 });
    expect(plan.months.slice(1, 12).every(x => x.drawKhr === 0)).toBe(true);
    expect(m(8).principalKhr).toBe(60_000_000);
    expect(m(8).principalKhr + m(11).principalKhr).toBe(150_000_000);
    expect(m(12).balanceKhr).toBe(0);
    expect(plan.years[0].principalKhr).toBe(plan.years[0].drawnKhr);
  });

  it('uses the agreed amount when one is typed', () => {
    const fixed = simulateLoan({ ...terms, loanAmountKhr: 300_000_000 }, a);
    expect(fixed.months[0].drawKhr).toBe(300_000_000);
    expect(fixed.months[7].principalKhr).toBe(60_000_000);
  });

  it('monthly trade carries the herd into year 2; everything left is sold at the end of the plan', () => {
    expect(m(12).headEnd).toBe(75);
    expect(m(24).headEnd).toBe(0);
    expect(m(24).headSold).toBe(100);
    // Without renewal the plan ends in month 12, so the herd is sold then.
    const one = simulateLoan({ ...terms, autoRenew: false }, a);
    expect(one.months[11]).toMatchObject({ headSold: 100, headEnd: 0 });
  });

  it('with "cattle, feed and interest" the one payout covers the first cattle, a year of feed and the year\'s interest', () => {
    const all = simulateLoan({ ...terms, loanCovers: 'all' }, a);
    // New plans cover the cattle plus the feed and interest of the months before the first sale ("start").
    expect(defaultTerms().loanCovers).toBe('start');
    // 100 cattle are stocked over the first 4 months, before the first sale (300M), plus a year of feed,
    // plus the interest on the loan itself: 1% a month on what is owed, 10.9 months' worth with 20/30/50%.
    const payout = (300_000_000 + all.years[0].feedKhr) / (1 - 0.01 * 10.9);
    expect(all.months[0].drawKhr).toBe(Math.round(payout));
    expect(Math.abs(all.years[0].interestKhr - (payout - 300_000_000 - all.years[0].feedKhr))).toBeLessThan(20);
    expect(all.years[0]).toMatchObject({ startCattleKhr: 300_000_000 });
    expect(all.years[0].loanParts).toMatchObject({ cattleKhr: 300_000_000, interestMonths: 12 });
    // Feed and interest are paid from the fund until the first sale: the farm needs no money of its own.
    expect(all.months.slice(0, 4).every(x => x.cashKhr >= 0)).toBe(true);
    expect(simulateLoan(terms, a).months[0].drawKhr).toBe(300_000_000); // cattle only
  });

  it('with "start" the loan covers the cattle plus the feed and interest of the months before the first sale (no trade income yet)', () => {
    const start = simulateLoan({ ...terms, loanCovers: 'start' }, a);
    // 120 days = 4 months: the first cattle are sold at the end of month 4. Herd on the farm: 25, 50, 75, 100 head.
    const feedFirst4 = (25 + 50 + 75 + 100) * 30 * 5000;
    // Nothing is repaid before month 8, so the whole payout is owed for those 4 months: P = base / (1 − 4 × 1%).
    const payout = (300_000_000 + feedFirst4) / (1 - 0.01 * 4);
    expect(start.months[0].drawKhr).toBe(Math.round(payout));
    expect(start.years[0].noTradeMonths).toBe(4);
    expect(start.years[0].loanParts).toEqual({ cattleKhr: 300_000_000, feedKhr: feedFirst4, interestKhr: Math.round(payout - 300_000_000 - feedFirst4), interestMonths: 4 });
    // The interest of those 4 months is exactly what the fund holds for it.
    const firstFour = start.months.slice(0, 4).reduce((s, x) => s + x.interestKhr, 0);
    expect(Math.abs(firstFour - start.years[0].loanParts!.interestKhr)).toBeLessThan(5);
    // The farm needs no money of its own in those months; later feed and interest come from the monthly sales.
    expect(start.months.slice(0, 4).every(x => x.cashKhr >= 0)).toBe(true);
    // It is more than cattle only, and less than covering a whole year.
    const cattleOnly = simulateLoan(terms, a).months[0].drawKhr;
    const all = simulateLoan({ ...terms, loanCovers: 'all' }, a).months[0].drawKhr;
    expect(start.months[0].drawKhr).toBeGreaterThan(cattleOnly);
    expect(start.months[0].drawKhr).toBeLessThan(all);
  });

  it('checks what the loan covers', () => {
    expect(parseLoanTerms({ ...terms, loanCovers: 'all' })).toMatchObject({ loanCovers: 'all' });
    expect(parseLoanTerms({ ...terms, loanCovers: 'start' })).toMatchObject({ loanCovers: 'start' });
    expect(parseLoanTerms({ ...terms, loanCovers: 'cattle' })).not.toHaveProperty('loanCovers');
    expect(parseLoanTerms({ ...terms, loanCovers: 'cows' })).toMatch(/what the loan covers/);
  });

  it('starts again in year 2 (refinance) and repays it by month 24', () => {
    // The old loan is repaid on renewal day, so the new one carries the 75 head still standing (225M) plus the first replacement before a sale (75M).
    expect(m(13)).toMatchObject({ headBought: 25, drawKhr: 300_000_000 });
    expect(m(24).balanceKhr).toBe(0);
    expect(plan.endBalanceKhr).toBe(0);
  });

  it('does not run the farm out of cash after renewal: year 2 carries the cattle already standing', () => {
    const start = simulateLoan({ ...terms, loanCovers: 'start', repayments: [{ pct: 100, month: 12 }] }, a);
    const oneYear = simulateLoan({ ...terms, loanCovers: 'start', repayments: [{ pct: 100, month: 12 }], autoRenew: false }, a);
    expect(start.months[12].drawKhr).toBeGreaterThan(oneYear.months[0].drawKhr * 0.9); // about as big as the first year's loan, not a tenth of it
    expect(start.shortMonths.filter(x => x > '2027-01')).toEqual([]);
  });

  it('shows how much own money the farm needs, and none once it has that much', () => {
    // With a small loan the farm must find money for the cattle itself.
    const small = simulateLoan({ ...terms, loanAmountKhr: 50_000_000 }, a);
    expect(small.months[0].cashKhr).toBeLessThan(0);
    expect(small.moneyNeededKhr).toBe(-small.lowestCashKhr);
    expect(small.shortMonths).toContain('2026-01');
    expect(simulateLoan({ ...terms, loanAmountKhr: 50_000_000 }, { ...a, openingCashKhr: small.moneyNeededKhr }).shortMonths).toEqual([]);
  });

  it('keeps under the credit limit and lets the farm pay the rest', () => {
    const capped = simulateLoan({ ...terms, creditLimitKhr: 100_000_000 }, a);
    expect(Math.max(...capped.months.map(x => x.balanceKhr))).toBeLessThanOrEqual(100_000_000);
    expect(capped.months[0].drawKhr).toBe(100_000_000);
  });

  it('carries what is not repaid when the shares add up to less than 100%', () => {
    const part = simulateLoan({ ...terms, autoRenew: false, repayments: [{ month: 12, pct: 50 }] }, a);
    expect(part.endBalanceKhr).toBeGreaterThan(0);
  });
});

describe('parse', () => {
  it('accepts the defaults and refuses bad terms', () => {
    expect(parseLoanTerms(terms)).toMatchObject({ repayments: [{ month: 8, pct: 20 }, { month: 11, pct: 30 }, { month: 12, pct: 50 }] });
    expect(parseLoanTerms({ ...terms, startMonth: '2026-13' })).toMatch(/month the loan starts/);
    expect(parseLoanTerms({ ...terms, loanAmountKhr: 500_000_000 })).toMatchObject({ loanAmountKhr: 500_000_000 });
    expect(parseLoanTerms({ ...terms, loanAmountKhr: 0 })).not.toHaveProperty('loanAmountKhr');
    expect(parseLoanTerms({ ...terms, loanAmountKhr: NaN })).toMatch(/loan amount/);
    expect(parseLoanTerms({ ...terms, repayments: [{ month: 8, pct: 60 }, { month: 12, pct: 50 }] })).toMatch(/more than 100/);
    expect(parseLoanTerms({ ...terms, repayments: [{ month: 8, pct: 20 }, { month: 8, pct: 20 }] })).toMatch(/twice/);
    expect(parseLoanTerms({ ...terms, annualRatePct: -1 })).toMatch(/interest/);
    expect(parseLoanAssumptions(a)).toEqual({ ...a, buyPlan: 'monthly' });
    expect(parseLoanAssumptions({ ...a, herdTarget: 0 })).toMatch(/how many cattle/);
    expect(parseLoanAssumptions({ ...a, lastBuyMonth: 13 })).toMatch(/last month/);
  });
});

describe('bankSchedule', () => {
  const plan = simulateLoan(terms, a);
  const { rows, years } = bankSchedule(plan);

  it('lists every month with interest, principal and the total paid to the bank', () => {
    expect(rows).toHaveLength(24);
    expect(rows[0]).toMatchObject({ openingKhr: 0, drawKhr: 300_000_000, interestKhr: 3_000_000, principalKhr: 0, totalKhr: 3_000_000, closingKhr: 300_000_000 });
    expect(rows[1].openingKhr).toBe(rows[0].closingKhr);
    for (const r of rows) expect(r.totalKhr).toBe(r.interestKhr + r.principalKhr);
  });

  it('the farm pays the bank all of it: interest every month, principal in the repayment months', () => {
    expect(rows[7]).toMatchObject({ principalKhr: 60_000_000, totalKhr: 60_000_000 + rows[7].interestKhr });
    expect(rows[0]).not.toHaveProperty('paidByCcKhr');
  });

  it('shows the farm cash left after each payment', () => {
    rows.forEach((r, i) => expect(r.cashAfterKhr).toBe(plan.months[i].cashKhr));
  });

  it('adds up the whole plan as well as each year', () => {
    const { total } = bankSchedule(plan);
    expect(total.totalKhr).toBe(years[0].totalKhr + years[1].totalKhr);
    expect(total.interestKhr).toBe(rows.reduce((s, r) => s + r.interestKhr, 0));
  });

  it('adds up each year: everything drawn is repaid', () => {
    expect(years.map(y => y.year)).toEqual([1, 2]);
    expect(years[0].principalKhr).toBe(years[0].drawKhr);
    expect(years[0].totalKhr).toBe(years[0].interestKhr + years[0].principalKhr);
  });
});

describe('feed by kind in a loan plan', () => {
  const lines = [{ productId: 'DSR', name: 'DSR-16 Cow Feed', kgPerHeadDay: 6, pricePerKgKhr: 1367 }, { name: 'Rice straw', kgPerHeadDay: 3, pricePerKgKhr: 150 }];
  it('works out the feed cost a day from the lines', () => {
    const parsed = parseLoanAssumptions({ ...a, feedCostPerHeadDayKhr: 1, feedLines: lines });
    expect(typeof parsed).not.toBe('string');
    expect((parsed as FarmLoanAssumptions).feedCostPerHeadDayKhr).toBe(6 * 1367 + 3 * 150);
    expect((parsed as FarmLoanAssumptions).feedLines).toEqual(lines);
  });
  it('refuses a line without kg', () => {
    expect(parseLoanAssumptions({ ...a, feedLines: [{ name: 'Silage', kgPerHeadDay: NaN, pricePerKgKhr: 250 }] })).toMatch(/kg each animal eats of Silage/);
  });
  it('counts animal-days so yearly feed needs can be worked out', () => {
    const plan = simulateLoan(terms, a);
    expect(plan.years[0].headDays).toBe(plan.months.filter(m => m.year === 1).reduce((s, m) => s + m.headDays, 0));
    expect(plan.years[0].feedKhr).toBe(plan.years[0].headDays * a.feedCostPerHeadDayKhr);
  });
});

describe('how the cattle are bought: only the monthly trade', () => {
  const head = (p: ReturnType<typeof simulateLoan>) => p.months.slice(0, 12).map(x => x.headDays / 30);
  it('stocks up a share a month, then sells the finished cattle and replaces them the same day, so the herd stays full', () => {
    const p = simulateLoan(terms, a);
    // 120 days = 4 months: 25 head a month for 4 months, then 25 sold and 25 bought every month.
    expect(head(p)).toEqual([25, 50, 75, 100, 100, 100, 100, 100, 100, 100, 100, 100]);
    expect(p.months.slice(0, 6).map(x => x.headBought)).toEqual([25, 25, 25, 25, 25, 25]);
    expect(p.months.slice(0, 6).map(x => x.headSold)).toEqual([0, 0, 0, 25, 25, 25]);
    expect(p.months[3].salesKhr).toBe(25 * (300 + 120) * 12000);
  });
  it('every sale goes to CC Livestock, which pays the farm in full; the farm buys new cattle and feed from it', () => {
    const p = simulateLoan(terms, a);
    const t = ccTrades(p);
    expect(p.months.every(x => x.buybackKhr === x.salesKhr)).toBe(true);
    // From month 4 the sale and the replacement happen on the same day.
    expect(t.rows.slice(0, 12).map(r => r.swap)).toEqual([false, false, false, true, true, true, true, true, true, true, true, true]);
    expect(t.rows.find(r => r.year === 1 && r.monthInYear === 8)).toMatchObject({ headSold: 25, headBought: 25, feedKhr: 100 * 30 * 5000 });
  });
  it('adds up the year totals of the trades the same way as the loan table, so the two tabs agree', () => {
    const p = simulateLoan(terms, a);
    const t = ccTrades(p);
    for (const y of t.years) {
      const ms = p.months.filter(x => x.year === y.year);
      expect(y.headBought).toBe(ms.reduce((s, x) => s + x.headBought, 0));
      expect(y.purchaseKhr).toBe(ms.reduce((s, x) => s + x.purchaseKhr, 0));
      expect(y.saleKhr).toBe(ms.reduce((s, x) => s + x.buybackKhr, 0));
    }
    // The restock on the last day of year 1 is shown on the month-12 row (sameDayHead) but the year total follows the loan table.
    expect(t.rows.find(r => r.year === 1 && r.monthInYear === 12)!.sameDayHead).toBe(25);
    expect(t.years[0].headBought).toBe(300);
  });
  it('reads any other choice a saved plan may hold (once, rounds, split) as the monthly trade', () => {
    const monthly = herdPlan(a, 1);
    for (const old of ['once', 'rounds', 'split'] as const) {
      expect(herdPlan({ ...a, buyPlan: old } as unknown as FarmLoanAssumptions, 1)).toEqual(monthly);
    }
    expect(parseLoanAssumptions({ ...a, buyPlan: 'rounds' })).toMatchObject({ buyPlan: 'monthly' });
    expect(parseLoanAssumptions({ ...a })).toMatchObject({ buyPlan: 'monthly' });
  });
});

