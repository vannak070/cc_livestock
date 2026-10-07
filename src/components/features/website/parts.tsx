'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/** Small building blocks shared by the Website page's tabs. */

/** Unwraps a server action result, throwing its error so react-query / the form shows it. */
export async function ok<T>(res: { success: true; data: T } | { success: false; error: string }): Promise<T> {
  if (!res.success) throw new Error(res.error);
  return res.data;
}

export const errorText = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

/** A photo stored on the Website page (served to signed-in office users only). */
export function PhotoThumb({ id, alt, className = 'h-16 w-16' }: { id: string; alt: string; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- private, session-protected image; next/image would cache it publicly
  return <img src={`/api/website/photos/${encodeURIComponent(id)}?size=small`} alt={alt} className={`${className} rounded-xl bg-slate-100 object-cover`} loading="lazy" />;
}

export type Tone = 'green' | 'amber' | 'slate' | 'red' | 'blue';
const TONES: Record<Tone, string> = {
  green: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-900 ring-amber-200',
  slate: 'bg-slate-100 text-ink ring-slate-200',
  red: 'bg-rose-50 text-rose-800 ring-rose-200',
  blue: 'bg-sky-50 text-sky-900 ring-sky-200',
};

export function Pill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ring-1 ${TONES[tone]}`}>{children}</span>;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-base font-medium text-ink">{label}</span>
      {children}
      {hint && <span className="block text-sm text-ink-muted">{hint}</span>}
    </label>
  );
}

/** A plain checkbox with a large tap area. */
export function Check({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl px-1 py-2 text-base text-ink">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-emerald-600" />
      <span>{children}</span>
    </label>
  );
}

export const inputClass = 'h-12 w-full rounded-xl border-2 border-slate-200 bg-white px-3 text-base text-ink focus:border-emerald-600 focus:outline-none';
export const areaClass = 'min-h-28 w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-base text-ink focus:border-emerald-600 focus:outline-none';

interface FormDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  saving: boolean;
  error: string;
  saveLabel: string;
  cancelLabel: string;
  onSave: () => void;
  children: React.ReactNode;
}

/** A dialog with a form, an error line and Cancel / Save at the bottom. */
export function FormDialog({ open, onClose, title, description, saving, error, saveLabel, cancelLabel, onSave, children }: FormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={o => { if (!o && !saving) onClose(); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-ink">{title}</DialogTitle>
          {description && <DialogDescription className="text-base text-ink-muted">{description}</DialogDescription>}
        </DialogHeader>
        <form className="space-y-4" onSubmit={e => { e.preventDefault(); onSave(); }}>
          {children}
          {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-base text-rose-800">{error}</p>}
          <DialogFooter className="gap-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>{cancelLabel}</Button>
            <Button type="submit" disabled={saving}>{saveLabel}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
