'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Eye, EyeOff, Info } from 'lucide-react';
import { loginAction } from '@/app/actions';

// Rendered by src/app/page.tsx whenever there is no valid session. It never
// receives any farm data: the page only loads data once the server has
// verified the session cookie that loginAction sets.
export default function LoginScreen() {
  const router = useRouter();
  const [emailInput, setEmailInput] = React.useState('');
  const [passwordInput, setPasswordInput] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [loginError, setLoginError] = React.useState<{ title: string; detail?: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // The server's wording for a wrong email or password is terse; say it in
  // plain words and tell the person what to do. Any other message (inactive
  // account, missing fields) is already plain and is shown as it is.
  const toFriendlyError = (message?: string) =>
    !message || message === 'Invalid email or password.'
      ? { title: 'Email or password is not correct', detail: 'Check both and try again. Tap Show to see what you typed.' }
      : { title: message };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsSubmitting(true);

    try {
      const res = await loginAction(emailInput.trim(), passwordInput);
      if (!res.success) {
        setLoginError(toFriendlyError(res.error));
        setIsSubmitting(false);
        return;
      }
      // The session cookie is set; re-render the page on the server so it
      // loads this user's data.
      router.refresh();
    } catch {
      setLoginError({ title: 'Could not sign in right now', detail: 'Check your internet connection and try again.' });
      setIsSubmitting(false);
    }
  };

  const fieldBorder = loginError ? 'border-rose-700' : 'border-slate-200 focus-within:border-emerald-600';

  return (
    <div className="min-h-screen flex sm:items-center justify-center bg-canvas font-sans sm:p-6">
      <div className="w-full sm:max-w-md bg-canvas sm:bg-white sm:border sm:border-slate-200 sm:rounded-3xl sm:shadow-sm overflow-hidden">
        <header className="bg-white border-b-4 border-brand px-6 pt-8 pb-7 flex flex-col items-center gap-3 text-center">
          <img src="/logo.png" alt="CC Livestock logo" className="h-28 w-28 object-contain" />
          <div>
            <h1 className="text-3xl font-bold leading-tight text-brand">CC Livestock</h1>
            <p className="text-base text-ink-muted mt-1">Farm records for your cattle</p>
          </div>
        </header>

        <div className="px-5 sm:px-8 pt-7 pb-8">
          <h2 className="text-2xl font-bold text-ink mb-5">Sign in</h2>

          {loginError && (
            <div role="alert" className="mb-5 flex gap-3 items-start p-4 rounded-xl bg-rose-50 text-rose-800">
              <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="text-base font-semibold">{loginError.title}</p>
                {loginError.detail && <p className="text-sm mt-0.5">{loginError.detail}</p>}
              </div>
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="login-email" className="block text-base font-semibold text-ink">Email</label>
              <input
                id="login-email"
                type="email"
                required
                autoComplete="username"
                inputMode="email"
                placeholder="name@farm.com"
                value={emailInput}
                onChange={e => setEmailInput(e.target.value)}
                className="w-full h-14 bg-white border-2 border-slate-200 rounded-xl px-4 text-lg text-ink focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15 placeholder:text-slate-400"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="login-password" className="block text-base font-semibold text-ink">Password</label>
              <div className={`flex items-center h-14 bg-white border-2 rounded-xl pl-4 pr-1.5 focus-within:ring-2 focus-within:ring-emerald-600/15 ${fieldBorder}`}>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={passwordInput}
                  onChange={e => setPasswordInput(e.target.value)}
                  aria-invalid={loginError ? true : undefined}
                  className="flex-1 min-w-0 bg-transparent text-lg text-ink focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="h-11 px-3 rounded-lg flex items-center gap-1.5 text-emerald-700 font-semibold text-sm hover:bg-emerald-50 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-lg rounded-xl flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer transition-colors"
            >
              {isSubmitting ? (
                <>
                  <span className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                  Signing in…
                </>
              ) : loginError ? 'Try again' : 'Sign in'}
            </button>
          </form>

          <div className="mt-6 flex gap-3 items-start p-4 rounded-xl bg-white sm:bg-slate-50 border border-slate-200">
            <Info className="h-5 w-5 flex-shrink-0 mt-0.5 text-ink-muted" aria-hidden="true" />
            <p className="text-sm text-ink-muted">Forgot your password? Ask your farm manager to reset it for you.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
