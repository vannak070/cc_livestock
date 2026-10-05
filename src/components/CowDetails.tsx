'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { StockItem, WeightRecord, SalesRecord } from '@/lib/xlsx-parser';
import { HealthLogItem } from '@/lib/types';
import { User, MapPin, Phone, Scale, Activity, DollarSign, Syringe, Heart, Calendar } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { format2Decimals, format2DecimalsWithCommas } from '@/lib/utils';

interface CowDetailsProps {
  cowId: string | null;
  isOpen: boolean;
  onClose: () => void;
  stock: StockItem[];
  weightTracking: WeightRecord[];
  salesTracking: SalesRecord[];
  healthLogs: HealthLogItem[];
  onUpdateCowImage?: (cowId: string, imageUrl: string) => Promise<void>;
}

const REALISTIC_CATTLE_FALLBACK = 'https://images.unsplash.com/photo-1546445317-29f4545f9d52?auto=format&fit=crop&w=800&q=80';
const DEFAULT_CATTLE_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" fill="none"><rect width="800" height="500" rx="30" fill="%230f172a"/><path d="M0 350 Q 200 280 400 350 T 800 320 L 800 500 L 0 500 Z" fill="%23047857" opacity="0.4"/><g transform="translate(250, 100) scale(1.4)"><ellipse cx="140" cy="130" rx="90" ry="55" fill="%23334155"/><ellipse cx="50" cy="90" rx="35" ry="25" fill="%23475569"/><ellipse cx="30" cy="95" rx="15" ry="12" fill="%2364748b"/><path d="M 60 70 Q 75 50 65 75 Z" fill="%23334155"/><path d="M 50 65 Q 45 40 35 50" stroke="%23f8fafc" stroke-width="4" stroke-linecap="round"/><rect x="75" y="170" width="16" height="60" rx="6" fill="%231e293b"/><rect x="115" y="170" width="16" height="60" rx="6" fill="%23334155"/><rect x="175" y="170" width="16" height="60" rx="6" fill="%231e293b"/><rect x="205" y="170" width="16" height="60" rx="6" fill="%23334155"/><path d="M 225 125 Q 245 150 240 180" stroke="%231e293b" stroke-width="4" stroke-linecap="round"/></g><text x="400" y="440" text-anchor="middle" fill="%2394a3b8" font-family="sans-serif" font-size="18" font-weight="800" letter-spacing="2">LIVESTOCK HERD REGISTRY</text></svg>`;

export default function CowDetails({
  cowId,
  isOpen,
  onClose,
  stock,
  weightTracking,
  salesTracking,
  healthLogs
}: CowDetailsProps) {
  const { t } = useLanguage();
  const [currentImg, setCurrentImg] = useState<string>(REALISTIC_CATTLE_FALLBACK);

  const cow = stock.find(c => c.id?.trim().toLowerCase() === cowId?.trim().toLowerCase());

  React.useEffect(() => {
    if (cow?.imageUrl && cow.imageUrl.trim().length > 0) {
      setCurrentImg(cow.imageUrl);
    } else {
      setCurrentImg(REALISTIC_CATTLE_FALLBACK);
    }
  }, [cowId, cow?.imageUrl]);

  if (!cowId || !cow) return null;

  // Filter weight records
  const history = weightTracking
    .filter(w => w.cowId === cowId)
    .sort((a, b) => {
      const timeA = a.trackingDate ? new Date(a.trackingDate).getTime() : 0;
      const timeB = b.trackingDate ? new Date(b.trackingDate).getTime() : 0;
      if (timeA !== timeB) return timeA - timeB;
      if (a.oldWeight === 0 && b.oldWeight !== 0) return -1;
      if (a.oldWeight !== 0 && b.oldWeight === 0) return 1;
      return a.currentWeight - b.currentWeight;
    });

  const initialWeight = history.length > 0 ? (history[0].oldWeight > 0 ? history[0].oldWeight : history[0].currentWeight) : cow.weight;
  const currentWeight = history.length > 0 ? Math.max(history[history.length - 1].currentWeight, cow.weight || 0) : cow.weight;
  const weightGain = Math.round((currentWeight - initialWeight) * 10) / 10;

  // Filter sales details
  const sale = salesTracking.find(s => s.cowId === cowId);

  // Filter health/medical logs for this cow
  const cowMedicalLogs = healthLogs.filter(log => log.cowId === cowId);

  // Dynamic P&L Calculation per Cow
  const purchaseCost = cow.totalPrice || 0;
  const medicalExpenses = cowMedicalLogs.reduce((sum, log) => sum + (log.cost || 0), 0);
  const totalInvestment = purchaseCost + medicalExpenses;
  const salesRevenue = sale ? sale.totalPrice : 0;
  const netProfitLoss = cow.status === 'Sold' 
    ? salesRevenue - totalInvestment 
    : (cow.status.toLowerCase() === 'dead' ? -totalInvestment : -medicalExpenses);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto bg-white border border-slate-200/80 text-slate-800 rounded-3xl shadow-2xl p-6 sm:p-7">
        {/* Header */}
        <DialogHeader className="border-b border-slate-100 pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <DialogTitle className="text-2xl font-bold tracking-tight text-slate-900">{cow.id}</DialogTitle>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
 cow.status.toLowerCase() === 'active'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
                    : cow.status.toLowerCase() === 'dead'
                    ? 'bg-rose-50 text-rose-700 border border-rose-200/80'
                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}>
                  ● {cow.status}
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100/80 text-slate-700 border border-slate-200/80">
                  {cow.breed}
                </span>
                {cow.location && (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50/80 text-emerald-800 border border-emerald-200/60 flex items-center gap-1">
                    📍 {cow.location}
                  </span>
                )}
              </div>
              <DialogDescription className="text-xs text-slate-450 mt-1.5 font-semibold">
                Herd Registry Record • Registered on {cow.purchaseDate ? new Date(cow.purchaseDate).toLocaleDateString() : 'N/A'}
              </DialogDescription>
            </div>
            {cow.status === 'Sold' && sale && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 px-4 py-2.5 rounded-2xl text-xs font-bold text-slate-800 shadow-xs flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 block animate-pulse" />
                Sold for <span className="text-emerald-700 font-bold text-sm">៛ {sale.totalPrice.toLocaleString()}</span>
              </div>
            )}
          </div>
        </DialogHeader>

        {/* Content Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          {/* Left Column: Photo & Biological Profile */}
          <div className="lg:col-span-1 space-y-6">
            {/* Display Cattle Photo */}
            <div className="overflow-hidden rounded-2xl border border-slate-200/80 shadow-md bg-slate-100 group">
              <img
                src={currentImg}
                alt={`Cattle ${cow.id}`}
                onError={() => setCurrentImg(DEFAULT_CATTLE_SVG)}
                className="w-full h-56 object-cover transition-transform duration-300 group-hover:scale-105"
              />
            </div>

            {/* Biological Profile */}
            <div>
              <h4 className="text-xs font-bold text-slate-400 mb-3 flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-emerald-600" />
                Biological Profile
              </h4>
              <div className="bg-slate-50/80 border border-slate-200/60 p-4 rounded-2xl space-y-3.5 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 flex-shrink-0">
                    <Scale className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-bold ">{t('inventory.initialWeight')}</p>
                    <p className="text-sm font-bold text-slate-900">{format2Decimals(initialWeight)} <span className="text-xs text-slate-500 font-bold">kg</span></p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 flex-shrink-0">
                    <Scale className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-bold ">{t('inventory.currentWeight')}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-emerald-700">{format2Decimals(currentWeight)} <span className="text-xs text-slate-500 font-bold">kg</span></p>
                      {weightGain > 0 && (
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded-md">
                          +{format2Decimals(weightGain)} kg
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0">
                    <Activity className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-bold ">Herd Health State</p>
                    <p className="text-xs font-bold text-slate-800">{cow.healthStatus}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 flex-shrink-0">
                    <User className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-bold ">Source Supplier</p>
                    <p className="text-xs font-bold text-slate-800">{cow.ownerName || 'N/A'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 flex-shrink-0">
                    <MapPin className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-bold ">Barn / Location</p>
                    <p className="text-xs font-bold text-slate-800">{cow.location || 'N/A'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600 flex-shrink-0">
                    <Phone className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-bold ">Contact Phone</p>
                    <p className="text-xs font-bold text-slate-800 font-mono">{cow.phone || 'N/A'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Financial Ledger & Health History */}
          <div className="lg:col-span-2 space-y-6">
            {/* Financial Ledger P&L */}
            <div>
              <h4 className="text-xs font-bold text-slate-400 mb-3 flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
                Financial Ledger (P&L Valuation)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-slate-50/80 border border-slate-200/60 p-4 rounded-2xl shadow-xs">
                  <p className="text-xs font-bold text-slate-400 ">Purchase Price</p>
                  <p className="text-base font-bold text-slate-900 mt-1">៛ {format2DecimalsWithCommas(purchaseCost)}</p>
                  <span className="text-xs text-slate-400 font-bold">{cow.buyType || 'Lumpsum'} basis</span>
                </div>

                <div className="bg-rose-50/30 border border-rose-100/60 p-4 rounded-2xl shadow-xs">
                  <p className="text-xs font-bold text-slate-400 ">Medical Expenses</p>
                  <p className="text-base font-bold text-rose-600 mt-1">៛ {format2DecimalsWithCommas(medicalExpenses)}</p>
                  <span className="text-xs text-rose-400 font-bold">{cowMedicalLogs.length} clinical logs</span>
                </div>

                <div className={`p-4 rounded-2xl border shadow-xs ${
 netProfitLoss >= 0 ? 'bg-emerald-50/50 border-emerald-200/70' : 'bg-rose-50/50 border-rose-200/70'
                }`}>
                  <p className="text-xs font-bold text-slate-400 ">Net Profit / Loss</p>
                  <p className={`text-base font-bold mt-1 ${netProfitLoss >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                    ៛ {format2DecimalsWithCommas(netProfitLoss)}
                  </p>
                  <span className={`text-xs font-bold ${netProfitLoss >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                    {cow.status === 'Sold' ? 'Realized P&L' : 'Unrealized asset'}
                  </span>
                </div>
              </div>
            </div>

            {/* Medical & Vaccination History Logs */}
            <div>
              <h4 className="text-xs font-bold text-slate-400 mb-3 flex items-center gap-1.5">
                <Syringe className="h-3.5 w-3.5 text-emerald-600" />
                Medical Treatments & Vaccine Logs
              </h4>
              {cowMedicalLogs.length > 0 ? (
                <div className="bg-slate-50/80 border border-slate-200/60 rounded-2xl overflow-hidden shadow-xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100/70 text-slate-400 font-bold text-xs border-b border-slate-200/60">
                      <tr>
                        <th className="py-2.5 px-3.5">Type</th>
                        <th className="py-2.5 px-3.5">Treatment / Vaccine</th>
                        <th className="py-2.5 px-3.5">Date</th>
                        <th className="py-2.5 px-3.5 text-right">Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/50 font-medium text-slate-700">
                      {cowMedicalLogs.map(log => (
                        <tr key={log.id} className="hover:bg-white/60">
                          <td className="py-2.5 px-3.5 font-bold text-emerald-700">{log.type}</td>
                          <td className="py-2.5 px-3.5 font-semibold text-slate-900">{log.name}</td>
                          <td className="py-2.5 px-3.5 text-slate-500">{log.date}</td>
                          <td className="py-2.5 px-3.5 text-right font-bold text-slate-900">៛ {(log.cost || 0).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="bg-slate-50/60 border border-slate-200/50 p-6 rounded-2xl text-center text-xs text-slate-400 font-bold">
                  No medical or vaccination records registered for this cow.
                </div>
              )}
            </div>

            {/* Breeding / Reproductive Profile (for female cows) */}
            {(cow.sex === 'Female' || cow.sex === 'F') && (
              <div>
                <h4 className="text-xs font-bold text-slate-400 mb-3 flex items-center gap-1.5">
                  <Heart className="h-3.5 w-3.5 text-rose-500" />
                  Reproductive & Breeding State
                </h4>
                <div className="bg-rose-50/30 border border-rose-100/60 p-4 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 font-semibold">Reproductive Status:</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold text-xs">
                      Open / Ready
                    </span>
                  </div>
                  <p className="text-xs text-slate-450 font-medium">
                    Female cattle registry record. Track breeding cycles and pregnancy check logs in ERP setup.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
