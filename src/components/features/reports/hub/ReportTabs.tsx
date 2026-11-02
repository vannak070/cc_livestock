'use client';

import React from 'react';
import PageTabs, { type PageTab } from '@/components/ui/page-tabs';

export type ReportTab = PageTab;

/** The Reports tabs are the app's standard tab bar (components/ui/page-tabs.tsx). */
export default function ReportTabs({ tabs, active, onChange, label }: { tabs: ReportTab[]; active: string; onChange: (id: string) => void; label: string }) {
  return <PageTabs tabs={tabs} active={active} onChange={onChange} label={label} tabPrefix="rep-tab" panelPrefix="rep-panel" />;
}
