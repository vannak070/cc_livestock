'use client';

import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ListboxSelect } from '@/components/ui/listbox-select';
import type { FeedProductItem, PlanFeedLine } from '@/lib/types';
import { MAX_FEED_LINES } from '@/lib/feed-lines';
import { NUM } from '../flow/FlowShell';

/** One feed line as typed: numbers stay text until saved. */
export interface FeedLineDraft {
  key: string;
  productId: string;
  name: string;
  kg: string;
  price: string;
}

const OTHER = '__other';
const FIELD = 'flex h-12 w-full items-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-3 text-lg text-ink hover:border-emerald-600 focus-visible:border-emerald-600 focus-visible:outline-none';
const riel = (n: number) => `${Math.round(n).toLocaleString()} ៛`;
let seq = 0;
const newKey = () => `line-${++seq}`;

export const toDrafts = (lines: PlanFeedLine[]): FeedLineDraft[] =>
  lines.map(l => ({ key: newKey(), productId: l.productId ?? '', name: l.name, kg: String(l.kgPerHeadDay), price: String(l.pricePerKgKhr) }));

/** Drafts as numbers; blank boxes become NaN so the checks catch them. */
export const fromDrafts = (rows: FeedLineDraft[]): PlanFeedLine[] =>
  rows.map(r => ({
    ...(r.productId ? { productId: r.productId } : {}),
    name: r.name.trim(),
    kgPerHeadDay: r.kg.trim() === '' ? NaN : Number(r.kg),
    pricePerKgKhr: r.price.trim() === '' ? NaN : Number(r.price),
  }));

/** Why the lines cannot be saved, or null. */
export function feedDraftProblem(rows: FeedLineDraft[]): string | null {
  if (rows.length === 0) return 'Add at least one feed.';
  for (const r of rows) {
    const label = r.name.trim() || 'each feed';
    if (!r.name.trim()) return 'Choose the feed, or type its name.';
    const kg = Number(r.kg);
    if (r.kg.trim() === '' || !Number.isFinite(kg) || kg < 0 || kg > 200) return `Type the kg each cow eats of ${label} a day (0 to 200).`;
    const price = Number(r.price);
    if (r.price.trim() === '' || !Number.isFinite(price) || price < 0) return `Type the price of a kg of ${label} (an estimate for your own feed).`;
  }
  return null;
}

/**
 * The feeds each cow eats a day, one line per feed: pick it from the feed
 * list (its price comes along) or type another, then kg per cow a day and the
 * price of a kg. Feed grown on the farm takes an estimated cost.
 */
export default function FeedLinesEditor({ rows, onChange, products }: { rows: FeedLineDraft[]; onChange: (rows: FeedLineDraft[]) => void; products: FeedProductItem[] }) {
  const active = products.filter(p => p.status !== 'Inactive');
  const byId = new Map(products.map(p => [p.id, p]));
  const options = [
    ...active.map(p => ({ value: p.id, label: `${p.name}${p.trackStock === false ? ' (grown on the farm)' : ''}` })),
    { value: OTHER, label: 'Another feed (type the name)' },
  ];
  const update = (key: string, patch: Partial<FeedLineDraft>) => onChange(rows.map(r => (r.key === key ? { ...r, ...patch } : r)));

  const pick = (row: FeedLineDraft, value: string) => {
    if (value === OTHER) { update(row.key, { productId: '', name: row.productId ? '' : row.name }); return; }
    const p = byId.get(value);
    if (!p) return;
    // The feed list's price per kg comes along; for feed grown on the farm it may be 0, so ask for an estimate.
    update(row.key, { productId: p.id, name: p.name, price: p.unitCost > 0 ? String(Math.round(p.unitCost)) : row.price });
  };

  const totalKg = rows.reduce((s, r) => s + (Number(r.kg) || 0), 0);
  const totalKhr = rows.reduce((s, r) => s + (Number(r.kg) || 0) * (Number(r.price) || 0), 0);

  return (
    <div className="space-y-3">
      <ul className="space-y-3">
        {rows.map((r, i) => {
          const product = r.productId ? byId.get(r.productId) : undefined;
          const grown = product?.trackStock === false;
          const lineKhr = (Number(r.kg) || 0) * (Number(r.price) || 0);
          return (
            <li key={r.key} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="mb-1 text-base font-medium text-ink">Feed {i + 1}</p>
                  <ListboxSelect
                    options={options}
                    value={r.productId || (r.name ? OTHER : '')}
                    onChange={v => pick(r, v)}
                    label={`Feed ${i + 1}`}
                    buttonClassName={FIELD}
                    listClassName="left-0 right-0"
                    renderButton={selected => <span className="truncate">{r.productId || r.name ? (r.productId ? selected.label : 'Another feed') : 'Choose a feed'}</span>}
                  />
                </div>
                <Button type="button" variant="ghost" size="icon" className="mt-7" aria-label={`Remove feed ${i + 1}`} onClick={() => onChange(rows.filter(x => x.key !== r.key))}><Trash2 className="text-rose-700" /></Button>
              </div>
              {!r.productId && (
                <Input aria-label={`Name of feed ${i + 1}`} placeholder="For example Rice straw" value={r.name} maxLength={80} onChange={e => update(r.key, { name: e.target.value })} className="h-12 text-lg" />
              )}
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-base text-ink">kg per cow a day</span>
                  <Input aria-label={`kg of feed ${i + 1} per cow a day`} type="number" step="any" min="0" inputMode="decimal" value={r.kg} onChange={e => update(r.key, { kg: e.target.value })} className={`h-12 text-lg ${NUM}`} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-base text-ink">{grown || !r.productId ? 'Cost of a kg (estimate)' : 'Price of a kg'}</span>
                  <div className="flex items-center gap-2">
                    <Input aria-label={`Price of a kg of feed ${i + 1}`} type="number" step="any" min="0" inputMode="decimal" value={r.price} onChange={e => update(r.key, { price: e.target.value })} className={`h-12 text-lg ${NUM}`} />
                    <span className="text-lg text-ink-muted">៛</span>
                  </div>
                </label>
              </div>
              <p className="text-base text-ink-muted">
                {lineKhr > 0 ? `${riel(lineKhr)} per cow a day` : 'Type kg and price to see the cost'}
                {grown && ' · grown on the farm: put what it costs you to grow or cut'}
              </p>
            </li>
          );
        })}
      </ul>
      <Button type="button" variant="outline" onClick={() => onChange([...rows, { key: newKey(), productId: '', name: '', kg: '', price: '' }])} disabled={rows.length >= MAX_FEED_LINES}><Plus /> Add a feed</Button>
      <p className="rounded-xl bg-emerald-50 p-3 text-lg text-emerald-900">
        Each cow: <span className="font-semibold">{Math.round(totalKg * 10) / 10} kg</span> a day · <span className="font-semibold">{riel(totalKhr)}</span> a day · {riel(totalKhr * 30)} a month
      </p>
    </div>
  );
}
