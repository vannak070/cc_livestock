'use client';

import React, { useEffect, useState } from 'react';
import { Send, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { MasterSetup } from '@/types/settings.types';
import { findTelegramChatsAction, runSaleAlertsAction, sendTelegramTestAction, telegramStatusAction } from '@/app/actions';
import { alertSettings, alertSettingsProblem } from '@/lib/alerts';
import { saleWindowDays } from '@/lib/sale-review';
import { longStayMonths } from '@/lib/long-stay';
import { getErrorMessage } from '@/lib/utils';
import { Choice } from '../flow/FlowShell';
import { useText } from '@/hooks/useText';

interface AlertsPanelProps {
  settings: MasterSetup;
  onSettings: (patch: Partial<MasterSetup>) => Promise<void>;
}

type Status = null | { configured: false } | { configured: true; bot?: { username: string; name: string }; error?: string };
type Chat = { id: string; type: string; title: string };

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const hourText = (h: number) => `${String(h).padStart(2, '0')}:00`;
const SELECT = 'h-12 rounded-xl border-2 border-slate-200 bg-white px-3 text-lg text-ink focus:border-emerald-600 focus:outline-none';

export default function AlertsPanel({ settings, onSettings }: AlertsPanelProps) {
  const { tx, txn } = useText('settingsPage');
  const saved = alertSettings(settings);
  const [enabled, setEnabled] = useState(saved.telegramEnabled);
  const [chatId, setChatId] = useState(saved.chatId);
  const [hour, setHour] = useState(saved.sendHour);
  const [status, setStatus] = useState<Status>(null);
  const [chats, setChats] = useState<Chat[] | null>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const [busy, setBusy] = useState<'' | 'save' | 'find' | 'test' | 'run'>('');

  useEffect(() => {
    let live = true;
    telegramStatusAction().then(res => { if (live) setStatus(res.success ? res.data : { configured: true, error: res.error }); });
    return () => { live = false; };
  }, []);

  const dirty = enabled !== saved.telegramEnabled || chatId.trim() !== saved.chatId || hour !== saved.sendHour;
  const say = (tone: 'ok' | 'bad', text: string) => setMessage({ tone, text });

  const save = async () => {
    const next = { telegramEnabled: enabled, chatId: chatId.trim(), sendHour: hour };
    const problem = alertSettingsProblem(next);
    if (problem) { say('bad', problem); return; }
    setBusy('save');
    try {
      await onSettings({ alerts: next });
      say('ok', tx('savedDot'));
    } catch (e) {
      say('bad', getErrorMessage(e, tx('couldNotSave')));
    } finally {
      setBusy('');
    }
  };

  const find = async () => {
    setBusy('find');
    setMessage(null);
    const res = await findTelegramChatsAction();
    setBusy('');
    if (!res.success) { say('bad', res.error); return; }
    setChats(res.data);
    if (res.data.length === 0) say('bad', tx('noGroup'));
  };

  const test = async () => {
    setBusy('test');
    setMessage(null);
    const res = await sendTelegramTestAction();
    setBusy('');
    say(res.success ? 'ok' : 'bad', res.success ? tx('testSent') : res.error);
  };

  const runNow = async () => {
    setBusy('run');
    setMessage(null);
    const res = await runSaleAlertsAction();
    setBusy('');
    if (!res.success) { say('bad', res.error); return; }
    const parts = [
      res.data.dailySent > 0 ? tx('sentDaily', { n: res.data.dailySent }) : '',
      res.data.capacitySent > 0 ? tx('sentForLimits', { n: res.data.capacitySent }) : '',
      res.data.lowFeedSent > 0 ? tx('sentLowFeed', { n: res.data.lowFeedSent }) : '',
    ].filter(Boolean);
    say('ok', parts.length > 0 ? parts.join(' ') : tx('nothingNew'));
  };

  const last = settings.alertStatus;
  // The scheduler checks every 10 minutes; a missing or older mark means automatic alerts are not going out.
  const [openedAt] = useState(() => Date.now());
  const seen = last?.schedulerSeenAt ? Date.parse(last.schedulerSeenAt) : NaN;
  const schedulerOn = Number.isFinite(seen) && openedAt - seen < 25 * 60 * 1000;
  const connected = status?.configured && !status.error && status.bot;

  return (
    <div className="space-y-5">
      <p className="text-base text-ink-muted">{tx('alertsIntro')}</p>

      <section className="space-y-2 rounded-2xl border-2 border-slate-200 bg-white p-4">
        <h3 className="text-lg font-semibold text-ink">{tx('theBot')}</h3>
        {status === null && <p className="text-base text-ink-muted">{tx('checking')}</p>}
        {status && !status.configured && (
          <p className="rounded-xl bg-amber-50 p-3 text-base text-amber-900">{tx('noBot')}</p>
        )}
        {status && status.configured && status.error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-base text-rose-800">{tx('botError', { error: status.error })}</p>}
        {connected && <p className="text-lg text-ink">{tx('connectedAs', { username: status.bot!.username, name: status.bot!.name })}</p>}
      </section>

      <section className="space-y-4 rounded-2xl border-2 border-slate-200 bg-white p-4">
        <h3 className="text-lg font-semibold text-ink">{tx('theGroup')}</h3>
        <div className="space-y-2">
          <p className="text-base font-medium text-ink">{tx('tgGroup')}</p>
          <div className="flex flex-wrap gap-2">
            <Input aria-label={tx('chatIdAria')} value={chatId} onChange={e => { setChatId(e.target.value); setMessage(null); }} placeholder={tx('notChosen')} className="h-14 min-w-0 flex-1 font-mono text-lg" />
            <Button type="button" variant="outline" size="lg" onClick={find} disabled={!connected || busy !== ''}><Search /> {busy === 'find' ? tx('looking') : tx('findGroup')}</Button>
          </div>
          <p className="text-base text-ink-muted">{tx('addBotFirst')}</p>
          {chats && chats.length > 0 && (
            <ul className="space-y-2">
              {chats.map(c => (
                <li key={c.id}>
                  <button type="button" onClick={() => { setChatId(c.id); setChats(null); setMessage(null); }} className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border-2 border-slate-200 px-4 py-2 text-left hover:border-emerald-600">
                    <span className="min-w-0 break-words text-lg font-semibold text-ink">{c.title}</span>
                    <span className="shrink-0 text-base text-ink-muted">{c.type === 'private' ? tx('aPerson') : c.type}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-base font-medium text-ink">{tx('sendAlerts')}</p>
          <div className="flex gap-3">
            <Choice selected={!enabled} onClick={() => { setEnabled(false); setMessage(null); }}>{tx('off')}</Choice>
            <Choice selected={enabled} onClick={() => { setEnabled(true); setMessage(null); }}>{tx('on')}</Choice>
          </div>
        </div>

        <label className="block space-y-2">
          <span className="text-base font-medium text-ink">{tx('sendAt')}</span>
          <select aria-label={tx('hourAria')} value={hour} onChange={e => { setHour(Number(e.target.value)); setMessage(null); }} className={SELECT}>
            {HOURS.map(h => <option key={h} value={h}>{hourText(h)}</option>)}
          </select>
          <span className="block text-base text-ink-muted">{tx('cambodiaTime')}</span>
        </label>

        {message && <p role={message.tone === 'bad' ? 'alert' : 'status'} className={`text-base font-medium ${message.tone === 'bad' ? 'text-rose-700' : 'text-emerald-700'}`}>{message.text}</p>}

        <div className="flex flex-wrap gap-2">
          <Button type="button" size="lg" onClick={save} disabled={!dirty || busy !== ''}>{busy === 'save' ? tx('saving') : tx('save')}</Button>
          <Button type="button" size="lg" variant="outline" onClick={test} disabled={!connected || !saved.chatId || dirty || busy !== ''}><Send /> {busy === 'test' ? tx('sending') : tx('sendTest')}</Button>
        </div>
        {dirty && saved.chatId && <p className="text-base text-ink-muted">{tx('saveFirst')}</p>}
      </section>

      <section className="space-y-3 rounded-2xl border-2 border-slate-200 bg-white p-4">
        <h3 className="text-lg font-semibold text-ink">{tx('whatSent')}</h3>
        <ul className="list-disc space-y-1 pl-5 text-base text-ink">
          <li>{tx('sent1')}</li>
          <li>{tx('sent2')}</li>
          <li>{tx('sent3', { n: saleWindowDays(settings) })}</li>
          <li>{tx('sent4', { months: longStayMonths(settings) })}</li>
          <li>{tx('sent6')}</li>
          <li>{tx('sent7')}</li>
        </ul>
        <p className="text-base text-ink-muted">{tx('changeDays')}</p>
        {last?.lastSentAt && <p className="text-base text-ink">{tx('lastAlert', { time: last.lastSentAt.slice(0, 16).replace('T', ' '), what: txn(last.lastSentCount ?? 0, 'messageOne', 'messageMany') })}</p>}
        {saved.telegramEnabled && (schedulerOn
          ? <p className="rounded-xl bg-emerald-50 p-3 text-base text-emerald-900">{tx('schedulerOn', { time: last!.schedulerSeenAt!.slice(0, 16).replace('T', ' ') })}</p>
          : <p role="alert" className="rounded-xl bg-amber-50 p-3 text-base text-amber-900">{tx('schedulerOff')}{Number.isFinite(seen) ? ' ' + tx('schedulerLast', { time: last!.schedulerSeenAt!.slice(0, 16).replace('T', ' ') }) : ''}</p>)}
        {last?.lastError && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-base text-rose-800">{tx('lastFailed', { error: last.lastError })}</p>}
        <Button type="button" size="lg" variant="outline" onClick={runNow} disabled={!connected || !saved.telegramEnabled || !saved.chatId || dirty || busy !== ''}>{busy === 'run' ? tx('checking') : tx('checkSend')}</Button>
        {!saved.telegramEnabled && <p className="text-base text-ink-muted">{tx('switchOn')}</p>}
      </section>
    </div>
  );
}
