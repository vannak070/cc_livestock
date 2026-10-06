'use client';

import React, { useMemo, useState } from 'react';
import { ArrowLeft, Beef, Scale, Syringe, DollarSign, Trash2 } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import type { BatchItem, FeedStockTransaction, HealthLogItem, UserRoleItem } from '@/lib/types';
import type { SalesRecord, StockItem, WeightRecord } from '@/lib/xlsx-parser';
import { hasPermission, getErrorMessage } from '@/lib/utils';
import { weighSchedules } from '@/lib/attention';
import { feedShares } from '@/lib/farm-costs';
import { daysOnFarm, growth, money, weighPoints } from '@/lib/cattle-stats';

interface CattleDetailPageProps {
  cowId: string;
  stock: StockItem[];
  weightTracking: WeightRecord[];
  salesTracking: SalesRecord[];
  healthLogs: HealthLogItem[];
  /** For this animal's share of its batch's daily feed. */
  feedTransactions?: FeedStockTransaction[];
  batches?: BatchItem[];
  currentUser?: UserRoleItem;
  onBack: () => void;
  onWeigh: (cowId: string) => void;
  onTreat: (cowId: string) => void;
  onSell: (cowId: string) => void;
  onDelete?: (cowId: string) => Promise<void>;
}

type Tab = 'overview' | 'weight' | 'health' | 'money';
const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'weight', label: 'Weight' },
  { key: 'health', label: 'Health' },
  { key: 'money', label: 'Money' },
];

const riel = (n: number) => `${Math.round(n).toLocaleString()} ៛`;
const kgText = (n: number) => `${Math.round(n * 10) / 10} kg`;
const signed = (n: number) => `${n > 0 ? '+' : ''}${Math.round(n * 10) / 10}`;
const dateText = (d: string | null | undefined) => (d ? d.slice(0, 10) : '—');

const SICK = ['poor', 'sick', 'critical', 'quarantine'];

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
      <p className="text-sm text-ink-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold text-ink sm:text-2xl">{value}</p>
      {sub && <p className="mt-0.5 text-sm text-ink-muted">{sub}</p>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-3 last:border-0">
      <dt className="text-base text-ink-muted">{label}</dt>
      <dd className="text-right text-base font-medium text-ink break-words">{value}</dd>
    </div>
  );
}

export default function CattleDetailPage({ cowId, stock, weightTracking, salesTracking, healthLogs, feedTransactions = [], batches = [], currentUser, onBack, onWeigh, onTreat, onSell, onDelete }: CattleDetailPageProps) {
  const [tab, setTab] = useState<Tab>('overview');
  const [photoFailed, setPhotoFailed] = useState(false);
  const [confirm, setConfirm] = useState<null | { title: string; description: string; type: 'danger' | 'success'; confirmText: string; onConfirm?: () => void }>(null);

  const cow = stock.find(c => c.id?.trim().toLowerCase() === cowId.trim().toLowerCase());
  const points = useMemo(
    () => weighPoints(cowId, weightTracking, stock.find(c => c.id?.trim().toLowerCase() === cowId.trim().toLowerCase())?.purchaseDate),
    [cowId, weightTracking, stock]
  );
  const logs = useMemo(() => healthLogs.filter(l => l.cowId === cowId).sort((a, b) => b.date.localeCompare(a.date)), [healthLogs, cowId]);
  const sale = salesTracking.find(s => s.cowId === cowId);
  // Its share of the batch's daily feed, split the same way as on Sales and Reports.
  const feed = useMemo(() => {
    const id = cow?.id ?? cowId;
    return Math.round(feedShares(feedTransactions, batches, stock, salesTracking).byCow.get(id) ?? 0);
  }, [feedTransactions, batches, stock, salesTracking, cow?.id, cowId]);

  if (!cow) {
    return (
      <div className="space-y-4">
        <Button variant="secondary" onClick={onBack}><ArrowLeft /> Back to cattle</Button>
        <p className="text-lg text-ink-muted">This animal is no longer in the list.</p>
      </div>
    );
  }

  const status = cow.status.toLowerCase();
  const isActive = status === 'active';
  const g = growth(cow, points);
  const days = daysOnFarm(cow, sale);
  const base = money(cow, sale, logs);
  const m = { ...base, invested: base.invested + feed, result: base.result === null ? null : base.result - feed };
  const sick = SICK.includes(cow.healthStatus?.toLowerCase() || '');
  const due = isActive ? weighSchedules({ stock: [cow], weightTracking })[0] : undefined;
  const needsWeigh = due && due.status !== 'weighed';

  const canWeigh = isActive && hasPermission(currentUser, 'weight_record');
  const canTreat = isActive && hasPermission(currentUser, 'health_record');
  const canSell = isActive && hasPermission(currentUser, 'sales_record');
  const canDelete = !!onDelete && hasPermission(currentUser, 'stock_delete');
  // Prices and profit only for people who see sales or costs; vets see neither.
  const canSeeMoney = hasPermission(currentUser, 'sales_view') || hasPermission(currentUser, 'costs_view');

  const statusStyle = isActive ? 'bg-emerald-100 text-emerald-800' : status === 'dead' ? 'bg-rose-100 text-rose-800' : 'bg-slate-200 text-ink';

  const askDelete = () => setConfirm({
    title: 'Delete this animal?',
    description: `This permanently removes ${cow.id} with all its weights and health records. This cannot be undone.`,
    type: 'danger',
    confirmText: 'Delete',
    onConfirm: async () => {
      try {
        await onDelete?.(cow.id);
        onBack();
      } catch (err) {
        setConfirm({ title: 'Could not delete', description: getErrorMessage(err, 'Something went wrong while deleting.'), type: 'danger', confirmText: 'OK' });
      }
    },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-10">
      <Button variant="ghost" onClick={onBack} className="-ml-3"><ArrowLeft /> All cattle</Button>

      {/* Who this is */}
      <section className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 sm:h-28 sm:w-28">
          {cow.imageUrl && !photoFailed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cow.imageUrl} alt={`Cattle ${cow.id}`} onError={() => setPhotoFailed(true)} className="h-full w-full object-cover" />
          ) : (
            <Beef className="h-10 w-10 text-slate-400" aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-3xl font-semibold text-ink">{cow.id}</h2>
            <span className={`rounded-full px-3 py-1 text-sm font-medium ${statusStyle}`}>{cow.status}</span>
          </div>
          <p className="mt-1 text-lg text-ink-muted">{[cow.sex, cow.breed, cow.age && cow.age !== 'N/A' ? cow.age : null].filter(Boolean).join(' · ')}</p>
          <p className="text-lg text-ink-muted">{cow.location || 'No farm set'}</p>
          <p className={`mt-1 text-base font-medium ${sick ? 'text-rose-700' : 'text-emerald-700'}`}>Health: {cow.healthStatus || '—'}</p>
        </div>
      </section>

      {status === 'sold' && sale && (
        <div className="rounded-2xl bg-slate-100 p-4 text-lg text-ink">
          {canSeeMoney ? <>Sold for <span className="font-semibold">{riel(sale.totalPrice)}</span></> : 'Sold'}
          {sale.salesDate ? ` on ${dateText(sale.salesDate)}` : ''}{sale.buyer ? ` to ${sale.buyer}` : ''}.
        </div>
      )}

      {/* What you can do */}
      {(canWeigh || canTreat || canSell) && (
        <section className="grid grid-cols-3 gap-3" aria-label="Actions">
          {canWeigh && <Button size="lg" onClick={() => onWeigh(cow.id)}><Scale /> Weigh</Button>}
          {canTreat && <Button size="lg" variant="outline" onClick={() => onTreat(cow.id)}><Syringe /> Treat</Button>}
          {canSell && <Button size="lg" variant="outline" onClick={() => onSell(cow.id)}><DollarSign /> Sell</Button>}
        </section>
      )}

      {needsWeigh && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-lg text-ink">
            {due.daysElapsed === 999 ? 'This animal has never been weighed.' : `Last weighed ${due.daysElapsed} days ago. Time to weigh again.`}
          </p>
          {canWeigh && <Button onClick={() => onWeigh(cow.id)}><Scale /> Weigh now</Button>}
        </div>
      )}

      {/* Numbers that matter */}
      <section className="grid grid-cols-3 gap-2 sm:gap-3">
        <Tile label="Weight now" value={kgText(g.currentWeight)} sub={g.gain !== 0 ? `${signed(g.gain)} kg in all` : undefined} />
        <Tile label="Daily gain" value={g.perDay !== null ? `${g.perDay} kg` : '—'} sub={g.perDay !== null ? 'each day' : 'Needs 2 weigh-ins'} />
        <Tile label={status === 'sold' ? 'Days before sale' : 'Days here'} value={days !== null ? String(days) : '—'} />
      </section>

      {/* Tabs */}
      <div role="tablist" aria-label="Animal details" className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.filter(t => t.key !== 'money' || canSeeMoney).map(t => (
          <button
            key={t.key}
            role="tab"
            type="button"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`min-h-12 flex-1 whitespace-nowrap border-b-4 px-2 text-base font-medium sm:px-4 sm:text-lg ${tab === t.key ? 'border-emerald-600 text-emerald-800' : 'border-transparent text-ink-muted hover:text-ink'}`}
          >
            {t.label}{t.key === 'health' && logs.length > 0 ? ` (${logs.length})` : ''}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <dl className="rounded-2xl border border-slate-200 bg-white px-5">
          <Row label="Came from" value={cow.purchaseType || '—'} />
          <Row label="Seller or owner" value={cow.ownerName || '—'} />
          <Row label="Seller phone" value={cow.phone && cow.phone !== 'N/A' ? cow.phone : '—'} />
          <Row label="Arrived" value={dateText(cow.purchaseDate)} />
          <Row label="Weight at arrival" value={kgText(g.startWeight)} />
          <Row label="Paid by" value={cow.paymentMethod && cow.paymentMethod !== 'N/A' ? cow.paymentMethod : '—'} />
          {cow.remark && <Row label="Note" value={cow.remark} />}
        </dl>
      )}

      {tab === 'weight' && (
        <div className="space-y-4">
          {points.length > 1 ? (
            <div className="h-72 rounded-2xl border border-slate-200 bg-white p-3" role="img" aria-label={`Weight of ${cow.id} over time`}>
              <p className="px-1 pb-1 text-sm text-ink-muted">Weight in kg</p>
              <ResponsiveContainer width="100%" height="88%">
                <LineChart data={points} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} tick={{ fontSize: 14, fill: '#475569' }} tickLine={false} />
                  <YAxis domain={['auto', 'auto']} width={44} tick={{ fontSize: 14, fill: '#475569' }} tickLine={false} axisLine={false} />
                  <Tooltip formatter={(v) => [`${v} kg`, 'Weight']} labelFormatter={(d) => String(d)} />
                  <Line type="monotone" dataKey="weight" stroke="#0E7A38" strokeWidth={3} dot={{ r: 4, fill: '#0E7A38' }} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="rounded-2xl bg-slate-50 p-4 text-lg text-ink-muted">The growth chart appears after two weigh-ins.</p>
          )}
          {points.length > 0 ? (
            <ul className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {[...points].reverse().map(p => (
                <li key={p.date} className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3 last:border-0">
                  <span className="text-base text-ink-muted">{p.date}</span>
                  <span className="text-lg font-semibold text-ink">{kgText(p.weight)}</span>
                  <span className={`w-24 text-right text-base font-medium ${p.change === null ? 'text-ink-muted' : p.change < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                    {p.change === null ? 'First' : `${signed(p.change)} kg`}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-2xl bg-slate-50 p-4 text-lg text-ink-muted">No weigh-ins yet.</p>
          )}
        </div>
      )}

      {tab === 'health' && (
        logs.length > 0 ? (
          <ul className="space-y-3">
            {logs.map(l => (
              <li key={l.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-ink">{l.name}</p>
                    <p className="text-base text-ink-muted">{l.type} · {l.date}{l.administeredBy ? ` · ${l.administeredBy}` : ''}</p>
                  </div>
                  {l.cost > 0 && <p className="shrink-0 text-base font-medium text-ink">{riel(l.cost)}</p>}
                </div>
                {l.notes && <p className="mt-2 text-base text-ink">{l.notes}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl bg-slate-50 p-4 text-lg text-ink-muted">No vaccines or treatments recorded yet.</p>
        )
      )}

      {tab === 'money' && canSeeMoney && (
        <div className="space-y-3">
          <dl className="rounded-2xl border border-slate-200 bg-white px-5">
            <Row label="Bought for" value={m.cost > 0 ? riel(m.cost) : 'Nothing paid'} />
            <Row label="Feed eaten" value={riel(feed)} />
            <Row label={`Health costs (${logs.length})`} value={riel(m.medical)} />
            <Row label="Cost so far" value={<span className="font-semibold">{riel(m.invested)}</span>} />
            {m.revenue !== null && <Row label="Sold for" value={riel(m.revenue)} />}
          </dl>
          {m.result !== null && (
            <div className={`rounded-2xl p-4 text-xl font-semibold ${m.result < 0 ? 'bg-rose-50 text-rose-800' : 'bg-emerald-50 text-emerald-800'}`}>
              {m.result < 0 ? 'Loss' : 'Profit'}: {riel(Math.abs(m.result))}
            </div>
          )}
          {m.result === null && <p className="text-base text-ink-muted">Profit is shown once the animal is sold.</p>}
          <p className="text-sm text-ink-muted">Feed is this animal&apos;s share of its batch&apos;s daily feed: each day is shared evenly by the animals in the batch that day.</p>
        </div>
      )}

      {canDelete && (
        <div className="border-t border-slate-200 pt-6">
          <Button variant="destructive" onClick={askDelete}><Trash2 /> Delete this animal</Button>
        </div>
      )}

      {confirm && (
        <ConfirmModal
          isOpen
          onClose={() => setConfirm(null)}
          onConfirm={confirm.onConfirm}
          title={confirm.title}
          description={confirm.description}
          type={confirm.type}
          confirmText={confirm.confirmText}
        />
      )}
    </div>
  );
}
