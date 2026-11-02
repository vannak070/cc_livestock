'use client';

import React from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { shownDay } from '@/lib/khmer-date';
import { useText } from '@/hooks/useText';
import { Fold, Tile } from '../parts';
import type { ERPLivestockData, UserRoleItem } from '@/lib/types';
import BuybacksReport from '../BuybacksReport';
import type { ReportData } from './useReportData';

const riel = (n: number) => `${Math.round(n).toLocaleString('en-US')} ៛`;
const num = (n: number) => n.toLocaleString('en-US');
const GREEN = '#138E46';
const BLUE = '#2B6CB0';

/** Cattle inventory and buy-back obligations, as in the CAmCOW control dashboard: tiles, the maturity and movement charts, and the farm and buy-back tables. */
export default function BuybacksSection({ r, data, currentUser, farm, onOpenActionPlans }: { r: ReportData; data: ERPLivestockData; currentUser: UserRoleItem; farm: string; onOpenActionPlans?: () => void }) {
  const rs = useText('reportsPage');
  const cd = useText('controlDashboard');
  const { language } = useText('reportsPage');
  const { dash } = r;
  if (!dash) return null;
  const { inventory: inv, buyback: bb } = dash;
  const maturity = [
    { name: cd.tx('bOverdue'), head: dash.maturity.overdue }, { name: cd.tx('b7'), head: dash.maturity.d7 }, { name: cd.tx('b30'), head: dash.maturity.d30 },
    { name: cd.tx('b60'), head: dash.maturity.d60 }, { name: cd.tx('b60p'), head: dash.maturity.later },
  ];
  const when = (days?: number) => (days === undefined ? '' : days < 0 ? cd.tx('scrLate', { n: -days }) : cd.tx('scrIn', { n: days }));
  const farmers = dash.farmers.filter(f => f.withFarmer > 0 || f.remaining > 0 || f.overdue > 0);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label={cd.tx('iWith')} value={num(inv.withFarmers)} />
        <Tile label={cd.tx('iDelivered')} value={num(inv.delivered)} />
        <Tile label={cd.tx('iBought')} value={num(inv.boughtBack)} />
        <Tile label={cd.tx('iMissing')} value={num(inv.missing)} tone={inv.missing > 0 ? 'warn' : undefined} />
        <Tile label={cd.tx('iOverdue')} value={num(inv.overdue)} tone={inv.overdue > 0 ? 'bad' : 'good'} />
        <Tile label={cd.tx('iDue7')} value={num(inv.due7)} tone={inv.due7 > 0 ? 'warn' : undefined} />
        <Tile label={cd.tx('iDue30')} value={num(inv.due30)} />
        <Tile label={cd.tx('iDue60')} value={num(inv.due60)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <figure className="rounded-xl p-4 ring-1 ring-slate-200">
          <figcaption className="mb-2 text-lg font-semibold text-ink">{cd.tx('chMaturity')}</figcaption>
          <div className="h-52" role="img" aria-label={cd.tx('chMaturity')}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={maturity} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="head" fill={GREEN} radius={[4, 4, 0, 0]} barSize={26} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </figure>
        <figure className="rounded-xl p-4 ring-1 ring-slate-200">
          <figcaption className="mb-2 text-lg font-semibold text-ink">{cd.tx('chMovement')}</figcaption>
          <div className="h-52" role="img" aria-label={cd.tx('chMovement')}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dash.movement.map(m => ({ name: `${m.month.slice(5)}/${m.month.slice(2, 4)}`, delivered: m.delivered, bought: m.boughtBack }))} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="delivered" name={cd.tx('lDelivered')} fill={GREEN} radius={[4, 4, 0, 0]} barSize={10} isAnimationActive={false} />
                <Bar dataKey="bought" name={cd.tx('lBought')} fill={BLUE} radius={[4, 4, 0, 0]} barSize={10} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </figure>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label={cd.tx('bRemaining')} value={riel(bb.remaining)} />
        <Tile label={cd.tx('bContract')} value={riel(bb.contractValue)} />
        <Tile label={cd.tx('bNeed30')} value={riel(bb.cash30Buybacks)} tone={bb.cash30Buybacks > 0 ? 'warn' : undefined} />
        <Tile label={cd.tx('bNoPrice')} value={num(bb.noPriceHead)} tone={bb.noPriceHead > 0 ? 'warn' : undefined} />
      </div>

      <Fold title={cd.tx('scrFarms')} headline={cd.tx('hlFarms', { n: farmers.length })} defaultOpen>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-base">
            <thead className="text-ink-muted"><tr>
              <th className="px-2 py-2 font-medium">{cd.tx('thName')}</th><th className="px-2 py-2 text-right font-medium">{cd.tx('thWith')}</th><th className="px-2 py-2 text-right font-medium">{cd.tx('thBought')}</th>
              <th className="px-2 py-2 text-right font-medium">{cd.tx('thOverdue')}</th><th className="px-2 py-2 text-right font-medium">{cd.tx('thRemaining')}</th>
            </tr></thead>
            <tbody>
              {farmers.map(f => (
                <tr key={f.name} className="border-t border-slate-100">
                  <td className="px-2 py-2 font-medium text-ink">{f.name}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{num(f.withFarmer)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{num(f.boughtBack)}</td>
                  <td className={`px-2 py-2 text-right tabular-nums ${f.overdue > 0 ? 'font-semibold text-rose-800' : ''}`}>{num(f.overdue)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{f.remaining ? riel(f.remaining) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Fold>

      <Fold title={cd.tx('scrNext')} headline={cd.tx('hlNext', { n: dash.upcoming.length })}>
        {dash.upcoming.length === 0 ? <p className="text-base text-ink-muted">{cd.tx('scrNextNone')}</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-base">
              <thead className="text-ink-muted"><tr>
                <th className="px-2 py-2 font-medium">{cd.tx('thBatch')}</th><th className="px-2 py-2 font-medium">{cd.tx('thFarmer')}</th><th className="px-2 py-2 font-medium">{cd.tx('thDue')}</th>
                <th className="px-2 py-2 text-right font-medium">{cd.tx('thValue')}</th>
              </tr></thead>
              <tbody>
                {dash.upcoming.slice(0, 10).map((u, i) => (
                  <tr key={`${u.batch}-${i}`} className="border-t border-slate-100">
                    <td className="px-2 py-2 font-medium text-ink">{u.batch}</td>
                    <td className="px-2 py-2">{u.farm}</td>
                    <td className={`px-2 py-2 ${u.bucket === 'overdue' ? 'font-semibold text-rose-800' : ''}`}>{shownDay(u.dueDate, language)} <span className="text-sm text-ink-muted">({when(u.days)})</span></td>
                    <td className="px-2 py-2 text-right tabular-nums">{u.value !== undefined ? riel(u.value) : '—'}{u.value !== undefined && u.estimate && <span className="ml-1 text-amber-800">*</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="px-2 pt-1 text-sm text-ink-muted">* {cd.tx('estimate')}</p>
          </div>
        )}
      </Fold>

      <Fold title={rs.tx('bbSchedule')} headline={rs.tx('bbScheduleHeadline')}>
        <BuybacksReport data={data} currentUser={currentUser} farm={farm} onOpenActionPlans={onOpenActionPlans} />
      </Fold>
    </>
  );
}
