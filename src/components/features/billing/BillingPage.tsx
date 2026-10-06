'use client';

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Download, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { getBillingAction, saveBillingPricesAction } from '@/app/actions';
import { billingProblem, billingStart, shiftMonth, sortedPrices, withPrice, withoutPrice, type BillingView } from '@/lib/billing';
import { exportBillingStatement } from '@/lib/billing-export';
import { monthLabel, shownDay } from '@/lib/khmer-date';
import { getErrorMessage } from '@/lib/utils';
import { useText } from '@/hooks/useText';

const riel = (n: number) => `${Math.round(n).toLocaleString()} ៛`;

/**
 * What CC Livestock is billed for cattle registrations: one month at a time,
 * by farm, with the price list. Super Admin and Admin only (the server checks).
 */
export default function BillingPage() {
  const { tx, language } = useText('billing');
  const queryClient = useQueryClient();
  const [month, setMonth] = useState<string | undefined>(undefined);
  const [showAnimals, setShowAnimals] = useState(false);

  const query = useQuery<BillingView>({
    queryKey: ['billing', month ?? 'current'],
    queryFn: async () => {
      const res = await getBillingAction(month);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    // Always fetch fresh when the page opens: registrations change the bill.
    refetchOnMount: 'always',
  });

  const view = query.data;
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['billing'] });

  if (query.isLoading) return <p className="mx-auto max-w-4xl text-lg text-ink-muted" role="status">{tx('loading')}</p>;
  if (query.isError || !view) {
    return (
      <div className="mx-auto max-w-4xl space-y-3 rounded-2xl bg-rose-50 p-6">
        <p role="alert" className="text-lg text-rose-800">{getErrorMessage(query.error, tx('loadFailed'))}</p>
        <Button onClick={() => query.refetch()}>{tx('retry')}</Button>
      </div>
    );
  }

  const { statement: st, settings, recent, currentMonth } = view;
  const start = billingStart(settings);
  const open = view.month === currentMonth;

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-10">
      <div>
        <h2 className="text-2xl font-semibold text-ink">{tx('title')}</h2>
        <p className="text-base text-ink-muted">{tx('subtitle')}</p>
      </div>

      {!start && (
        <section className="space-y-2 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4">
          <h3 className="text-lg font-semibold text-amber-900">{tx('noPriceTitle')}</h3>
          <p className="text-base text-amber-900">{tx('noPriceBody')}</p>
        </section>
      )}

      {/* Which month */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" aria-label={tx('prevMonth')} onClick={() => setMonth(shiftMonth(view.month, -1))}><ChevronLeft /></Button>
        <div className="min-w-44 text-center">
          <p className="text-xl font-semibold text-ink">{monthLabel(view.month, language)}</p>
          {open && <p className="text-sm text-ink-muted">{tx('monthSoFar')}</p>}
        </div>
        <Button variant="outline" size="icon" aria-label={tx('nextMonth')} onClick={() => setMonth(shiftMonth(view.month, 1))}><ChevronRight /></Button>
        {!open && <Button variant="ghost" onClick={() => setMonth(undefined)}>{tx('thisMonth')}</Button>}
        <Button variant="outline" className="ml-auto" onClick={() => exportBillingStatement(st)} disabled={!st.billed}><Download /> {tx('download')}</Button>
      </div>

      {!st.billed && start && (
        <div className="rounded-2xl bg-slate-50 p-5">
          <p className="text-lg font-semibold text-ink">{tx('notStartedTitle', { month: monthLabel(start, language) })}</p>
          <p className="text-base text-ink-muted">{tx('notStartedBody')}</p>
        </div>
      )}

      {st.billed && (
        <>
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4"><dt className="text-base text-ink-muted">{tx('tileCattle')}</dt><dd className="mt-1 text-3xl font-semibold text-ink">{st.cattle}</dd></div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4"><dt className="text-base text-ink-muted">{tx('tilePrice')}</dt><dd className="mt-1 text-3xl font-semibold text-ink">{riel(st.price ?? 0)}</dd></div>
            <div className="rounded-2xl border-2 border-emerald-600 bg-emerald-50 p-4"><dt className="text-base text-emerald-900">{tx('tileAmount')}</dt><dd className="mt-1 text-3xl font-semibold text-emerald-900">{riel(st.amount)}</dd></div>
          </dl>

          <section aria-labelledby="by-farm" className="space-y-2">
            <h3 id="by-farm" className="text-lg font-semibold text-ink">{tx('byFarm')}</h3>
            {st.farms.length === 0 ? (
              <p className="rounded-2xl bg-slate-50 p-5 text-base text-ink-muted">{tx('noneThisMonth')}</p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                <table className="w-full text-left text-base">
                  <thead className="bg-slate-50 text-ink-muted">
                    <tr><th className="px-4 py-3 font-medium">{tx('colFarm')}</th><th className="px-4 py-3 text-right font-medium">{tx('colCattle')}</th><th className="px-4 py-3 text-right font-medium">{tx('colAmount')}</th></tr>
                  </thead>
                  <tbody>
                    {st.farms.map(f => (
                      <tr key={f.farm} className="border-t border-slate-100">
                        <td className="px-4 py-3 text-ink">{f.farm}</td>
                        <td className="px-4 py-3 text-right text-ink">{f.cattle}</td>
                        <td className="px-4 py-3 text-right font-medium text-ink">{riel(f.amount)}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
                      <td className="px-4 py-3 text-ink">{tx('total')}</td>
                      <td className="px-4 py-3 text-right text-ink">{st.cattle}</td>
                      <td className="px-4 py-3 text-right text-ink">{riel(st.amount)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
            {st.removed > 0 && <p className="text-base text-ink-muted">{tx('removedNote', { n: st.removed })}</p>}
          </section>

          {st.animals.length > 0 && (
            <section className="space-y-2">
              <Button variant="outline" aria-expanded={showAnimals} onClick={() => setShowAnimals(v => !v)}>
                {showAnimals ? tx('hideAnimals') : tx('showAnimals')} ({st.animals.length})
              </Button>
              {showAnimals && (
                <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                  <table className="w-full text-left text-base">
                    <thead className="bg-slate-50 text-ink-muted">
                      <tr><th className="px-4 py-3 font-medium">{tx('colTag')}</th><th className="px-4 py-3 font-medium">{tx('colFarm')}</th><th className="px-4 py-3 font-medium">{tx('colDay')}</th><th className="px-4 py-3 font-medium">{tx('colBy')}</th></tr>
                    </thead>
                    <tbody>
                      {st.animals.map(a => (
                        <tr key={`${a.cowId}-${a.registeredAt}`} className="border-t border-slate-100">
                          <td className="px-4 py-3 font-medium text-ink">{a.cowId}</td>
                          <td className="px-4 py-3 text-ink">{a.farm}</td>
                          <td className="px-4 py-3 text-ink">{shownDay(a.registeredAt, language)}</td>
                          <td className="px-4 py-3 text-ink-muted">{a.registeredBy || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </>
      )}

      {/* The last twelve months */}
      <section aria-labelledby="recent" className="space-y-2">
        <h3 id="recent" className="text-lg font-semibold text-ink">{tx('recentTitle')}</h3>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-left text-base">
            <thead className="bg-slate-50 text-ink-muted">
              <tr><th className="px-4 py-3 font-medium">{tx('colMonth')}</th><th className="px-4 py-3 text-right font-medium">{tx('colCattle')}</th><th className="px-4 py-3 text-right font-medium">{tx('colAmount')}</th></tr>
            </thead>
            <tbody>
              {recent.map(r => (
                <tr key={r.month} className={`border-t border-slate-100 ${r.month === view.month ? 'bg-emerald-50' : ''}`}>
                  <td className="px-4 py-2">
                    <button type="button" aria-label={tx('openMonth', { month: monthLabel(r.month, language) })} onClick={() => setMonth(r.month === currentMonth ? undefined : r.month)} className="min-h-11 text-left font-medium text-emerald-800 underline-offset-2 hover:underline">{monthLabel(r.month, language)}</button>
                  </td>
                  <td className="px-4 py-2 text-right text-ink">{r.billed ? r.cattle : '—'}</td>
                  <td className="px-4 py-2 text-right text-ink">{r.billed ? riel(r.amount) : <span className="text-ink-muted">{tx('notBilled')}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <PriceSection settings={settings} currentMonth={currentMonth} onChanged={refresh} />
    </div>
  );
}

function PriceSection({ settings, currentMonth, onChanged }: { settings: BillingView['settings']; currentMonth: string; onChanged: () => void }) {
  const { tx, language } = useText('billing');
  const prices = sortedPrices(settings);
  const [price, setPrice] = useState(prices.length === 0 ? '5000' : '');
  const [from, setFrom] = useState(currentMonth);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<null | { title: string; description: string; type: 'danger' | 'info'; confirmText: string; onConfirm?: () => void }>(null);

  const persist = async (next: BillingView['settings']) => {
    const problem = billingProblem(next);
    if (problem) throw new Error(problem);
    const res = await saveBillingPricesAction(next);
    if (!res.success) throw new Error(res.error);
    onChanged();
    return res.data;
  };

  const save = async () => {
    const n = Number(price);
    if (price.trim() === '' || !Number.isInteger(n)) { setError(tx('typePrice')); return; }
    if (!from) { setError(tx('typeMonth')); return; }
    setSaving(true); setError(''); setSaved('');
    try {
      const done = await persist(withPrice(settings, { from, price: n }));
      setSaved(tx('saved', { month: monthLabel(billingStart(done) ?? from, language) }));
      setPrice('');
    } catch (e) {
      setError(getErrorMessage(e, tx('couldNotSave')));
    } finally {
      setSaving(false);
    }
  };

  const askRemove = (rule: { from: string; price: number }) => {
    if (prices.length <= 1) {
      setConfirm({ title: tx('removeTitle'), description: tx('cannotRemoveLast'), type: 'info', confirmText: tx('ok') });
      return;
    }
    setConfirm({
      title: tx('removeTitle'),
      description: tx('removeDesc', { price: rule.price.toLocaleString(), month: monthLabel(rule.from, language) }),
      type: 'danger',
      confirmText: tx('remove'),
      onConfirm: async () => {
        try { await persist(withoutPrice(settings, rule.from)); } catch (e) { setConfirm({ title: tx('couldNotSave'), description: getErrorMessage(e, tx('couldNotSave')), type: 'info', confirmText: tx('ok') }); }
      },
    });
  };

  return (
    <section aria-labelledby="price" className="space-y-4 rounded-2xl border-2 border-slate-200 bg-white p-4 sm:p-5">
      <div>
        <h3 id="price" className="text-lg font-semibold text-ink">{tx('priceTitle')}</h3>
        <p className="text-base text-ink-muted">{tx('priceHint')}</p>
      </div>
      <form noValidate onSubmit={e => { e.preventDefault(); save(); }} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="block">
          <span className="mb-1 block text-base font-medium text-ink">{tx('priceLabel')}</span>
          <Input aria-label={tx('priceAria')} type="number" inputMode="numeric" min={0} step={1} value={price} onChange={e => { setPrice(e.target.value); setError(''); setSaved(''); }} className="h-14 text-xl font-semibold" />
        </label>
        <label className="block">
          <span className="mb-1 block text-base font-medium text-ink">{tx('priceFrom')}</span>
          <Input aria-label={tx('priceFromAria')} type="month" value={from} onChange={e => { setFrom(e.target.value); setError(''); setSaved(''); }} className="h-14 text-lg" />
        </label>
        <Button type="submit" size="lg" disabled={saving}>{saving ? tx('saving') : tx('savePrice')}</Button>
      </form>
      {error && <p role="alert" className="text-base font-medium text-rose-700">{error}</p>}
      {saved && <p role="status" className="text-base font-medium text-emerald-700">{saved}</p>}

      {prices.length > 0 && (
        <div>
          <p className="mb-1 text-base font-medium text-ink">{tx('history')}</p>
          <ul className="space-y-2">
            {prices.map(rule => (
              <li key={rule.from} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-2">
                <span className="text-lg text-ink">{tx('priceLine', { price: rule.price.toLocaleString(), month: monthLabel(rule.from, language) })}</span>
                <Button variant="ghost" size="icon" aria-label={tx('removeAria', { month: monthLabel(rule.from, language) })} onClick={() => askRemove(rule)}><Trash2 className="text-rose-700" /></Button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {confirm && <ConfirmModal isOpen onClose={() => setConfirm(null)} onConfirm={confirm.onConfirm} title={confirm.title} description={confirm.description} type={confirm.type} confirmText={confirm.confirmText} />}
    </section>
  );
}
