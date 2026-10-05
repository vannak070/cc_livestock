'use client';

import React, { useState, useSyncExternalStore } from 'react';
import { Download } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// Chrome, Edge and Android browsers fire `beforeinstallprompt` once, soon after
// the page loads, and the install prompt can only be shown later if someone
// kept that event. It is captured here at module load rather than inside a
// component, so the button still works after the login screen (one mounted
// copy) is replaced by the app header (another copy).
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(listener => listener());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', event => {
    // Stops the browser's own mini-banner; our button shows the prompt instead.
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notify();
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// 'prompt': the browser can install directly (Chrome, Edge, Android).
// 'ios' / 'safari-mac': no install API, so the button shows manual steps.
// null: already running as an installed app, or the browser can't install.
type InstallMode = 'prompt' | 'ios' | 'safari-mac' | null;

function getInstallMode(): InstallMode {
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (isStandalone) return null;
  if (deferredPrompt) return 'prompt';

  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac; touch support tells them apart.
  const isIos = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (isIos) return 'ios';
  const isMacSafari = /Macintosh/.test(ua) && /Safari\//.test(ua) && !/Chrome|Chromium|Edg|Firefox|OPR/.test(ua);
  if (isMacSafari) return 'safari-mac';
  return null;
}

interface InstallAppButtonProps {
  // 'menu' is a row in the side menu (next to Share app);
  // 'full' is a full-width button for the login screen.
  variant?: 'menu' | 'full';
}

export default function InstallAppButton({ variant = 'menu' }: InstallAppButtonProps) {
  const { t } = useLanguage();
  const mode = useSyncExternalStore(subscribe, getInstallMode, () => null);
  const [showSteps, setShowSteps] = useState(false);

  if (!mode) return null;

  const handleClick = async () => {
    if (mode !== 'prompt' || !deferredPrompt) {
      setShowSteps(true);
      return;
    }
    const promptEvent = deferredPrompt;
    await promptEvent.prompt();
    await promptEvent.userChoice;
    // A prompt event can only be used once.
    deferredPrompt = null;
    notify();
  };

  const steps = mode === 'ios'
    ? [t('pwa.iosStep1'), t('pwa.iosStep2'), t('pwa.iosStep3')]
    : [t('pwa.macStep1'), t('pwa.macStep2'), t('pwa.macStep3')];

  return (
    <>
      {variant === 'full' ? (
        <button
          type="button"
          onClick={handleClick}
          className="w-full h-14 bg-white border-2 border-emerald-600 text-emerald-700 hover:bg-emerald-50 font-semibold text-lg rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors"
        >
          <Download className="h-5 w-5" aria-hidden="true" />
          {t('pwa.install')}
        </button>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          className="w-full flex items-center gap-3 min-h-12 px-3 py-2.5 rounded-xl text-ink hover:bg-slate-100 font-medium transition-colors duration-150 cursor-pointer"
        >
          <Download className="h-5 w-5 text-ink-muted" aria-hidden="true" />
          <span className="text-base leading-tight text-left">{t('pwa.install')}</span>
        </button>
      )}

      <Dialog open={showSteps} onOpenChange={setShowSteps}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('pwa.installTitle')}</DialogTitle>
            <DialogDescription>{t('pwa.installIntro')}</DialogDescription>
          </DialogHeader>
          <ol className="space-y-3">
            {steps.map((step, i) => (
              <li key={i} className="flex gap-3 items-start">
                <span className="h-7 w-7 flex-shrink-0 rounded-full bg-emerald-600 text-white text-sm font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <span className="text-base text-ink pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
          <p className="text-sm text-ink-muted">{t('pwa.signInAgain')}</p>
        </DialogContent>
      </Dialog>
    </>
  );
}
