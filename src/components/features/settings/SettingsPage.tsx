'use client';

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateSettingsAction } from '@/app/actions';
import type { MasterSetup, UserRoleItem } from '@/types/settings.types';
import { isFarmOwner } from '@/lib/user-admin';
import PeoplePanel from './PeoplePanel';
import RolesPanel from './RolesPanel';
import ListsPanel from './ListsPanel';

interface SettingsPageProps {
  settings: MasterSetup;
  currentUser?: UserRoleItem;
  /** Open with the people of this farm, when coming from the Farms page. */
  initialFarm?: string;
}

type Tab = 'people' | 'roles' | 'lists';
const TABS: { key: Tab; label: string }[] = [
  { key: 'people', label: 'People' },
  { key: 'roles', label: 'Roles' },
  { key: 'lists', label: 'Lists' },
];

export default function SettingsPage({ settings, currentUser, initialFarm }: SettingsPageProps) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('people');

  const save = useMutation({
    mutationFn: async (patch: Partial<MasterSetup>) => {
      const res = await updateSettingsAction(patch);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['livestock'] }); },
  });
  // Lists and roles are saved as just the part that changed; people have their own requests.
  const onSettings = async (patch: Partial<MasterSetup>) => { await save.mutateAsync(patch); };
  const onChanged = () => { queryClient.invalidateQueries({ queryKey: ['livestock'] }); };

  if (!currentUser) return null;
  // A farm owner only looks after the people on their own farm.
  const ownerOnly = isFarmOwner(currentUser);

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-10">
      <div>
        <h2 className="text-2xl font-semibold text-ink">{ownerOnly ? 'People' : 'Settings'}</h2>
        <p className="text-base text-ink-muted">{ownerOnly ? 'Add and manage the staff on your farm.' : 'Who can sign in, what they can do, and the choices in your forms.'}</p>
      </div>

      {!ownerOnly && (
        <div role="tablist" aria-label="Settings" className="flex rounded-xl bg-slate-100 p-1 sm:w-fit">
          {TABS.map(t => (
            <button key={t.key} role="tab" type="button" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
              className={`min-h-11 flex-1 whitespace-nowrap rounded-lg px-4 text-base font-medium sm:px-6 ${tab === t.key ? 'bg-white text-emerald-800 shadow-sm' : 'text-ink-muted hover:text-ink'}`}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {(ownerOnly || tab === 'people') && <PeoplePanel settings={settings} actor={currentUser} onChanged={onChanged} initialFarm={initialFarm} />}
      {!ownerOnly && tab === 'roles' && <RolesPanel settings={settings} actor={currentUser} onSettings={onSettings} />}
      {!ownerOnly && tab === 'lists' && <ListsPanel settings={settings} onSettings={onSettings} />}
    </div>
  );
}
