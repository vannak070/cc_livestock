'use client';

import React, { useRef, useState } from 'react';
import { Check, Copy, Download, Share2 } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { useLanguage } from '@/context/LanguageContext';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// "Share app" row for the side menu. Opens a dialog with a QR code of the app's
// address (drawn in the browser, so the link never goes to a QR service), the
// phone's own share sheet where available, copy link, and a PNG download for
// printing. Only the site address is shared: no farm data, and the person who
// receives it still needs their own account to sign in.
export default function ShareAppButton() {
  const { t } = useLanguage();
  const [appUrl, setAppUrl] = useState<string | null>(null);
  const [canShare, setCanShare] = useState(false);
  const [copied, setCopied] = useState(false);
  const qrRef = useRef<HTMLCanvasElement>(null);
  const linkRef = useRef<HTMLInputElement>(null);
  const copyRef = useRef<HTMLButtonElement>(null);

  const openDialog = () => {
    setAppUrl(`${window.location.origin}/`);
    setCanShare(typeof navigator.share === 'function');
    setCopied(false);
  };

  const shareLink = async () => {
    if (!appUrl) return;
    try {
      await navigator.share({ title: 'CC Livestock', text: t('pwa.shareText'), url: appUrl });
    } catch {
      // The person closed the share sheet; nothing to do.
    }
  };

  const copyLink = async () => {
    if (!appUrl) return;
    try {
      await navigator.clipboard.writeText(appUrl);
      setCopied(true);
    } catch {
      // Clipboard blocked (e.g. plain http): select the link so it can be copied by hand.
      linkRef.current?.select();
    }
  };

  const downloadQr = () => {
    const canvas = qrRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = 'cc-livestock-qr.png';
    link.click();
  };

  const actionButton = 'h-12 rounded-xl flex items-center justify-center gap-2 font-semibold text-base cursor-pointer transition-colors';

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="w-full flex items-center gap-3 min-h-12 px-3 py-2.5 rounded-xl text-ink hover:bg-slate-100 font-medium transition-colors duration-150 cursor-pointer"
      >
        <Share2 className="h-5 w-5 text-ink-muted" aria-hidden="true" />
        <span className="text-base leading-tight text-left">{t('pwa.share')}</span>
      </button>

      <Dialog open={appUrl !== null} onOpenChange={open => { if (!open) setAppUrl(null); }}>
        {/* Start focus on Copy link: the dialog would otherwise focus (and highlight) the link box. */}
        <DialogContent onOpenAutoFocus={e => { e.preventDefault(); copyRef.current?.focus(); }}>
          <DialogHeader>
            <DialogTitle>{t('pwa.shareTitle')}</DialogTitle>
            <DialogDescription>{t('pwa.shareIntro')}</DialogDescription>
          </DialogHeader>

          {appUrl && (
            <div className="flex flex-col items-center gap-4">
              {/* Drawn at 512px so the downloaded PNG prints sharply; shown at 240px. */}
              <QRCodeCanvas
                ref={qrRef}
                value={appUrl}
                size={512}
                level="H"
                marginSize={2}
                title={appUrl}
                imageSettings={{ src: '/icons/icon-192.png', width: 112, height: 112, excavate: true }}
                className="rounded-xl border border-slate-200"
                style={{ width: 240, height: 240 }}
              />

              <input
                ref={linkRef}
                readOnly
                value={appUrl}
                aria-label="App link"
                className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-slate-50 text-base text-ink text-center"
              />

              <div className="w-full grid gap-2">
                {canShare && (
                  <button type="button" onClick={shareLink} className={`${actionButton} bg-emerald-600 hover:bg-emerald-700 text-white`}>
                    <Share2 className="h-5 w-5" aria-hidden="true" />
                    {t('pwa.shareVia')}
                  </button>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <button ref={copyRef} type="button" onClick={copyLink} className={`${actionButton} border-2 border-emerald-600 text-emerald-700 hover:bg-emerald-50`}>
                    {copied ? <Check className="h-5 w-5" aria-hidden="true" /> : <Copy className="h-5 w-5" aria-hidden="true" />}
                    {copied ? t('pwa.copied') : t('pwa.copyLink')}
                  </button>
                  <button type="button" onClick={downloadQr} className={`${actionButton} border-2 border-slate-200 text-ink hover:bg-slate-50`}>
                    <Download className="h-5 w-5" aria-hidden="true" />
                    {t('pwa.downloadQr')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
