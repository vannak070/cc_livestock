'use client';

import React, { useMemo, useState } from 'react';
import { Copy, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import type { ERPLivestockData, FarmItem, FarmLoanAssumptions, FarmLoanRecord, FarmLoanTerms, ProposalPlanParams, ProposalPlanRecord } from '@/types';
import { MAX_PLANS } from '@/types';
import { calculatePlan } from '@/lib/proposal-plan';
import { getErrorMessage } from '@/lib/utils';
import PlanEditor from './PlanEditor';
import PlanComparison from './PlanComparison';
import FarmLoansPanel from './FarmLoansPanel';
import FarmLoanEditor from './FarmLoanEditor';

interface PlanningPageProps {
  /** The saved plans, in any order; each has its own slot from 1 to 10. */
  plans: ProposalPlanRecord[];
  onSavePlan: (slot: number, name: string, params: ProposalPlanParams) => Promise<void>;
  onDeletePlan: (slot: number) => Promise<void>;
  farms: FarmItem[];
  loans: FarmLoanRecord[];
  /** The farms' records, for starting a loan plan from real numbers. */
  data: ERPLivestockData;
  onSaveLoan: (farm: string, terms: FarmLoanTerms, assumptions: FarmLoanAssumptions, notes: string) => Promise<void>;
  onDeleteLoan: (farm: string) => Promise<void>;
  /** A Farm Owner: show only this farm's loan, read only (no fattening plans). */
  ownFarm?: string;
}

type Tab = 'loans' | 'plans' | 'compare';
type View = { kind: 'list' } | { kind: 'edit'; slot: number; startFrom?: ProposalPlanParams } | { kind: 'loan'; farm: string };

const riel = (n: number) => `${n < 0 ? '−' : ''}${Math.round(Math.abs(n)).toLocaleString()} ៛`;
const day = (iso: string) => iso.slice(0, 10);

export default function PlanningPage({ plans, onSavePlan, onDeletePlan, farms, loans, data, onSaveLoan, onDeleteLoan, ownFarm }: PlanningPageProps) {
  const [tab, setTab] = useState<Tab>('loans');
  const [view, setView] = useState<View>({ kind: 'list' });
  const [confirm, setConfirm] = useState<null | { title: string; description: string; type: 'danger'; confirmText: string; onConfirm?: () => void }>(null);
  const [error, setError] = useState('');

  const bySlot = useMemo(() => new Map(plans.map(p => [p.slot, p])), [plans]);
  const saved = useMemo(() => [...plans].sort((a, b) => a.slot - b.slot), [plans]);
  // A new plan takes the lowest free slot, and only shows in the list once it is saved.
  const firstEmpty = Array.from({ length: MAX_PLANS }, (_, i) => i + 1).find(n => !bySlot.has(n));

  if (ownFarm) {
    const farm = farms.find(f => f.name === ownFarm) ?? { id: ownFarm, name: ownFarm };
    return (
      <FarmLoanEditor
        farm={farm}
        loan={loans.find(l => l.farmLocation === ownFarm)}
        data={data}
        readOnly
        onSave={async () => { throw new Error('Only the office can change a loan plan.'); }}
        onDelete={async () => { throw new Error('Only the office can remove a loan plan.'); }}
      />
    );
  }

  if (view.kind === 'loan') {
    const farm = farms.find(f => f.name === view.farm);
    if (farm) {
      const loan = loans.find(l => l.farmLocation === farm.name);
      return (
        <FarmLoanEditor
          key={farm.name}
          farm={farm}
          loan={loan}
          data={data}
          onBack={() => setView({ kind: 'list' })}
          onSave={(terms, assumptions, notes) => onSaveLoan(farm.name, terms, assumptions, notes)}
          onDelete={async () => { await onDeleteLoan(farm.name); setView({ kind: 'list' }); }}
        />
      );
    }
  }

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
      />
    );
  }

  const duplicate = async (p: ProposalPlanRecord) => {
    if (firstEmpty === undefined) return;
    setError('');
    try {
      await onSavePlan(firstEmpty, `${p.name} copy`.slice(0, 60), p.params);
      setView({ kind: 'edit', slot: firstEmpty });
    } catch (e) {
      setError(getErrorMessage(e, 'Could not copy the plan.'));
    }
  };

  const askDelete = (p: ProposalPlanRecord) => setConfirm({
    title: 'Delete this plan?',
    description: `Plan ${p.slot}, "${p.name}", will be removed for everyone. This cannot be undone.`,
    type: 'danger',
    confirmText: 'Delete plan',
    onConfirm: async () => {
      try { await onDeletePlan(p.slot); } catch (e) { setConfirm({ title: 'Could not delete', description: getErrorMessage(e, 'Something went wrong.'), type: 'danger', confirmText: 'OK' }); }
    },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-ink">Planning</h2>
          <p className="text-base text-ink-muted">Each farm’s bank loan over 24 months, and up to {MAX_PLANS} fattening plans to compare. Nothing here changes your real herd.</p>
        </div>
        {tab !== 'loans' && firstEmpty !== undefined && <Button size="lg" onClick={() => setView({ kind: 'edit', slot: firstEmpty })}><Plus /> New plan</Button>}
      </div>

      <div role="tablist" aria-label="Planning" className="flex rounded-xl bg-slate-100 p-1 sm:w-fit">
        {([['loans', `Farm loans (${loans.length})`], ['plans', `Plans (${plans.length} of ${MAX_PLANS})`], ['compare', 'Compare']] as [Tab, string][]).map(([k, label]) => (
          <button key={k} role="tab" type="button" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`min-h-11 flex-1 whitespace-nowrap rounded-lg px-4 text-base font-medium sm:px-6 ${tab === k ? 'bg-white text-emerald-800 shadow-sm' : 'text-ink-muted hover:text-ink'}`}>
            {label}
          </button>
        ))}
      </div>

      {error && <p role="alert" className="text-base font-medium text-rose-700">{error}</p>}

      {tab === 'loans' && <FarmLoansPanel farms={farms} loans={loans} onOpen={f => setView({ kind: 'loan', farm: f.name })} />}

      {tab === 'plans' && (
        saved.length === 0 ? (
          <div className="space-y-4 rounded-2xl bg-slate-50 p-8 text-center">
            <p className="text-lg text-ink-muted">No plans yet. A plan appears here once you save it.</p>
            {firstEmpty !== undefined && <Button size="lg" onClick={() => setView({ kind: 'edit', slot: firstEmpty })}><Plus /> New plan</Button>}
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {saved.map(p => {
              const r = calculatePlan(p.params);
              return (
                <li key={p.slot} className="flex flex-col rounded-2xl border border-slate-200 bg-white">
                  <button type="button" onClick={() => setView({ kind: 'edit', slot: p.slot })} className="flex flex-1 flex-col gap-2 rounded-t-2xl p-4 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
                    <span className="text-sm text-ink-muted">Plan {p.slot}</span>
                    <span className="break-words text-xl font-semibold text-ink">{p.name}</span>
                    <span className={`text-2xl font-semibold ${r.annualProfitKhr < 0 ? 'text-rose-700' : 'text-emerald-800'}`}>{riel(r.annualProfitKhr)} <span className="text-base font-normal text-ink-muted">a year</span></span>
                    <span className="text-base text-ink-muted">{Math.round(r.annualRoiPercent * 10) / 10}% return · {p.params.targetStockLevel.toLocaleString()} cattle · {p.params.fatteningPeriodDays} days</span>
                    <span className="text-sm text-ink-muted">Saved {day(p.updatedAt)}{p.updatedBy ? ` by ${p.updatedBy}` : ''}</span>
                  </button>
                  <div className="flex justify-end gap-1 border-t border-slate-100 px-2 py-1">
                    <Button variant="ghost" onClick={() => duplicate(p)} disabled={firstEmpty === undefined} title={firstEmpty === undefined ? 'All ten plans are used' : undefined}><Copy /> Copy</Button>
                    <Button variant="ghost" aria-label={`Delete plan ${p.slot}`} onClick={() => askDelete(p)}><Trash2 className="text-rose-700" /></Button>
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
