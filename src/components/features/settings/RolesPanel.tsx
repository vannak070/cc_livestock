'use client';

import React, { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { ALL_PERMISSIONS, type CustomRoleDefinition, type MasterSetup, type UserRoleItem } from '@/types/settings.types';
import { SYSTEM_ROLES, deleteRole, followsRole, roleDeleteBlock, rolesOf, saveRole, type RoleInput, knownPermissionCount, usesStandardDescription } from '@/lib/user-admin';
import { getErrorMessage } from '@/lib/utils';
import RoleFlow from './RoleFlow';
import { useText } from '@/hooks/useText';

interface RolesPanelProps {
  settings: MasterSetup;
  actor: UserRoleItem;
  onSettings: (patch: Partial<MasterSetup>) => Promise<void>;
}

const newId = () => Math.random().toString(36).slice(2, 8).toUpperCase();

export default function RolesPanel({ settings, actor, onSettings }: RolesPanelProps) {
  const { tx, txn } = useText('settingsPage');
  const [flow, setFlow] = useState<null | { role: CustomRoleDefinition | null }>(null);
  const [confirm, setConfirm] = useState<null | { title: string; description: string; type: 'danger' | 'info'; confirmText: string; onConfirm?: () => void }>(null);
  const roles = rolesOf(settings);
  // Built-in roles show the app's own wording in the chosen language, unless an admin described them.
  const describe = (r: CustomRoleDefinition) => (SYSTEM_ROLES.some(s => s.name === r.name) && usesStandardDescription(r)
    ? tx(`desc_${r.name}`)
    : usesStandardDescription(r) ? tx('customRole') : r.description!);
  const people = (name: string) => (settings.users || []).filter(u => u.role === name).length;

  const askDelete = (role: CustomRoleDefinition) => {
    const block = roleDeleteBlock(settings, role);
    if (block) { setConfirm({ title: tx('roleCantDelete', { name: role.name }), description: block, type: 'info', confirmText: tx('ok') }); return; }
    setConfirm({
      title: tx('roleDeleteTitle', { name: role.name }),
      description: tx('roleDeleteDesc'),
      type: 'danger',
      confirmText: tx('roleDelete'),
      onConfirm: async () => { try { await onSettings({ roles: deleteRole(settings, role.id) }); } catch (e) { setConfirm({ title: tx('couldNotDelete'), description: getErrorMessage(e, tx('somethingWrong')), type: 'danger', confirmText: tx('ok') }); } },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-base text-ink-muted">{tx('rolesIntro')}</p>
        <Button size="lg" onClick={() => setFlow({ role: null })}><Plus /> {tx('makeRole')}</Button>
      </div>
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {roles.map(r => (
          <li key={r.id} className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="break-words text-xl font-semibold text-ink">{r.name}</p>
              <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium ${r.isSystem ? 'bg-slate-200 text-ink' : 'bg-emerald-100 text-emerald-800'}`}>{r.isSystem ? tx('builtIn') : tx('yours')}</span>
            </div>
            <p className="text-base text-ink-muted">{describe(r)}</p>
            <p className="text-base text-ink">{tx('thingsLine', { n: knownPermissionCount(r.permissions), total: ALL_PERMISSIONS.length, people: txn(people(r.name), 'personOne', 'personMany') })}</p>
            <div className="mt-auto flex gap-2 border-t border-slate-100 pt-3">
              {r.name !== 'Super Admin' || actor.role === 'Super Admin' ? <Button variant="outline" size="sm" onClick={() => setFlow({ role: r })}><Pencil /> {tx('edit')}</Button> : null}
              {!r.isSystem && <Button variant="ghost" size="sm" aria-label={tx('deleteAria', { name: r.name })} onClick={() => askDelete(r)}><Trash2 className="text-rose-700" /></Button>}
            </div>
          </li>
        ))}
      </ul>

      <RoleFlow
        isOpen={!!flow}
        onClose={() => setFlow(null)}
        role={flow?.role ?? null}
        settings={settings}
        actor={actor}
        onSave={async (input: RoleInput) => {
          const editing = flow?.role ?? null;
          // Counted before saving, from the same rule the server uses.
          const holders = editing ? (settings.users || []).filter(u => u.role === editing.name) : [];
          const follow = editing ? holders.filter(u => followsRole(u, editing.name, editing.permissions)).length : 0;
          const own = holders.length - follow;
          const changed = !!editing && (input.permissions.length !== editing.permissions.length || input.permissions.some(p => !editing.permissions.includes(p)));
          await onSettings({ roles: saveRole(settings, input, editing, newId) });
          // Admins always have full access, so their role's list changes nothing for them.
          if (changed && holders.length > 0 && editing && !['Super Admin', 'Admin'].includes(editing.name)) {
            const parts = [
              follow > 0 ? txn(follow, 'followOne', 'followMany') : '',
              own > 0 ? txn(own, 'ownOne', 'ownMany') : '',
            ].filter(Boolean);
            setConfirm({ title: tx('roleSaved'), description: parts.join(' '), type: 'info', confirmText: tx('ok') });
          }
        }}
      />

      {confirm && (
        <ConfirmModal isOpen onClose={() => setConfirm(null)} onConfirm={confirm.onConfirm} title={confirm.title} description={confirm.description} type={confirm.type} confirmText={confirm.confirmText} />
      )}
    </div>
  );
}
