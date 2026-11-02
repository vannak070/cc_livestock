'use client';

import React, { useMemo, useState } from 'react';
import PageTabs from '@/components/ui/page-tabs';
import { Copy, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import type { ERPLivestockData, ProposalPlanParams, ProposalPlanRecord } from '@/types';
import { MAX_PLANS } from '@/types';
import { calculatePlan } from '@/lib/proposal-plan';
import { planLoanInputs } from '@/lib/plan-loan';
import { simulateLoan } from '@/lib/farm-loan';
import { getErrorMessage } from '@/lib/utils';
import PlanEditor from './PlanEditor';
import PlanComparison from './PlanComparison';
import { useText } from '@/hooks/useText';
import { useOpsPrograms } from '@/hooks/useOpsPrograms';
import { plansInUse } from '@/lib/ops-view';
import { shownDay } from '@/lib/khmer-date';

interface PlanningPageProps {
  /** The saved plans, in any order; each has its own slot from 1 to 10. */
  plans: ProposalPlanRecord[];
  onSavePlan: (slot: number, name: string, params: ProposalPlanParams) => Promise<void>;
  onDeletePlan: (slot: number) => Promise<void>;
  /** The app's data, for the feed list. */
  data: ERPLivestockData;
  /** Opens Action plans on the calendar and setup tab, to make a farm program from a plan. */
  onOpenPrograms?: () => void;
}

type Tab = 'plans' | 'compare';
type View = { kind: 'list' } | { kind: 'edit'; slot: number; startFrom?: ProposalPlanParams };

const riel = (n: number) => `${n < 0 ? '−' : ''}${Math.round(Math.abs(n)).toLocaleString()} ៛`;

export default function PlanningPage({ plans, onSavePlan, onDeletePlan, data, onOpenPrograms }: PlanningPageProps) {
  const { tx, language } = useText('planning');
  const [tab, setTab] = useState<Tab>('plans');
  const [view, setView] = useState<View>({ kind: 'list' });
  const [confirm, setConfirm] = useState<null | { title: string; description: string; type: 'danger'; confirmText: string; onConfirm?: () => void }>(null);
  const [error, setError] = useState('');

  // Which farms already run a program made from each plan (Planning is open to the same people who see programs).
  const programs = useOpsPrograms();
  const usedBy = useMemo(() => plansInUse(programs.data?.programs ?? []), [programs.data]);
  const bySlot = useMemo(() => new Map(plans.map(p => [p.slot, p])), [plans]);
  const saved = useMemo(() => [...plans].sort((a, b) => a.slot - b.slot), [plans]);
  // A new plan takes the lowest free slot, and only shows in the list once it is saved.
  const firstEmpty = Array.from({ length: MAX_PLANS }, (_, i) => i + 1).find(n => !bySlot.has(n));

  if (view.kind === 'edit') {
    const slot = view.slot;
    return (
      <PlanEditor
        // A new key when another plan is opened; saving keeps the page (and its "saved" message).
        key={`${slot}-${view.startFrom ? 'copy' : ''}`}
        slot={slot}
        plan={bySlot.get(slot)}
        startFrom={view.startFrom}
        onBack={() => setView({ kind: 'list' })}
        onSave={(name, params) => onSavePlan(slot, name, params)}
        products={data.feedProducts ?? []}
        usedBy={usedBy.get(slot) ?? []}
        onOpenPrograms={onOpenPrograms}
      />
    );
  }

  const duplicate = async (p: ProposalPlanRecord) => {
    if (firstEmpty === undefined) return;
    setError('');
    try {
      await onSavePlan(firstEmpty, tx('copySuffix', { name: p.name }).slice(0, 60), p.params);
      setView({ kind: 'edit', slot: firstEmpty });
    } catch (e) {
      setError(getErrorMessage(e, tx('copyFailed')));
    }
  };

  const askDelete = (p: ProposalPlanRecord) => setConfirm({
    title: tx('deleteTitle'),
    description: tx('deleteDesc', { n: p.slot, name: p.name }),
    type: 'danger',
    confirmText: tx('deleteConfirm'),
    onConfirm: async () => {
      try { await onDeletePlan(p.slot); } catch (e) { setConfirm({ title: tx('couldNotDelete'), description: getErrorMessage(e, tx('somethingWrong')), type: 'danger', confirmText: tx('ok') }); }
    },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="max-w-2xl text-base text-ink-muted">{tx('intro', { max: MAX_PLANS })}</p>
        </div>
        {firstEmpty !== undefined && <Button size="lg" onClick={() => setView({ kind: 'edit', slot: firstEmpty })}><Plus /> {tx('newPlan')}</Button>}
      </div>

      <PageTabs fit label={tx('title')} active={tab} onChange={id => setTab(id as Tab)} tabs={([['plans', tx('tabPlans', { n: plans.length, max: MAX_PLANS })], ['compare', tx('tabCompare')]] as [Tab, string][]).map(([k, label]) => ({ id: k, label }))} />

      {error && <p role="alert" className="text-base font-medium text-rose-700">{error}</p>}

      {tab === 'plans' && (
        saved.length === 0 ? (
          <div className="space-y-4 rounded-2xl bg-slate-50 p-8 text-center">
            <p className="text-lg text-ink-muted">{tx('noPlans')}</p>
            {firstEmpty !== undefined && <Button size="lg" onClick={() => setView({ kind: 'edit', slot: firstEmpty })}><Plus /> {tx('newPlan')}</Button>}
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {saved.map(p => {
              const r = calculatePlan(p.params);
              const { terms, assumptions } = planLoanInputs(p.params);
              const payout = simulateLoan(terms, assumptions).months[0]?.drawKhr ?? 0;
              const covers = terms.loanAmountKhr ? 'coverFixed' : terms.loanCovers === 'all' ? 'coverAll' : terms.loanCovers === 'start' ? 'coverStart' : 'coverCattle';
              const farmsUsing = usedBy.get(p.slot) ?? [];
              const stat = (label: string, value: string) => (
                <div className="min-w-0"><dt className="text-xs text-ink-muted">{label}</dt><dd className="truncate text-base font-semibold tabular-nums text-ink">{value}</dd></div>
              );
              return (
                <li key={p.slot} className="flex flex-col rounded-2xl border border-slate-200 bg-white">
                  <button type="button" onClick={() => setView({ kind: 'edit', slot: p.slot })} className="flex flex-1 flex-col gap-3 rounded-t-2xl p-4 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
                    <span className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium text-ink-muted">{tx('planN', { n: p.slot })}</span>
                      {farmsUsing.length > 0 && (
                        <span className="rounded-full bg-emerald-100 px-3 py-0.5 text-sm font-semibold text-emerald-900" title={farmsUsing.join(', ')}>
                          {farmsUsing.length <= 2 ? tx('usedBy', { farms: farmsUsing.join(', ') }) : tx('usedByN', { n: farmsUsing.length })}
                        </span>
                      )}
                    </span>
                    <span className="break-words text-xl font-semibold leading-snug text-ink">{p.name}</span>
                    <span className={`text-2xl font-semibold ${r.annualProfitKhr < 0 ? 'text-rose-700' : 'text-emerald-800'}`}>{riel(r.annualProfitKhr)} <span className="text-base font-normal text-ink-muted">{tx('aYear')}</span></span>
                    <dl className="grid grid-cols-3 gap-3 border-t border-slate-100 pt-3">
                      {stat(tx('statReturn'), `${Math.round(r.annualRoiPercent * 10) / 10}%`)}
                      {stat(tx('statCattle'), p.params.targetStockLevel.toLocaleString())}
                      {stat(tx('statDays'), String(p.params.fatteningPeriodDays))}
                    </dl>
                    <span className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-ink">
                      <span className="font-semibold">{tx('statLoan')}: {riel(payout)}</span> <span className="text-ink-muted">· {tx(covers)}</span>
                    </span>
                    <span className="truncate text-sm text-ink-muted">{p.updatedBy ? tx('savedBy', { day: shownDay(p.updatedAt, language), who: p.updatedBy }) : tx('savedOn', { day: shownDay(p.updatedAt, language) })}</span>
                  </button>
                  <div className="flex justify-end gap-1 border-t border-slate-100 px-2 py-1">
                    <Button variant="ghost" onClick={() => duplicate(p)} disabled={firstEmpty === undefined} title={firstEmpty === undefined ? tx('allUsed') : undefined}><Copy /> {tx('copy')}</Button>
                    {farmsUsing.length > 0 ? (
                      // A plan a farm's action plan is made from cannot be deleted (the server refuses too).
                      <Button variant="ghost" disabled aria-label={tx('deleteBlockedAria', { n: p.slot, farms: farmsUsing.join(', ') })} title={tx('deleteBlocked', { farms: farmsUsing.join(', ') })}><Trash2 className="text-slate-400" /> <span className="text-sm text-ink-muted">{tx('inUse')}</span></Button>
                    ) : (
                      <Button variant="ghost" aria-label={tx('deletePlanAria', { n: p.slot })} onClick={() => askDelete(p)}><Trash2 className="text-rose-700" /></Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )
      )}

      {tab === 'compare' && <PlanComparison plans={saved} />}

      {confirm && (
        <ConfirmModal isOpen onClose={() => setConfirm(null)} onConfirm={confirm.onConfirm} title={confirm.title} description={confirm.description} type={confirm.type} confirmText={confirm.confirmText} />
      )}
    </div>
  );
}
