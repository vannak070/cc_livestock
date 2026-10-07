'use client';

import React, { useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { uploadWebsitePhotoAction } from '@/app/website-actions';
import { PHOTO_LARGE_PX, PHOTO_SMALL_PX } from '@/lib/website';
import { useText } from '@/hooks/useText';
import { errorText, ok, PhotoThumb } from './parts';

/** Largest file we send for the big copy; quality steps down until it fits (keeps uploads under the 1 MB action limit). */
const TARGET_BYTES = 600_000;

/**
 * Draws the photo again at a smaller size. Re-drawing keeps only the pixels,
 * so GPS position, camera details and other EXIF data are left behind.
 * WebP where the browser can make it, else JPEG (Safari).
 */
async function encode(bitmap: ImageBitmap, maxPx: number, targetBytes: number): Promise<{ blob: Blob; width: number; height: number }> {
  const scale = Math.min(1, maxPx / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height);
  const make = (type: string, q: number) => new Promise<Blob>((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Could not read the photo.'))), type, q));
  let type = 'image/webp';
  for (const q of [0.82, 0.72, 0.62, 0.52]) {
    let blob = await make(type, q);
    if (blob.type !== 'image/webp') { type = 'image/jpeg'; blob = await make(type, q); }
    if (blob.size <= targetBytes || q === 0.52) return { blob, width, height };
  }
  throw new Error('Could not read the photo.');
}

const base64 = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
  r.onerror = () => reject(new Error('Could not read the photo.'));
  r.readAsDataURL(blob);
});

export function PhotoPicker({ ids, onChange, max }: { ids: string[]; onChange: (ids: string[]) => void; max: number }) {
  const { tx } = useText('websitePage');
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setError('');
    const added: string[] = [];
    try {
      for (const file of Array.from(files).slice(0, max - ids.length)) {
        const bitmap = await createImageBitmap(file);
        const large = await encode(bitmap, PHOTO_LARGE_PX, TARGET_BYTES);
        const small = await encode(bitmap, PHOTO_SMALL_PX, 200_000);
        bitmap.close();
        if (large.blob.type !== small.blob.type) throw new Error(tx('photoFailed'));
        const info = await ok(await uploadWebsitePhotoAction({
          mime: large.blob.type, largeBase64: await base64(large.blob), smallBase64: await base64(small.blob), width: large.width, height: large.height,
        }));
        added.push(info.id);
      }
    } catch (err) {
      setError(errorText(err, tx('photoFailed')));
    } finally {
      if (added.length) onChange([...ids, ...added]);
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-3">
        {ids.map(id => (
          <div key={id} className="relative">
            <PhotoThumb id={id} alt={tx('photoAlt')} className="h-20 w-20" />
            <button type="button" onClick={() => onChange(ids.filter(x => x !== id))} aria-label={tx('photoRemove')} className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white text-ink shadow ring-1 ring-slate-200 hover:bg-rose-50">
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        ))}
      </div>
      {ids.length < max && (
        <>
          <input ref={input} type="file" accept="image/*" multiple className="sr-only" onChange={e => add(e.target.files)} aria-label={tx('photoAdd')} />
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()}>
            <ImagePlus aria-hidden /> {busy ? tx('photoUploading') : tx('photoAdd')}
          </Button>
        </>
      )}
      <p className="text-sm text-ink-muted">{tx('photoHint', { max })}</p>
      {error && <p role="alert" className="text-sm text-rose-800">{error}</p>}
    </div>
  );
}
