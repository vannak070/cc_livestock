'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { shiftMonth } from '@/lib/billing';
import { monthLabel } from '@/lib/khmer-date';
import { useText } from '@/hooks/useText';

/** Previous / next month arrows with the month name, and a way back to this month. */
export default function MonthNav({ month, currentMonth, onChange }: { month: string; currentMonth: string; onChange: (month: string | undefined) => void }) {
  const { tx, language } = useText('actionPlans');
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="icon" aria-label={tx('prevMonth')} onClick={() => onChange(shiftMonth(month, -1))}><ChevronLeft /></Button>
      <p className="min-w-44 text-center text-xl font-semibold text-ink">{monthLabel(month, language)}</p>
      <Button variant="outline" size="icon" aria-label={tx('nextMonth')} onClick={() => onChange(shiftMonth(month, 1))}><ChevronRight /></Button>
      {month !== currentMonth && <Button variant="ghost" onClick={() => onChange(undefined)}>{tx('thisMonth')}</Button>}
    </div>
  );
}
