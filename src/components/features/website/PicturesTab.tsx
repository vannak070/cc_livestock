'use client';

import React, { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { setWebsiteSiteImageAction } from '@/app/website-actions';
import { useText } from '@/hooks/useText';
import { SITE_IMAGE_DEFAULT_FILE, SITE_IMAGE_SHAPE, SITE_IMAGE_SLOTS, type SiteImages, type SiteImageSlot } from '@/lib/website';
import { errorText, ok, Pill } from './parts';
import { PhotoPicker } from './PhotoPicker';

const FRAME: Record<'wide' | 'tall' | 'square', string> = {
  wide: 'aspect-[16/10] w-full sm:w-56',
  tall: 'aspect-[3/4] w-32',
  square: 'aspect-square w-28',
};

/**
 * The pictures built into the public website (page tops, team, leaders, partner logos). Each one shows its original
 * until a photo is chosen here; "Use the original" goes back. Super Admin and Admin only (the service checks).
 */
export function PicturesTab({ siteImages, onChanged }: { siteImages: SiteImages; onChanged: () => void }) {
  const { tx } = useText('websitePage');
  const [busy, setBusy] = useState<SiteImageSlot | null>(null);
  const [resetting, setResetting] = useState<SiteImageSlot | null>(null);
  const [error, setError] = useState('');

  const change = async (slot: SiteImageSlot, photoId: string | null) => {
    setBusy(slot);
    setError('');
    try {
      await ok(await setWebsiteSiteImageAction(slot, photoId));
      onChanged();
    } catch (err) {
      setError(errorText(err, tx('saveFailed')));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-base text-ink-muted">{tx('picturesIntro')}</p>
      {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-base text-rose-800">{error}</p>}
      <ul className="space-y-3">
        {SITE_IMAGE_SLOTS.map(slot => {
          const chosen = siteImages[slot];
          const shape = SITE_IMAGE_SHAPE[slot];
          const src = chosen ? `/api/website/photos/${encodeURIComponent(chosen)}?size=small` : `/website-defaults/${SITE_IMAGE_DEFAULT_FILE[slot]}`;
          return (
            <li key={slot} className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-start">
              {/* eslint-disable-next-line @next/next/no-img-element -- the chosen photo is private and session-protected (see PhotoThumb) */}
              <img src={src} alt={tx(`pic_${slot}`)} className={`${FRAME[shape]} shrink-0 rounded-xl bg-slate-100 ${shape === 'square' ? 'object-contain' : 'object-cover'}`} loading="lazy" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-lg font-semibold text-ink">{tx(`pic_${slot}`)}</p>
                  {chosen ? <Pill tone="green">{tx('picCustom')}</Pill> : <Pill tone="slate">{tx('picOriginal')}</Pill>}
                </div>
                <p className="text-base text-ink-muted">{tx('picShowsOn', { where: tx(`picWhere_${slot}`) })}</p>
                <div className="flex flex-wrap items-start gap-3">
                  <PhotoPicker
                    ids={[]}
                    max={1}
                    onChange={ids => { if (ids[0]) void change(slot, ids[0]); }}
                    addLabel={busy === slot ? tx('saving') : tx('picReplace')}
                    hint={tx(shape === 'wide' ? 'picShapeWide' : shape === 'tall' ? 'picShapeTall' : 'picShapeSquare')}
                  />
                  {chosen && (
                    <Button type="button" size="sm" variant="ghost" disabled={busy === slot} onClick={() => setResetting(slot)}>
                      <RotateCcw aria-hidden /> {tx('picUseOriginal')}
                    </Button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <ConfirmModal
        isOpen={!!resetting}
        onClose={() => setResetting(null)}
        onConfirm={() => { const s = resetting; setResetting(null); if (s) void change(s, null); }}
        title={tx('picResetTitle')}
        description={tx('picResetBody', { name: resetting ? tx(`pic_${resetting}`) : '' })}
        confirmText={tx('picUseOriginal')}
        cancelText={tx('cancel')}
      />
    </div>
  );
}
