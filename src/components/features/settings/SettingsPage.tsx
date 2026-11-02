'use client';

import React, { useState } from 'react';
import PageTabs from '@/components/ui/page-tabs';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateSettingsAction } from '@/app/actions';
import type { MasterSetup, UserRoleItem } from '@/types/settings.types';
import { isFarmOwner } from '@/lib/user-admin';
import PeoplePanel from './PeoplePanel';
import RolesPanel from './RolesPanel';
import ListsPanel from './ListsPanel';
import AlertsPanel from './AlertsPanel';
import SignInPanel from './SignInPanel';
import { canSetSessionPolicy } from '@/lib/session-policy';
import { useText } from '@/hooks/useText';

interface SettingsPageProps {
  settings: MasterSetup;
  currentUser?: UserRoleItem;
  /** Opens the Farms page, where farm people are looked after; only for people who may open it. */
  onOpenFarms?: () => void;
}

type Tab = 'people' | 'roles' | 'lists' | 'alerts' | 'signin';
const TABS: { key: Tab; label: string }[] = [
  { key: 'people', label: 'tabPeople' },
  { key: 'roles', label: 'tabRoles' },
  { key: 'lists', label: 'tabLists' },
  { key: 'alerts', label: 'tabAlerts' },
];

export default function SettingsPage({ settings, currentUser, onOpenFarms }: SettingsPageProps) {
  const queryClient = useQueryClient();
  const { tx, t } = useText('settingsPage');
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
        <p className="text-base text-ink-muted">{ownerOnly ? tx('introPeople') : tx('introSettings')}</p>
      </div>

      {!ownerOnly && (
        <PageTabs
          label={tx('titleSettings')}
          active={tab}
          onChange={id => setTab(id as Tab)}
          tabs={[
            ...TABS.map(tb => ({ id: tb.key, label: tx(tb.label) })),
            // The sign-in time limit is the Super Admin's alone.
            ...(canSetSessionPolicy(currentUser) ? [{ id: 'signin', label: t('session.tab') }] : []),
          ]}
        />
      )}

      {(ownerOnly || tab === 'people') && <PeoplePanel settings={settings} actor={currentUser} onChanged={onChanged} onOpenFarms={onOpenFarms} />}
      {!ownerOnly && tab === 'roles' && <RolesPanel settings={settings} actor={currentUser} onSettings={onSettings} />}
      {!ownerOnly && tab === 'lists' && <ListsPanel settings={settings} onSettings={onSettings} />}
      {!ownerOnly && tab === 'alerts' && <AlertsPanel settings={settings} onSettings={onSettings} />}
      {!ownerOnly && tab === 'signin' && canSetSessionPolicy(currentUser) && <SignInPanel settings={settings} />}
    </div>
  );
}
