'use client';

import React, { useMemo, useState } from 'react';
import { ArrowLeft, Database, Download, Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { Input } from '@/components/ui/input';
import type { ERPLivestockData, FarmItem, FarmLoanAssumptions, FarmLoanRecord, FarmLoanTerms, LoanRepayment } from '@/lib/types';
import { DEFAULT_ASSUMPTIONS, bankSchedule, defaultTerms, farmActuals, fatteningMonthsFor, simulateLoan } from '@/lib/farm-loan';
import { exportToExcel } from '@/lib/excel-export';
import { getErrorMessage } from '@/lib/utils';
import { NUM } from '../flow/FlowShell';

interface FarmLoanEditorProps {
  farm: FarmItem;
  loan?: FarmLoanRecord;
  data: ERPLivestockData;
  onBack: () => void;
  onSave: (terms: FarmLoanTerms, assumptions: FarmLoanAssumptions, notes: string) => Promise<void>;
  onDelete: () => Promise<void>;
}

type AKey = keyof FarmLoanAssumptions;
const CATTLE_FIELDS: { key: AKey; label: string; unit: string; step?: string }[] = [
  { key: 'herdTarget', label: 'Cattle to keep on the farm', unit: 'head' },
  { key: 'initialWeightKg', label: 'Weight when bought', unit: 'kg' },
  { key: 'dailyGainKg', label: 'Gain each day', unit: 'kg', step: '0.05' },
  { key: 'fatteningDays', label: 'Days fattening each animal', unit: 'days' },
  { key: 'buyPricePerKgKhr', label: 'Buy price for each kg', unit: '៛' },
  { key: 'sellPricePerKgKhr', label: 'Sell price for each kg', unit: '៛' },
  { key: 'feedCostPerHeadDayKhr', label: 'Feed for each animal each day', unit: '៛' },
  { key: 'lastBuyMonth', label: 'Last month to buy cattle in a loan year', unit: 'month' },
  { key: 'openingCashKhr', label: 'Farm’s own money at the start', unit: '៛' },
];

const riel = (n: number) => `${n < 0 ? '−' : ''}${Math.round(Math.abs(n)).toLocaleString()} ៛`;
const mil = (n: number) => (n === 0 ? '0' : `${n < 0 ? '−' : ''}${(Math.round(Math.abs(n) / 100_000) / 10).toLocaleString()}M`);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthLabel = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
const FIELD = `h-12 text-lg ${NUM}`;

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'good' | 'bad' }) {
  const style = tone === 'bad' ? 'border-rose-300 bg-rose-50' : tone === 'good' ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white';
  return (
    <div className={`rounded-2xl border p-3 sm:p-4 ${style}`}>
      <p className="text-sm text-ink-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold text-ink sm:text-2xl">{value}</p>
      {sub && <p className="mt-0.5 text-sm text-ink-muted">{sub}</p>}
    </div>
  );
}

const toText = <T extends object>(o: T) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, String(v)])) as Record<keyof T, string>;

export default function FarmLoanEditor({ farm, loan, data, onBack, onSave, onDelete }: FarmLoanEditorProps) {
  const start = loan?.terms ?? defaultTerms();
  const [bank, setBank] = useState(start.bank);
  const [money, setMoney] = useState({ creditLimitKhr: String(start.creditLimitKhr), annualRatePct: String(start.annualRatePct), financedPct: String(start.financedPct) });
  const [startMonth, setStartMonth] = useState(start.startMonth);
  const [repayments, setRepayments] = useState<{ month: string; pct: string }[]>(start.repayments.map(r => ({ month: String(r.month), pct: String(r.pct) })));
  const [autoRenew, setAutoRenew] = useState(start.autoRenew);
  const [fields, setFields] = useState<Record<AKey, string>>(() => toText(loan?.assumptions ?? { ...DEFAULT_ASSUMPTIONS, herdTarget: farm.capacity || DEFAULT_ASSUMPTIONS.herdTarget }));
  const [basis, setBasis] = useState<Partial<Record<AKey, string>>>({});
  const [notes, setNotes] = useState(loan?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const touch = () => setStatus(null);
  const terms: FarmLoanTerms = useMemo(() => ({
    bank: bank.trim(),
    creditLimitKhr: Number(money.creditLimitKhr) || 0,
    annualRatePct: Number(money.annualRatePct) || 0,
    financedPct: Number(money.financedPct) || 0,
    startMonth,
    repayments: repayments.map(r => ({ month: Number(r.month), pct: Number(r.pct) })).filter(r => r.month >= 1 && r.month <= 12 && r.pct > 0) as LoanRepayment[],
    autoRenew,
  }), [bank, money, startMonth, repayments, autoRenew]);
  const assumptions = useMemo(() => Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, Number(v) || 0])) as unknown as FarmLoanAssumptions, [fields]);
  const plan = useMemo(() => simulateLoan(terms, assumptions), [terms, assumptions]);
  const totalPct = terms.repayments.reduce((s, r) => s + r.pct, 0);

  const useRecords = () => {
    const a = farmActuals(farm, data);
    if (Object.keys(a.values).length === 0) { setStatus({ ok: false, text: 'This farm has no records to start from yet.' }); return; }
    setFields(f => ({ ...f, ...toText(a.values) }));
    setBasis(a.basis);
    setStatus({ ok: true, text: `Filled ${Object.keys(a.values).length} numbers from ${farm.name}’s records. Check them before saving.` });
  };

  const save = async () => {
    setSaving(true);
    setStatus(null);
    try {
      await onSave(terms, assumptions, notes);
      setStatus({ ok: true, text: `Loan saved at ${new Date().toLocaleTimeString()}.` });
    } catch (e) {
      setStatus({ ok: false, text: getErrorMessage(e, 'Could not save the loan.') });
    } finally {
      setSaving(false);
    }
  };

  const repaymentRows = plan.months.filter(m => m.principalKhr > 0);
  // What goes to the bank each month (interest every month, principal on the repayment months).
  const payments = useMemo(() => bankSchedule(plan), [plan]);
  const bankName = terms.bank || 'the bank';

  const exportBankPlan = () => exportToExcel({
    filename: `CC_Livestock_Bank_Payment_Plan_${farm.name.replace(/[^\p{L}\p{N}]+/gu, '_')}_${terms.startMonth}.xlsx`,
    sheetName: 'Bank payments',
    data: [
      ...payments.rows.map(r => ({ ...r, label: `${monthLabel(r.month)} (year ${r.year}, month ${r.monthInYear})` })),
      ...payments.years.map(y => ({ label: `Year ${y.year} total`, openingKhr: '', drawKhr: y.drawKhr, interestKhr: y.interestKhr, principalKhr: y.principalKhr, totalKhr: y.totalKhr, paidByCcKhr: y.paidByCcKhr, paidByFarmKhr: y.paidByFarmKhr, closingKhr: '' })),
    ],
    columns: [
      { header: 'Month', key: 'label' },
      { header: 'Owed at start (៛)', key: 'openingKhr' },
      { header: 'Drawn (៛)', key: 'drawKhr' },
      { header: 'Interest (៛)', key: 'interestKhr' },
      { header: 'Principal (៛)', key: 'principalKhr' },
      { header: 'Total to the bank (៛)', key: 'totalKhr' },
      { header: 'Paid by CC Livestock (៛)', key: 'paidByCcKhr' },
      { header: 'Paid by the farm (៛)', key: 'paidByFarmKhr' },
      { header: 'Owed at end (៛)', key: 'closingKhr' },
    ],
  });
  const year1 = plan.years[0];
  const year2 = plan.years[1];

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-10">
      <Button variant="ghost" onClick={onBack} className="-ml-3"><ArrowLeft /> All farm loans</Button>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-base text-ink-muted">Loan plan{loan ? '' : ' (not saved yet)'}</p>
          <h2 className="text-2xl font-semibold text-ink">{farm.name}</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {loan && <Button variant="outline" onClick={() => setConfirmDelete(true)}><Trash2 className="text-rose-700" /> Remove loan</Button>}
          <Button size="lg" onClick={save} disabled={saving}><Save /> {saving ? 'Saving…' : 'Save loan'}</Button>
        </div>
      </div>
      <p className="text-base text-ink-muted">The bank lends to the farm to buy cattle. In month 12 CC Livestock buys the cattle back and pays the bank first. This plan does not change any real records.</p>
      {status && <p role={status.ok ? 'status' : 'alert'} className={`text-base font-medium ${status.ok ? 'text-emerald-800' : 'text-rose-700'}`}>{status.text}</p>}

      <section className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Tile
          label="Farm’s own money needed"
          value={plan.moneyNeededKhr > 0 ? riel(plan.moneyNeededKhr) : 'None'}
          sub={plan.moneyNeededKhr > 0 && plan.lowestCashMonth ? `lowest in ${monthLabel(plan.lowestCashMonth)}` : 'cash never goes below 0'}
          tone={plan.moneyNeededKhr > 0 ? 'bad' : 'good'}
        />
        <Tile label="Bank loan, year 1" value={riel(year1?.drawnKhr ?? 0)} sub={`interest ${riel(year1?.interestKhr ?? 0)}`} />
        <Tile label="Profit, year 1" value={riel(year1?.profitKhr ?? 0)} sub="sales less cattle, feed and interest" tone={(year1?.profitKhr ?? 0) < 0 ? 'bad' : 'good'} />
        {year2
          ? <Tile label="Profit, year 2" value={riel(year2.profitKhr)} sub={`interest ${riel(year2.interestKhr)}`} tone={year2.profitKhr < 0 ? 'bad' : 'good'} />
          : <Tile label="Year 2" value="No refinance" sub="the loan does not renew" />}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="mb-1 text-lg font-semibold text-ink">Repayments</h3>
        <p className="mb-3 text-base text-ink-muted">Can the farm pay each one from its cash?</p>
        {repaymentRows.length === 0 ? <p className="text-base text-ink-muted">No repayments in this plan.</p> : (
          <ul className="divide-y divide-slate-100">
            {repaymentRows.map(m => {
              const short = m.cashKhr < 0;
              return (
                <li key={m.index} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2">
                  <span className="text-base text-ink">
                    <span className="font-semibold">{monthLabel(m.month)}</span> · year {m.year}, month {m.monthInYear}
                    {m.paidFromBuybackKhr > 0 && <span className="block text-sm text-ink-muted">{riel(m.paidFromBuybackKhr)} paid to the bank by CC Livestock from the buyback ({riel(m.buybackKhr)})</span>}
                  </span>
                  <span className="text-right text-base">
                    <span className="font-semibold text-ink">{riel(m.principalKhr)}</span>
                    <span className={`ml-3 rounded-full px-2.5 py-0.5 text-sm font-medium ${short ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>{short ? `Short ${riel(-m.cashKhr)}` : 'Covered'}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        {plan.endBalanceKhr > 0 && <p className="mt-2 rounded-xl bg-amber-50 p-3 text-base text-amber-900">The repayments add up to {totalPct}%, so {riel(plan.endBalanceKhr)} is still owed at the end.</p>}
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-ink">Payment plan with the bank</h3>
            <p className="text-base text-ink-muted">What {farm.name} pays {bankName} each month: interest every month, principal in the repayment months. In month 12 CC Livestock pays the bank first from the buyback.</p>
          </div>
          <Button variant="outline" onClick={exportBankPlan}><Download /> Download Excel</Button>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {payments.years.map(y => (
            <div key={y.year} className="rounded-xl bg-slate-50 p-3 text-base text-ink">
              <p className="font-semibold">Year {y.year}: {riel(y.totalKhr)} to the bank</p>
              <p className="text-ink-muted">Interest {riel(y.interestKhr)} · principal {riel(y.principalKhr)} (drawn {riel(y.drawKhr)})</p>
              <p className="text-ink-muted">Farm pays {riel(y.paidByFarmKhr)}{y.paidByCcKhr > 0 ? ` · CC Livestock pays ${riel(y.paidByCcKhr)} from the buyback` : ''}</p>
            </div>
          ))}
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[52rem] text-right text-base">
            <thead className="bg-slate-50 text-sm text-ink-muted">
              <tr>
                <th scope="col" className="sticky left-0 bg-slate-50 px-3 py-2 text-left font-medium">Month</th>
                <th scope="col" className="px-3 py-2 font-medium">Owed at start</th>
                <th scope="col" className="px-3 py-2 font-medium">Drawn</th>
                <th scope="col" className="px-3 py-2 font-medium">Interest</th>
                <th scope="col" className="px-3 py-2 font-medium">Principal</th>
                <th scope="col" className="px-3 py-2 font-medium">Total to the bank</th>
                <th scope="col" className="px-3 py-2 font-medium">Paid by</th>
                <th scope="col" className="px-3 py-2 font-medium">Owed at end</th>
              </tr>
            </thead>
            <tbody>
              {payments.rows.map(r => (
                <tr key={r.index} className={`border-t ${r.monthInYear === 1 && r.index > 1 ? 'border-t-2 border-slate-300' : 'border-slate-100'} ${r.principalKhr > 0 ? 'bg-amber-50' : ''}`}>
                  <th scope="row" className={`sticky left-0 px-3 py-2 text-left font-medium text-ink ${r.principalKhr > 0 ? 'bg-amber-50' : 'bg-white'}`}>
                    {monthLabel(r.month)}
                    <span className="block text-sm font-normal text-ink-muted">Y{r.year} · M{r.monthInYear}</span>
                  </th>
                  <td className="px-3 py-2 text-ink">{riel(r.openingKhr)}</td>
                  <td className="px-3 py-2 text-ink">{r.drawKhr ? riel(r.drawKhr) : '—'}</td>
                  <td className="px-3 py-2 text-ink">{r.interestKhr ? riel(r.interestKhr) : '—'}</td>
                  <td className="px-3 py-2 font-medium text-ink">{r.principalKhr ? riel(r.principalKhr) : '—'}</td>
                  <td className="px-3 py-2 font-semibold text-ink">{r.totalKhr ? riel(r.totalKhr) : '—'}</td>
                  <td className="px-3 py-2 text-left text-sm text-ink">
                    {r.totalKhr === 0 ? '—' : (
                      <>
                        {r.paidByFarmKhr > 0 && <span className="block">Farm {riel(r.paidByFarmKhr)}</span>}
                        {r.paidByCcKhr > 0 && <span className="block text-emerald-800">CC Livestock {riel(r.paidByCcKhr)}</span>}
                      </>
                    )}
                  </td>
                  <td className="px-3 py-2 text-ink">{riel(r.closingKhr)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 text-ink">
              {payments.years.map(y => (
                <tr key={y.year} className="border-t border-slate-200">
                  <th scope="row" className="sticky left-0 bg-slate-50 px-3 py-2 text-left font-semibold">Year {y.year}</th>
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2">{riel(y.drawKhr)}</td>
                  <td className="px-3 py-2">{riel(y.interestKhr)}</td>
                  <td className="px-3 py-2">{riel(y.principalKhr)}</td>
                  <td className="px-3 py-2 font-semibold">{riel(y.totalKhr)}</td>
                  <td className="px-3 py-2 text-left text-sm">Farm {riel(y.paidByFarmKhr)}{y.paidByCcKhr > 0 && <span className="block text-emerald-800">CC Livestock {riel(y.paidByCcKhr)}</span>}</td>
                  <td className="px-3 py-2" />
                </tr>
              ))}
            </tfoot>
          </table>
        </div>
        <p className="text-sm text-ink-muted">Highlighted rows are principal repayment months. Interest is {terms.annualRatePct}% a year, charged each month on what is owed after that month&apos;s draws. Change the terms under &quot;The loan and the cattle&quot;.</p>
      </section>

      <details open={!loan} className="group rounded-2xl border border-slate-200 bg-white">
        <summary className="flex min-h-14 cursor-pointer items-center justify-between gap-3 px-4 text-lg font-semibold text-ink">
          <span>The loan and the cattle</span>
          <span className="text-base font-normal text-ink-muted group-open:hidden">Tap to change the numbers</span>
        </summary>
        <div className="grid grid-cols-1 gap-6 border-t border-slate-100 p-4 md:grid-cols-2">
          <fieldset className="space-y-3">
            <legend className="mb-1 text-lg font-semibold text-ink">The loan</legend>
            <label className="block"><span className="mb-1 block text-base text-ink">Bank</span><Input value={bank} maxLength={100} onChange={e => { setBank(e.target.value); touch(); }} className="h-12 text-lg" /></label>
            <label className="block"><span className="mb-1 block text-base text-ink">Month 1 of the loan</span><Input type="month" value={startMonth} onChange={e => { setStartMonth(e.target.value); touch(); }} className="h-12 text-lg" /></label>
            {([['annualRatePct', 'Interest', '% a year', '0.1'], ['financedPct', 'Bank pays of each cattle purchase', '%', '1'], ['creditLimitKhr', 'Credit limit (0 = no limit)', '៛', '1']] as const).map(([k, label, unit, step]) => (
              <label key={k} className="block">
                <span className="mb-1 block text-base text-ink">{label}</span>
                <div className="flex items-center gap-2">
                  <Input type="number" inputMode="decimal" step={step} min="0" value={money[k]} onChange={e => { setMoney(m => ({ ...m, [k]: e.target.value })); touch(); }} className={FIELD} />
                  <span className="w-16 shrink-0 text-base text-ink-muted">{unit}</span>
                </div>
              </label>
            ))}
            <div>
              <p className="mb-1 text-base text-ink">Principal repayments (share of what was drawn that year)</p>
              <ul className="space-y-2">
                {repayments.map((r, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="shrink-0 text-base text-ink-muted">Month</span>
                    <Input aria-label={`Repayment ${i + 1}: month of the loan year`} type="number" min="1" max="12" value={r.month} onChange={e => { setRepayments(rs => rs.map((x, j) => (j === i ? { ...x, month: e.target.value } : x))); touch(); }} className={`w-20 ${FIELD}`} />
                    <Input aria-label={`Repayment ${i + 1}: share in %`} type="number" min="0" max="100" value={r.pct} onChange={e => { setRepayments(rs => rs.map((x, j) => (j === i ? { ...x, pct: e.target.value } : x))); touch(); }} className={`w-24 ${FIELD}`} />
                    <span className="text-base text-ink-muted">%</span>
                    <Button variant="ghost" size="icon" aria-label={`Remove repayment ${i + 1}`} onClick={() => { setRepayments(rs => rs.filter((_, j) => j !== i)); touch(); }}><Trash2 className="text-rose-700" /></Button>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex items-center justify-between gap-3">
                <Button variant="outline" onClick={() => { setRepayments(rs => [...rs, { month: '', pct: '' }]); touch(); }} disabled={repayments.length >= 12}><Plus /> Add a repayment</Button>
                <span className={`text-base font-medium ${totalPct === 100 ? 'text-emerald-800' : 'text-amber-800'}`}>Total {totalPct}%</span>
              </div>
            </div>
            <label className="flex min-h-11 items-center gap-3">
              <input type="checkbox" checked={autoRenew} onChange={e => { setAutoRenew(e.target.checked); touch(); }} className="h-5 w-5 accent-emerald-700" />
              <span className="text-base text-ink">Renews each year (refinance in month 1 of year 2)</span>
            </label>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="mb-1 text-lg font-semibold text-ink">The cattle</legend>
            <Button variant="outline" onClick={useRecords}><Database /> Use {farm.name}’s records</Button>
            {CATTLE_FIELDS.map(f => (
              <label key={f.key} className="block">
                <span className="mb-1 block text-base text-ink">{f.label}</span>
                <div className="flex items-center gap-2">
                  <Input type="number" inputMode="decimal" step={f.step} min="0" value={fields[f.key]} onChange={e => { setFields(x => ({ ...x, [f.key]: e.target.value })); setBasis(b => ({ ...b, [f.key]: undefined })); touch(); }} className={FIELD} />
                  <span className="w-16 shrink-0 text-base text-ink-muted">{f.unit}</span>
                </div>
                {basis[f.key] && <span className="mt-1 block text-sm text-emerald-800">From {basis[f.key]}</span>}
              </label>
            ))}
            <p className="text-base text-ink-muted">
              Each animal: buy {riel(plan.buyPerHeadKhr)}, sell {riel(plan.sellPerHeadKhr)} after {fatteningMonthsFor(assumptions.fatteningDays)} months. {plan.headPerMonth} bought a month until the farm is full.
            </p>
            <label className="block"><span className="mb-1 block text-base text-ink">Notes</span><Input value={notes} maxLength={1000} onChange={e => { setNotes(e.target.value); touch(); }} className="h-12 text-lg" /></label>
          </fieldset>
        </div>
      </details>

      <section>
        <h3 className="mb-2 text-lg font-semibold text-ink">Month by month</h3>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[56rem] text-right text-base">
            <thead className="bg-slate-50 text-sm text-ink-muted">
              <tr>
                <th scope="col" className="sticky left-0 bg-slate-50 px-3 py-2 text-left font-medium">Month</th>
                <th scope="col" className="px-3 py-2 font-medium">Cattle</th>
                <th scope="col" className="px-3 py-2 font-medium">Loan drawn</th>
                <th scope="col" className="px-3 py-2 font-medium">Cattle bought</th>
                <th scope="col" className="px-3 py-2 font-medium">Feed</th>
                <th scope="col" className="px-3 py-2 font-medium">Sales</th>
                <th scope="col" className="px-3 py-2 font-medium">Interest</th>
                <th scope="col" className="px-3 py-2 font-medium">Repaid</th>
                <th scope="col" className="px-3 py-2 font-medium">Owed</th>
                <th scope="col" className="px-3 py-2 font-medium">Farm cash</th>
              </tr>
            </thead>
            <tbody>
              {plan.months.map(m => (
                <tr key={m.index} className={`border-t ${m.monthInYear === 1 && m.index > 1 ? 'border-t-2 border-slate-300' : 'border-slate-100'}`}>
                  <th scope="row" className="sticky left-0 bg-white px-3 py-2 text-left font-medium text-ink">
                    {monthLabel(m.month)}
                    <span className="block text-sm font-normal text-ink-muted">Y{m.year} · M{m.monthInYear}</span>
                  </th>
                  <td className="px-3 py-2 text-ink">{m.headEnd}<span className="block text-sm text-ink-muted">{m.headBought ? `+${m.headBought}` : ''}{m.headBought && m.headSold ? ' ' : ''}{m.headSold ? `−${m.headSold}` : ''}</span></td>
                  <td className="px-3 py-2 text-ink">{m.drawKhr ? mil(m.drawKhr) : '—'}</td>
                  <td className="px-3 py-2 text-ink">{m.purchaseKhr ? mil(m.purchaseKhr) : '—'}</td>
                  <td className="px-3 py-2 text-ink">{m.feedKhr ? mil(m.feedKhr) : '—'}</td>
                  <td className="px-3 py-2 text-ink">{m.salesKhr ? mil(m.salesKhr) : '—'}{m.buybackKhr > 0 && <span className="block text-sm text-emerald-800">CC Livestock</span>}</td>
                  <td className="px-3 py-2 text-ink">{m.interestKhr ? mil(m.interestKhr) : '—'}</td>
                  <td className="px-3 py-2 font-medium text-ink">{m.principalKhr ? mil(m.principalKhr) : '—'}</td>
                  <td className="px-3 py-2 text-ink">{mil(m.balanceKhr)}</td>
                  <td className={`px-3 py-2 font-semibold ${m.cashKhr < 0 ? 'bg-rose-50 text-rose-700' : 'text-emerald-800'}`}>{mil(m.cashKhr)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-sm text-ink-muted">Amounts in millions of riel (M). Cattle are bought at the start of a month and sold at the end of the month their fattening ends; in month 12 CC Livestock buys every animal still on the farm. Farm cash below 0 is money the farm must find elsewhere.</p>
      </section>

      {confirmDelete && (
        <ConfirmModal
          isOpen
          onClose={() => setConfirmDelete(false)}
          onConfirm={async () => {
            try { await onDelete(); } catch (e) { setStatus({ ok: false, text: getErrorMessage(e, 'Could not remove the loan.') }); }
          }}
          title="Remove this loan?"
          description={`${farm.name}’s loan plan will be removed for everyone. This cannot be undone.`}
          type="danger"
          confirmText="Remove loan"
        />
      )}
    </div>
  );
}
