'use client';

import React, { useMemo, useState } from 'react';
import { Camera } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { MasterSetup, StockItem, UserRoleItem } from '@/lib/types';
import { Choice, FlowDone, FlowFooter, FlowShell, NUM, Question, money as fmtMoney, today } from '../flow/FlowShell';

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

type Step = 'origin' | 'tag' | 'kind' | 'where' | 'price' | 'review' | 'done';

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
  const breeds = common.breeds ?? [];
  const payments = (common.paymentMethods ?? []).filter(p => p !== 'N/A');
  const healthStatuses = common.healthStatuses?.length ? common.healthStatuses : ['Good', 'Fair', 'Poor'];
  const perKgType = common.buyTypes?.find(b => b === 'Weight') ?? 'Weight';
  const wholeType = common.buyTypes?.find(b => b !== 'Weight' && !ORIGIN_TEXT[b]) ?? 'Lumsum';

  const [step, setStep] = useState<Step>('origin');
  const [origin, setOrigin] = useState('');
  const [tag, setTag] = useState('CC-');
  const [weight, setWeight] = useState('');
  // Sex, breed and payment start empty on purpose: a default could be saved unnoticed.
  const [sex, setSex] = useState('');
  const [breed, setBreed] = useState('');
  const [age, setAge] = useState('');
  const [date, setDate] = useState(today());
  const [farm, setFarm] = useState(lockedFarm ?? (farmNames.length === 1 ? farmNames[0] : ''));
  const [buyType, setBuyType] = useState(wholeType);
  const [price, setPrice] = useState('');
  const [payment, setPayment] = useState('');
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
  const steps: Step[] = paid ? ['origin', 'tag', 'kind', 'where', 'price', 'review'] : ['origin', 'tag', 'kind', 'where', 'review'];
  const stepIndex = steps.indexOf(step);
  const kg = Number(weight);
  const unit = Number(price) || 0;
  const total = paid ? (buyType === perKgType ? kg * unit : unit) : 0;
  const money = fmtMoney;

  const fail = (msg: string) => { setError(msg); return false; };

  const valid: Record<string, () => boolean> = {
    tag: () => {
      const id = tag.trim();
      if (id.length <= 3) return fail('Type the tag number after CC-, for example CC-204.');
      if (existingCattle.some(c => c.id.toLowerCase() === id.toLowerCase())) return fail(`${id} is already on the farm. Check the tag number.`);
      if (!(kg > 0)) return fail('Type the weight in kg.');
      return true;
    },
    kind: () => {
      if (!sex) return fail('Choose male or female.');
      if (breeds.length > 0 && !breed) return fail('Choose the breed.');
      return true;
    },
    where: () => {
      if (!farm) return fail('Choose which farm the animal is on.');
      if (!date) return fail('Choose the date it arrived.');
      return true;
    },
    price: () => {
      if (!(unit > 0)) return fail(buyType === perKgType ? 'Type the price for each kg.' : 'Type the price paid.');
      if (origin === 'Purchase' && payments.length > 0 && !payment) return fail('Choose how it was paid.');
      return true;
    },
  };

  const go = (to: Step) => { setError(''); setStep(to); };
  const next = () => {
    if (valid[step] && !valid[step]()) return;
    go(steps[stepIndex + 1]);
  };
  const back = () => go(steps[stepIndex - 1]);

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
    try {
      await onSave({
        id: tag.trim(),
        breed,
        sex,
        age: age.trim() || 'N/A',
        weight: kg,
        ownerName: origin === 'Born in Farm' ? 'SNR Farm' : seller.trim(),
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

  // Keeps origin, farm, date and price type so a group arriving together is quick to enter.
  const addAnother = () => {
    setTag('CC-');
    setWeight('');
    setSex('');
    setBreed('');
    setAge('');
    setNote('');
    setPhoto(null);
    setHealth(healthStatuses[0]);
    go('tag');
  };

  const heading: Record<Step, { title: string; sub: string }> = {
    origin: { title: 'Where did it come from?', sub: 'Choose one.' },
    tag: { title: 'Tag and weight', sub: 'Read the ear tag and the scale.' },
    kind: { title: 'What kind of animal?', sub: 'Tap one answer in each row.' },
    where: { title: 'Where is it?', sub: 'Which farm, and when it arrived.' },
    price: { title: 'What was paid?', sub: 'The price from the seller.' },
    review: { title: 'Check and save', sub: 'Look it over, then save.' },
    done: { title: 'Cattle added', sub: 'It is now in the cattle list.' },
  };

  // What has been entered so far, so the person always sees what they are adding.
  const summary = [tag.trim().length > 3 ? tag.trim() : '', kg > 0 ? `${kg} kg` : '', sex, step === 'review' || step === 'where' || step === 'price' ? breed : '']
    .filter(Boolean).join(' · ');

  return (
    <FlowShell
      steps={steps}
      step={step}
      title={heading[step].title}
      subtitle={heading[step].sub}
      summary={step !== 'done' && step !== 'review' ? summary : ''}
      error={error}
      onSubmit={step === 'origin' || step === 'done' ? undefined : () => (step === 'review' ? register() : next())}
      footer={step === 'origin' || step === 'done' ? null : (
        <FlowFooter onBack={back} label={step === 'review' ? (saving ? 'Saving…' : 'Save cattle') : 'Next'} busy={saving} />
      )}
    >
          {step === 'origin' && (
            <ul className="space-y-3">
              {origins.map(o => (
                <li key={o}>
                  <button
                    type="button"
                    onClick={() => { setOrigin(o); go('tag'); }}
                    className="flex min-h-20 w-full flex-col items-start justify-center rounded-xl border-2 border-slate-200 px-5 py-3 text-left hover:border-emerald-600"
                  >
                    <span className="text-xl font-semibold text-ink">{ORIGIN_TEXT[o]?.title ?? o}</span>
                    {ORIGIN_TEXT[o] && <span className="text-base text-ink-muted">{ORIGIN_TEXT[o].hint}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {step === 'tag' && (
            <>
              <Question label="Tag number" hint="The number on the ear tag, for example CC-204.">
                <Input aria-label="Tag number" value={tag} onChange={e => { setTag(e.target.value); setError(''); }} autoFocus className="h-16 text-2xl font-semibold" />
              </Question>
              <Question label="Weight (kg)">
                <Input aria-label="Weight in kg" type="number" inputMode="decimal" value={weight} onChange={e => { setWeight(e.target.value); setError(''); }} className={`h-16 text-2xl font-semibold ${NUM}`} />
              </Question>
            </>
          )}

          {step === 'kind' && (
            <>
              <Question label="Sex">
                <div className="flex flex-wrap gap-3">{sexes.map(s => <Choice key={s} selected={sex === s} onClick={() => { setSex(s); setError(''); }}>{s}</Choice>)}</div>
              </Question>
              {breeds.length > 0 && (
                <Question label="Breed">
                  <div className="flex flex-wrap gap-3">{breeds.map(b => <Choice key={b} selected={breed === b} onClick={() => { setBreed(b); setError(''); }}>{b}</Choice>)}</div>
                </Question>
              )}
              <Question label="Age (if you know it)">
                <Input aria-label="Age" value={age} onChange={e => setAge(e.target.value)} placeholder="for example 18 months" />
              </Question>
            </>
          )}

          {step === 'where' && (
            <>
              {lockedFarm ? (
                <Question label="Farm"><p className="rounded-xl bg-slate-50 px-4 py-3 text-lg font-medium text-ink">{lockedFarm}</p></Question>
              ) : (
                <Question label="Which farm?">
                  <div className="flex flex-wrap gap-3">{farmNames.map(f => <Choice key={f} selected={farm === f} onClick={() => { setFarm(f); setError(''); }}>{f}</Choice>)}</div>
                </Question>
              )}
              <Question label="Date it arrived">
                <Input aria-label="Date it arrived" type="date" value={date} max={today()} onChange={e => setDate(e.target.value)} className="h-14 text-lg" />
              </Question>
            </>
          )}

          {step === 'price' && (
            <>
              <Question label="How was the price set?">
                <div className="flex flex-wrap gap-3">
                  <Choice selected={buyType === wholeType} onClick={() => setBuyType(wholeType)}>One price for the animal</Choice>
                  <Choice selected={buyType === perKgType} onClick={() => setBuyType(perKgType)}>Price per kg</Choice>
                </div>
              </Question>
              <Question label={buyType === perKgType ? 'Price for each kg (៛)' : 'Price paid (៛)'}>
                <Input aria-label="Price" type="number" inputMode="numeric" autoFocus value={price} onChange={e => { setPrice(e.target.value); setError(''); }} className={`h-16 text-2xl font-semibold ${NUM}`} />
                <p className="mt-3 rounded-xl bg-slate-50 p-3 text-lg text-ink">
                  Total: <span className="font-semibold">{money(total)}</span>
                  {buyType === perKgType && kg > 0 && <span className="text-ink-muted"> ({kg} kg × {money(unit)})</span>}
                </p>
              </Question>
              {origin === 'Purchase' && payments.length > 0 && (
                <Question label="How was it paid?">
                  <div className="flex flex-wrap gap-3">{payments.map(p => <Choice key={p} selected={payment === p} onClick={() => { setPayment(p); setError(''); }}>{p}</Choice>)}</div>
                </Question>
              )}
              <Question label="Seller name (optional)"><Input aria-label="Seller name" value={seller} onChange={e => setSeller(e.target.value)} /></Question>
              <Question label="Seller phone (optional)"><Input aria-label="Seller phone" type="tel" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} /></Question>
            </>
          )}

          {step === 'review' && (
            <>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-4 rounded-xl bg-slate-50 p-4">
                {[
                  ['Tag', tag.trim()],
                  ['Weight', `${kg} kg`],
                  ['Sex', sex],
                  ['Breed', breed || '—'],
                  ['Farm', farm],
                  ['Came from', ORIGIN_TEXT[origin]?.title ?? origin],
                  ['Cost', paid ? money(total) : 'None'],
                  ['Arrived', date],
                ].map(([k, v]) => (
                  <div key={k}><dt className="text-sm text-ink-muted">{k}</dt><dd className="text-lg font-semibold text-ink">{v}</dd></div>
                ))}
              </dl>
              <Question label="How does it look?">
                <div className="flex flex-wrap gap-3">{healthStatuses.map(h => <Choice key={h} selected={health === h} onClick={() => setHealth(h)}>{h}</Choice>)}</div>
              </Question>
              <Question label="Note (optional)"><Input aria-label="Note" value={note} onChange={e => setNote(e.target.value)} /></Question>
              <div>
                <input id="add-photo" type="file" accept="image/*" capture="environment" className="sr-only" onChange={onPhoto} />
                {photo ? (
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo} alt="Cattle" className="h-16 w-16 rounded-xl object-cover" />
                    <Button type="button" variant="secondary" size="sm" onClick={() => setPhoto(null)}>Remove photo</Button>
                  </div>
                ) : (
                  <label htmlFor="add-photo" className="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 text-lg font-medium text-ink hover:border-emerald-600">
                    <Camera className="h-5 w-5" aria-hidden /> Add a photo (optional)
                  </label>
                )}
              </div>
            </>
          )}

          {step === 'done' && (
            <FlowDone
              message={<><span className="font-semibold">{lastTag}</span> is registered</>}
              detail={addedCount > 1 ? `${addedCount} animals added this time` : undefined}
              again="Add another animal"
              onAgain={addAnother}
              onClose={onClose}
            />
          )}
    </FlowShell>
  );
}
