'use client';

import React, { useMemo, useState } from 'react';
import { ArrowLeft, Camera, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { MasterSetup, StockItem, UserRoleItem } from '@/lib/types';

export type NewCattle = Omit<StockItem, 'no' | 'status'> & { imageUrl?: string };

interface AddCattleFlowProps {
  isOpen: boolean;
  onClose: () => void;
  common: MasterSetup;
  /** Cattle already on the farm, used to catch a repeated tag number. */
  existingCattle: Pick<StockItem, 'id'>[];
  currentUser?: UserRoleItem;
  onSave: (cow: NewCattle) => Promise<void>;
}

type Step = 'origin' | 'details' | 'price' | 'review' | 'done';

const today = () => new Date().toISOString().split('T')[0];
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

// Plain wording for the stored purchase types; unknown ones show as typed.
const ORIGIN_TEXT: Record<string, { title: string; hint: string }> = {
  Purchase: { title: 'Bought', hint: 'Bought from a seller' },
  'Born in Farm': { title: 'Born on the farm', hint: 'A calf from our own cows' },
  Transfer: { title: 'Moved from another farm', hint: 'No payment' },
  Partnership: { title: 'Partner animal', hint: 'Shared with a partner' },
};

const PAID_ORIGINS = ['Purchase', 'Partnership'];

export default function AddCattleFlow(props: AddCattleFlowProps) {
  // Remount on every open so each registration starts from a clean form.
  return (
    <Dialog open={props.isOpen} onOpenChange={open => { if (!open) props.onClose(); }}>
      {props.isOpen && <AddCattleBody {...props} />}
    </Dialog>
  );
}

function Choice({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`min-h-12 rounded-xl border-2 px-4 text-base font-medium ${selected ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 bg-white text-ink'}`}
    >
      {children}
    </button>
  );
}

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-base font-medium text-ink">{label}</label>
      {children}
      {hint && <p className="mt-1 text-sm text-ink-muted">{hint}</p>}
    </div>
  );
}

function AddCattleBody({ onClose, common, existingCattle, currentUser, onSave }: AddCattleFlowProps) {
  const lockedFarm = currentUser?.farmLocation && !['Super Admin', 'Admin', 'Company'].includes(currentUser.role)
    ? currentUser.farmLocation
    : null;
  const farmNames = useMemo(
    () => (common.farms && common.farms.length > 0 ? common.farms.map(f => f.name) : common.locations || []),
    [common.farms, common.locations]
  );
  const origins = common.purchaseTypes?.length ? common.purchaseTypes : Object.keys(ORIGIN_TEXT);
  const sexes = common.sexes?.length ? common.sexes : ['Male', 'Female'];
  const healthStatuses = common.healthStatuses?.length ? common.healthStatuses : ['Good', 'Fair', 'Poor'];
  const perKgType = common.buyTypes?.find(b => b === 'Weight') ?? 'Weight';
  const wholeType = common.buyTypes?.find(b => b !== 'Weight' && !ORIGIN_TEXT[b]) ?? 'Lumsum';

  const [step, setStep] = useState<Step>('origin');
  const [origin, setOrigin] = useState('');
  const [tag, setTag] = useState('CC-');
  const [sex, setSex] = useState(sexes[0]);
  const [breed, setBreed] = useState(common.breeds?.[0] ?? '');
  const [weight, setWeight] = useState('');
  const [age, setAge] = useState('');
  const [date, setDate] = useState(today());
  const [farm, setFarm] = useState(lockedFarm ?? (farmNames.length === 1 ? farmNames[0] : ''));
  const [buyType, setBuyType] = useState(wholeType);
  const [price, setPrice] = useState('');
  const [payment, setPayment] = useState(common.paymentMethods?.[0] ?? '');
  const [seller, setSeller] = useState('');
  const [phone, setPhone] = useState('');
  const [health, setHealth] = useState(healthStatuses[0]);
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [addedCount, setAddedCount] = useState(0);
  const [lastTag, setLastTag] = useState('');

  const paid = PAID_ORIGINS.includes(origin);
  const kg = Number(weight);
  const unit = Number(price) || 0;
  const total = paid ? (buyType === perKgType ? kg * unit : unit) : 0;
  const money = (n: number) => `៛ ${Math.round(n).toLocaleString()}`;

  const fail = (msg: string) => { setError(msg); return false; };

  const checkDetails = () => {
    const id = tag.trim();
    if (id.length <= 3) return fail('Type the tag number after CC-, for example CC-204.');
    if (existingCattle.some(c => c.id.toLowerCase() === id.toLowerCase())) return fail(`${id} is already on the farm. Check the tag number.`);
    if (!(kg > 0)) return fail('Type the weight in kg.');
    if (!farm) return fail('Choose which farm the animal is on.');
    if (!date) return fail('Choose the date it arrived.');
    return true;
  };

  const checkPrice = () => {
    if (paid && !(unit > 0)) return fail(buyType === perKgType ? 'Type the price for each kg.' : 'Type the price paid.');
    return true;
  };

  const next = () => {
    setError('');
    if (step === 'origin') { if (!origin) return fail('Choose where the animal came from.'); setStep('details'); }
    else if (step === 'details') { if (checkDetails()) setStep(paid ? 'price' : 'review'); }
    else if (step === 'price') { if (checkPrice()) setStep('review'); }
  };

  const back = () => {
    setError('');
    if (step === 'details') setStep('origin');
    else if (step === 'price') setStep('details');
    else if (step === 'review') setStep(paid ? 'price' : 'details');
  };

  const onPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_PHOTO_BYTES) { setError('That photo is too big (over 5 MB). Choose a smaller one.'); return; }
    const reader = new FileReader();
    reader.onload = () => setPhoto(reader.result as string);
    reader.readAsDataURL(file);
  };

  const register = async () => {
    setSaving(true);
    setError('');
    const born = origin === 'Born in Farm';
    try {
      await onSave({
        id: tag.trim(),
        breed,
        sex,
        age: age.trim() || 'N/A',
        weight: kg,
        ownerName: born ? 'SNR Farm' : seller.trim(),
        location: farm,
        phone: paid && phone.trim() ? phone.trim() : 'N/A',
        buyType: paid ? buyType : wholeType,
        unitPrice: paid ? unit : 0,
        totalPrice: total,
        healthStatus: health,
        purchaseDate: date,
        remark: note.trim(),
        purchaseType: origin,
        paymentMethod: origin === 'Purchase' ? payment : 'N/A',
        imageUrl: photo || undefined,
      });
      setLastTag(tag.trim());
      setAddedCount(n => n + 1);
      setStep('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Keeps the origin, farm and date so a group arriving together is quick to enter.
  const addAnother = () => {
    setTag('CC-');
    setWeight('');
    setAge('');
    setPrice(paid && buyType === wholeType ? price : '');
    setNote('');
    setPhoto(null);
    setHealth(healthStatuses[0]);
    setError('');
    setStep('details');
  };

  const stepNo = { origin: 1, details: 2, price: 3, review: paid ? 4 : 3, done: 0 }[step];
  const stepTotal = paid ? 4 : 3;
  const title = {
    origin: 'Where did it come from?',
    details: 'About the animal',
    price: 'What was paid?',
    review: 'Check and save',
    done: 'Cattle added',
  }[step];

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle className="text-2xl font-semibold text-ink">{title}</DialogTitle>
        <DialogDescription className="text-base text-ink-muted">
          {step === 'done' ? 'It is now in the cattle list.' : `Step ${stepNo} of ${stepTotal}`}
        </DialogDescription>
      </DialogHeader>

      {step === 'origin' && (
        <ul className="space-y-2">
          {origins.map(o => (
            <li key={o}>
              <button
                type="button"
                onClick={() => { setOrigin(o); setError(''); setStep('details'); }}
                className={`flex min-h-14 w-full flex-col items-start justify-center rounded-xl border-2 px-4 py-2 text-left hover:border-emerald-600 ${origin === o ? 'border-emerald-600' : 'border-slate-200'}`}
              >
                <span className="text-lg font-semibold text-ink">{ORIGIN_TEXT[o]?.title ?? o}</span>
                {ORIGIN_TEXT[o] && <span className="text-sm text-ink-muted">{ORIGIN_TEXT[o].hint}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}

      {step === 'details' && (
        <div className="space-y-4">
          <Field label="Tag number" htmlFor="add-tag" hint="The number on the ear tag, for example CC-204.">
            <Input id="add-tag" value={tag} onChange={e => { setTag(e.target.value); setError(''); }} autoFocus className="h-14 text-xl font-semibold" />
          </Field>
          <Field label="Weight (kg)" htmlFor="add-weight">
            <Input id="add-weight" type="number" inputMode="decimal" value={weight} onChange={e => { setWeight(e.target.value); setError(''); }} className="h-14 text-xl font-semibold" />
          </Field>
          <div>
            <p className="mb-1 text-base font-medium text-ink">Sex</p>
            <div className="flex flex-wrap gap-2">{sexes.map(s => <Choice key={s} selected={sex === s} onClick={() => setSex(s)}>{s}</Choice>)}</div>
          </div>
          {common.breeds?.length > 0 && (
            <div>
              <p className="mb-1 text-base font-medium text-ink">Breed</p>
              <div className="flex flex-wrap gap-2">{common.breeds.map(b => <Choice key={b} selected={breed === b} onClick={() => setBreed(b)}>{b}</Choice>)}</div>
            </div>
          )}
          {lockedFarm ? (
            <p className="text-base text-ink-muted">Farm: <span className="font-medium text-ink">{lockedFarm}</span></p>
          ) : (
            <div>
              <p className="mb-1 text-base font-medium text-ink">Farm</p>
              <div className="flex flex-wrap gap-2">{farmNames.map(f => <Choice key={f} selected={farm === f} onClick={() => setFarm(f)}>{f}</Choice>)}</div>
            </div>
          )}
          <Field label="Age (if you know it)" htmlFor="add-age">
            <Input id="add-age" value={age} onChange={e => setAge(e.target.value)} placeholder="for example 18 months" />
          </Field>
          <Field label="Date it arrived" htmlFor="add-date">
            <Input id="add-date" type="date" value={date} max={today()} onChange={e => setDate(e.target.value)} />
          </Field>
        </div>
      )}

      {step === 'price' && (
        <div className="space-y-4">
          <div>
            <p className="mb-1 text-base font-medium text-ink">How was the price set?</p>
            <div className="flex flex-wrap gap-2">
              <Choice selected={buyType === wholeType} onClick={() => setBuyType(wholeType)}>One price for the animal</Choice>
              <Choice selected={buyType === perKgType} onClick={() => setBuyType(perKgType)}>Price per kg</Choice>
            </div>
          </div>
          <Field label={buyType === perKgType ? 'Price for each kg (៛)' : 'Price paid (៛)'} htmlFor="add-price">
            <Input id="add-price" type="number" inputMode="numeric" value={price} onChange={e => { setPrice(e.target.value); setError(''); }} autoFocus className="h-14 text-xl font-semibold" />
          </Field>
          <p className="rounded-xl bg-slate-50 p-3 text-base text-ink">
            Total: <span className="font-semibold">{money(total)}</span>
            {buyType === perKgType && kg > 0 && <span className="text-ink-muted"> ({kg} kg × {money(unit)})</span>}
          </p>
          {origin === 'Purchase' && common.paymentMethods?.length > 0 && (
            <div>
              <p className="mb-1 text-base font-medium text-ink">How was it paid?</p>
              <div className="flex flex-wrap gap-2">{common.paymentMethods.filter(p => p !== 'N/A').map(p => <Choice key={p} selected={payment === p} onClick={() => setPayment(p)}>{p}</Choice>)}</div>
            </div>
          )}
          <Field label="Seller name (optional)" htmlFor="add-seller">
            <Input id="add-seller" value={seller} onChange={e => setSeller(e.target.value)} />
          </Field>
          <Field label="Seller phone (optional)" htmlFor="add-phone">
            <Input id="add-phone" type="tel" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} />
          </Field>
        </div>
      )}

      {step === 'review' && (
        <div className="space-y-4">
          <dl className="grid grid-cols-2 gap-x-3 gap-y-3 rounded-xl bg-slate-50 p-4 text-base">
            <div><dt className="text-sm text-ink-muted">Tag</dt><dd className="font-semibold text-ink">{tag.trim()}</dd></div>
            <div><dt className="text-sm text-ink-muted">Weight</dt><dd className="font-semibold text-ink">{kg} kg</dd></div>
            <div><dt className="text-sm text-ink-muted">Sex · Breed</dt><dd className="font-semibold text-ink">{sex} · {breed || '—'}</dd></div>
            <div><dt className="text-sm text-ink-muted">Farm</dt><dd className="font-semibold text-ink">{farm}</dd></div>
            <div><dt className="text-sm text-ink-muted">Came from</dt><dd className="font-semibold text-ink">{ORIGIN_TEXT[origin]?.title ?? origin}</dd></div>
            <div><dt className="text-sm text-ink-muted">Cost</dt><dd className="font-semibold text-ink">{paid ? money(total) : 'None'}</dd></div>
          </dl>

          <div>
            <p className="mb-1 text-base font-medium text-ink">How does it look?</p>
            <div className="flex flex-wrap gap-2">{healthStatuses.map(h => <Choice key={h} selected={health === h} onClick={() => setHealth(h)}>{h}</Choice>)}</div>
          </div>

          <Field label="Note (optional)" htmlFor="add-note">
            <Input id="add-note" value={note} onChange={e => setNote(e.target.value)} />
          </Field>

          <div>
            <input id="add-photo" type="file" accept="image/*" capture="environment" className="sr-only" onChange={onPhoto} />
            {photo ? (
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo} alt="Cattle" className="h-16 w-16 rounded-xl object-cover" />
                <Button type="button" variant="secondary" size="sm" onClick={() => setPhoto(null)}>Remove photo</Button>
              </div>
            ) : (
              <label htmlFor="add-photo" className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 text-base font-medium text-ink hover:border-emerald-600">
                <Camera className="h-5 w-5" aria-hidden /> Add a photo (optional)
              </label>
            )}
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="space-y-5 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <Check className="h-9 w-9" aria-hidden />
          </div>
          <p className="text-xl text-ink"><span className="font-semibold">{lastTag}</span> is registered</p>
          {addedCount > 1 && <p className="text-base text-ink-muted">{addedCount} animals added this time</p>}
          <div className="flex flex-col gap-3">
            <Button type="button" size="lg" onClick={addAnother}>Add another animal</Button>
            <Button type="button" size="lg" variant="secondary" onClick={onClose}>I&apos;m done</Button>
          </div>
        </div>
      )}

      {error && <p role="alert" className="text-base font-medium text-rose-700">{error}</p>}

      {(step === 'details' || step === 'price' || step === 'review') && (
        <div className="flex gap-3">
          <Button type="button" variant="secondary" size="lg" onClick={back} aria-label="Go back"><ArrowLeft /></Button>
          {step === 'review' ? (
            <Button type="button" size="lg" className="flex-1" onClick={register} disabled={saving}>{saving ? 'Saving…' : 'Save cattle'}</Button>
          ) : (
            <Button type="button" size="lg" className="flex-1" onClick={next}>Next</Button>
          )}
        </div>
      )}
    </DialogContent>
  );
}
