'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { loginAction } from '@/app/actions';

// Rendered by src/app/page.tsx whenever there is no valid session. It never
// receives any farm data: the page only loads data once the server has
// verified the session cookie that loginAction sets.
export default function LoginScreen() {
  const router = useRouter();
  const [emailInput, setEmailInput] = React.useState('');
  const [passwordInput, setPasswordInput] = React.useState('');
  const [loginError, setLoginError] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsSubmitting(true);

    try {
      const res = await loginAction(emailInput.trim(), passwordInput);
      if (!res.success) {
        setLoginError(res.error || 'Invalid corporate email or password.');
        setIsSubmitting(false);
        return;
      }
      // The session cookie is set; re-render the page on the server so it
      // loads this user's data.
      router.refresh();
    } catch {
      setLoginError('Invalid corporate email or password.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 font-sans p-4 relative overflow-hidden">
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-50/60 blur-3xl -z-10" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-teal-50/60 blur-3xl -z-10" />

      <div className="w-full max-w-md bg-white border border-slate-100/80 rounded-3xl shadow-xl overflow-hidden transition-all duration-300 hover:shadow-2xl">
        <div className="bg-[#002D26] p-8 text-center relative">
          <div className="absolute inset-0 bg-gradient-to-tr from-emerald-950/20 to-teal-500/10 opacity-70" />
          <div className="relative z-10 flex flex-col items-center">
            <div className="mb-4 transform hover:scale-105 transition-transform duration-250 flex items-center justify-center">
              <img src="/logo.png" alt="CC Livestock Logo" className="h-20 w-auto object-contain filter drop-shadow-lg" />
            </div>
            <h1 className="font-black text-lg leading-tight tracking-wider uppercase text-white">CC Livestock</h1>
            <p className="text-[10px] text-emerald-400 font-extrabold tracking-widest uppercase mt-1">Fattening Livestock Management System</p>
          </div>
        </div>

        <div className="p-8">
          <form onSubmit={handleLoginSubmit} className="space-y-5">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Email</label>
              <input
                type="email"
                required
                placeholder="e.g. name@snrfarm.com"
                value={emailInput}
                onChange={e => setEmailInput(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 transition-all placeholder:text-slate-400"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Password</label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={passwordInput}
                onChange={e => setPasswordInput(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 transition-all placeholder:text-slate-400"
              />
            </div>

            {loginError && (
              <div className="p-3.5 bg-red-50 border border-red-100 rounded-xl text-xs font-semibold text-red-600">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-4 rounded-xl text-xs uppercase tracking-wider shadow-lg shadow-emerald-600/10 hover:shadow-emerald-600/20 active:scale-[0.98] transition-all duration-150 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                'Authenticate Access'
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
            <p className="text-[10px] font-bold text-slate-400/80 uppercase tracking-wider">CC Livestock Enterprise Systems</p>
            <p className="text-[9px] text-slate-400 mt-1">Authorized personnel only. Sessions are monitored and logged.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
