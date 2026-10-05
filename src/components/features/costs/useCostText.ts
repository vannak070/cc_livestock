'use client';

import { useLanguage } from '@/context/LanguageContext';

/**
 * Text for the Costs screens in the chosen language (src/locales, `costs`).
 * `{name}` placeholders are filled from `vars`. Kinds of cost are saved in
 * English; the built-in ones are shown translated, kinds added in Settings
 * as typed.
 */
export function useCostText() {
  const { t, language } = useLanguage();
  const text = (key: string, vars: Record<string, string | number> = {}) =>
    t(`costs.${key}`).replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m));
  const category = (c: string) => (c.includes('.') ? c : t(`costs.categories.${c}`, c));
  /** A kind of cost inside a sentence: lower case in English ("How much for wages?"). */
  const inline = (c: string) => (language === 'en' ? category(c).toLowerCase() : category(c));
  const months = t('costs.months').split(',');
  const monthName = (yyyyMm: string) => `${months[Number(yyyyMm.slice(5, 7)) - 1] ?? yyyyMm.slice(5, 7)} ${yyyyMm.slice(0, 4)}`;
  return { text, category, inline, monthName };
}
