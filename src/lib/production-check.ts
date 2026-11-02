// What must be true of the settings before CC Livestock goes live. Pure: it reads a settings object and
// returns findings; it never prints or returns a secret's value.

import { DEV_JWT_SECRET, MIN_SECRET_LENGTH, corsOrigins } from './server-security';

export interface Finding { level: 'error' | 'warning' | 'info'; message: string }
type Env = Record<string, string | undefined>;

const WEAK_DB_PASSWORDS = ['', 'postgres', 'postgres123', 'password', 'admin', '123456'];

export function productionFindings(env: Env): Finding[] {
  const out: Finding[] = [];
  const add = (level: Finding['level'], message: string) => out.push({ level, message });
  const set = (k: string) => !!env[k]?.trim();

  if (env.NODE_ENV !== 'production') add('error', 'NODE_ENV must be "production" on the live server (PM2 sets it from ecosystem.config.js).');

  const jwt = env.JWT_SECRET?.trim() ?? '';
  if (!jwt) add('error', 'JWT_SECRET is not set. Logins cannot be signed safely without it.');
  else if (jwt === DEV_JWT_SECRET || jwt.length < MIN_SECRET_LENGTH) add('error', `JWT_SECRET is the sample value or shorter than ${MIN_SECRET_LENGTH} characters. Make a new one: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`);

  if (WEAK_DB_PASSWORDS.includes((env.DB_PASSWORD ?? '').trim())) add('error', 'DB_PASSWORD is empty or a well-known password. Use a long random one.');
  if (env.DB_SSL !== 'true' && (env.DB_HOST ?? 'localhost') !== 'localhost' && env.DB_HOST !== '127.0.0.1' && env.DB_HOST !== 'db') add('warning', 'The database is on another machine and DB_SSL is not "true". The connection is not encrypted.');

  const cors = corsOrigins(env);
  if (cors === '*') add('error', 'CORS_ORIGIN is "*": any website may call the API from a browser. List your own address instead.');
  else if (cors === false) add('info', 'CORS_ORIGIN is not set: browsers on other websites cannot call the API (fine when the app and API share one address).');

  const url = env.NEXT_PUBLIC_APP_URL?.trim() ?? '';
  if (!url) add('warning', 'NEXT_PUBLIC_APP_URL is not set, so the Share app QR code uses whatever address the page was opened from.');
  else if (!url.startsWith('https://')) add('error', 'NEXT_PUBLIC_APP_URL is not an https:// address. The site must be served over HTTPS (passwords and the login cookie travel in the clear over HTTP).');

  if (env.SESSION_COOKIE_SECURE?.trim().toLowerCase() === 'false') add('error', 'SESSION_COOKIE_SECURE=false: the login cookie is also sent over plain HTTP.');
  else if (env.SESSION_COOKIE_SECURE?.trim().toLowerCase() !== 'true') add('warning', 'SESSION_COOKIE_SECURE is not "true". Once the site has HTTPS, set it so the login cookie can never travel over HTTP.');

  if (set('WEBSITE_API_KEY') && (env.WEBSITE_API_KEY as string).trim().length < MIN_SECRET_LENGTH) add('error', `WEBSITE_API_KEY is shorter than ${MIN_SECRET_LENGTH} characters.`);
  if (!set('WEBSITE_API_KEY')) add('info', 'WEBSITE_API_KEY is not set: the public website link is switched off.');
  if (!set('TELEGRAM_BOT_TOKEN')) add('info', 'TELEGRAM_BOT_TOKEN is not set: Telegram alerts are off.');
  if (!set('ANTHROPIC_API_KEY')) add('info', 'ANTHROPIC_API_KEY is not set: reading cattle receipts (PDF/photo) is off.');
  return out;
}

export const hasErrors = (findings: Finding[]) => findings.some(f => f.level === 'error');
