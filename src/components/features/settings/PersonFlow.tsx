'use client';

import React, { useMemo, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ALL_PERMISSIONS, type MasterSetup, type PermissionKey, type UserRoleItem } from '@/types/settings.types';
import { SYSTEM_ROLES, usesStandardDescription, FARM_ROLES, MIN_PASSWORD_LENGTH, assignableRoles, effectivePermissions, grantable, isFarmOwner, rolesOf, validatePerson, type PersonErrors, type PersonInput, knownPermissionCount } from '@/lib/user-admin';
import { FlowFooter, FlowShell, PickList, Question, RowButton } from '../flow/FlowShell';
import PermissionPicker from './PermissionPicker';
import { useText } from '@/hooks/useText';

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
  const { tx } = useText('settingsPage');
  const flow = useText('flow');
  const edit = !!person;
  const describe = (r: { name: string; description?: string }) => (SYSTEM_ROLES.some(s => s.name === r.name) && usesStandardDescription(r)
    ? tx(`desc_${r.name}`)
    : usesStandardDescription(r) ? tx('customRole') : r.description!);
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

  // There is no PIN on the web (it was for the removed mobile app); an existing PIN is left as it is.
  const input = (): PersonInput => ({ name, email, role, farmLocation: lockedFarm || farm, password, pin: '', clearPin: false, permissions });
  const stepFields: Record<Step, (keyof PersonErrors)[]> = { who: ['name', 'email'], role: ['role'], farm: ['farmLocation'], signin: ['password'], access: ['permissions'], done: [] };
  const problem = (s: Step): string | null => {
    if (s === 'role' && !role) return tx('pChooseRole');
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
      setError(e instanceof Error ? e.message : tx('errSave'));
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
    who: { title: self ? tx('pTitleMine') : edit ? tx('pTitleEdit') : tx('pTitleAdd'), sub: self ? tx('pSubMine') : tx('pSubWho') },
    role: { title: tx('pTitleRole'), sub: tx('pSubRole') },
    farm: { title: tx('pTitleFarm'), sub: tx('pSubFarm') },
    signin: { title: tx('pTitleSignin'), sub: edit ? tx('pSubSigninEdit') : tx('pSubSigninAdd') },
    access: { title: tx('pTitleAccess'), sub: tx('pSubAccess') },
    done: { title: edit ? tx('pTitleSaved') : tx('pTitleAdded'), sub: tempPassword ? tx('pSubTemp') : tx('pSubEmail') },
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
        ? <FlowFooter onBack={back} label={flow.tx('next')} />
        : <FlowFooter onBack={at === 0 ? undefined : back} label={step === last ? (saving ? flow.tx('saving') : flow.tx('save')) : flow.tx('next')} busy={saving} />}
    >
      {step === 'who' && (
        <>
          <Question label={tx('pName')}><Input aria-label={tx('pName')} autoFocus value={name} onChange={e => { setName(e.target.value); setError(''); }} className="h-16 text-xl font-semibold" /></Question>
          <Question label={tx('pEmail')}><Input aria-label={tx('pEmail')} type="email" inputMode="email" autoComplete="off" value={email} onChange={e => { setEmail(e.target.value); setError(''); }} className="h-14 text-lg" /></Question>
        </>
      )}

      {step === 'role' && options.length === 0 && (
        <p className="rounded-xl bg-amber-50 p-4 text-lg text-amber-900">{tx('pNoRole')}</p>
      )}

      {step === 'role' && (
        <ul className="space-y-3 pb-2">
          {options.map(r => (
            <li key={r.id}>
              <RowButton onClick={() => { chooseRole(r.name); setStep(!lockedFarm && FARM_ROLES.includes(r.name) && farmNames.length > 0 ? 'farm' : 'signin'); }} selected={role === r.name}>
                <span>
                  <span className="block text-xl font-semibold text-ink">{r.name}</span>
                  <span className="block text-base text-ink-muted">{describe(r)}</span>
                  <span className="block text-sm text-ink-muted">{tx('pThings', { n: knownPermissionCount(r.permissions), total: ALL_PERMISSIONS.length })}</span>
                </span>
                {role === r.name && <Check className="h-7 w-7 shrink-0 text-emerald-700" aria-hidden />}
              </RowButton>
            </li>
          ))}
        </ul>
      )}

      {step === 'farm' && <PickList options={farmNames} value={farm} onChange={v => { setFarm(v); setError(''); }} />}

      {step === 'signin' && (
        <Question label={edit ? tx('pNewPw') : tx('pPw')} hint={edit ? tx('pPwKeep') : tx('pPwMake', { n: MIN_PASSWORD_LENGTH })}>
          <div className="flex gap-2">
            <Input aria-label={tx('pPwAria')} type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={e => { setPassword(e.target.value); setError(''); }} className="h-14 text-lg" />
            <button type="button" onClick={() => setShowPassword(v => !v)} className="min-h-14 shrink-0 rounded-xl border-2 border-slate-200 px-4 text-base font-medium text-ink hover:border-emerald-600">{showPassword ? tx('hide') : tx('showPw')}</button>
          </div>
        </Question>
      )}

      {step === 'access' && (
        <>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-lg text-ink">{sameAsRole ? tx('pUsual', { role }) : tx('pCustom', { role })}</p>
            <p className="text-base text-ink-muted">{tx('pAllowed', { n: knownPermissionCount(permissions), total: ALL_PERMISSIONS.length })}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="outline" onClick={() => setFineTune(v => !v)}>{fineTune ? tx('pHideList') : tx('pChange')}</Button>
            {!sameAsRole && <Button type="button" variant="ghost" onClick={() => setPermissions(roleDefault)}>{tx('pUseUsual', { role })}</Button>}
          </div>
          {fineTune && <PermissionPicker value={permissions} onChange={p => { setPermissions(p); setError(''); }} allowed={allowed} />}
        </>
      )}

      {step === 'done' && (
        <div className="flex h-full flex-col justify-between gap-6">
          <div className="space-y-5 pt-4 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><Check className="h-11 w-11" aria-hidden /></div>
            <p className="text-2xl font-semibold text-ink">{edit ? tx('pWasSaved', { name: name.trim() }) : tx('pWasAdded', { name: name.trim() })}</p>
            {tempPassword && (
              <div className="space-y-3 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 text-left">
                <p className="text-base text-ink">{tx('pTempFor', { email: email.trim() })}</p>
                <p className="select-all break-all text-center font-mono text-3xl font-semibold text-ink">{tempPassword}</p>
                <p className="text-base text-ink-muted">{tx('pShownOnce')}</p>
                <Button type="button" variant="outline" onClick={copy}><Copy /> {copied ? tx('copied') : tx('pCopy')}</Button>
              </div>
            )}
          </div>
          <Button type="button" size="lg" onClick={onClose}>{tx('done')}</Button>
        </div>
      )}
    </FlowShell>
  );
}
