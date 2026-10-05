'use client';

import React, { useMemo, useState } from 'react';
import { Building, Copy, KeyRound, Lock, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { MasterSetup, UserRoleItem } from '@/types/settings.types';
import { FARM_ROLES, canChangeUser, isFarmOwner, isOfficePerson, officeRoleNames, rolesOf, visibleUsers, type PersonInput } from '@/lib/user-admin';
import { createUserAction, deleteUserAction, resetUserPasswordAction, setUserStatusAction, updateUserAction } from '@/app/actions';
import { getErrorMessage } from '@/lib/utils';
import PersonFlow from './PersonFlow';

interface PeoplePanelProps {
  settings: MasterSetup;
  actor: UserRoleItem;
  /** Called after a change has been saved, so the lists reload. */
  onChanged: () => void;
  /** Show only the people of this farm (the Farms page). Without it, Settings shows the office accounts. */
  farm?: string;
  /** Extra buttons on a person's card, such as Make owner. */
  extraActions?: (u: UserRoleItem) => React.ReactNode;
  /** The farm is run by the company, so an empty list does not ask for an owner. */
  companyRun?: boolean;
  /** Opens the Farms page, where farm people are managed; given only to people who may open it. */
  onOpenFarms?: () => void;
}

/** Each change is one request for one person, so another admin's changes are never overwritten. */
async function ok<T>(res: { success: true; data: T } | { success: false; error: string }): Promise<T> {
  if (!res.success) throw new Error(res.error);
  return res.data;
}

const SELECT = 'h-11 rounded-xl border-2 border-slate-200 bg-white px-3 text-base text-ink focus:border-emerald-600 focus:outline-none';
const norm = (s?: string) => (s ?? '').trim().toLowerCase();

export default function PeoplePanel({ settings, actor, onChanged, farm, companyRun, extraActions, onOpenFarms }: PeoplePanelProps) {
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [status, setStatus] = useState<'All' | 'Active' | 'Inactive'>('All');
  const [flow, setFlow] = useState<null | { person: UserRoleItem | null }>(null);
  const [shown, setShown] = useState<null | { name: string; email: string; password: string }>(null);
  const [copied, setCopied] = useState(false);
  const [confirm, setConfirm] = useState<null | { title: string; description: string; type: 'danger' | 'warning'; confirmText: string; onConfirm?: () => void }>(null);

  // A farm owner sees their own farm's staff; otherwise one farm (Farms page) or the office accounts (Settings).
  const mode: 'owner' | 'farm' | 'office' = isFarmOwner(actor) ? 'owner' : farm ? 'farm' : 'office';
  const farmNames = useMemo(() => (settings.farms || []).map(f => f.name), [settings.farms]);
  const all = useMemo(() => {
    const users = visibleUsers(settings.users || [], actor);
    if (mode === 'farm') return users.filter(u => u.farmLocation === farm);
    if (mode === 'office') return users.filter(u => isOfficePerson(u, farmNames));
    return users;
  }, [settings.users, actor, mode, farm, farmNames]);
  const roles = useMemo(() => rolesOf(settings), [settings]);
  const roleChoices = useMemo(() => [...new Set(all.map(u => u.role))].sort(), [all]);
  const office = useMemo(() => officeRoleNames(roles), [roles]);
  // Which roles the add/edit steps offer, so a person never moves out of the list they were opened from.
  const onlyRolesFor = (person: UserRoleItem | null): string[] | undefined => {
    if (mode === 'farm') return FARM_ROLES;
    if (mode === 'office') return person && FARM_ROLES.includes(person.role) ? undefined : office;
    return undefined;
  };
  const counts = { All: all.length, Active: all.filter(u => u.status === 'Active').length, Inactive: all.filter(u => u.status !== 'Active').length };

  const list = useMemo(() => {
    const q = norm(query);
    return all
      .filter(u => (status === 'All' ? true : status === 'Active' ? u.status === 'Active' : u.status !== 'Active'))
      .filter(u => !roleFilter || u.role === roleFilter)
      .filter(u => !q || norm(u.name).includes(q) || norm(u.email).includes(q))
      .sort((a, b) => Number(b.role === 'Farm Owner') - Number(a.role === 'Farm Owner') || a.name.localeCompare(b.name));
  }, [all, query, roleFilter, status]);

  const fail = (e: unknown) => setConfirm({ title: 'That did not work', description: getErrorMessage(e, 'The change could not be saved.'), type: 'danger', confirmText: 'OK' });

  const savePersonFromFlow = async (input: PersonInput): Promise<string | undefined> => {
    const editing = flow?.person ?? null;
    if (editing) {
      await ok(await updateUserAction(editing.id, input));
      onChanged();
      return undefined;
    }
    const created = await ok(await createUserAction(input));
    onChanged();
    return created.tempPassword;
  };

  const askStatus = (u: UserRoleItem) => {
    const turnOff = u.status === 'Active';
    setConfirm({
      title: turnOff ? `Turn off ${u.name}?` : `Turn on ${u.name}?`,
      description: turnOff ? 'They will not be able to sign in until you turn them on again. Their records stay.' : 'They will be able to sign in again.',
      type: 'warning',
      confirmText: turnOff ? 'Turn off' : 'Turn on',
      onConfirm: async () => { try { await ok(await setUserStatusAction(u.id, turnOff ? 'Inactive' : 'Active')); onChanged(); } catch (e) { fail(e); } },
    });
  };

  const askPassword = (u: UserRoleItem) => setConfirm({
    title: `New password for ${u.name}?`,
    description: 'Their old password stops working. You will see the new temporary password once, to give to them.',
    type: 'warning',
    confirmText: 'Make a new password',
    onConfirm: async () => {
      try {
        const r = await ok(await resetUserPasswordAction(u.id));
        onChanged();
        setCopied(false);
        setShown({ name: u.name, email: u.email, password: r.password });
      } catch (e) { fail(e); }
    },
  });

  const askRemove = (u: UserRoleItem) => setConfirm({
    title: `Remove ${u.name}?`,
    description: 'They lose all access and cannot sign in. Records they made stay. This cannot be undone. To keep the person but stop their access, turn them off instead.',
    type: 'danger',
    confirmText: 'Remove',
    onConfirm: async () => { try { await ok(await deleteUserAction(u.id)); onChanged(); } catch (e) { fail(e); } },
  });

  const copy = async () => {
    try { await navigator.clipboard.writeText(shown?.password ?? ''); setCopied(true); } catch { /* the password stays on screen to copy by hand */ }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-base text-ink-muted">
          {all.length} {all.length === 1 ? 'person' : 'people'} {mode === 'office' ? 'in the office' : mode === 'farm' ? 'on this farm' : 'can sign in to your farm'}.
        </p>
        <Button size="lg" onClick={() => setFlow({ person: null })}><Plus /> Add a person</Button>
      </div>

      {mode === 'office' && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 p-4">
          <p className="text-base text-ink">Farm owners, staff and vets are looked after on the <span className="font-semibold">Farms</span> page, under each farm&apos;s People.</p>
          {onOpenFarms && <Button variant="outline" onClick={onOpenFarms}><Building /> Go to Farms</Button>}
        </div>
      )}

      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted" aria-hidden />
          <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by name or email" aria-label="Search people" className="h-14 pl-11 text-lg" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="tablist" aria-label="Show" className="flex rounded-xl bg-slate-100 p-1">
            {(['All', 'Active', 'Inactive'] as const).map(s => (
              <button key={s} role="tab" type="button" aria-selected={status === s} onClick={() => setStatus(s)}
                className={`min-h-11 rounded-lg px-4 text-base font-medium ${status === s ? 'bg-white text-emerald-800 shadow-sm' : 'text-ink-muted hover:text-ink'}`}>
                {s === 'Inactive' ? 'Turned off' : s} ({counts[s]})
              </button>
            ))}
          </div>
          {roleChoices.length > 1 && (
            <select aria-label="Role" value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className={`${SELECT} ml-auto`}>
              <option value="">All roles</option>
              {roleChoices.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          )}
        </div>
      </div>

      {list.length === 0 ? (
        <p className="rounded-2xl bg-slate-50 p-6 text-center text-lg text-ink-muted">{all.length === 0 ? (mode === 'farm' ? (companyRun ? 'No one works on this farm yet. The company runs it, so you can add staff when you need them.' : 'No one works on this farm yet. Add the owner first.') : 'No one yet. Add the first person.') : 'No one matches what you chose.'}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {list.map(u => {
            const isMe = u.id === actor.id;
            const locked = u.role === 'Super Admin';
            const mayChange = canChangeUser(actor, u);
            const active = u.status === 'Active';
            return (
              <li key={u.id} className={`space-y-3 rounded-2xl border bg-white p-4 ${active ? 'border-slate-200' : 'border-slate-200 opacity-80'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words text-xl font-semibold text-ink">{u.name}{isMe && <span className="ml-2 text-base font-normal text-ink-muted">(you)</span>}</p>
                    <p className="break-all text-base text-ink-muted">{u.email}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium ${active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-ink'}`}>{active ? 'Active' : 'Turned off'}</span>
                </div>
                <p className="text-base text-ink">{[u.role, mode === 'office' ? u.farmLocation : ''].filter(Boolean).join(' · ')}</p>
                {mode === 'office' && FARM_ROLES.includes(u.role) && (
                  <p className="rounded-xl bg-amber-50 p-3 text-base text-amber-900">
                    {u.farmLocation ? `${u.farmLocation} is not a farm any more.` : 'Not on any farm yet.'} Tap Edit to choose their farm; after that they are looked after on the Farms page.
                  </p>
                )}
                {mayChange ? (
                  <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                    <Button variant="outline" size="sm" onClick={() => setFlow({ person: u })}><Pencil /> Edit</Button>
                    {extraActions?.(u)}
                    <Button variant="outline" size="sm" onClick={() => askPassword(u)}><KeyRound /> New password</Button>
                    {!locked && !isMe && <Button variant="outline" size="sm" onClick={() => askStatus(u)}>{active ? 'Turn off' : 'Turn on'}</Button>}
                    {!locked && !isMe && <Button variant="ghost" size="sm" aria-label={`Remove ${u.name}`} onClick={() => askRemove(u)}><Trash2 className="text-rose-700" /></Button>}
                    {(locked || isMe) && <span className="flex items-center gap-1.5 px-2 text-sm text-ink-muted"><Lock className="h-4 w-4" aria-hidden /> {isMe ? 'You cannot turn off or remove yourself' : 'Protected account'}</span>}
                  </div>
                ) : (
                  <p className="flex items-center gap-1.5 border-t border-slate-100 pt-3 text-sm text-ink-muted"><Lock className="h-4 w-4" aria-hidden /> Only a {u.role === 'Super Admin' ? 'Super Admin' : 'Super Admin or Admin'} can change this account</p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <PersonFlow
        isOpen={!!flow}
        onClose={() => setFlow(null)}
        person={flow?.person ?? null}
        settings={settings}
        actor={actor}
        onSave={savePersonFromFlow}
        onlyRoles={flow ? onlyRolesFor(flow.person) : undefined}
        presetFarm={mode === 'farm' && !flow?.person ? farm : undefined}
      />

      {shown && (
        <Dialog open onOpenChange={open => { if (!open) setShown(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader className="text-left">
              <DialogTitle className="text-2xl font-semibold text-ink">New password</DialogTitle>
              <DialogDescription className="text-base text-ink-muted">For {shown.name} ({shown.email}). It is shown only now.</DialogDescription>
            </DialogHeader>
            <p className="select-all break-all rounded-xl bg-amber-50 p-4 text-center font-mono text-3xl font-semibold text-ink">{shown.password}</p>
            <p className="text-base text-ink-muted">Give it to them. If they forget it, make a new one here.</p>
            <div className="flex gap-3">
              <Button type="button" variant="outline" size="lg" onClick={copy}><Copy /> {copied ? 'Copied' : 'Copy'}</Button>
              <Button type="button" size="lg" className="flex-1" onClick={() => setShown(null)}>Done</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {confirm && (
        <ConfirmModal isOpen onClose={() => setConfirm(null)} onConfirm={confirm.onConfirm} title={confirm.title} description={confirm.description} type={confirm.type} confirmText={confirm.confirmText} />
      )}
    </div>
  );
}
