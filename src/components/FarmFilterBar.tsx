'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Building2, ChevronDown, X, Check, Search } from 'lucide-react';
import { FarmItem, UserRoleItem } from '@/lib/types';
import { useLanguage } from '@/context/LanguageContext';

interface FarmFilterBarProps {
  farms: FarmItem[];
  selectedFarm: string | null;
  onFarmChange: (farmName: string | null) => void;
  countByFarm?: Record<string, number>;
  totalCount?: number;
  label?: string;
  currentUser?: UserRoleItem;
}

export default function FarmFilterBar({
  farms,
  selectedFarm,
  onFarmChange,
  countByFarm = {},
  totalCount,
  label = 'records',
  currentUser
}: FarmFilterBarProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Only show for admin-level users (no farmLocation restriction)
  if (currentUser?.farmLocation) return null;
  if (!farms || farms.length === 0) return null;

  const allCount = totalCount ?? Object.values(countByFarm).reduce((s, c) => s + c, 0);
  const selectedCount = selectedFarm ? (countByFarm[selectedFarm] ?? 0) : allCount;

  const filteredFarms = farms.filter(f =>
    f.name.toLowerCase().includes(search.toLowerCase())
  );

  // Close dropdown when clicking outside
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div className="flex items-center gap-3 bg-white border border-slate-200/70 rounded-2xl px-4 py-2.5 shadow-sm">
      {/* Icon + Label */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <Building2 className="h-4 w-4 text-emerald-600" />
        <span className="text-xs font-bold text-slate-400 hidden sm:block">
          Farm / Branch
        </span>
      </div>

      {/* Divider */}
      <div className="h-5 w-px bg-slate-200 flex-shrink-0 hidden sm:block" />

      {/* Dropdown trigger */}
      <div className="relative flex-1" ref={dropdownRef}>
        <button
          onClick={() => { setOpen(!open); setSearch(''); }}
          className={`group flex items-center gap-2 w-full sm:w-auto min-w-[220px] px-3.5 py-2 rounded-xl border text-xs font-bold transition-all duration-150 cursor-pointer ${
 selectedFarm
 ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:border-slate-300'
          }`}
        >
          {/* Dot indicator */}
          <span className={`h-2 w-2 rounded-full flex-shrink-0 ${selectedFarm ? 'bg-emerald-500' : 'bg-slate-300'}`} />

          {/* Label */}
          <span className="flex-1 text-left truncate">
            {selectedFarm ?? t('common.allFarms')}
          </span>

          {/* Count badge */}
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md flex-shrink-0 ${
 selectedFarm
 ? 'bg-emerald-200 text-emerald-700'
              : 'bg-slate-200 text-slate-500'
          }`}>
            {selectedCount} {label}
          </span>

          <ChevronDown className={`h-3.5 w-3.5 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </button>

        {/* Dropdown panel */}
        {open && (
          <div className="absolute left-0 top-full mt-1.5 z-50 w-72 bg-white border border-slate-200 rounded-2xl shadow-xl shadow-slate-200/60 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
            {/* Search box */}
            {farms.length > 5 && (
              <div className="p-2 border-b border-slate-100">
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
                  <Search className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                  <input
                    autoFocus
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search farms..."
                    className="flex-1 bg-transparent text-xs font-semibold text-slate-700 placeholder:text-slate-400 outline-none"
                  />
                  {search && (
                    <button onClick={() => setSearch('')} className="text-slate-400 hover:text-slate-600">
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Options list */}
            <div className="max-h-64 overflow-y-auto py-1.5">
              {/* All Farms option */}
              <button
                onClick={() => { onFarmChange(null); setOpen(false); setSearch(''); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-semibold transition-colors cursor-pointer ${
 !selectedFarm
 ? 'bg-emerald-50 text-emerald-800'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                }`}
              >
                <span className="h-7 w-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0 text-xs font-bold">
                  ALL
                </span>
                <div className="flex-1 text-left">
                  <p className="font-bold text-xs">All Farms & Branches</p>
                  <p className="text-xs text-slate-400 font-medium">View consolidated data</p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-xs font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md">
                    {allCount}
                  </span>
                  {!selectedFarm && <Check className="h-3.5 w-3.5 text-emerald-600" />}
                </div>
              </button>

              {filteredFarms.length > 0 && (
                <div className="my-1 mx-3 h-px bg-slate-100" />
              )}

              {/* Individual farm options */}
              {filteredFarms.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-4">No farms match &quot;{search}&quot;</p>
              ) : (
                filteredFarms.map((farm, idx) => {
                  const isActive = selectedFarm === farm.name;
                  const count = countByFarm[farm.name] ?? 0;
                  // Generate a consistent color based on index
                  const colors = [
                    'bg-teal-100 text-teal-700',
                    'bg-blue-100 text-blue-700',
                    'bg-violet-100 text-violet-700',
                    'bg-amber-100 text-amber-700',
                    'bg-rose-100 text-rose-700',
                    'bg-cyan-100 text-cyan-700',
                  ];
                  const colorClass = colors[idx % colors.length];

                  return (
                    <button
                      key={farm.id}
                      onClick={() => { onFarmChange(farm.name); setOpen(false); setSearch(''); }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-semibold transition-colors cursor-pointer ${
 isActive
 ? 'bg-emerald-50 text-emerald-800'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                      }`}
                    >
                      <span className={`h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold ${colorClass}`}>
                        {farm.name.substring(0, 2).toUpperCase()}
                      </span>
                      <div className="flex-1 text-left min-w-0">
                        <p className="font-bold text-xs truncate">{farm.name}</p>
                        {farm.address && (
                          <p className="text-xs text-slate-400 font-medium truncate">{farm.address}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md ${
 isActive ? 'bg-emerald-200 text-emerald-700' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {count}
                        </span>
                        {isActive && <Check className="h-3.5 w-3.5 text-emerald-600" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer summary */}
            <div className="border-t border-slate-100 px-4 py-2 bg-slate-50/60 flex items-center justify-between">
              <p className="text-xs text-slate-400 font-semibold">
                {farms.length} farm{farms.length !== 1 ? 's' : ''} registered
              </p>
              {selectedFarm && (
                <button
                  onClick={() => { onFarmChange(null); setOpen(false); setSearch(''); }}
                  className="text-xs font-bold text-rose-500 hover:text-rose-700 flex items-center gap-1 cursor-pointer"
                >
                  <X className="h-3 w-3" /> Clear filter
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Active filter chip — quick clear */}
      {selectedFarm && (
        <button
          onClick={() => onFarmChange(null)}
          className="flex-shrink-0 flex items-center gap-1.5 bg-emerald-100 text-emerald-700 hover:bg-rose-100 hover:text-rose-600 text-xs font-bold px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
          title="Clear farm filter"
        >
          <X className="h-3 w-3" />
          <span className="hidden sm:inline">Clear</span>
        </button>
      )}
    </div>
  );
}
