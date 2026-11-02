'use client';

import React, { useMemo } from 'react';
import type { ERPLivestockData, FarmItem, UserRoleItem } from '@/lib/types';
import type { ActiveTabType } from '../../layout/SidebarLayout';
import ReportsHub from './hub/ReportsHub';

interface ReportsPageProps {
  data: ERPLivestockData;
  currentUser?: UserRoleItem;
  farms?: FarmItem[];
  /** Opens the Action plans page (where plans, tasks and contract prices are worked). */
  onOpenActionPlans?: () => void;
  /** Opens another page (Today, Sales, Cattle...) from a tile or a button. */
  onNavigateToTab: (tab: ActiveTabType) => void;
  /** Opens the Batches page on the sale review. */
  onOpenSaleReview?: () => void;
}

/**
 * Reports: one page of sections that follow the Management report template (see hub/ReportsHub). This wrapper narrows the data to the
 * farm chosen in "Working on" (it sets the person's farm for every page).
 */
export default function ReportsPage({ data, currentUser, farms = [], onOpenActionPlans, onNavigateToTab, onOpenSaleReview }: ReportsPageProps) {
  const farm = currentUser?.farmLocation ?? '';

  // Everything below works on the chosen farm only.
  const scoped = useMemo(() => {
    if (!farm) return data;
    const stock = data.stock.filter(s => s.location === farm);
    const ids = new Set(stock.map(s => s.id));
    return {
      ...data,
      stock,
      batches: data.batches.filter(b => b.farmLocation === farm || b.cowIds?.some(id => ids.has(id))),
      weightTracking: data.weightTracking.filter(w => ids.has(w.cowId)),
      healthLogs: data.healthLogs.filter(h => ids.has(h.cowId)),
      salesTracking: data.salesTracking.filter(s => ids.has(s.cowId)),
    };
  }, [data, farm]);

  return <ReportsHub data={data} scoped={scoped} currentUser={currentUser} farms={farms} farm={farm} onOpenActionPlans={onOpenActionPlans} onNavigateToTab={onNavigateToTab} onOpenSaleReview={onOpenSaleReview} />;
}
