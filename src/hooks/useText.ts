'use client';

import { useLanguage } from '@/context/LanguageContext';

/**
 * A screen's words in the chosen language, from one section of src/locales
 * (for example `useText('todayPage')`). `tx('greeting', { name })` fills
 * `{name}` placeholders. English is the fallback for anything Khmer lacks.
 * Data (tags, breeds, farm names, numbers) is shown as it is.
 */
export function useText(section: string) {
  const { t, language } = useLanguage();
  const tx = (key: string, vars: Record<string, string | number> = {}) =>
    t(`${section}.${key}`).replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m));
  /** One of two keys by count, e.g. txn(n, 'animalOne', 'animalMany', { n }). Khmer usually uses the same text for both. */
  const txn = (n: number, one: string, many: string, vars: Record<string, string | number> = {}) => tx(n === 1 ? one : many, { n, ...vars });
  return { tx, txn, t, language };
}
