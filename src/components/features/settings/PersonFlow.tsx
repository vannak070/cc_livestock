'use client';

import React, { useMemo, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ALL_PERMISSIONS, type MasterSetup, type PermissionKey, type UserRoleItem } from '@/types/settings.types';
import { FARM_ROLES, MIN_PASSWORD_LENGTH, assignableRoles, effectivePermissions, grantable, isFarmOwner, rolesOf, validatePerson, type PersonErrors, type PersonInput } from '@/lib/user-admin';
import { MIN_PIN_LENGTH } from '@/lib/pin';
import { FlowFooter, FlowShell, PickList, Question, RowButton } from '../flow/FlowShell';
import PermissionPicker from './PermissionPicker';

interface PersonFlowProps {
  isOpen: boolean;
  onClose: () => void;
  /** The person being changed; leave empty to add someone. */
  person?: UserRoleItem | null;
  settings: MasterSetup;
  /** The signed-in person; what they may give is limited by what they hold. */
  actor: UserRoleItem;
  /** Saves and returns a temporary password when one was made. */
  onSave: (input: PersonInput) => Promise<string | undefined>;
  /** Start with this farm already chosen and locked, for example when adding to a farm. */
  presetFarm?: string;
  /** Only these roles can be chosen; when there is just one it is chosen for you. */
  onlyRoles?: string[];
}

type Step = 'who' | 'role' | 'farm' | 'signin' | 'access' | 'done';

// Everyday roles first, the powerful ones last, so the safe choice is the easy one.
const ORDER = ['Farm Staff', 'Veterinarian', 'Management', 'Farm Owner', 'Company', 'Admin', 'Super Admin'];

export default function PersonFlow(props: PersonFlowProps) {
  // Remount on every open so each add or edit starts from the right values.
  return (
    <Dialog open={props.isOpen} onOpenChange={open => { if (!open) props.onClose(); }}>
      {props.isOpen && <PersonBody {...props} />}
    </Dialog>
  );
}

function PersonBody({ onClose, person, settings, actor, onSave, presetFarm, onlyRoles }: PersonFlowProps) {
  const edit = !!person;
  const lockedFarm = isFarmOwner(actor) ? actor.farmLocation ?? '' : presetFarm ?? null;
  const roles = useMemo(() => rolesOf(settings), [settings]);
  const options = useMemo(() => [...assignableRoles(roles, actor)].filter(r => !onlyRoles || onlyRoles.includes(r.name)).sort((a, b) => {
    const rank = (n: string) => (ORDER.includes(n) ? ORDER.indexOf(n) : ORDER.indexOf('Management') + 0.5);
    return rank(a.name) - rank(b.name);
  }), [roles, actor, onlyRoles]);
  const farmNames = (settings.farms || []).map(f => f.name);
  const allowed = useMemo(() => grantable(actor), [actor]);

  const [step, setStep] = useState<Step>('who');
  const [name, setName] = useState(person?.name ?? '');
  const [email, setEmail] = useState(person?.email ?? '');
  // With only one role to choose from there is nothing to ask.
  const soleRole = !person && options.length === 1 ? options[0].name : '';
  const [role, setRole] = useState(person?.role ?? (soleRole || (isFarmOwner(actor) ? 'Farm Staff' : '')));
  const [farm, setFarm] = useState(person?.farmLocation ?? lockedFarm ?? (farmNames.length === 1 ? farmNames[0] : ''));
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pin, setPin] = useState('');
  const [clearPin, setClearPin] = useState(false);
  const [permissions, setPermissions] = useState<PermissionKey[]>(() => (person ? effectivePermissions(person, roles) : soleRole ? effectivePermissions({ role: soleRole }, roles) : isFarmOwner(actor) ? effectivePermissions({ role: 'Farm Staff' }, roles) : []));
  const [fineTune, setFineTune] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [tempPassword, setTempPassword] = useState<string | undefined>();
  const [copied, setCopied] = useState(false);

  // Your own role, farm and access are changed by another admin, so you cannot lock yourself out.
  const self = !!person && person.id === actor.id;
  const needsFarm = FARM_ROLES.includes(role) && !lockedFarm && farmNames.length > 0 && !self;
  const steps: Step[] = [
    'who', ...(soleRole || self ? [] : ['role' as Step]),
    ...(needsFarm ? ['farm' as Step] : []),
    'signin',
    ...(isFarmOwner(actor) || self ? [] : ['access' as Step]),
  ];
  const at = steps.indexOf(step);
  const last = steps[steps.length - 1];

  const input = (): PersonInput => ({ name, email, role, farmLocation: lockedFarm || farm, password, pin, clearPin, permissions });
  const stepFields: Record<Step, (keyof PersonErrors)[]> = { who: ['name', 'email'], role: ['role'], farm: ['farmLocation'], signin: ['password', 'pin'], access: ['permissions'], done: [] };
  const problem = (s: Step): string | null => {
    if (s === 'role' && !role) return 'Choose a role.';
    const errors = validatePerson(settings, input(), person ?? null, actor);
    for (const key of stepFields[s]) if (errors[key]) return errors[key]!;
    return null;
  };

  const chooseRole = (r: string) => {
    setRole(r);
    setError('');
    // A new role brings its usual access; an unchanged role on an existing person keeps what they have.
    if (!(person && person.role === r)) setPermissions(roles.find(x => x.name === r)?.permissions ?? []);
    setFineTune(false);
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const temp = await onSave(input());
      setTempPassword(temp);
      setStep('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const next = () => {
    const p = problem(step);
    if (p) { setError(p); return; }
    if (step === last) { save(); return; }
    setError('');
    setStep(steps[at + 1]);
  };
  const back = () => { setError(''); setStep(steps[at - 1]); };

  const copy = async () => {
    try { await navigator.clipboard.writeText(tempPassword ?? ''); setCopied(true); } catch { /* the password stays on screen to copy by hand */ }
  };

  const roleDefault = roles.find(r => r.name === role)?.permissions ?? [];
  const sameAsRole = permissions.length === roleDefault.length && permissions.every(p => roleDefault.includes(p));

  const heading: Record<Step, { title: string; sub: string }> = {
    who: { title: self ? 'Edit my account' : edit ? 'Edit person' : 'Add a person', sub: self ? 'Your name and sign-in. Another admin changes your role and access.' : 'Their name, and the email they sign in with.' },
    role: { title: 'What is their role?', sub: 'The role sets what they can see and do.' },
    farm: { title: 'Which farm?', sub: 'They will only see this farm.' },
    signin: { title: 'Signing in', sub: edit ? 'Change the password only if they need a new one.' : 'Choose a password, or let us make one.' },
    access: { title: 'What can they do?', sub: 'Usually the role is enough. Change it only if this person is different.' },
    done: { title: edit ? 'Saved' : 'Person added', sub: tempPassword ? 'Give them this temporary password now.' : 'They can sign in with their email.' },
  };

  return (
    <FlowShell
      steps={steps}
      step={step}
      title={heading[step].title}
      subtitle={heading[step].sub}
      summary={step === 'who' || step === 'done' ? '' : [name.trim(), step !== 'role' ? role : ''].filter(Boolean).join(' · ')}
      error={error}
      onSubmit={step === 'role' || step === 'done' ? undefined : next}
      footer={step === 'done' ? null : step === 'role'
        ? <FlowFooter onBack={back} label="Next" />
        : <FlowFooter onBack={at === 0 ? undefined : back} label={step === last ? (saving ? 'Saving…' : 'Save') : 'Next'} busy={saving} />}
    >
      {step === 'who' && (
        <>
          <Question label="Name"><Input aria-label="Name" autoFocus value={name} onChange={e => { setName(e.target.value); setError(''); }} className="h-16 text-xl font-semibold" /></Question>
          <Question label="Email"><Input aria-label="Email" type="email" inputMode="email" autoComplete="off" value={email} onChange={e => { setEmail(e.target.value); setError(''); }} className="h-14 text-lg" /></Question>
        </>
      )}

      {step === 'role' && (
        <ul className="space-y-3 pb-2">
          {options.map(r => (
            <li key={r.id}>
              <RowButton onClick={() => { chooseRole(r.name); setStep(!lockedFarm && FARM_ROLES.includes(r.name) && farmNames.length > 0 ? 'farm' : 'signin'); }} selected={role === r.name}>
                <span>
                  <span className="block text-xl font-semibold text-ink">{r.name}</span>
                  <span className="block text-base text-ink-muted">{r.description || 'Custom role'}</span>
                  <span className="block text-sm text-ink-muted">{r.permissions.length} of {ALL_PERMISSIONS.length} things</span>
                </span>
                {role === r.name && <Check className="h-7 w-7 shrink-0 text-emerald-700" aria-hidden />}
              </RowButton>
            </li>
          ))}
        </ul>
      )}

      {step === 'farm' && <PickList options={farmNames} value={farm} onChange={v => { setFarm(v); setError(''); }} />}

      {step === 'signin' && (
        <>
          <Question label={edit ? 'New password (optional)' : 'Password (optional)'} hint={edit ? 'Leave empty to keep the current password.' : `Leave empty and we will make a temporary one to give them. At least ${MIN_PASSWORD_LENGTH} characters if you type one.`}>
            <div className="flex gap-2">
              <Input aria-label="Password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={e => { setPassword(e.target.value); setError(''); }} className="h-14 text-lg" />
              <button type="button" onClick={() => setShowPassword(v => !v)} className="min-h-14 shrink-0 rounded-xl border-2 border-slate-200 px-4 text-base font-medium text-ink hover:border-emerald-600">{showPassword ? 'Hide' : 'Show'}</button>
            </div>
          </Question>
          <Question label="PIN (optional)" hint={person?.hasPin ? 'A PIN is already set. Leave empty to keep it.' : `${MIN_PIN_LENGTH} or more digits, for signing in on the mobile app.`}>
            <Input aria-label="PIN" inputMode="numeric" autoComplete="off" value={pin} disabled={clearPin} onChange={e => { setPin(e.target.value.replace(/[^0-9]/g, '')); setClearPin(false); setError(''); }} className="h-14 text-lg" />
            {person?.hasPin && (
              <label className="mt-2 flex min-h-11 items-center gap-2 text-base font-medium text-rose-700">
                <input type="checkbox" checked={clearPin} onChange={e => { setClearPin(e.target.checked); if (e.target.checked) setPin(''); }} className="h-5 w-5" /> Remove their PIN
              </label>
            )}
          </Question>
        </>
      )}

      {step === 'access' && (
        <>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-lg text-ink">{sameAsRole ? <>Uses the usual <span className="font-semibold">{role}</span> access.</> : <>Custom access, different from the usual <span className="font-semibold">{role}</span>.</>}</p>
            <p className="text-base text-ink-muted">{permissions.length} of {ALL_PERMISSIONS.length} things allowed</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="outline" onClick={() => setFineTune(v => !v)}>{fineTune ? 'Hide the list' : 'Change what they can do'}</Button>
            {!sameAsRole && <Button type="button" variant="ghost" onClick={() => setPermissions(roleDefault)}>Use the usual {role} access</Button>}
          </div>
          {fineTune && <PermissionPicker value={permissions} onChange={p => { setPermissions(p); setError(''); }} allowed={allowed} />}
        </>
      )}

      {step === 'done' && (
        <div className="flex h-full flex-col justify-between gap-6">
          <div className="space-y-5 pt-4 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><Check className="h-11 w-11" aria-hidden /></div>
            <p className="text-2xl text-ink"><span className="font-semibold">{name.trim()}</span> {edit ? 'was saved' : 'was added'}</p>
            {tempPassword && (
              <div className="space-y-3 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 text-left">
                <p className="text-base text-ink">Temporary password for <span className="font-medium">{email.trim()}</span>:</p>
                <p className="select-all break-all text-center font-mono text-3xl font-semibold text-ink">{tempPassword}</p>
                <p className="text-base text-ink-muted">This is shown only now. Write it down or copy it, and ask them to change it after they sign in.</p>
                <Button type="button" variant="outline" onClick={copy}><Copy /> {copied ? 'Copied' : 'Copy password'}</Button>
              </div>
            )}
          </div>
          <Button type="button" size="lg" onClick={onClose}>Done</Button>
        </div>
      )}
    </FlowShell>
  );
}
