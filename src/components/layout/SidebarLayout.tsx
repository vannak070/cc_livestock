'use client';

import React, { useState } from 'react';
import { 
  Database, 
  DollarSign, 
  Scale, 
  LogOut, 
  Calendar, 
  Activity, 
  TrendingUp, 
  Heart, 
  Settings, 
  PieChart, 
  LayoutDashboard,
  Menu,
  X,
  Building,
  ChevronRight,
  Beef,
  Syringe,
  Package,
  Calculator
} from 'lucide-react';
import { StockItem } from '@/lib/xlsx-parser';
import { UserRoleItem } from '@/lib/types';
import { hasPermission, format2Decimals, format2DecimalsWithCommas } from '@/lib/utils';
import { useLanguage } from '@/context/LanguageContext';
import LanguageSwitcher from '../LanguageSwitcher';

export type ActiveTabType = 
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
  | 'farms';

interface SidebarLayoutProps {
  children: React.ReactNode;
  stock: StockItem[];
  activeTab: ActiveTabType;
  setActiveTab: (tab: ActiveTabType) => void;
  onOpenQuickEntry: () => void;
  healthAlertsCount: number;
  vaccineAlertsCount: number;
  currentUser?: UserRoleItem | null;
  onLogout?: () => void;
}

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
  badge?: number | string | null;
  badgeColor?: 'amber' | 'rose' | 'emerald';
}

function NavItem({ icon, label, isActive, onClick, badge, badgeColor = 'amber' }: NavItemProps) {
  const badgeColors = {
    amber: 'bg-amber-500',
    rose: 'bg-rose-500',
    emerald: 'bg-emerald-500'
  };

  return (
    <button
      onClick={onClick}
      aria-current={isActive ? 'page' : undefined}
      className={`w-full group flex items-center justify-between min-h-12 px-3 py-2.5 rounded-xl transition-colors duration-150 cursor-pointer ${
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
  stock,
  activeTab,
  setActiveTab,
  onOpenQuickEntry,
  healthAlertsCount,
  vaccineAlertsCount,
  currentUser,
  onLogout
}: SidebarLayoutProps) {
  const { t } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const activeStock = stock.filter(item => item.status.toLowerCase() === 'active');
  const totalHead = activeStock.length;
  const totalWeight = activeStock.reduce((sum, item) => sum + (item.weight || 0), 0);
  const averageWeight = totalHead > 0 ? format2Decimals(totalWeight / totalHead) : '0.00';
  const inventoryValue = activeStock.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
  const totalAlerts = healthAlertsCount + vaccineAlertsCount;

  const handleTabChange = (tab: ActiveTabType) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  // Get user initials for avatar
  const userInitials = currentUser?.name
    ? currentUser.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : 'US';

  // Role color badge
  const roleColors: Record<string, string> = {
    'Super Admin': 'bg-rose-50 text-rose-800 border-rose-200',
    'Admin': 'bg-emerald-50 text-emerald-800 border-emerald-200',
    'Company': 'bg-teal-50 text-teal-800 border-teal-200',
    'Farm Owner': 'bg-amber-50 text-amber-800 border-amber-200',
    'Farm Staff': 'bg-indigo-50 text-indigo-800 border-indigo-200',
    'Veterinarian': 'bg-blue-50 text-blue-800 border-blue-200',
  };
  const roleBadgeClass = roleColors[currentUser?.role || ''] || 'bg-slate-100 text-ink border-slate-200';

  const navContent = (
    <div className="flex flex-col h-full bg-white border-r border-slate-200">

      {/* ─── Logo ─── */}
      <div className="flex items-center justify-between h-20 px-4 border-b-4 border-brand flex-shrink-0">
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
          aria-label="Close menu"
          className="md:hidden text-ink-muted hover:text-ink h-11 w-11 flex items-center justify-center rounded-xl hover:bg-slate-100 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>




      {/* ─── Navigation Links ─── */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-3">

        {/* Core */}
        <NavSection label="Overview">
          <NavItem
            icon={<LayoutDashboard className="h-5 w-5" />}
            label={t('nav.dashboard')}
            isActive={activeTab === 'dashboard'}
            onClick={() => handleTabChange('dashboard')}
          />
        </NavSection>

        {/* Livestock ERP */}
        {(hasPermission(currentUser, 'stock_view') ||
          hasPermission(currentUser, 'batch_view') ||
          hasPermission(currentUser, 'health_view')) && (
          <NavSection label="Livestock ERP">
            {hasPermission(currentUser, 'stock_view') && (
              <NavItem
                icon={<Beef className="h-5 w-5" />}
                label={t('nav.cattleRegistry')}
                isActive={activeTab === 'cow-inventory'}
                onClick={() => handleTabChange('cow-inventory')}
              />
            )}
            {hasPermission(currentUser, 'batch_view') && (
              <NavItem
                icon={<TrendingUp className="h-5 w-5" />}
                label={t('nav.batchManagement')}
                isActive={activeTab === 'batch-management'}
                onClick={() => handleTabChange('batch-management')}
              />
            )}
            <NavItem
              icon={<Package className="h-5 w-5" />}
              label={t('nav.feedStock')}
              isActive={activeTab === 'feed-inventory'}
              onClick={() => handleTabChange('feed-inventory')}
            />
            {hasPermission(currentUser, 'health_view') && (
              <NavItem
                icon={<Syringe className="h-5 w-5" />}
                label={t('nav.healthVaccines')}
                isActive={activeTab === 'health-tracking'}
                onClick={() => handleTabChange('health-tracking')}
                badge={totalAlerts > 0 ? totalAlerts : null}
                badgeColor="rose"
              />
            )}
          </NavSection>
        )}

        {/* Financials */}
        {hasPermission(currentUser, 'sales_view') && (
          <NavSection label="Financials">
            <NavItem
              icon={<DollarSign className="h-5 w-5" />}
              label={t('nav.financeLedger')}
              isActive={activeTab === 'sales-finance'}
              onClick={() => handleTabChange('sales-finance')}
            />
          </NavSection>
        )}

        {/* Analytics & Business Planning */}
        {hasPermission(currentUser, 'analytics_view') && (
          <NavSection label="Insights & Planning">
            <NavItem
              icon={<PieChart className="h-5 w-5" />}
              label={t('nav.analytics')}
              isActive={activeTab === 'analytics'}
              onClick={() => handleTabChange('analytics')}
            />
            <NavItem
              icon={<Calculator className="h-5 w-5" />}
              label={t('nav.proposalPlan')}
              isActive={activeTab === 'proposal-plan'}
              onClick={() => handleTabChange('proposal-plan')}
            />
          </NavSection>
        )}

        {/* Administration */}
        {(hasPermission(currentUser, 'settings_manage') || hasPermission(currentUser, 'farms_manage')) && (
          <NavSection label="Administration">
            {hasPermission(currentUser, 'farms_manage') && (
              <NavItem
                icon={<Building className="h-5 w-5" />}
                label={t('nav.farmsBranches')}
                isActive={activeTab === 'farms'}
                onClick={() => handleTabChange('farms')}
              />
            )}
            {hasPermission(currentUser, 'settings_manage') && (
              <NavItem
                icon={<Settings className="h-5 w-5" />}
                label={t('nav.masterSettings')}
                isActive={activeTab === 'settings'}
                onClick={() => handleTabChange('settings')}
              />
            )}
          </NavSection>
        )}
      </nav>

      {/* ─── User Profile Footer ─── */}
      {currentUser && (
        <div className="flex-shrink-0 mx-3 mb-3 mt-1 border-t border-slate-200 pt-3">
          <div className="flex items-center gap-3 bg-slate-50 rounded-xl px-3 py-2.5">
            {/* Avatar */}
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
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex min-h-screen bg-canvas text-ink font-sans">

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-72 flex-shrink-0 flex-col sticky top-0 h-screen">
        {navContent}
      </aside>

      {/* Mobile Backdrop & Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-72 max-w-[82vw] h-full shadow-2xl z-10 flex flex-col">
            {navContent}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col bg-canvas min-w-0 overflow-y-auto">

        {/* Top Header Bar (Hidden when activeTab === 'proposal-plan') */}
        {activeTab !== 'proposal-plan' ? (
          <header className="border-b border-slate-200/70 bg-white/95 backdrop-blur-md px-4 sm:px-6 py-4 sticky top-0 z-20">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                {/* Mobile Hamburger */}
                <button
                  onClick={() => setMobileMenuOpen(true)}
                  className="md:hidden h-12 w-12 flex items-center justify-center rounded-xl bg-slate-100 text-ink hover:bg-slate-200 transition-colors"
                  aria-label="Open menu"
                >
                  <Menu className="h-6 w-6" />
                </button>
                <div>
                  <h2 className="text-base sm:text-xl font-bold tracking-tight text-slate-900 leading-tight">
                    {t('nav.systemTitle')}
                  </h2>
                  <p className="text-xs sm:text-xs text-slate-400 font-semibold flex items-center gap-1.5 mt-0.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                    {t('nav.systemSubtitle')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <LanguageSwitcher />
                <div className="hidden lg:flex text-xs text-slate-500 font-semibold bg-slate-50 py-2 px-3.5 rounded-full border border-slate-200 items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 text-emerald-600" />
                  {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
              </div>
            </div>

            {/* Responsive Stats Strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-400 ">{t('dashboard.totalHerd')}</p>
                  <h3 className="text-xl font-bold text-slate-900 mt-0.5 leading-none">{totalHead}<span className="text-xs text-emerald-600 font-bold ml-1">head</span></h3>
                </div>
                <div className="h-9 w-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm flex-shrink-0">
                  <Database className="h-4 w-4" />
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-400 ">{t('dashboard.avgWeight')}</p>
                  <h3 className="text-xl font-bold text-slate-900 mt-0.5 leading-none">{averageWeight}<span className="text-xs text-blue-600 font-bold ml-1">kg</span></h3>
                </div>
                <div className="h-9 w-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm flex-shrink-0">
                  <Scale className="h-4 w-4" />
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-400 ">{t('dashboard.assetValue')}</p>
                  <h3 className="text-sm font-bold text-slate-900 mt-0.5 leading-none truncate">៛ {format2DecimalsWithCommas(inventoryValue)}</h3>
                </div>
                <div className="h-9 w-9 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-sm flex-shrink-0">
                  <DollarSign className="h-4 w-4" />
                </div>
              </div>

              <div className={`border rounded-xl p-3 flex items-center justify-between ${
 healthAlertsCount > 0 ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50 border-emerald-100'
              }`}>
                <div>
                  <p className="text-xs font-bold text-slate-400 ">Health Status</p>
                  <h3 className={`text-sm font-bold mt-0.5 leading-none ${healthAlertsCount > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                    {healthAlertsCount > 0 ? `${healthAlertsCount} Alerts` : '✓ All Stable'}
                  </h3>
                </div>
                <div className={`h-9 w-9 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0 text-white ${
 healthAlertsCount > 0 ? 'bg-rose-500' : 'bg-emerald-600'
                }`}>
                  <Activity className="h-4 w-4" />
                </div>
              </div>
            </div>
          </header>
        ) : (
          /* Sleek minimal header for mobile navigation when viewing Proposal Plan */
          <div className="md:hidden flex items-center justify-between p-4 bg-white border-b border-slate-200 sticky top-0 z-20">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
              aria-label="Open Navigation Menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <LanguageSwitcher />
          </div>
        )}

        {/* Page Content */}
        <div className="p-4 sm:p-6 flex-1 min-w-0">
          {children}
        </div>
      </main>
    </div>
  );
}
