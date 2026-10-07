import { en, type Dict } from './en';
import { km } from './km';
import type { Lang } from './langs';

export * from './langs';
export type { Dict };

const DICTS: Record<Lang, Dict> = { km, en };

/** The site's words in one language. */
export const getDict = (lang: Lang): Dict => DICTS[lang];

/** Fills {name} placeholders. */
export const fill = (text: string, vars: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));

/** A stored value (sex, weight class...) in the chosen language; unknown values as they are. */
export const valueText = (map: Record<string, string>, v: string) => map[v] ?? v;
