'use client';

import React from 'react';
import { Calendar, X, Clock } from 'lucide-react';
import { Button } from '../ui/button';

export interface DateRangeFilterBarProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onResetDates: () => void;
  className?: string;
}

export const DateRangeFilterBar: React.FC<DateRangeFilterBarProps> = ({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onResetDates,
  className = ''
}) => {
  const setPreset = (preset: 'today' | 'thisMonth' | 'last30') => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (preset === 'today') {
      onStartDateChange(todayStr);
      onEndDateChange(todayStr);
    } else if (preset === 'thisMonth') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      onStartDateChange(firstDay);
      onEndDateChange(todayStr);
    } else if (preset === 'last30') {
      const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      onStartDateChange(past30);
      onEndDateChange(todayStr);
    }
  };

  const hasFilter = Boolean(startDate || endDate);

  return (
    <div className={`flex flex-wrap items-center gap-2 bg-slate-50/80 p-2 rounded-2xl border border-slate-200/70 text-xs ${className}`}>
      <div className="flex items-center gap-1.5 font-bold text-slate-600 pl-1">
        <Calendar className="h-3.5 w-3.5 text-emerald-600" />
        <span className="text-xs text-slate-500 font-bold">Filter Date:</span>
      </div>

      <div className="flex items-center gap-1">
        <input
          type="date"
          value={startDate}
          onChange={(e) => onStartDateChange(e.target.value)}
          className="h-8 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
        />
        <span className="text-slate-400 font-bold text-xs">➔</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => onEndDateChange(e.target.value)}
          className="h-8 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
        />
      </div>

      {/* Preset Quick Buttons */}
      <div className="flex items-center gap-1 border-l border-slate-200/80 pl-2">
        <button
          type="button"
          onClick={() => setPreset('today')}
          className="px-2 py-1 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
        >
          Today
        </button>
        <button
          type="button"
          onClick={() => setPreset('thisMonth')}
          className="px-2 py-1 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
        >
          This Month
        </button>
        <button
          type="button"
          onClick={() => setPreset('last30')}
          className="px-2 py-1 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
        >
          Last 30 Days
        </button>
      </div>

      {/* Clear Date Filter Button */}
      {hasFilter && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onResetDates}
          className="h-7 text-xs gap-1 rounded-lg border-slate-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 ml-auto cursor-pointer"
        >
          <X className="h-3 w-3" /> Clear Date
        </Button>
      )}
    </div>
  );
};
