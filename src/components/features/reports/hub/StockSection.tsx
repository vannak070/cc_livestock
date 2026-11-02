'use client';

import React, { useMemo } from 'react';
import { HELD_ALERT_DAYS, heldLots, soldLots } from '@/lib/camcow-stock';
import { farmToday } from '@/lib/daily-feed';
import { shownDay } from '@/lib/khmer-date';
import { useText } from '@/hooks/useText';
import { Fold, Tile } from '../parts';
import type { ReportData } from './useReportData';

const riel = (n: number) => `${Math.round(n).toLocaleString('en-US')} ៛`;
const mil = (n: number) => `${(n / 1_000_000).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} M ៛`;

/** The cattle CC Livestock holds after collecting them from farms, read-only (the stock is worked on Action plans → CamCow stock). */
export default function StockSection({ r }: { r: ReportData }) {
  const { tx, language } = useText('camcowStock');
  const today = farmToday();
  const lots = useMemo(() => heldLots(r.holdings, today), [r.holdings, today]);
  const sold = useMemo(() => soldLots(r.holdings), [r.holdings]);
  const s = r.stock;
  if (!s) return <p className="rounded-xl bg-slate-50 p-5 text-base text-ink-muted">{tx('lotsEmpty')}</p>;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Tile label={tx('tInStock')} value={String(s.held)} sub={tx('tInStockSub', { kg: Math.round(s.heldKg).toLocaleString('en-US'), cost: mil(s.heldCost) })} />
        <Tile label={tx('tDays')} value={String(s.avgDaysHeld)} sub={s.held ? tx('tDaysSub', { n: s.oldestDaysHeld }) : undefined} />
        <Tile label={tx('tTooLong', { n: HELD_ALERT_DAYS })} value={String(s.heldTooLong)} tone={s.heldTooLong > 0 ? 'warn' : undefined} />
        <Tile label={tx('tSold')} value={String(s.sold)} sub={tx('tSoldSub', { amount: mil(s.soldRevenue) })} />
        <Tile label={tx('tMargin')} value={s.sold ? mil(s.marginAfterCosts) : '—'} sub={s.soldCost > 0 ? tx('tMarginAfter', { cost: mil(s.soldCost) }) : tx('tMarginSub')} tone={s.sold ? (s.marginAfterCosts >= 0 ? 'good' : 'bad') : undefined} />
      </div>
      {s.lost > 0 && <p className="text-base text-ink-muted">{tx('tLost')}: <b className="text-rose-800">{s.lost}</b> · {tx('tLostSub', { cost: mil(s.lostCost) })}</p>}

      <Fold title={tx('lotsTitle')} headline={tx('tInStockSub', { kg: Math.round(s.heldKg).toLocaleString('en-US'), cost: mil(s.heldCost) })} defaultOpen>
        {lots.length === 0 ? <p className="text-base text-ink-muted">{tx('lotsEmpty')}</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-base">
              <thead className="text-ink-muted"><tr>
                <th className="px-2 py-2 font-medium">{tx('colFarm')}</th><th className="px-2 py-2 font-medium">{tx('colCollected')}</th><th className="px-2 py-2 text-right font-medium">{tx('colHead')}</th>
                <th className="px-2 py-2 text-right font-medium">{tx('colKg')}</th><th className="px-2 py-2 text-right font-medium">{tx('colCost')}</th><th className="px-2 py-2 text-right font-medium">{tx('colDays')}</th>
              </tr></thead>
              <tbody>
                {lots.map(l => (
                  <tr key={l.key} className="border-t border-slate-100">
                    <td className="px-2 py-2 font-medium text-ink">{l.farm}</td>
                    <td className="px-2 py-2 whitespace-nowrap">{shownDay(l.collectedOn, language)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{l.head}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{Math.round(l.kg).toLocaleString('en-US')} kg</td>
                    <td className="px-2 py-2 text-right tabular-nums">{riel(l.cost)}</td>
                    <td className={`px-2 py-2 text-right tabular-nums ${l.daysHeld > HELD_ALERT_DAYS ? 'font-semibold text-amber-800' : ''}`}>{l.daysHeld}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Fold>

      <Fold title={tx('soldTitle')} headline={tx('tSoldSub', { amount: mil(s.soldRevenue) })}>
        {sold.length === 0 ? <p className="text-base text-ink-muted">{tx('soldEmpty')}</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-base">
              <thead className="text-ink-muted"><tr>
                <th className="px-2 py-2 font-medium">{tx('colSoldOn')}</th><th className="px-2 py-2 font-medium">{tx('colBuyer')}</th><th className="px-2 py-2 font-medium">{tx('colFarm')}</th>
                <th className="px-2 py-2 text-right font-medium">{tx('colHead')}</th><th className="px-2 py-2 text-right font-medium">{tx('colSale')}</th><th className="px-2 py-2 text-right font-medium">{tx('colMargin')}</th>
              </tr></thead>
              <tbody>
                {sold.slice(0, 15).map(l => (
                  <tr key={l.key} className="border-t border-slate-100">
                    <td className="px-2 py-2 whitespace-nowrap">{shownDay(l.soldOn, language)}</td><td className="px-2 py-2">{l.buyer}</td><td className="px-2 py-2">{l.farm}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{l.head}</td><td className="px-2 py-2 text-right tabular-nums">{riel(l.total)}</td>
                    <td className={`px-2 py-2 text-right tabular-nums ${l.margin < 0 ? 'text-rose-800' : 'text-emerald-800'}`}>{riel(l.margin)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {sold.length > 15 && <p className="px-2 pt-1 text-sm text-ink-muted">{tx('more', { n: 15, total: sold.length })}</p>}
          </div>
        )}
      </Fold>
      {r.buyers.some(b => b.sold > 0) && (
        <Fold title={tx('buyersTitle')} headline={`${tx('tHeadSold')}: ${r.buyers.reduce((a, b) => a + b.head, 0)} · ${mil(r.buyers.reduce((a, b) => a + b.sold, 0))}`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-base">
              <thead className="text-ink-muted"><tr>
                <th className="px-2 py-2 font-medium">{tx('colBuyer')}</th><th className="px-2 py-2 text-right font-medium">{tx('colHead')}</th><th className="px-2 py-2 text-right font-medium">{tx('colSale')}</th>
                <th className="px-2 py-2 text-right font-medium">{tx('colKg')}</th><th className="px-2 py-2 text-right font-medium">{tx('colPerKg')}</th><th className="px-2 py-2 text-right font-medium">{tx('colMargin')}</th>
              </tr></thead>
              <tbody>
                {r.buyers.filter(b => b.sold > 0).map(b => (
                  <tr key={b.buyer.id} className="border-t border-slate-100">
                    <td className="px-2 py-2 font-medium text-ink">{b.buyer.name}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{b.head}</td><td className="px-2 py-2 text-right tabular-nums">{riel(b.sold)}</td><td className="px-2 py-2 text-right tabular-nums">{Math.round(b.kg).toLocaleString('en-US')} kg</td>
                    <td className="px-2 py-2 text-right tabular-nums">{riel(b.perKg)}</td>
                    <td className={`px-2 py-2 text-right tabular-nums ${b.margin < 0 ? 'text-rose-800' : 'text-emerald-800'}`}>{riel(b.margin)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Fold>
      )}
      <p className="text-sm text-ink-muted">{tx('note')}</p>
    </>
  );
}
