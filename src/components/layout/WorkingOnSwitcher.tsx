'use client';

import React from 'react';
import { Building2 } from 'lucide-react';

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
    <label className={`flex min-h-11 min-w-0 items-center gap-2 rounded-xl border-2 px-3 text-base ${focused ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
      <Building2 className={`h-5 w-5 shrink-0 ${focused ? 'text-emerald-700' : 'text-ink-muted'}`} aria-hidden />
      <span className="hidden shrink-0 text-ink-muted sm:inline">Working on</span>
      <select
        aria-label="Working on"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="min-w-0 max-w-[11rem] truncate bg-transparent font-semibold text-ink focus:outline-none sm:max-w-[14rem]"
      >
        <option value="">All farms</option>
        {farms.map(f => <option key={f} value={f}>{f}</option>)}
      </select>
    </label>
  );
}
