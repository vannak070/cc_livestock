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
    const all = simulateLoan({ ...terms, loanCovers: 'all' }, { ...a, buyPlan: 'rounds' });
    expect(defaultTerms().loanCovers).toBe('all');
    // 100 cattle before the first sale (300M) + a year of feed for 100 head (100 × 360 × 5,000 = 180M) = 480M,
    // plus the interest on the loan itself: 1% a month on what is owed, 10.9 months' worth with 20/30/50%.
    const payout = 480_000_000 / (1 - 0.01 * 10.9);
    expect(all.months[0].drawKhr).toBe(Math.round(payout));
    expect(Math.abs(all.years[0].interestKhr - (payout - 480_000_000))).toBeLessThan(20);
    expect(all.years[0]).toMatchObject({ startCattleKhr: 300_000_000, feedKhr: 180_000_000 });
    // Feed and interest are paid from the fund until the first sale: the farm needs no money of its own.
    expect(all.months.slice(0, 4).every(x => x.cashKhr >= 0)).toBe(true);
    expect(simulateLoan(terms, { ...a, buyPlan: 'rounds' }).months[0].drawKhr).toBe(300_000_000); // cattle only
  });

  it('checks what the loan covers', () => {
    expect(parseLoanTerms({ ...terms, loanCovers: 'all' })).toMatchObject({ loanCovers: 'all' });
    expect(parseLoanTerms({ ...terms, loanCovers: 'cattle' })).not.toHaveProperty('loanCovers');
    expect(parseLoanTerms({ ...terms, loanCovers: 'cows' })).toMatch(/what the loan covers/);
  });

  it('starts again in year 2 (refinance) and repays it by month 24', () => {
    // The herd is already on the farm, so year 2 only lends for the first replacement before a sale.
    expect(m(13)).toMatchObject({ headBought: 25, drawKhr: 75_000_000 });
    expect(m(24).balanceKhr).toBe(0);
    expect(plan.endBalanceKhr).toBe(0);
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
    expect(parseLoanAssumptions(a)).toEqual(a);
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

describe('how the cattle are bought', () => {
  const head = (p: ReturnType<typeof simulateLoan>) => p.months.slice(0, 12).map(x => x.headDays / 30);
  it('once: the whole herd in month 1, kept and sold to CC Livestock in month 12', () => {
    const p = simulateLoan(terms, { ...a, buyPlan: 'once' });
    expect(p.months[0].headBought).toBe(100);
    expect(head(p)).toEqual(Array(12).fill(100));
    expect(p.months[11]).toMatchObject({ headSold: 100, buybackKhr: 100 * (300 + 1 * 360) * 12000 });
    expect(p.months[0].drawKhr).toBe(300_000_000); // one payout for the 100 cattle
  });
  it('rounds: swapped with CC Livestock each time fattening ends, so the herd stays full', () => {
    const p = simulateLoan(terms, { ...a, buyPlan: 'rounds' });
    expect(head(p)).toEqual(Array(12).fill(100));
    // 120 days = 4 months: three rounds, bought in months 1, 5, 9 and sold in months 4, 8, 12.
    expect(p.months.slice(0, 12).map(x => x.headBought)).toEqual([100, 0, 0, 0, 100, 0, 0, 0, 100, 0, 0, 0]);
    expect(p.months.slice(0, 12).map(x => x.headSold)).toEqual([0, 0, 0, 100, 0, 0, 0, 100, 0, 0, 0, 100]);
    expect(p.months[3].salesKhr).toBe(100 * (300 + 120) * 12000);
    expect(p.months[11].salesKhr).toBe(100 * (300 + 120) * 12000);
    expect(p.months[0].drawKhr).toBe(300_000_000); // the first herd; the next ones are paid from the sales
  });
  it('rounds: a short leftover makes the last round longer, a long one makes one more round', () => {
    const lengths = (days: number) => herdPlan({ ...a, buyPlan: 'rounds', fatteningDays: days }, 1).map(c => c.sellAt - c.bought + 1);
    expect(lengths(150)).toEqual([5, 7]); // 2 months left over: the second round runs to month 12
    expect(lengths(210)).toEqual([7, 5]); // 5 months left over: one more, shorter round
    expect(lengths(180)).toEqual([6, 6]);
    expect(lengths(400)).toEqual([12]);
  });
  it('every sale goes to CC Livestock, which pays the farm in full; the farm buys new cattle and feed from it', () => {
    const p = simulateLoan(terms, { ...a, buyPlan: 'rounds' });
    const t = ccTrades(p);
    // Every month has feed. Months 4, 8 and 12 are swaps: sold, and the new herd taken the same day (shown on the sale month;
    // month 12's new herd is the one for the renewed year).
    expect(t.rows.slice(0, 12).map(r => r.swap)).toEqual([false, false, false, true, false, false, false, true, false, false, false, true]);
    expect(t.rows.slice(0, 13).map(r => r.headBought)).toEqual([100, 0, 0, 100, 0, 0, 0, 100, 0, 0, 0, 100, 0]);
    const m8 = t.rows.find(r => r.year === 1 && r.monthInYear === 8)!;
    expect(m8).toMatchObject({ headSold: 100, saleKhr: 504_000_000, headBought: 100, purchaseKhr: 300_000_000, feedKhr: 100 * 30 * 5000 });
    expect(t.years[0]).toMatchObject({ headSold: 300, headBought: 400, purchaseKhr: 1_200_000_000, feedKhr: 180_000_000 });
  });
  it('two purchases: part in month 1, the rest later, all kept to month 12', () => {
    const p = simulateLoan(terms, { ...a, buyPlan: 'split', firstBuyPct: 50, secondBuyMonth: 4 });
    expect(head(p)).toEqual([50, 50, 50, 100, 100, 100, 100, 100, 100, 100, 100, 100]);
    expect(p.months[11].headSold).toBe(100);
    expect(herdPlan({ ...a, buyPlan: 'split', firstBuyPct: 50, secondBuyMonth: 4 }, 1).map(c => c.days)).toEqual([360, 270]);
  });
  it('checks the buying plan', () => {
    expect(parseLoanAssumptions({ ...a, buyPlan: 'weekly' })).toMatch(/how the cattle are bought/);
    expect(parseLoanAssumptions({ ...a, buyPlan: 'split', firstBuyPct: 50, secondBuyMonth: 1 })).toMatch(/second purchase/);
    expect(parseLoanAssumptions({ ...a, buyPlan: 'split', firstBuyPct: 60, secondBuyMonth: 3 })).toMatchObject({ buyPlan: 'split', firstBuyPct: 60, secondBuyMonth: 3 });
  });
});

