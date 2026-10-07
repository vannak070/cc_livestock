'use client';

import React, { useState } from 'react';
import {
  LogOut,
  Calendar,
  Settings,
  PieChart,
  LayoutDashboard,
  X,
  Building,
  ChevronRight,
  Beef,
  Syringe,
  Package,
  Calculator,
  Home,
  Scale,
  Layers,
  DollarSign,
  PlusCircle,
  MoreHorizontal,
  Users,
  Receipt,
  Globe
} from 'lucide-react';
import { UserRoleItem } from '@/lib/types';
import { canUsePlanning, hasPermission } from '@/lib/utils';
import { canOpenPeople, isFarmOwner } from '@/lib/user-admin';
import { useLanguage } from '@/context/LanguageContext';
import { canSeeBilling } from '@/lib/billing';
import { canOpenWebsitePage } from '@/lib/website/access';
import { khmerLongDate } from '@/lib/khmer-date';
import LanguageSwitcher from '../LanguageSwitcher';
import InstallAppButton from '../InstallAppButton';
import ShareAppButton from '../ShareAppButton';

export type ActiveTabType =
  | 'today'
  | 'dashboard'
  | 'cow-inventory'
  | 'batch-management'
  | 'feed-inventory'
  | 'health-tracking'
  | 'weight-tracking'
  | 'sales-finance'
  | 'analytics'
  | 'proposal-plan'
  | 'settings'
  | 'farms'
  | 'billing'
  | 'website'
  | 'costs';

/** Something a person can record from Today or the phone's Record button. */
export interface RecordAction {
  key: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}

interface SidebarLayoutProps {
  children: React.ReactNode;
  activeTab: ActiveTabType;
  setActiveTab: (tab: ActiveTabType) => void;
  recordActions: RecordAction[];
  healthAlertsCount: number;
  vaccineAlertsCount: number;
  currentUser?: UserRoleItem | null;
  onLogout?: () => void;
  /** The "Working on" farm choice for office accounts; shown in the header, or above the page on phones. */
  workingOn?: React.ReactNode;
}

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
  badge?: number | string | null;
  badgeColor?: 'amber' | 'rose' | 'emerald';
  /** Hide it in the phone's More menu because the bottom bar already has it. */
  onBottomBar?: boolean;
}

function NavItem({ icon, label, isActive, onClick, badge, badgeColor = 'amber', onBottomBar }: NavItemProps) {
  const badgeColors = {
    amber: 'bg-amber-600',
    rose: 'bg-rose-700',
    emerald: 'bg-emerald-600'
  };

  return (
    <button
      onClick={onClick}
      aria-current={isActive ? 'page' : undefined}
      className={`w-full group flex items-center justify-between min-h-12 px-3 py-2.5 rounded-xl transition-colors duration-150 cursor-pointer ${onBottomBar ? 'max-md:hidden' : ''} ${
        isActive
          ? 'bg-emerald-50 text-emerald-800 font-semibold'
          : 'text-ink hover:bg-slate-100 font-medium'
      }`}
    >
      <span className="flex items-center gap-3">
        <span className={`flex-shrink-0 transition-colors duration-150 ${isActive ? 'text-emerald-700' : 'text-ink-muted group-hover:text-ink'}`}>
          {icon}
        </span>
        <span className="text-base leading-tight text-left">{label}</span>
      </span>
      <span className="flex items-center gap-2">
        {badge ? (
          <span className={`inline-flex items-center justify-center h-6 min-w-6 px-1.5 rounded-full text-xs font-bold text-white ${badgeColors[badgeColor]}`}>
            {badge}
          </span>
        ) : isActive ? (
          <ChevronRight className="h-4 w-4 text-emerald-700" />
        ) : null}
      </span>
    </button>
  );
}

function NavSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs font-semibold text-ink-muted px-3 pt-2 pb-1">
        {label}
      </p>
      {children}
    </div>
  );
}

export default function SidebarLayout({
  children,
  activeTab,
  setActiveTab,
  recordActions,
  healthAlertsCount,
  vaccineAlertsCount,
  currentUser,
  onLogout,
  workingOn
}: SidebarLayoutProps) {
  const { t, language } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [recordSheetOpen, setRecordSheetOpen] = useState(false);

  const totalAlerts = healthAlertsCount + vaccineAlertsCount;
  const can = (key: Parameters<typeof hasPermission>[1]) => hasPermission(currentUser, key);

  const handleTabChange = (tab: ActiveTabType) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
    setRecordSheetOpen(false);
  };

  // Page names shown in the header (one source for the menu and the header).
  const tabLabels: Record<ActiveTabType, string> = {
    'today': t('nav.today', 'Today'),
    'dashboard': t('nav.summary', 'Summary'),
    'cow-inventory': t('nav.cattleRegistry'),
    'weight-tracking': t('nav.weights', 'Weights'),
    'health-tracking': t('nav.healthVaccines'),
    'feed-inventory': t('nav.feedStock'),
    'batch-management': t('nav.batchManagement'),
    'costs': t('nav.costs', 'Costs'),
    'sales-finance': t('nav.financeLedger'),
    'analytics': t('nav.analytics'),
    'proposal-plan': t('nav.proposalPlan'),
    'farms': t('nav.farmsBranches'),
    'billing': t('nav.billing', 'Billing'),
    'website': t('nav.website', 'Website'),
    // A farm owner's Settings page is only the people on their farm.
    'settings': currentUser && isFarmOwner(currentUser) ? t('nav.people', 'People') : t('nav.masterSettings')
  };

  // "Office" pages are for people who look at money and reports; farm staff
  // and vets (who have none of these permissions) see only daily work.
  const showSummary = can('dashboard_view') && (can('sales_view') || can('analytics_view'));
  const hasOffice = showSummary || can('sales_view') || can('analytics_view') || canUsePlanning(currentUser) || can('farms_manage') || canSeeBilling(currentUser) || canOpenPeople(currentUser);

  const userInitials = currentUser?.name
    ? currentUser.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : 'US';

  const roleColors: Record<string, string> = {
    'Super Admin': 'bg-rose-50 text-rose-800 border-rose-200',
    'Admin': 'bg-emerald-50 text-emerald-800 border-emerald-200',
    'Company': 'bg-teal-50 text-teal-800 border-teal-200',
    'Farm Owner': 'bg-amber-50 text-amber-800 border-amber-200',
    'Farm Staff': 'bg-indigo-50 text-indigo-800 border-indigo-200',
    'Veterinarian': 'bg-blue-50 text-blue-800 border-blue-200',
  };
  const roleBadgeClass = roleColors[currentUser?.role || ''] || 'bg-slate-100 text-ink border-slate-200';

  // On a phone the whole menu scrolls as one (logo bar stays on top), so the
  // page list gets the full height and Share app / Sign out follow it; on a
  // computer only the page list scrolls.
  const navContent = (
    <div className="flex flex-col h-full bg-white border-r border-slate-200 max-md:overflow-y-auto">

      {/* ─── Logo ─── */}
      <div className="flex items-center justify-between h-20 px-4 border-b-4 border-brand flex-shrink-0 bg-white max-md:sticky max-md:top-0 max-md:z-10">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 flex items-center justify-center flex-shrink-0">
            <img src="/logo.png" alt="CC Livestock logo" className="h-full w-full object-contain" />
          </div>
          <div>
            <p className="text-brand font-bold text-lg leading-tight">CC Livestock</p>
            <p className="text-ink-muted text-sm leading-tight">Farm records</p>
          </div>
        </div>
        <button
          onClick={() => setMobileMenuOpen(false)}
          aria-label={t('nav.closeMenu', 'Close menu')}
          className="md:hidden text-ink-muted hover:text-ink h-11 w-11 flex items-center justify-center rounded-xl hover:bg-slate-100 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* ─── Navigation Links ─── */}
      <nav aria-label="Main" className="flex-1 md:overflow-y-auto max-md:flex-none px-3 py-3 space-y-3">
        <NavSection label={t('nav.dailyWork', 'Daily work')}>
          {can('dashboard_view') && (
            <NavItem icon={<Home className="h-5 w-5" />} label={tabLabels['today']} isActive={activeTab === 'today'} onClick={() => handleTabChange('today')} onBottomBar />
          )}
          {can('stock_view') && (
            <NavItem icon={<Beef className="h-5 w-5" />} label={tabLabels['cow-inventory']} isActive={activeTab === 'cow-inventory'} onClick={() => handleTabChange('cow-inventory')} onBottomBar />
          )}
          {can('weight_view') && (
            <NavItem icon={<Scale className="h-5 w-5" />} label={tabLabels['weight-tracking']} isActive={activeTab === 'weight-tracking'} onClick={() => handleTabChange('weight-tracking')} />
          )}
          {can('health_view') && (
            <NavItem
              icon={<Syringe className="h-5 w-5" />}
              label={tabLabels['health-tracking']}
              isActive={activeTab === 'health-tracking'}
              onClick={() => handleTabChange('health-tracking')}
              badge={totalAlerts > 0 ? totalAlerts : null}
              badgeColor="rose"
            />
          )}
          {can('feed_view') && (
            <NavItem icon={<Package className="h-5 w-5" />} label={tabLabels['feed-inventory']} isActive={activeTab === 'feed-inventory'} onClick={() => handleTabChange('feed-inventory')} />
          )}
          {can('batch_view') && (
            <NavItem icon={<Layers className="h-5 w-5" />} label={tabLabels['batch-management']} isActive={activeTab === 'batch-management'} onClick={() => handleTabChange('batch-management')} />
          )}
          {can('costs_view') && (
            <NavItem icon={<Receipt className="h-5 w-5" />} label={tabLabels['costs']} isActive={activeTab === 'costs'} onClick={() => handleTabChange('costs')} />
          )}
        </NavSection>

        {hasOffice && (
          <NavSection label={t('nav.office', 'Office')}>
            {showSummary && (
              <NavItem icon={<LayoutDashboard className="h-5 w-5" />} label={tabLabels['dashboard']} isActive={activeTab === 'dashboard'} onClick={() => handleTabChange('dashboard')} onBottomBar={recordActions.length === 0} />
            )}
            {can('sales_view') && (
              <NavItem icon={<DollarSign className="h-5 w-5" />} label={tabLabels['sales-finance']} isActive={activeTab === 'sales-finance'} onClick={() => handleTabChange('sales-finance')} />
            )}
            {can('analytics_view') && (
              <NavItem icon={<PieChart className="h-5 w-5" />} label={tabLabels['analytics']} isActive={activeTab === 'analytics'} onClick={() => handleTabChange('analytics')} />
            )}
            {canUsePlanning(currentUser) && (
              <NavItem icon={<Calculator className="h-5 w-5" />} label={tabLabels['proposal-plan']} isActive={activeTab === 'proposal-plan'} onClick={() => handleTabChange('proposal-plan')} />
            )}
            {can('farms_manage') && (
              <NavItem icon={<Building className="h-5 w-5" />} label={tabLabels['farms']} isActive={activeTab === 'farms'} onClick={() => handleTabChange('farms')} />
            )}
            {canSeeBilling(currentUser) && (
              <NavItem icon={<Receipt className="h-5 w-5" />} label={tabLabels['billing']} isActive={activeTab === 'billing'} onClick={() => handleTabChange('billing')} />
            )}
            {canOpenWebsitePage(currentUser) && (
              <NavItem icon={<Globe className="h-5 w-5" />} label={tabLabels['website']} isActive={activeTab === 'website'} onClick={() => handleTabChange('website')} />
            )}
            {canOpenPeople(currentUser) && (
              <NavItem icon={currentUser && isFarmOwner(currentUser) ? <Users className="h-5 w-5" /> : <Settings className="h-5 w-5" />} label={tabLabels['settings']} isActive={activeTab === 'settings'} onClick={() => handleTabChange('settings')} />
            )}
          </NavSection>
        )}
      </nav>

      {/* ─── Install / share this app ─── */}
      <div className="flex-shrink-0 px-3 pt-2 border-t border-slate-200 space-y-0.5">
        <InstallAppButton />
        <ShareAppButton />
      </div>

      {/* ─── User Profile Footer ─── */}
      {currentUser && (
        <div className="flex-shrink-0 mx-3 mb-3 mt-1 border-t border-slate-200 pt-3">
          <div className="flex items-center gap-3 bg-slate-50 rounded-xl px-3 py-2.5">
            <div className="h-10 w-10 rounded-full bg-emerald-600 flex items-center justify-center font-bold text-sm text-white flex-shrink-0">
              {userInitials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ink truncate leading-tight">{currentUser.name}</p>
              <span className={`inline-block text-xs font-bold px-1.5 py-0.5 rounded-full border mt-0.5 ${roleBadgeClass}`}>
                {currentUser.role}
              </span>
            </div>
            {onLogout && (
              <button
                onClick={onLogout}
                className="text-ink-muted hover:text-rose-700 transition-colors cursor-pointer h-11 w-11 flex items-center justify-center rounded-xl hover:bg-rose-50"
                title={t('nav.signOut', 'Sign out')}
                aria-label={t('nav.signOut', 'Sign out')}
              >
                <LogOut className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );

  const bottomTab = (label: string, icon: React.ReactNode, onClick: () => void, isActive: boolean) => (
    <button
      key={label}
      type="button"
      onClick={onClick}
      aria-current={isActive ? 'page' : undefined}
      className={`flex flex-col items-center justify-center gap-1 min-h-16 text-sm cursor-pointer ${isActive ? 'text-emerald-700 font-bold' : 'text-ink-muted font-medium'}`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div className="flex min-h-screen bg-canvas text-ink font-sans">

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-72 flex-shrink-0 flex-col sticky top-0 h-screen">
        {navContent}
      </aside>

      {/* Mobile menu drawer ("More") */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div className="fixed inset-0 bg-slate-900/60" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative w-80 max-w-[85vw] h-full shadow-2xl z-10 flex flex-col">
            {navContent}
          </div>
        </div>
      )}

      {/* Mobile "Record" sheet */}
      {recordSheetOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex flex-col justify-end" role="dialog" aria-modal="true" aria-label={t('nav.record', 'Record')}>
          <div className="fixed inset-0 bg-slate-900/60" onClick={() => setRecordSheetOpen(false)} />
          <div className="relative z-10 bg-white rounded-t-3xl px-4 pt-4 pb-8 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-ink">{t('nav.recordTitle', 'What do you want to record?')}</h2>
              <button type="button" onClick={() => setRecordSheetOpen(false)} aria-label="Close" className="h-11 w-11 flex items-center justify-center rounded-xl hover:bg-slate-100 text-ink-muted">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {recordActions.map(a => (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => { setRecordSheetOpen(false); a.onClick(); }}
                  className="min-h-20 rounded-2xl border border-slate-200 bg-white flex flex-col items-center justify-center gap-2 text-base font-semibold text-ink hover:bg-emerald-50 cursor-pointer"
                >
                  <span className="text-emerald-700">{a.icon}</span>
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col bg-canvas min-w-0 overflow-y-auto">
        <header className="border-b border-slate-200 bg-white px-4 sm:px-6 h-16 md:h-20 flex items-center justify-between gap-4 sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <img src="/logo.png" alt="" className="md:hidden h-10 w-10 object-contain flex-shrink-0" />
            <h1 className="text-xl md:text-2xl font-bold text-ink truncate">{tabLabels[activeTab]}</h1>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Room for the title comes first: the farm picker joins the bar from 1024px, the date from 1280px. */}
            {workingOn && <div className="hidden lg:block">{workingOn}</div>}
            <LanguageSwitcher />
            <div className="hidden xl:flex text-sm text-ink-muted bg-slate-50 py-2 px-3.5 rounded-full border border-slate-200 items-center gap-2">
              <Calendar className="h-4 w-4 text-emerald-700" />
              {language === 'km' ? khmerLongDate(new Date()) : new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>
        </header>

        {/* Page Content (extra space at the bottom on phones for the bottom bar) */}
        <div className="p-4 sm:p-6 pb-28 md:pb-6 flex-1 min-w-0">
          {workingOn && <div className="mb-4 lg:hidden">{workingOn}</div>}
          {children}
        </div>
      </main>

      {/* Phone bottom bar: Today · Cattle · Record · More */}
      <nav aria-label="Quick" className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 grid grid-cols-4 pb-[env(safe-area-inset-bottom)]">
        {bottomTab(tabLabels['today'], <Home className="h-6 w-6" />, () => handleTabChange(can('dashboard_view') ? 'today' : 'dashboard'), activeTab === 'today')}
        {bottomTab(tabLabels['cow-inventory'], <Beef className="h-6 w-6" />, () => handleTabChange('cow-inventory'), activeTab === 'cow-inventory')}
        {recordActions.length > 0
          ? bottomTab(t('nav.record', 'Record'), <PlusCircle className="h-6 w-6" />, () => { setMobileMenuOpen(false); setRecordSheetOpen(true); }, recordSheetOpen)
          : bottomTab(tabLabels['dashboard'], <LayoutDashboard className="h-6 w-6" />, () => handleTabChange('dashboard'), activeTab === 'dashboard')}
        {bottomTab(t('nav.more', 'More'), <MoreHorizontal className="h-6 w-6" />, () => { setRecordSheetOpen(false); setMobileMenuOpen(true); }, mobileMenuOpen)}
      </nav>

    </div>
  );
}
