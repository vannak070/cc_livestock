'use client';

import React from 'react';
import { Building2 } from 'lucide-react';
import { Chevron, ListboxSelect } from '@/components/ui/listbox-select';

interface WorkingOnSwitcherProps {
  farms: string[];
  /** The farm being looked at; '' means every farm. */
  value: string;
  onChange: (farm: string) => void;
}

/**
 * Lets an office account look at one farm at a time. Every page and form then
 * works on that farm only, like a farm's own staff see it, until "All farms"
 * is chosen again.
 */
export default function WorkingOnSwitcher({ farms, value, onChange }: WorkingOnSwitcherProps) {
  const focused = value !== '';
  return (
    <ListboxSelect
      options={[{ value: '', label: 'All farms' }, ...farms.map(f => ({ value: f, label: f }))]}
      value={value}
      onChange={onChange}
      label="Working on"
      separateFirst
      listClassName="left-0 right-0 md:left-auto md:w-64"
      buttonClassName={`flex min-h-11 w-full min-w-0 items-center gap-2 rounded-xl border-2 px-3 text-left text-base transition-colors hover:border-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${focused ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200 bg-white'}`}
      renderButton={(selected, open) => (
        <>
          <Building2 className={`h-5 w-5 shrink-0 ${focused ? 'text-emerald-700' : 'text-ink-muted'}`} aria-hidden />
          <span className="hidden shrink-0 text-ink-muted sm:inline">Working on</span>
          <span className="min-w-0 flex-1 truncate font-semibold text-ink md:max-w-[14rem]">{selected.label}</span>
          <Chevron open={open} />
        </>
      )}
    />
  );
}
