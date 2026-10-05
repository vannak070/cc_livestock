'use client';

import React, { useMemo, useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { CustomRoleDefinition, MasterSetup, PermissionKey, UserRoleItem } from '@/types/settings.types';
import { ALL_PERMISSIONS } from '@/types/settings.types';
import { grantable, validateRole, type RoleInput } from '@/lib/user-admin';
import { FlowFooter, FlowShell, Question } from '../flow/FlowShell';
import PermissionPicker from './PermissionPicker';

interface RoleFlowProps {
  isOpen: boolean;
  onClose: () => void;
  /** The role being changed; leave empty to make a new one. */
  role?: CustomRoleDefinition | null;
  settings: MasterSetup;
  actor: UserRoleItem;
  onSave: (input: RoleInput) => Promise<void>;
}

type Step = 'name' | 'access';
const STEPS: Step[] = ['name', 'access'];

export default function RoleFlow(props: RoleFlowProps) {
  // Remount on every open so each add or edit starts from the right values.
  return (
    <Dialog open={props.isOpen} onOpenChange={open => { if (!open) props.onClose(); }}>
      {props.isOpen && <RoleBody {...props} />}
    </Dialog>
  );
}

function RoleBody({ onClose, role, settings, actor, onSave }: RoleFlowProps) {
  const [step, setStep] = useState<Step>('name');
  const [name, setName] = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [permissions, setPermissions] = useState<PermissionKey[]>(role?.permissions ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const allowed = useMemo(() => grantable(actor), [actor]);

  const at = STEPS.indexOf(step);
  const input = (): RoleInput => ({ name, description, permissions });

  const save = async () => {
    const errors = validateRole(settings, input(), role ?? null, actor);
    if (errors.permissions) { setError(errors.permissions); return; }
    setSaving(true);
    setError('');
    try {
      await onSave(input());
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const next = () => {
    if (step === 'name') {
      const errors = validateRole(settings, { ...input(), permissions: permissions.length ? permissions : ['dashboard_view'] }, role ?? null, actor);
      if (errors.name) { setError(errors.name); return; }
      setError('');
      setStep('access');
    } else save();
  };

  return (
    <FlowShell
      steps={STEPS}
      step={step}
      title={step === 'name' ? (role ? 'Edit role' : 'Make a role') : 'What can this role do?'}
      subtitle={step === 'name' ? 'A role is a set of access you can give to many people.' : `${permissions.length} of ${ALL_PERMISSIONS.length} things allowed`}
      summary={step === 'access' ? name.trim() : ''}
      error={error}
      onSubmit={next}
      footer={<FlowFooter onBack={at === 0 ? undefined : () => { setError(''); setStep('name'); }} label={step === 'access' ? (saving ? 'Saving…' : 'Save role') : 'Next'} busy={saving} />}
    >
      {step === 'name' && (
        <>
          <Question label="Name of the role" hint={role?.isSystem ? 'A built-in role keeps its name, but you can change what it can do.' : 'For example Accountant or Feed manager.'}>
            <Input aria-label="Name of the role" autoFocus disabled={role?.isSystem} value={name} onChange={e => { setName(e.target.value); setError(''); }} className="h-16 text-xl font-semibold" />
          </Question>
          <Question label="Description (optional)"><Input aria-label="Description" value={description} onChange={e => setDescription(e.target.value)} className="h-14 text-lg" /></Question>
        </>
      )}
      {step === 'access' && <PermissionPicker value={permissions} onChange={p => { setPermissions(p); setError(''); }} allowed={allowed} />}
    </FlowShell>
  );
}
