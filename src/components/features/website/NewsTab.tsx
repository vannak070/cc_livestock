'use client';

import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { deleteWebsiteNewsAction, saveWebsiteNewsAction, setWebsiteNewsPublishedAction } from '@/app/website-actions';
import type { WebsiteNewsPost } from '@/lib/types';
import { useText } from '@/hooks/useText';
import { areaClass, errorText, Field, FormDialog, inputClass, ok, Pill, PhotoThumb } from './parts';
import { PhotoPicker } from './PhotoPicker';

/** News and training posts for the website. Khmer is required, English optional. */
export function NewsTab({ news, onChanged }: { news: WebsiteNewsPost[]; onChanged: () => void }) {
  const { tx } = useText('websitePage');
  const [editing, setEditing] = useState<WebsiteNewsPost | 'new' | null>(null);
  const [deleting, setDeleting] = useState<WebsiteNewsPost | null>(null);
  const [error, setError] = useState('');

  const act = async (fn: () => Promise<unknown>) => {
    setError('');
    try { await fn(); onChanged(); } catch (err) { setError(errorText(err, tx('saveFailed'))); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-base text-ink-muted">{tx('newsIntro')}</p>
        <Button size="sm" onClick={() => setEditing('new')}><Plus aria-hidden />{tx('newPost')}</Button>
      </div>
      {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-base text-rose-800">{error}</p>}
      {news.length === 0
        ? <p className="rounded-2xl bg-slate-50 p-6 text-lg text-ink-muted">{tx('noNews')}</p>
        : (
          <ul className="space-y-3">
            {news.map(n => (
              <li key={n.id} className="flex flex-wrap items-start gap-4 rounded-2xl border border-slate-200 bg-white p-4">
                {n.photoId && <PhotoThumb id={n.photoId} alt={n.titleEn || n.titleKm} />}
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-lg font-semibold text-ink">{n.titleKm}</p>
                  {n.titleEn && <p className="text-base text-ink-muted">{n.titleEn}</p>}
                  {n.published ? <Pill tone="green">{tx('onWebsite')}</Pill> : <Pill tone="slate">{tx('draft')}</Pill>}
                </div>
                <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:flex-col">
                  <Button size="sm" variant="outline" onClick={() => setEditing(n)}>{tx('edit')}</Button>
                  {n.published
                    ? <Button size="sm" variant="secondary" onClick={() => act(async () => ok(await setWebsiteNewsPublishedAction(n.id, false)))}>{tx('takeOff')}</Button>
                    : <Button size="sm" onClick={() => act(async () => ok(await setWebsiteNewsPublishedAction(n.id, true)))}>{tx('putOn')}</Button>}
                  <Button size="sm" variant="ghost" onClick={() => setDeleting(n)}>{tx('delete')}</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      {editing && <NewsDialog post={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); onChanged(); }} />}
      <ConfirmModal
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => { const d = deleting; setDeleting(null); if (d) act(async () => ok(await deleteWebsiteNewsAction(d.id))); }}
        title={tx('deleteTitle')}
        description={tx('deleteBody', { title: deleting?.titleKm ?? '' })}
        confirmText={tx('delete')}
        cancelText={tx('cancel')}
        type="danger"
      />
    </div>
  );
}

function NewsDialog({ post, onClose, onSaved }: { post: WebsiteNewsPost | null; onClose: () => void; onSaved: () => void }) {
  const { tx } = useText('websitePage');
  const [titleKm, setTitleKm] = useState(post?.titleKm ?? '');
  const [titleEn, setTitleEn] = useState(post?.titleEn ?? '');
  const [bodyKm, setBodyKm] = useState(post?.bodyKm ?? '');
  const [bodyEn, setBodyEn] = useState(post?.bodyEn ?? '');
  const [photos, setPhotos] = useState<string[]>(post?.photoId ? [post.photoId] : []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await ok(await saveWebsiteNewsAction(post?.id ?? null, { titleKm, titleEn, bodyKm, bodyEn, photoId: photos[0] ?? null }));
      onSaved();
    } catch (err) {
      setError(errorText(err, tx('saveFailed')));
      setSaving(false);
    }
  };

  return (
    <FormDialog open onClose={onClose} title={post ? tx('editPost') : tx('newPost')} saving={saving} error={error} saveLabel={saving ? tx('saving') : tx('save')} cancelLabel={tx('cancel')} onSave={save}>
      <Field label={tx('titleKm')}><input className={inputClass} value={titleKm} maxLength={120} onChange={e => setTitleKm(e.target.value)} /></Field>
      <Field label={tx('titleEn')}><input className={inputClass} value={titleEn} maxLength={120} onChange={e => setTitleEn(e.target.value)} /></Field>
      <Field label={tx('bodyKm')}><textarea className={areaClass} value={bodyKm} maxLength={5000} onChange={e => setBodyKm(e.target.value)} /></Field>
      <Field label={tx('bodyEn')}><textarea className={areaClass} value={bodyEn} maxLength={5000} onChange={e => setBodyEn(e.target.value)} /></Field>
      <div className="space-y-2">
        <p className="text-base font-medium text-ink">{tx('newsPhoto')}</p>
        <PhotoPicker ids={photos} onChange={setPhotos} max={1} />
      </div>
    </FormDialog>
  );
}
