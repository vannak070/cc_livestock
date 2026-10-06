'use client';

import React, { useMemo, useState } from 'react';
import { Check, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { StockItem } from '@/lib/xlsx-parser';
import { useText, useValueText } from '@/hooks/useText';
import { RowButton } from '../flow/FlowShell';

interface CattlePickerProps {
  cattle: StockItem[];
  selected: string[];
  onChange: (ids: string[]) => void;
  emptyText?: string;
}

/** Tap animals to choose several, with a tag search and "choose all shown". */
export default function CattlePicker({ cattle, selected, onChange, emptyText }: CattlePickerProps) {
  const { tx } = useText('weighFlow');
  const val = useValueText();
  const [query, setQuery] = useState('');
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cattle.filter(c => !q || c.id.toLowerCase().includes(q) || c.breed?.toLowerCase().includes(q));
  }, [cattle, query]);

  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
  const allShown = shown.length > 0 && shown.every(c => selected.includes(c.id));

  return (
    <>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted" aria-hidden />
        <Input value={query} onChange={e => setQuery(e.target.value)} placeholder={tx('searchTag')} aria-label={tx('searchTag')} className="h-14 pl-10 text-lg" />
      </div>
      {shown.length > 0 && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-base text-ink-muted">{tx('chosen', { n: selected.length })}</p>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onChange(allShown ? selected.filter(id => !shown.some(c => c.id === id)) : [...new Set([...selected, ...shown.map(c => c.id)])])}
          >
            {allShown ? tx('clearThese') : tx('chooseAll', { n: shown.length })}
          </Button>
        </div>
      )}
      <ul className="space-y-3 pb-2">
        {shown.map(c => {
          const on = selected.includes(c.id);
          return (
            <li key={c.id}>
              <RowButton onClick={() => toggle(c.id)} selected={on}>
                <span>
                  <span className="block text-xl font-semibold text-ink">{c.id}</span>
                  <span className="block text-base text-ink-muted">{[val(c.sex), c.breed, c.weight ? `${c.weight} kg` : null].filter(Boolean).join(' · ')}</span>
                </span>
                {on && <Check className="h-7 w-7 shrink-0 text-emerald-700" aria-hidden />}
              </RowButton>
            </li>
          );
        })}
        {shown.length === 0 && <li className="rounded-xl bg-slate-50 p-4 text-center text-lg text-ink-muted">{query ? tx('noTag') : emptyText ?? tx('noneToChoose')}</li>}
      </ul>
    </>
  );
}
