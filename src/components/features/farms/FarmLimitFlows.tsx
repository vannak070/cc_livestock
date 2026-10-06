'use client';

import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { decideFarmLimitAction, requestFarmLimitAction } from '@/app/actions';
import type { FarmLimitRequest } from '@/lib/types';
import { MAX_EXTRA } from '@/lib/farm-limit';
import { useText } from '@/hooks/useText';
import { Choice, FlowDone, FlowFooter, FlowShell, NUM, Question } from '../flow/FlowShell';

async function ok<T>(res: { success: true; data: T } | { success: false; error: string }): Promise<T> {
  if (!res.success) throw new Error(res.error);
  return res.data;
}

interface RequestProps {
  isOpen: boolean;
  onClose: () => void;
  farm: string;
  limit: number;
  used: number;
}

/** A farm asks a Super Admin or Admin for a higher cattle limit. */
export function LimitRequestFlow(props: RequestProps) {
  return (
    <Dialog open={props.isOpen} onOpenChange={open => { if (!open) props.onClose(); }}>
      {props.isOpen && <RequestBody {...props} />}
    </Dialog>
  );
}

function RequestBody({ onClose, farm, limit, used }: RequestProps) {
  const { tx } = useText('farmLimits');
  const queryClient = useQueryClient();
  const [extra, setExtra] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [sent, setSent] = useState(false);

  const send = async () => {
    const n = Number(extra);
    if (!(Number.isInteger(n) && n >= 1 && n <= MAX_EXTRA)) { setError(tx('eHowMany')); return; }
    setSaving(true);
    setError('');
    try {
      await ok(await requestFarmLimitAction({ farm, extra: n, reason }));
      queryClient.invalidateQueries({ queryKey: ['livestock'] });
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : tx('eSend'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <FlowShell
      steps={[]}
      step={sent ? 'done' : 'ask'}
      title={sent ? tx('sentTitle') : tx('askTitle')}
      subtitle={sent ? undefined : limit > 0 ? tx('askSub', { farm, used, limit }) : tx('askSubNone', { farm })}
      error={error}
      onSubmit={sent ? undefined : send}
      footer={sent ? null : <FlowFooter label={saving ? tx('sending') : tx('send')} busy={saving} />}
    >
      {sent ? (
        <FlowDone message={tx('sentMsg', { n: Number(extra), farm })} detail={tx('sentDetail')} onClose={onClose} />
      ) : (
        <>
          <Question label={tx('howMany')}>
            <Input aria-label={tx('howManyAria')} type="number" inputMode="numeric" min="1" step="1" autoFocus value={extra} onChange={e => { setExtra(e.target.value); setError(''); }} className={`h-16 text-2xl font-semibold ${NUM}`} />
          </Question>
          <Question label={tx('reason')}>
            <Input aria-label={tx('reasonAria')} value={reason} maxLength={500} placeholder={tx('reasonPh')} onChange={e => setReason(e.target.value)} className="h-14 text-lg" />
          </Question>
        </>
      )}
    </FlowShell>
  );
}

interface DecideProps {
  isOpen: boolean;
  onClose: () => void;
  request: FarmLimitRequest | null;
  limit: number;
  used: number;
}

/** A Super Admin or Admin approves a request (setting the new limit) or declines it. */
export function LimitDecisionFlow(props: DecideProps) {
  return (
    <Dialog open={props.isOpen} onOpenChange={open => { if (!open) props.onClose(); }}>
      {props.isOpen && props.request && <DecideBody {...props} request={props.request} />}
    </Dialog>
  );
}

function DecideBody({ onClose, request, limit, used }: DecideProps & { request: FarmLimitRequest }) {
  const { tx } = useText('farmLimits');
  const queryClient = useQueryClient();
  const [approve, setApprove] = useState(true);
  // The usual answer: the current limit plus what was asked for (never below what is already registered).
  const [newLimit, setNewLimit] = useState(String(Math.max(limit + request.extra, used)));
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<null | 'approved' | 'declined'>(null);

  const save = async () => {
    const n = Number(newLimit);
    if (approve && !(Number.isInteger(n) && n >= Math.max(1, used))) { setError(tx('eNewLimit', { used: Math.max(1, used) })); return; }
    setSaving(true);
    setError('');
    try {
      await ok(await decideFarmLimitAction(request.id, approve, approve ? n : 0, note));
      queryClient.invalidateQueries({ queryKey: ['livestock'] });
      setDone(approve ? 'approved' : 'declined');
    } catch (e) {
      setError(e instanceof Error ? e.message : tx('eDecide'));
    } finally {
      setSaving(false);
    }
  };

  const farm = request.farmLocation;
  return (
    <FlowShell
      steps={[]}
      step={done ? 'done' : 'decide'}
      title={done === 'approved' ? tx('approvedTitle') : done === 'declined' ? tx('declinedTitle') : tx('decideTitle')}
      subtitle={done ? undefined : tx('decideSub', { farm, n: request.extra, limit, used })}
      error={error}
      onSubmit={done ? undefined : save}
      footer={done ? null : <FlowFooter label={saving ? tx('sending') : tx('saveAnswer')} busy={saving} />}
    >
      {done ? (
        <FlowDone message={done === 'approved' ? tx('approvedMsg', { farm, limit: Number(newLimit) }) : tx('declinedMsg', { farm })} onClose={onClose} />
      ) : (
        <>
          {request.reason && <p className="rounded-xl bg-slate-50 p-3 text-base text-ink">{tx('decideReason', { reason: request.reason })}</p>}
          <div className="grid grid-cols-2 gap-3">
            <Choice selected={approve} onClick={() => { setApprove(true); setError(''); }}>{tx('approve')}</Choice>
            <Choice selected={!approve} onClick={() => { setApprove(false); setError(''); }}>{tx('decline')}</Choice>
          </div>
          {approve && (
            <Question label={tx('newLimit')} hint={tx('newLimitHint', { used })}>
              <Input aria-label={tx('newLimitAria')} type="number" inputMode="numeric" min={Math.max(1, used)} step="1" value={newLimit} onChange={e => { setNewLimit(e.target.value); setError(''); }} className={`h-16 text-2xl font-semibold ${NUM}`} />
            </Question>
          )}
          <Question label={tx('note')}>
            <Input aria-label={tx('noteAria')} value={note} maxLength={500} onChange={e => setNote(e.target.value)} className="h-14 text-lg" />
          </Question>
        </>
      )}
    </FlowShell>
  );
}
