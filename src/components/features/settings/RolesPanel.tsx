'use client';

import React, { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { ALL_PERMISSIONS, type CustomRoleDefinition, type MasterSetup, type UserRoleItem } from '@/types/settings.types';
import { deleteRole, followsRole, roleDeleteBlock, rolesOf, saveRole, type RoleInput } from '@/lib/user-admin';
import { getErrorMessage } from '@/lib/utils';
import RoleFlow from './RoleFlow';

interface RolesPanelProps {
  settings: MasterSetup;
  actor: UserRoleItem;
  onSettings: (patch: Partial<MasterSetup>) => Promise<void>;
}

const newId = () => Math.random().toString(36).slice(2, 8).toUpperCase();

export default function RolesPanel({ settings, actor, onSettings }: RolesPanelProps) {
  const [flow, setFlow] = useState<null | { role: CustomRoleDefinition | null }>(null);
  const [confirm, setConfirm] = useState<null | { title: string; description: string; type: 'danger' | 'info'; confirmText: string; onConfirm?: () => void }>(null);
  const roles = rolesOf(settings);
  const people = (name: string) => (settings.users || []).filter(u => u.role === name).length;

  const askDelete = (role: CustomRoleDefinition) => {
    const block = roleDeleteBlock(settings, role);
    if (block) { setConfirm({ title: `${role.name} cannot be deleted`, description: block, type: 'info', confirmText: 'OK' }); return; }
    setConfirm({
      title: `Delete the ${role.name} role?`,
      description: 'No one has this role, so no one loses access. It cannot be undone.',
      type: 'danger',
      confirmText: 'Delete role',
      onConfirm: async () => { try { await onSettings({ roles: deleteRole(settings, role.id) }); } catch (e) { setConfirm({ title: 'Could not delete', description: getErrorMessage(e, 'Something went wrong.'), type: 'danger', confirmText: 'OK' }); } },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-base text-ink-muted">A role is a set of access you give to people. When you change a role, everyone on its usual access gets the change. People you gave their own access keep it.</p>
        <Button size="lg" onClick={() => setFlow({ role: null })}><Plus /> Make a role</Button>
      </div>
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {roles.map(r => (
          <li key={r.id} className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="break-words text-xl font-semibold text-ink">{r.name}</p>
              <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium ${r.isSystem ? 'bg-slate-200 text-ink' : 'bg-emerald-100 text-emerald-800'}`}>{r.isSystem ? 'Built in' : 'Yours'}</span>
            </div>
            <p className="text-base text-ink-muted">{r.description || 'Custom role'}</p>
            <p className="text-base text-ink">{r.permissions.length} of {ALL_PERMISSIONS.length} things · {people(r.name)} {people(r.name) === 1 ? 'person' : 'people'}</p>
            <div className="mt-auto flex gap-2 border-t border-slate-100 pt-3">
              {r.name !== 'Super Admin' || actor.role === 'Super Admin' ? <Button variant="outline" size="sm" onClick={() => setFlow({ role: r })}><Pencil /> Edit</Button> : null}
              {!r.isSystem && <Button variant="ghost" size="sm" aria-label={`Delete ${r.name}`} onClick={() => askDelete(r)}><Trash2 className="text-rose-700" /></Button>}
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
              follow > 0 ? `${follow} ${follow === 1 ? 'person' : 'people'} on the usual access now ${follow === 1 ? 'has' : 'have'} the new access.` : '',
              own > 0 ? `${own} ${own === 1 ? 'person has' : 'people have'} their own access and kept it. Change them in People if needed.` : '',
            ].filter(Boolean);
            setConfirm({ title: 'Role saved', description: parts.join(' '), type: 'info', confirmText: 'OK' });
          }
        }}
      />

      {confirm && (
        <ConfirmModal isOpen onClose={() => setConfirm(null)} onConfirm={confirm.onConfirm} title={confirm.title} description={confirm.description} type={confirm.type} confirmText={confirm.confirmText} />
      )}
    </div>
  );
}
