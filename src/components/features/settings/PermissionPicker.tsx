'use client';

import React from 'react';
import { PERMISSION_MODULES, type PermissionKey } from '@/types/settings.types';
import { useText } from '@/hooks/useText';
import { en as permWords } from '@/locales/sections/permissions';

interface PermissionPickerProps {
  value: PermissionKey[];
  onChange: (next: PermissionKey[]) => void;
  /** What the person making the change may hand out; the rest is shown but locked. */
  allowed: PermissionKey[];
}

const clean = (label: string) => label.replace(/^[^\p{L}\p{N}]+/u, '');

/** The things someone can do, grouped by area, each a big on/off switch. */
export default function PermissionPicker({ value, onChange, allowed }: PermissionPickerProps) {
  const { tx } = useText('settingsPage');
  const perm = useText('permissions');
  // Names in the chosen language when this list knows them; otherwise the label from the types file.
  const word = (key: string, fallback: string) => (key in permWords ? perm.tx(key) : fallback);
  const toggle = (key: PermissionKey) => onChange(value.includes(key) ? value.filter(k => k !== key) : [...value, key]);

  return (
    <div className="space-y-5">
      {PERMISSION_MODULES.map(module => {
        const keys = module.items.map(i => i.key);
        const usable = keys.filter(k => allowed.includes(k));
        const allOn = usable.length > 0 && usable.every(k => value.includes(k));
        return (
          <section key={module.id} aria-label={word(`mod_${module.id}`, clean(module.label))}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <h4 className="text-lg font-semibold text-ink">{word(`mod_${module.id}`, clean(module.label))}</h4>
              {usable.length > 1 && (
                <button
                  type="button"
                  onClick={() => onChange(allOn ? value.filter(k => !usable.includes(k)) : [...new Set([...value, ...usable])])}
                  className="min-h-11 text-base font-medium text-emerald-800 underline-offset-4 hover:underline"
                >
                  {allOn ? tx('clearThese') : tx('chooseAll')}
                </button>
              )}
            </div>
            <ul className="space-y-2">
              {module.items.map(item => {
                const locked = !allowed.includes(item.key);
                const on = value.includes(item.key);
                return (
                  <li key={item.key}>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={on}
                      disabled={locked}
                      onClick={() => toggle(item.key)}
                      className={`flex min-h-16 w-full items-center justify-between gap-4 rounded-xl border-2 px-4 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${on ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200 bg-white hover:border-emerald-600'}`}
                    >
                      <span>
                        <span className="block text-lg font-medium text-ink">{word(`perm_${item.key}`, item.label)}</span>
                        <span className="block text-base text-ink-muted">{locked ? tx('lockedPerm') : word(`desc_${item.key}`, item.description)}</span>
                      </span>
                      <span aria-hidden className={`flex h-8 w-14 shrink-0 items-center rounded-full p-1 transition-colors ${on ? 'bg-emerald-600' : 'bg-slate-300'}`}>
                        <span className={`h-6 w-6 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-6' : ''}`} />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
