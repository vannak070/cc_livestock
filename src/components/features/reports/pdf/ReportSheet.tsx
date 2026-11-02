'use client';

import React from 'react';
import type { ControlDashboard } from '@/lib/control-dashboard';
import type { FinanceBlock } from '@/lib/finance-report';
import { monthLabel, shownDay } from '@/lib/khmer-date';
import type { PackSection, ReportPack } from '@/lib/report-pack';
import type { BuyerAccount } from '@/lib/camcow-buyers';
import { HELD_ALERT_DAYS, heldLots, soldLots, summarizeStock, type Holding } from '@/lib/camcow-stock';
import { useText } from '@/hooks/useText';
import { BRAND_GREEN, BRAND_RED, BarChart, Cover, DataTable, Kpis, Messages, Note, PageHeader, Pill, Section, ShareBars, SubTitle, fmt, mil, pct } from './PdfParts';

interface Props {
  ordered: PackSection[];
  pack: ReportPack;
  dash: ControlDashboard | null;
  finance: FinanceBlock | null;
  /** The cattle CC Livestock holds after collecting them (the chosen farm's, or all). */
  holdings: Holding[];
  /** Each animal's share of the holding costs. */
  costOf?: Map<string, number>;
  /** What each buyer owes (all farms; empty when one farm is chosen). */
  buyers?: BuyerAccount[];
  farm: string;
  periodText: string;
  today: string;
  /** Translates stored values (Male, Good...) for the cattle shares. */
  value: (v: string) => string;
  /** A Farm Owner's own report: words say "your farm" instead of "the farms". */
  own?: boolean;
}

const ALERT_KEYS: Record<string, [string, string]> = {
  overdue: ['alOverdue', 'whOverdue'], due7: ['alDue7', 'whDue7'], cash: ['alCash', 'whCash'], missing: ['alMissing', 'whMissing'],
  unsold: ['alUnsold', 'whUnsold'], bank: ['alBank', 'whBank'], integrity: ['alIntegrity', 'whIntegrity'], tasks: ['alTasks', 'whTasks'],
};

/** The printed report: a cover, then each chosen section on its own landscape page(s), written like a financial report. */
export default function ReportSheet({ ordered, pack, dash, finance, holdings, costOf, buyers = [], farm, periodText, today, value, own = false }: Props) {
  const { tx, language } = useText('reportPdf');
  const cd = useText('controlDashboard');
  const ops = useText('opsTasks');
  const cs = useText('camcowStock');
  const day = (v?: string) => shownDay(v, language);
  const scope = `${farm || tx('allFarms')} · ${periodText}`;
  const header = <PageHeader title={tx('reportTitle')} scope={scope} />;
  const part = (s: PackSection) => tx(({ overview: 'secOverview', management: 'secManagement', stock: 'secStock', finance: 'secFinance', work: 'secWork', cattle: 'secCattle', money: 'secMoney' } as const)[s]);
  const o = pack.overview, c = pack.cattle, m = pack.money;
  const named = (rows: { label: string; count: number; pct: number }[]) => rows.map(r => ({ ...r, label: value(r.label) }));
  const monthShort = (k: string) => monthLabel(k, language);

  const section = (s: PackSection, no: number) => {
    const first = no === 1;
    const wrap = (note: string, body: React.ReactNode) => <Section key={s} no={no} first={first} title={part(s)} note={note} header={first ? undefined : header}>{body}</Section>;

    if (s === 'overview') {
      const net = finance?.cash.thisMonth?.net ?? 0;
      const lateTasks = dash?.plan?.byStatus.late ?? 0;
      const messages: { text: string; tone?: 'good' | 'bad' | 'warn' }[] = [];
      if (finance) {
        if (net !== 0) messages.push({ text: tx(net > 0 ? (own ? 'mgNetPaysOwn' : 'mgNetPays') : own ? 'mgNetReceivesOwn' : 'mgNetReceives', { amount: fmt(Math.abs(net)) }), tone: net > 0 ? 'good' : 'bad' });
        messages.push({ text: tx(own ? 'mgOwedOwn' : 'mgOwed', { amount: fmt(finance.loan.outstanding), interest: fmt(finance.loan.interestMonthly) }) });
        if (finance.loan.principalNext90 > 0) messages.push({ text: tx('mgPrincipal', { amount: fmt(finance.loan.principalNext90) }), tone: 'warn' });
      }
      if (o.profit !== null) messages.push({ text: tx(o.profit >= 0 ? 'mgProfit' : 'mgLoss', { amount: fmt(Math.abs(o.profit)), sales: fmt(o.salesAmount) }), tone: o.profit >= 0 ? 'good' : 'bad' });
      if (dash) {
        if (dash.inventory.overdue > 0) messages.push({ text: tx('mgOverdue', { n: fmt(dash.inventory.overdue) }), tone: 'bad' });
        if (dash.inventory.due7 > 0) messages.push({ text: tx('mgDue7', { n: fmt(dash.inventory.due7) }), tone: 'warn' });
        if (lateTasks > 0) messages.push({ text: tx('mgLate', { n: fmt(lateTasks) }), tone: 'bad' });
      }
      if (holdings.length > 0) { const hs = summarizeStock(holdings, today); if (hs.held > 0) messages.push({ text: tx('mgStock', { n: fmt(hs.held), cost: fmt(hs.heldCost), late: fmt(hs.heldTooLong) }), tone: hs.heldTooLong > 0 ? 'warn' : undefined }); }
      if (messages.length === 0) messages.push({ text: tx('mgClear'), tone: 'good' });
      const actions = (dash?.alerts ?? []).filter(a => a.level === 'red' || a.level === 'amber');
      return wrap(tx('noteOverview'), (
        <div className="space-y-5">
          <Kpis items={[
            { label: tx('oCattle'), value: fmt(o.head), sub: `${tx('oBatches')}: ${o.batches}` },
            { label: tx('oSold'), value: fmt(o.sold), sub: periodText },
            { label: tx('oSales'), value: mil(o.salesAmount), sub: tx('unitM') },
            { label: o.profit !== null && o.profit < 0 ? tx('oLoss') : tx('oProfit'), value: o.profit === null ? '—' : mil(o.profit), sub: tx('unitM'), tone: o.profit === null ? undefined : o.profit < 0 ? 'bad' : 'good' },
            { label: tx('kBuyOverdue'), value: fmt(dash?.inventory.overdue ?? 0), sub: `${tx('kDue7')}: ${fmt(dash?.inventory.due7 ?? 0)}`, tone: (dash?.inventory.overdue ?? 0) > 0 ? 'bad' : 'good' },
            { label: tx('kPlan'), value: dash?.plan ? `${dash.plan.completionPct}%` : '—', sub: `${tx('thLate')}: ${lateTasks}`, tone: lateTasks > 0 ? 'warn' : undefined },
          ]} />
          <Messages title={tx('mgTitle')} items={messages} />
          {actions.length > 0 && (
            <>
              <SubTitle>{tx('actionsTitle')}</SubTitle>
              <DataTable
                rows={actions}
                cols={[
                  { label: '#', width: '4%', cell: a => String(actions.indexOf(a) + 1) },
                  { label: tx('thStatus'), width: '9%', cell: a => <Pill tone={a.level === 'red' ? 'bad' : 'warn'}>{cd.tx(a.level)}</Pill> },
                  { label: tx('thItem'), cell: a => cd.tx(ALERT_KEYS[a.key][0]) },
                  { label: tx('thCount'), align: 'right', width: '9%', cell: a => (a.value === null ? '—' : fmt(a.value)), bold: true },
                  { label: tx('thWhere'), width: '34%', cell: a => <span style={{ color: '#64748b', fontWeight: 400 }}>{cd.tx(ALERT_KEYS[a.key][1])}</span> },
                ]}
              />
            </>
          )}
        </div>
      ));
    }

    if (s === 'finance') {
      if (!finance) return wrap(tx('noteFinance'), <p className="text-[13px]" style={{ color: '#64748b' }}>{tx('finNone')}</p>);
      const { loan, cash } = finance;
      const now = cash.thisMonth;
      const net = now?.net ?? 0;
      return wrap(tx('noteFinance'), (
        <div className="space-y-5">
          <SubTitle>{tx('finLoan')}</SubTitle>
          <Kpis items={[
            { label: tx('finDrawn'), value: mil(loan.drawn), sub: tx('unitM') }, { label: tx('finOutstanding'), value: mil(loan.outstanding), sub: tx('unitM') },
            { label: tx('finInterestMonth'), value: mil(loan.interestMonthly), sub: tx('unitM') }, { label: tx('finInterestToDate'), value: mil(loan.interestToDate), sub: tx('unitM') },
            { label: tx('finPrincipalNext'), value: mil(loan.principalNext90), sub: tx('unitM'), tone: loan.principalNext90 > 0 ? 'warn' : undefined },
          ]} />
          <SubTitle>{tx('finCash')}</SubTitle>
          <Kpis items={[
            { label: tx('finBought'), value: mil(now?.bought ?? 0), sub: tx('unitM') }, { label: tx('finSold'), value: mil(now?.sold ?? 0), sub: tx('unitM') },
            { label: tx('finNet'), value: mil(net), sub: net >= 0 ? tx(own ? 'netPaysOwn' : 'netPays') : tx(own ? 'netReceivesOwn' : 'netReceives'), tone: net > 0 ? 'good' : net < 0 ? 'bad' : undefined },
            { label: tx(own ? 'finBankPayOwn' : 'finBankPay'), value: mil((now?.interest ?? 0) + (now?.principal ?? 0)), sub: tx('unitM') },
          ]} />
          <div className="grid gap-4" style={{ gridTemplateColumns: '1.05fr 1fr' }}>
            <BarChart title={tx('finChart')} categories={cash.months.map(x => monthShort(x.month))} series={[{ name: tx('finBought'), color: BRAND_RED, values: cash.months.map(x => x.bought) }, { name: tx('finSold'), color: BRAND_GREEN, values: cash.months.map(x => x.sold) }]} />
            <DataTable
              rows={cash.months} highlight={r => r.month === finance.month}
              cols={[
                { label: tx('thMonth'), nowrap: true, cell: r => monthShort(r.month), total: tx('thTotal') },
                { label: tx('finBought'), align: 'right', cell: r => fmt(r.bought), total: fmt(cash.months.reduce((a, r) => a + r.bought, 0)) },
                { label: tx('finSold'), align: 'right', cell: r => fmt(r.sold), total: fmt(cash.months.reduce((a, r) => a + r.sold, 0)) },
                { label: tx('finNet'), align: 'right', cell: r => fmt(r.net), tone: r => (r.net > 0 ? 'good' : r.net < 0 ? 'bad' : undefined), total: fmt(cash.months.reduce((a, r) => a + r.net, 0)) },
                { label: tx(own ? 'finBankPayOwn' : 'finBankPay'), align: 'right', cell: r => fmt(r.interest + r.principal), total: fmt(cash.months.reduce((a, r) => a + r.interest + r.principal, 0)) },
              ]}
              totals
            />
          </div>
          <SubTitle>{tx('finByFarm')}</SubTitle>
          <DataTable
            rows={loan.farms} totals
            cols={[
              { label: tx('thFarm'), cell: f => f.farm, total: tx('thTotal') },
              { label: tx('finDrawn'), align: 'right', cell: f => (f.drawn ? fmt(f.drawn) : '—'), total: fmt(loan.drawn) },
              { label: tx('finOutstanding'), align: 'right', cell: f => (f.outstanding ? fmt(f.outstanding) : '—'), total: fmt(loan.outstanding) },
              { label: tx('finInterestMonth'), align: 'right', cell: f => fmt(f.interestMonthly), total: fmt(loan.interestMonthly) },
              { label: tx('finInterestToDate'), align: 'right', cell: f => (f.interestToDate ? fmt(f.interestToDate) : '—'), total: fmt(loan.interestToDate) },
              { label: tx('finRepays'), align: 'right', nowrap: true, cell: f => (f.principalMonth ? monthShort(f.principalMonth) : '—') },
            ]}
          />
          <Note>{tx('finNote')}</Note>
        </div>
      ));
    }

    if (s === 'money') {
      const t = m.totals;
      const marginOf = (sales: number, profit: number) => (sales > 0 ? pct((profit / sales) * 100) : '—');
      const costs = m.costs;
      return wrap(tx('noteMoney'), (
        <div className="space-y-5">
          <Kpis items={[
            { label: tx('mSales'), value: mil(t.sales), sub: tx('unitM') }, { label: tx('mCosts'), value: mil(costs), sub: tx('unitM') },
            { label: t.profit < 0 ? tx('oLoss') : tx('oProfit'), value: mil(t.profit), sub: tx('unitM'), tone: t.profit < 0 ? 'bad' : 'good' },
            { label: tx('thMargin'), value: marginOf(t.sales, t.profit), tone: t.profit < 0 ? 'bad' : 'good' }, { label: tx('mSold'), value: fmt(t.soldCount) },
          ]} />
          {m.months.length === 0 ? <p className="text-[13px]" style={{ color: '#64748b' }}>{tx('none')}</p> : (
            <>
              <div className="grid gap-4" style={{ gridTemplateColumns: '1.3fr 1fr' }}>
                <BarChart title={tx('mChart')} categories={m.months.map(x => monthShort(x.month))} series={[{ name: tx('mSales'), color: BRAND_GREEN, values: m.months.map(x => x.sales) }, { name: tx('mCosts'), color: BRAND_RED, values: m.months.map(x => x.cattleCost + x.medicine + x.feed + x.other) }]} />
                <div>
                  <DataTable
                    rows={[{ k: tx('mCattle'), v: t.cattleCost }, { k: tx('mFeed'), v: t.feed }, { k: tx('mMedicine'), v: t.medicine }, { k: tx('mRunning'), v: t.other }]} totals
                    cols={[
                      { label: tx('mWent'), cell: r => r.k, total: tx('thTotal') },
                      { label: '៛', align: 'right', cell: r => fmt(r.v), total: fmt(costs) },
                      { label: tx('thShare'), align: 'right', cell: r => (costs > 0 ? pct((r.v / costs) * 100) : '—'), total: costs > 0 ? '100%' : '—' },
                    ]}
                  />
                </div>
              </div>
              <SubTitle>{tx('mMonthly')}</SubTitle>
              <DataTable
                rows={m.months} totals
                cols={[
                  { label: tx('thMonth'), nowrap: true, cell: r => monthShort(r.month), total: tx('thTotal') },
                  { label: tx('mSold'), align: 'right', cell: r => fmt(r.soldCount), total: fmt(t.soldCount) },
                  { label: tx('thSales'), align: 'right', cell: r => fmt(r.sales), total: fmt(t.sales) },
                  { label: tx('mCattle'), align: 'right', cell: r => fmt(r.cattleCost), total: fmt(t.cattleCost) },
                  { label: tx('mFeed'), align: 'right', cell: r => fmt(r.feed), total: fmt(t.feed) },
                  { label: tx('mMedicine'), align: 'right', cell: r => fmt(r.medicine), total: fmt(t.medicine) },
                  { label: tx('mRunning'), align: 'right', cell: r => fmt(r.other), total: fmt(t.other) },
                  { label: tx('thTotalCosts'), align: 'right', cell: r => fmt(r.cattleCost + r.medicine + r.feed + r.other), total: fmt(costs) },
                  { label: tx('thProfit'), align: 'right', cell: r => fmt(r.profit), tone: r => (r.profit < 0 ? 'bad' : 'good'), total: fmt(t.profit), bold: true },
                  { label: tx('thMargin'), align: 'right', cell: r => marginOf(r.sales, r.profit), total: marginOf(t.sales, t.profit) },
                ]}
              />
            </>
          )}
        </div>
      ));
    }

    if (s === 'management') {
      if (!dash) return wrap(tx('noteInventory'), <p className="text-[13px]" style={{ color: '#64748b' }}>{tx('none')}</p>);
      const inv = dash.inventory, bb = dash.buyback;
      const farmers = dash.farmers.filter(f => f.withFarmer > 0 || f.remaining > 0 || f.overdue > 0);
      const bucket: Record<string, string> = { overdue: cd.tx('bucketOverdue'), d7: cd.tx('bucketD7'), d30: cd.tx('bucketD30'), d60: cd.tx('bucketD60'), later: cd.tx('bucketLater') };
      const alerts = dash.alerts.filter(a => a.level !== 'grey');
      return wrap(tx('noteInventory'), (
        <div className="space-y-5">
          <Kpis items={[
            { label: cd.tx('iWith'), value: fmt(inv.withFarmers) }, { label: cd.tx('iDelivered'), value: fmt(inv.delivered) }, { label: cd.tx('iBought'), value: fmt(inv.boughtBack) },
            { label: cd.tx('iOverdue'), value: fmt(inv.overdue), tone: inv.overdue > 0 ? 'bad' : 'good' }, { label: cd.tx('iDue7'), value: fmt(inv.due7), tone: inv.due7 > 0 ? 'warn' : undefined },
            { label: cd.tx('iDue30'), value: fmt(inv.due30) },
          ]} />
          <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div>
              <SubTitle>{cd.tx('gBuyback')}</SubTitle>
              <DataTable
                rows={[
                  { k: cd.tx('bOutstanding'), v: fmt(bb.outstandingHead) }, { k: cd.tx('bRemaining'), v: fmt(bb.remaining) }, { k: cd.tx('bContract'), v: fmt(bb.contractValue) },
                  { k: cd.tx('bNeed30'), v: fmt(bb.cash30Buybacks) }, { k: cd.tx('bNoPrice'), v: fmt(bb.noPriceHead) },
                ]}
                cols={[{ label: tx('thItem'), cell: r => r.k }, { label: tx('thValue'), align: 'right', cell: r => r.v, bold: true }]}
              />
            </div>
            <div>
              <SubTitle>{cd.tx('alertsTitle')}</SubTitle>
              <DataTable
                rows={alerts}
                cols={[
                  { label: tx('thStatus'), width: '16%', cell: a => <Pill tone={a.level === 'red' ? 'bad' : a.level === 'amber' ? 'warn' : 'good'}>{cd.tx(a.level)}</Pill> },
                  { label: tx('thItem'), cell: a => cd.tx(ALERT_KEYS[a.key][0]) },
                  { label: tx('thCount'), align: 'right', width: '12%', cell: a => (a.value === null ? '—' : fmt(a.value)), bold: true },
                ]}
              />
            </div>
          </div>
          <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <BarChart unit="" title={cd.tx('chMaturity')} categories={[cd.tx('bOverdue'), cd.tx('b7'), cd.tx('b30'), cd.tx('b60'), cd.tx('b60p')]} series={[{ name: cd.tx('chMaturity'), color: BRAND_GREEN, values: [dash.maturity.overdue, dash.maturity.d7, dash.maturity.d30, dash.maturity.d60, dash.maturity.later] }]} />
            <BarChart unit="" title={cd.tx('chMovement')} categories={dash.movement.map(x => `${x.month.slice(5)}/${x.month.slice(2, 4)}`)} series={[{ name: cd.tx('lDelivered'), color: BRAND_GREEN, values: dash.movement.map(x => x.delivered) }, { name: cd.tx('lBought'), color: '#2B6CB0', values: dash.movement.map(x => x.boughtBack) }]} />
          </div>
          <SubTitle>{cd.tx('tFarmers')}</SubTitle>
          <DataTable
            rows={farmers} totals
            cols={[
              { label: cd.tx('thName'), cell: f => f.name, total: tx('thTotal') },
              { label: cd.tx('thWith'), align: 'right', cell: f => fmt(f.withFarmer), total: fmt(farmers.reduce((a, f) => a + f.withFarmer, 0)) },
              { label: cd.tx('thBought'), align: 'right', cell: f => fmt(f.boughtBack), total: fmt(farmers.reduce((a, f) => a + f.boughtBack, 0)) },
              { label: cd.tx('thOverdue'), align: 'right', cell: f => fmt(f.overdue), tone: f => (f.overdue > 0 ? 'bad' : undefined), total: fmt(farmers.reduce((a, f) => a + f.overdue, 0)) },
              { label: cd.tx('thRemaining'), align: 'right', cell: f => (f.remaining ? fmt(f.remaining) : '—'), total: fmt(farmers.reduce((a, f) => a + f.remaining, 0)) },
            ]}
          />
          <SubTitle>{cd.tx('tUpcoming')}</SubTitle>
          <DataTable
            rows={dash.upcoming} empty={cd.tx('scrNextNone')}
            cols={[
              { label: cd.tx('thBatch'), cell: u => u.batch }, { label: cd.tx('thFarmer'), cell: u => u.farm }, { label: cd.tx('thDue'), cell: u => day(u.dueDate) },
              { label: cd.tx('thDays'), align: 'right', cell: u => (u.days === undefined ? '' : String(u.days)), tone: u => (u.bucket === 'overdue' ? 'bad' : undefined) },
              { label: cd.tx('thValue'), align: 'right', cell: u => (u.value !== undefined ? `${fmt(u.value)}${u.estimate ? ' *' : ''}` : '—') }, { label: cd.tx('thBucket'), cell: u => bucket[u.bucket] },
            ]}
          />
          <Note>* {cd.tx('estimate')}</Note>
        </div>
      ));
    }

    if (s === 'stock') {
      const st = summarizeStock(holdings, today);
      const month = today.slice(0, 7);
      const inMonth = summarizeStock(holdings, today, month, month, costOf);
      const lots = heldLots(holdings, today);
      const sold = soldLots(holdings);
      return wrap(tx('noteStock'), (
        <div className="space-y-5">
          <Kpis items={[
            { label: cs.tx('tInStock'), value: fmt(st.held), sub: `${fmt(Math.round(st.heldKg))} kg` },
            { label: cs.tx('tCost'), value: mil(st.heldCost), sub: tx('unitM') },
            { label: cs.tx('tDays'), value: String(st.avgDaysHeld), sub: st.held ? cs.tx('tDaysSub', { n: st.oldestDaysHeld }) : undefined },
            { label: cs.tx('tTooLong', { n: HELD_ALERT_DAYS }), value: fmt(st.heldTooLong), tone: st.heldTooLong > 0 ? 'warn' : 'good' },
            { label: cs.tx('tSold'), value: fmt(inMonth.sold), sub: mil(inMonth.soldRevenue) },
            { label: cs.tx('tMargin'), value: inMonth.sold ? mil(inMonth.marginAfterCosts) : '—', sub: inMonth.soldCost > 0 ? cs.tx('tMarginAfter', { cost: mil(inMonth.soldCost) }) : undefined, tone: inMonth.sold ? (inMonth.marginAfterCosts >= 0 ? 'good' : 'bad') : undefined },
          ]} />
          <SubTitle>{cs.tx('lotsTitle')}</SubTitle>
          <DataTable
            rows={lots} totals empty={cs.tx('lotsEmpty')}
            cols={[
              { label: cs.tx('colFarm'), cell: l => l.farm, total: tx('thTotal') },
              { label: cs.tx('colCollected'), nowrap: true, cell: l => day(l.collectedOn) },
              { label: cs.tx('colHead'), align: 'right', cell: l => fmt(l.head), total: fmt(lots.reduce((a, l) => a + l.head, 0)) },
              { label: cs.tx('colKg'), align: 'right', cell: l => fmt(l.kg), total: fmt(lots.reduce((a, l) => a + l.kg, 0)) },
              { label: cs.tx('colCost'), align: 'right', cell: l => fmt(l.cost), total: fmt(lots.reduce((a, l) => a + l.cost, 0)) },
              { label: cs.tx('colDays'), align: 'right', cell: l => String(l.daysHeld), tone: l => (l.daysHeld > HELD_ALERT_DAYS ? 'warn' : undefined) },
            ]}
          />
          <SubTitle>{cs.tx('soldTitle')}</SubTitle>
          <DataTable
            rows={sold.slice(0, 15)} totals empty={cs.tx('soldEmpty')}
            cols={[
              { label: cs.tx('colSoldOn'), nowrap: true, cell: l => day(l.soldOn), total: tx('thTotal') },
              { label: cs.tx('colBuyer'), cell: l => l.buyer }, { label: cs.tx('colFarm'), cell: l => l.farm },
              { label: cs.tx('colHead'), align: 'right', cell: l => fmt(l.head), total: fmt(sold.slice(0, 15).reduce((a, l) => a + l.head, 0)) },
              { label: cs.tx('colSale'), align: 'right', cell: l => fmt(l.total), total: fmt(sold.slice(0, 15).reduce((a, l) => a + l.total, 0)) },
              { label: cs.tx('colMargin'), align: 'right', cell: l => fmt(l.margin), tone: l => (l.margin < 0 ? 'bad' : 'good'), total: fmt(sold.slice(0, 15).reduce((a, l) => a + l.margin, 0)) },
            ]}
          />
          {buyers.some(b => b.sold > 0) && (
            <>
              <SubTitle>{cs.tx('buyersTitle')}</SubTitle>
              <DataTable
                rows={buyers.filter(b => b.sold > 0)} totals
                cols={[
                  { label: cs.tx('colBuyer'), cell: b => b.buyer.name, total: tx('thTotal') },
                  { label: cs.tx('colHead'), align: 'right', cell: b => fmt(b.head), total: fmt(buyers.reduce((a, b) => a + b.head, 0)) },
                  { label: cs.tx('colSale'), align: 'right', cell: b => fmt(b.sold), total: fmt(buyers.reduce((a, b) => a + b.sold, 0)) },
                  { label: cs.tx('colKg'), align: 'right', cell: b => fmt(Math.round(b.kg)), total: fmt(Math.round(buyers.reduce((a, b) => a + b.kg, 0))) },
                  { label: cs.tx('colPerKg'), align: 'right', cell: b => fmt(b.perKg) },
                  { label: cs.tx('colMargin'), align: 'right', cell: b => fmt(b.margin), tone: b => (b.margin < 0 ? 'bad' : 'good'), total: fmt(buyers.reduce((a, b) => a + b.margin, 0)) },
                ]}
              />
            </>
          )}
          {sold.length > 15 && <Note>{cs.tx('more', { n: 15, total: sold.length })}</Note>}
          {st.lost > 0 && <Note>{cs.tx('tLost')}: {st.lost} · {cs.tx('tLostSub', { cost: mil(st.lostCost) })}</Note>}
          <Note>{cs.tx('note')}</Note>
        </div>
      ));
    }

    if (s === 'work') {
      const p = dash?.plan;
      if (!p) return wrap(tx('noteAction'), <p className="text-[13px]" style={{ color: '#64748b' }}>{tx('workNone')}</p>);
      const kinds = (['sell_to_farm', 'buy_back'] as const).map(k => ({ k, t: p.byKind[k] }));
      return wrap(tx('noteAction'), (
        <div className="space-y-5">
          <Kpis items={[
            { label: cd.tx('pTasks'), value: fmt(p.tasks) }, { label: cd.tx('pDone'), value: `${p.completionPct}%`, tone: p.completionPct >= 90 ? 'good' : 'warn' },
            { label: cd.tx('pLate'), value: fmt(p.byStatus.late), tone: p.byStatus.late > 0 ? 'bad' : 'good' }, { label: cd.tx('pDueSoon'), value: fmt(p.byStatus.due_soon), tone: p.byStatus.due_soon > 0 ? 'warn' : undefined },
            { label: cd.tx('pDelayed'), value: fmt(p.delayed) }, { label: cd.tx('pSwaps'), value: fmt(p.swapsOpen) },
          ]} />
          <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <DataTable
              rows={kinds}
              cols={[
                { label: cd.tx('pKind'), cell: r => ops.tx(`kind_${r.k}`) },
                { label: cd.tx('pKindTasks'), align: 'right', cell: r => `${r.t.done} / ${r.t.tasks}` },
                { label: cd.tx('pKindHead'), align: 'right', cell: r => `${fmt(r.t.doneHead)} / ${fmt(r.t.plannedHead)}` },
                { label: cd.tx('pKindLate'), align: 'right', cell: r => fmt(r.t.late), tone: r => (r.t.late > 0 ? 'bad' : undefined) },
              ]}
            />
            <DataTable
              rows={[{ k: cd.tx('pOut30'), v: p.cashOut30 }, { k: cd.tx('pIn30'), v: p.cashIn30 }]}
              cols={[{ label: tx('thItem'), cell: r => r.k }, { label: '៛', align: 'right', cell: r => fmt(r.v), bold: true }]}
            />
          </div>
          <SubTitle>{cd.tx('pLateTitle')}</SubTitle>
          <DataTable
            rows={p.late} empty={cd.tx('pLateNone')}
            cols={[
              { label: tx('thFarm'), cell: l => l.farm }, { label: cd.tx('pKind'), cell: l => ops.tx(`kind_${l.kind}`) }, { label: tx('thDueDay'), cell: l => day(l.dueDate) },
              { label: tx('thDaysLate'), align: 'right', cell: l => String(l.daysLate), tone: () => 'bad' }, { label: tx('thOwner'), cell: l => l.owner || '—' },
            ]}
          />
          <SubTitle>{tx('apNext')}</SubTitle>
          <DataTable
            rows={p.next} empty={cd.tx('scrNextNone')}
            cols={[
              { label: tx('thFarm'), cell: n => n.farm }, { label: cd.tx('pKind'), cell: n => ops.tx(`kind_${n.kind}`) }, { label: tx('thDueDay'), cell: n => day(n.dueDate) },
              { label: cd.tx('thDays'), align: 'right', cell: n => String(n.days), tone: n => (n.late ? 'bad' : undefined) },
              { label: tx('thCattle'), align: 'right', cell: n => (n.head ? fmt(n.head) : '—') }, { label: cd.tx('thValue'), align: 'right', cell: n => (n.value ? fmt(n.value) : '—') },
            ]}
          />
        </div>
      ));
    }

    // Herd and health
    const heads = c.byFarm.reduce((a, f) => a + f.head, 0);
    const recentBatches = [...c.batches].sort((a, b) => b.startDate.localeCompare(a.startDate)).slice(0, 10);
    return wrap(tx('noteHerd'), (
      <div className="space-y-5">
        <Kpis items={[
          { label: tx('oCattle'), value: fmt(c.head) }, { label: tx('cAvg'), value: c.head ? `${Math.round(c.avgWeight)} kg` : '—' }, { label: tx('cCost'), value: mil(c.cost), sub: tx('unitM') },
          { label: tx('cLost'), value: fmt(c.dead), tone: c.dead > 0 ? 'bad' : 'good' }, { label: tx('oSick'), value: fmt(o.sick), tone: o.sick > 0 ? 'warn' : 'good' },
        ]} />
        <div className="grid grid-cols-3 gap-4">
          <ShareBars title={tx('cBreed')} rows={c.breeds} /><ShareBars title={tx('cSex')} rows={named(c.sexes)} /><ShareBars title={tx('cHealth')} rows={named(c.health)} />
        </div>
        {!farm && c.byFarm.length > 0 && (
          <>
            <SubTitle>{tx('cByFarm')}</SubTitle>
            <DataTable
              rows={c.byFarm} totals
              cols={[
                { label: tx('thFarm'), cell: f => f.name, total: tx('thTotal') },
                { label: tx('thCattle'), align: 'right', cell: f => fmt(f.head), total: fmt(heads) },
                { label: tx('thAvg'), align: 'right', cell: f => fmt(f.avg), total: c.head ? fmt(c.avgWeight) : '—' },
              ]}
            />
          </>
        )}
        <SubTitle>{tx('cBatches')}</SubTitle>
        <DataTable
          rows={recentBatches} empty={tx('none')}
          cols={[
            { label: tx('thBatch'), cell: b => b.name }, { label: tx('thFarm'), cell: b => b.farm }, { label: tx('thStarted'), nowrap: true, cell: b => day(b.startDate) },
            { label: tx('thCattle'), align: 'right', cell: b => fmt(b.head) }, { label: tx('thAvg'), align: 'right', cell: b => (b.head ? fmt(b.avgWeight) : '—') },
          ]}
        />
        {c.batches.length > recentBatches.length && <Note>{tx('batchesTrimmed', { n: recentBatches.length, total: c.batches.length })}</Note>}
      </div>
    ));
  };

  return (
    <div className="bg-white text-ink" style={{ fontSize: 13 }}>
      {header}
      <Cover title={tx('coverTitle')} rows={[[tx('metaFarm'), farm || tx('allFarms')], [tx('metaPeriod'), periodText], [tx('metaDate'), day(today)]]} />
      {ordered.map((s, i) => section(s, i + 1))}
      <Note>{tx('basisBody')} {tx('generated', { date: day(today) })}</Note>
    </div>
  );
}
