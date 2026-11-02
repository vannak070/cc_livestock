'use client';

import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import type { MasterSetup } from '@/types/settings.types';
import { saveSessionPolicyAction } from '@/app/actions';
import { DEFAULT_IDLE_MINUTES, IDLE_MINUTE_CHOICES, idleMinutes } from '@/lib/session-policy';
import { getErrorMessage } from '@/lib/utils';
import { Choice } from '../flow/FlowShell';
import { useText } from '@/hooks/useText';

/** Settings → Sign-in (Super Admin only): how long without activity before everyone is signed out. */
export default function SignInPanel({ settings }: { settings: MasterSetup }) {
  const { tx } = useText('session');
  const queryClient = useQueryClient();
  const saved = idleMinutes(settings.session);
  const [minutes, setMinutes] = useState(saved);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);

  const label = (m: number) =>
    (m === 60 ? tx('oneHour') : m > 60 ? tx('hours', { n: m / 60 }) : tx('minutes', { n: m })) +
    (m === DEFAULT_IDLE_MINUTES ? ` ${tx('recommended')}` : '');

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await saveSessionPolicyAction(minutes);
      if (!res.success) throw new Error(res.error);
      await queryClient.invalidateQueries({ queryKey: ['livestock'] });
      setMessage({ tone: 'ok', text: tx('saved') });
    } catch (e) {
      setMessage({ tone: 'bad', text: getErrorMessage(e, tx('couldNotSave')) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <p className="text-base text-ink-muted">{tx('intro')}</p>
      <section className="space-y-4 rounded-2xl border-2 border-slate-200 bg-white p-4">
        <p className="text-lg font-medium text-ink">{tx('idleLabel')}</p>
        <div className="flex flex-wrap gap-2">
          {IDLE_MINUTE_CHOICES.map(m => (
            <Choice key={m} selected={minutes === m} onClick={() => { setMinutes(m); setMessage(null); }}>{label(m)}</Choice>
          ))}
        </div>
        <p className="text-base text-ink-muted">{tx('rules')}</p>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" size="lg" onClick={save} disabled={busy || minutes === saved}>{busy ? tx('saving') : tx('save')}</Button>
          {message && (
            <p role={message.tone === 'bad' ? 'alert' : 'status'} className={message.tone === 'bad' ? 'text-base text-rose-800' : 'text-base text-emerald-800'}>{message.text}</p>
          )}
        </div>
      </section>
    </div>
  );
}
