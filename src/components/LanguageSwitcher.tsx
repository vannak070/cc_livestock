'use client';

import React from 'react';
import { useLanguage, Language } from '@/context/LanguageContext';
import { Globe } from 'lucide-react';

export default function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/60 shadow-xs">
      <button
        type="button"
        onClick={() => setLanguage('km')}
        className={`flex items-center gap-1.5 min-h-11 px-3 rounded-lg text-sm font-bold transition-all ${
 language === 'km'
            ? 'bg-emerald-600 text-white shadow-xs'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
        }`}
        title="ភាសាខ្មែរ (Khmer)"
      >
        <span>🇰🇭</span>
        <span>ខ្មែរ</span>
      </button>
      <button
        type="button"
        onClick={() => setLanguage('en')}
        className={`flex items-center gap-1.5 min-h-11 px-3 rounded-lg text-sm font-bold transition-all ${
 language === 'en'
            ? 'bg-emerald-600 text-white shadow-xs'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
        }`}
        title="English"
      >
        <span>🇬🇧</span>
        <span>EN</span>
      </button>
    </div>
  );
}
