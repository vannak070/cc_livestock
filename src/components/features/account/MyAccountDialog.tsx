'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, KeyRound, UserRound } from 'lucide-react';
import { changeMyPasswordAction, updateMyNameAction } from '@/app/actions';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { nameProblem, newPasswordProblem, problemOfMessage, type AccountProblem } from '@/lib/my-account';
import type { UserRoleItem } from '@/lib/types';
import { useText } from '@/hooks/useText';

/**
 * My account (side menu -> your name): every signed-in person changes their own name and password. Email, role and farm
 * are shown but stay with the admins (Settings -> People). The server checks everything again (my-account.service.ts).
 */
export default function MyAccountDialog({ open, onClose, user }: { open: boolean; onClose: () => void; user: UserRoleItem }) {
  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      {open && <Body onClose={onClose} user={user} />}
    </Dialog>
  );
}

const LABEL = 'mb-1 block text-base font-medium text-ink';

function Body({ onClose, user }: { onClose: () => void; user: UserRoleItem }) {
  const { tx } = useText('myAccount');
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [nameBusy, setNameBusy] = useState(false);
  const [nameMsg, setNameMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pw, setPw] = useState({ current: '', next: '', repeat: '' });
  const [show, setShow] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Problems show in the chosen language; any other server error is shown as the server sent it.
  const said = (p: AccountProblem) => tx(`p_${p}`);
  const serverText = (message: string) => { const p = problemOfMessage(message); return p ? said(p) : message; };

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = nameProblem(name);
    if (problem) { setNameMsg({ ok: false, text: said(problem) }); return; }
    setNameBusy(true); setNameMsg(null);
    const res = await updateMyNameAction(name);
    setNameBusy(false);
    if (!res.success) { setNameMsg({ ok: false, text: serverText(res.error) }); return; }
    setNameMsg({ ok: true, text: tx('nameSaved') });
    router.refresh(); // the side menu shows the new name
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = newPasswordProblem({ ...pw, email: user.email });
    if (problem) { setPwMsg({ ok: false, text: said(problem) }); return; }
    setPwBusy(true); setPwMsg(null);
    const res = await changeMyPasswordAction(pw);
    setPwBusy(false);
    if (!res.success) { setPwMsg({ ok: false, text: serverText(res.error) }); return; }
    setPw({ current: '', next: '', repeat: '' });
    setPwMsg({ ok: true, text: tx('passwordChanged') });
  };

  const message = (m: { ok: boolean; text: string } | null) => m && (
    <p role={m.ok ? 'status' : 'alert'} className={`flex items-start gap-2 rounded-xl p-3 text-base font-medium ${m.ok ? 'bg-emerald-50 text-emerald-900' : 'bg-rose-50 text-rose-800'}`}>
      {m.ok && <Check className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />}{m.text}
    </p>
  );
  const pwField = (key: keyof typeof pw, label: string, autoComplete: string, hint?: string) => (
    <label className="block">
      <span className={LABEL}>{label}</span>
      <Input type={show ? 'text' : 'password'} autoComplete={autoComplete} value={pw[key]} onChange={e => setPw(p => ({ ...p, [key]: e.target.value }))} className="h-12 text-lg" />
      {hint && <span className="mt-1 block text-sm text-ink-muted">{hint}</span>}
    </label>
  );

  return (
    <DialogContent className="flex max-w-xl flex-col gap-0 overflow-hidden p-0 max-sm:left-0 max-sm:top-0 max-sm:h-dvh max-sm:max-h-dvh max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none sm:max-h-[90vh]">
      <DialogHeader className="shrink-0 space-y-1 px-6 pb-3 pt-6 text-left sm:text-left">
        <DialogTitle className="text-2xl font-semibold text-ink">{tx('title')}</DialogTitle>
        <DialogDescription className="text-base text-ink-muted">{tx('sub')}</DialogDescription>
      </DialogHeader>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 pb-6 pt-2">
        <form onSubmit={saveName} className="space-y-4 rounded-2xl border border-slate-200 p-4">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-ink"><UserRound className="h-5 w-5 text-emerald-700" aria-hidden />{tx('detailsTitle')}</h3>
          <label className="block">
            <span className={LABEL}>{tx('name')}</span>
            <Input value={name} onChange={e => setName(e.target.value)} autoComplete="name" maxLength={100} className="h-12 text-lg" />
          </label>
          <dl className="grid grid-cols-1 gap-3 text-base sm:grid-cols-2">
            <div className="sm:col-span-2"><dt className="text-sm text-ink-muted">{tx('email')}</dt><dd className="break-all font-medium text-ink">{user.email}</dd></div>
            <div><dt className="text-sm text-ink-muted">{tx('role')}</dt><dd className="font-medium text-ink">{user.role}</dd></div>
            <div><dt className="text-sm text-ink-muted">{tx('farm')}</dt><dd className="font-medium text-ink">{user.farmLocation || tx('allFarms')}</dd></div>
          </dl>
          {message(nameMsg)}
          <Button type="submit" size="lg" disabled={nameBusy || name.trim() === user.name}>{nameBusy ? tx('saving') : tx('saveName')}</Button>
        </form>

        <form onSubmit={savePassword} className="space-y-4 rounded-2xl border border-slate-200 p-4">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-ink"><KeyRound className="h-5 w-5 text-emerald-700" aria-hidden />{tx('passwordTitle')}</h3>
          {/* A hidden username lets password managers save the new password for the right account. */}
          <input type="email" autoComplete="username" value={user.email} readOnly hidden />
          {pwField('current', tx('current'), 'current-password')}
          {pwField('next', tx('next'), 'new-password', tx('nextHint'))}
          {pwField('repeat', tx('repeat'), 'new-password')}
          <label className="flex min-h-11 items-center gap-3 text-base text-ink">
            <input type="checkbox" className="h-5 w-5 accent-emerald-700" checked={show} onChange={e => setShow(e.target.checked)} />
            {tx('show')}
          </label>
          {message(pwMsg)}
          <Button type="submit" size="lg" disabled={pwBusy || !pw.current || !pw.next || !pw.repeat}>{pwBusy ? tx('saving') : tx('changePassword')}</Button>
        </form>

        <Button type="button" variant="secondary" size="lg" className="w-full" onClick={onClose}>{tx('close')}</Button>
      </div>
    </DialogContent>
  );
}
