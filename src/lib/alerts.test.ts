import { describe, it, expect } from 'vitest';
import { alertSettings, alertSettingsProblem, escapeHtml, isChatId } from './alerts';

describe('alert settings', () => {
  it('fills in defaults: off, no group, 07:00', () => {
    expect(alertSettings(undefined)).toEqual({ telegramEnabled: false, chatId: '', sendHour: 7 });
    expect(alertSettings({ alerts: { telegramEnabled: true, chatId: ' -1001234567890 ', sendHour: 18 } })).toEqual({ telegramEnabled: true, chatId: '-1001234567890', sendHour: 18 });
    expect(alertSettings({ alerts: { sendHour: 99 } }).sendHour).toBe(7);
  });

  it('knows a Telegram chat id', () => {
    for (const ok of ['-1001234567890', '123456789', '@cc_management']) expect(isChatId(ok)).toBe(true);
    for (const bad of ['', 'abc', '12', '@ab', '-', '12 34', 'https://t.me/x']) expect(isChatId(bad)).toBe(false);
  });

  it('accepts good settings and explains bad ones', () => {
    expect(alertSettingsProblem({ telegramEnabled: true, chatId: '-1001234567890', sendHour: 7 })).toBeNull();
    expect(alertSettingsProblem({ telegramEnabled: false, chatId: '', sendHour: 7 })).toBeNull();
    expect(alertSettingsProblem({ telegramEnabled: true, chatId: '' })).toMatch(/Choose the Telegram group/);
    expect(alertSettingsProblem({ chatId: 'nope' })).toMatch(/chat id/);
    expect(alertSettingsProblem({ sendHour: 24 })).toMatch(/0 to 23/);
    expect(alertSettingsProblem({ sendHour: 7.5 })).toMatch(/0 to 23/);
    expect(alertSettingsProblem(undefined)).toMatch(/missing/);
  });

  it('keeps user text from being read as Telegram HTML', () => {
    expect(escapeHtml('Batch <A> & "B"')).toBe('Batch &lt;A&gt; &amp; "B"');
  });
});
