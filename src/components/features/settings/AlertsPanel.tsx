'use client';

import React, { useEffect, useState } from 'react';
import { Send, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { MasterSetup } from '@/types/settings.types';
import { findTelegramChatsAction, sendTelegramTestAction, telegramStatusAction } from '@/app/actions';
import { alertSettings, alertSettingsProblem } from '@/lib/alerts';
import { getErrorMessage } from '@/lib/utils';
import { Choice } from '../flow/FlowShell';

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
  const saved = alertSettings(settings);
  const [enabled, setEnabled] = useState(saved.telegramEnabled);
  const [chatId, setChatId] = useState(saved.chatId);
  const [hour, setHour] = useState(saved.sendHour);
  const [status, setStatus] = useState<Status>(null);
  const [chats, setChats] = useState<Chat[] | null>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const [busy, setBusy] = useState<'' | 'save' | 'find' | 'test'>('');

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
      say('ok', 'Saved.');
    } catch (e) {
      say('bad', getErrorMessage(e, 'Could not save.'));
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
    if (res.data.length === 0) say('bad', 'No group found yet. Add the bot to your group, send any message in it, then tap Find again.');
  };

  const test = async () => {
    setBusy('test');
    setMessage(null);
    const res = await sendTelegramTestAction();
    setBusy('');
    say(res.success ? 'ok' : 'bad', res.success ? 'Test message sent. Check your Telegram group.' : res.error);
  };

  const connected = status?.configured && !status.error && status.bot;

  return (
    <div className="space-y-5">
      <p className="text-base text-ink-muted">Send alerts to a Telegram group when a batch nears its selling date.</p>

      <section className="space-y-2 rounded-2xl border-2 border-slate-200 bg-white p-4">
        <h3 className="text-lg font-semibold text-ink">The bot</h3>
        {status === null && <p className="text-base text-ink-muted">Checking…</p>}
        {status && !status.configured && (
          <p className="rounded-xl bg-amber-50 p-3 text-base text-amber-900">No bot is connected yet. Create one with @BotFather in Telegram, then put its token in the server&apos;s <span className="font-mono">.env</span> file as <span className="font-mono">TELEGRAM_BOT_TOKEN</span> and restart the server.</p>
        )}
        {status && status.configured && status.error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-base text-rose-800">The bot token is set, but Telegram said: {status.error}</p>}
        {connected && <p className="text-lg text-ink">Connected as <span className="font-semibold">@{status.bot!.username}</span> ({status.bot!.name})</p>}
      </section>

      <section className="space-y-4 rounded-2xl border-2 border-slate-200 bg-white p-4">
        <h3 className="text-lg font-semibold text-ink">The group</h3>
        <div className="space-y-2">
          <p className="text-base font-medium text-ink">Telegram group</p>
          <div className="flex flex-wrap gap-2">
            <Input aria-label="Telegram chat id" value={chatId} onChange={e => { setChatId(e.target.value); setMessage(null); }} placeholder="Not chosen yet" className="h-14 min-w-0 flex-1 font-mono text-lg" />
            <Button type="button" variant="outline" size="lg" onClick={find} disabled={!connected || busy !== ''}><Search /> {busy === 'find' ? 'Looking…' : 'Find my group'}</Button>
          </div>
          <p className="text-base text-ink-muted">Add the bot to your group first, then send any message in the group so the bot can see it.</p>
          {chats && chats.length > 0 && (
            <ul className="space-y-2">
              {chats.map(c => (
                <li key={c.id}>
                  <button type="button" onClick={() => { setChatId(c.id); setChats(null); setMessage(null); }} className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border-2 border-slate-200 px-4 py-2 text-left hover:border-emerald-600">
                    <span className="min-w-0 break-words text-lg font-semibold text-ink">{c.title}</span>
                    <span className="shrink-0 text-base text-ink-muted">{c.type === 'private' ? 'a person' : c.type}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-base font-medium text-ink">Send alerts</p>
          <div className="flex gap-3">
            <Choice selected={!enabled} onClick={() => { setEnabled(false); setMessage(null); }}>Off</Choice>
            <Choice selected={enabled} onClick={() => { setEnabled(true); setMessage(null); }}>On</Choice>
          </div>
        </div>

        <label className="block space-y-2">
          <span className="text-base font-medium text-ink">Send the daily alert at</span>
          <select aria-label="Hour of the daily alert" value={hour} onChange={e => { setHour(Number(e.target.value)); setMessage(null); }} className={SELECT}>
            {HOURS.map(h => <option key={h} value={h}>{hourText(h)}</option>)}
          </select>
          <span className="block text-base text-ink-muted">Cambodia time.</span>
        </label>

        {message && <p role={message.tone === 'bad' ? 'alert' : 'status'} className={`text-base font-medium ${message.tone === 'bad' ? 'text-rose-700' : 'text-emerald-700'}`}>{message.text}</p>}

        <div className="flex flex-wrap gap-2">
          <Button type="button" size="lg" onClick={save} disabled={!dirty || busy !== ''}>{busy === 'save' ? 'Saving…' : 'Save'}</Button>
          <Button type="button" size="lg" variant="outline" onClick={test} disabled={!connected || !saved.chatId || dirty || busy !== ''}><Send /> {busy === 'test' ? 'Sending…' : 'Send test message'}</Button>
        </div>
        {dirty && saved.chatId && <p className="text-base text-ink-muted">Save your changes before sending a test.</p>}
      </section>
    </div>
  );
}
