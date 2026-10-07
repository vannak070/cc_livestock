'use client';

import { useRef, useState } from 'react';
import { LARGE_PX, MAX_PHOTOS, SMALL_PX, type PhotoIn } from '@/lib/forms/photos';

/**
 * Up to three farm photos for a Join application. Each is re-drawn smaller in
 * the browser before sending, which also removes GPS and camera data.
 * WebP where the browser can make it, else JPEG (Safari).
 */
async function encode(bitmap: ImageBitmap, maxPx: number, targetBytes: number): Promise<{ blob: Blob; width: number; height: number }> {
  const scale = Math.min(1, maxPx / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height);
  const make = (type: string, q: number) => new Promise<Blob>((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('photo'))), type, q));
  let type = 'image/webp';
  let blob: Blob | null = null;
  for (const q of [0.8, 0.7, 0.6, 0.5]) {
    blob = await make(type, q);
    if (blob.type !== 'image/webp') { type = 'image/jpeg'; blob = await make(type, q); }
    if (blob.size <= targetBytes) break;
  }
  return { blob: blob!, width, height };
}

const base64 = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
  r.onerror = () => reject(new Error('photo'));
  r.readAsDataURL(blob);
});

export interface JoinPhoto extends PhotoIn { preview: string }

export function JoinPhotos({ photos, onChange, t }: { photos: JoinPhoto[]; onChange: (p: JoinPhoto[]) => void; t: { photos: string; photosHint: string; addPhotos: string; preparing: string; photoFailed: string; removePhoto: string } }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setError('');
    const added: JoinPhoto[] = [];
    try {
      for (const file of Array.from(files).slice(0, MAX_PHOTOS - photos.length)) {
        const bitmap = await createImageBitmap(file);
        const large = await encode(bitmap, LARGE_PX, 550_000);
        const small = await encode(bitmap, SMALL_PX, 120_000);
        bitmap.close();
        if (large.blob.type !== small.blob.type) throw new Error('photo');
        added.push({ mime: large.blob.type, large: await base64(large.blob), small: await base64(small.blob), width: large.width, height: large.height, preview: URL.createObjectURL(small.blob) });
      }
    } catch {
      setError(t.photoFailed);
    } finally {
      if (added.length) onChange([...photos, ...added]);
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div className="stack" style={{ gap: 8 }}>
      {photos.length > 0 && (
        <div className="row" style={{ gap: 10 }}>
          {photos.map((p, i) => (
            <div key={p.preview} style={{ position: 'relative' }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- local preview of a photo the visitor picked */}
              <img src={p.preview} alt="" style={{ width: 84, height: 84, objectFit: 'cover', borderRadius: 14 }} />
              <button type="button" aria-label={t.removePhoto} onClick={() => { URL.revokeObjectURL(p.preview); onChange(photos.filter((_, j) => j !== i)); }}
                style={{ position: 'absolute', top: -8, right: -8, width: 32, height: 32, borderRadius: '50%', border: '1px solid var(--line)', background: '#fff', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
            </div>
          ))}
        </div>
      )}
      {photos.length < MAX_PHOTOS && (
        <>
          <input ref={input} type="file" accept="image/*" multiple className="hp" tabIndex={-1} aria-hidden="true" onChange={e => void add(e.target.files)} />
          <button type="button" className="btn btn-line" style={{ alignSelf: 'flex-start', minHeight: 44 }} disabled={busy} onClick={() => input.current?.click()}>
            {busy ? t.preparing : t.addPhotos}
          </button>
        </>
      )}
      <span className="small muted">{t.photosHint}</span>
      {error && <span className="form-error" role="alert">{error}</span>}
    </div>
  );
}
