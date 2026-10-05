'use client';

import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { changeMyPasswordAction } from '@/app/actions';
import { MIN_PASSWORD_LENGTH, newPasswordProblem } from '@/lib/user-admin';

interface ChangePasswordDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ChangePasswordDialog({ isOpen, onClose }: ChangePasswordDialogProps) {
  // Remount on every open so the typed passwords never linger.
  return (
    <Dialog open={isOpen} onOpenChange={open => { if (!open) onClose(); }}>
      {isOpen && <Body onClose={onClose} />}
    </Dialog>
  );
}

function Body({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = newPasswordProblem(current, next) ?? (next !== repeat ? 'The two new passwords are not the same.' : null);
    if (problem) { setError(problem); return; }
    setSaving(true);
    setError('');
    try {
      const res = await changeMyPasswordAction(current, next);
      if (!res.success) { setError(res.error); return; }
      setDone(true);
    } catch {
      setError('Could not change the password. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const type = show ? 'text' : 'password';
  const edit = (set: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => { set(e.target.value); setError(''); };

  return (
    <DialogContent className="max-w-md">
      <DialogHeader className="text-left">
        <DialogTitle className="text-2xl font-semibold text-ink">{done ? 'Password changed' : 'Change my password'}</DialogTitle>
        <DialogDescription className="text-base text-ink-muted">
          {done ? 'Use your new password the next time you sign in.' : `Your new password needs at least ${MIN_PASSWORD_LENGTH} characters.`}
        </DialogDescription>
      </DialogHeader>

      {done ? (
        <div className="space-y-5">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><Check className="h-11 w-11" aria-hidden /></div>
          <Button type="button" size="lg" className="w-full" onClick={onClose}>Done</Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <label className="block space-y-1.5">
            <span className="text-base font-medium text-ink">Current password</span>
            <Input type={type} autoComplete="current-password" autoFocus value={current} onChange={edit(setCurrent)} className="h-14 text-lg" />
          </label>
          <label className="block space-y-1.5">
            <span className="text-base font-medium text-ink">New password</span>
            <Input type={type} autoComplete="new-password" value={next} onChange={edit(setNext)} className="h-14 text-lg" />
          </label>
          <label className="block space-y-1.5">
            <span className="text-base font-medium text-ink">New password again</span>
            <Input type={type} autoComplete="new-password" value={repeat} onChange={edit(setRepeat)} className="h-14 text-lg" />
          </label>
          <label className="flex min-h-11 items-center gap-2 text-base text-ink">
            <input type="checkbox" checked={show} onChange={e => setShow(e.target.checked)} className="h-5 w-5" /> Show passwords
          </label>
          {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-base text-rose-800">{error}</p>}
          <div className="flex gap-3">
            <Button type="button" variant="outline" size="lg" onClick={onClose}>Cancel</Button>
            <Button type="submit" size="lg" className="flex-1" disabled={saving}>{saving ? 'Saving…' : 'Change password'}</Button>
          </div>
        </form>
      )}
    </DialogContent>
  );
}
