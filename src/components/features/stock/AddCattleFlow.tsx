'use client';

import React, { useMemo, useState } from 'react';
import { Camera } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { MasterSetup, StockItem, UserRoleItem } from '@/lib/types';
import { Choice, FlowDone, FlowFooter, FlowShell, NUM, PickList, Question, money as fmtMoney, today } from '../flow/FlowShell';
import { useText, useValueText } from '@/hooks/useText';
import { shownDay } from '@/lib/khmer-date';

export type NewCattle = Omit<StockItem, 'no' | 'status'> & { imageUrl?: string };

interface AddCattleFlowProps {
  isOpen: boolean;
  onClose: () => void;
  common: MasterSetup;
  /** Cattle already on the farm, used to catch a repeated tag number. */
  existingCattle: Pick<StockItem, 'id'>[];
  currentUser?: UserRoleItem;
  /** The farm an office account is working on; used as the starting choice. */
  defaultFarm?: string;
  onSave: (cow: NewCattle) => Promise<void>;
}

type Step = 'origin' | 'tag' | 'kind' | 'where' | 'price' | 'review' | 'done';

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

// Plain wording for the stored purchase types (addCattle.o_<type>, oh_<type>); unknown ones show as typed.
const KNOWN_ORIGINS = ['Purchase', 'Born in Farm', 'Transfer', 'Partnership'];

const PAID_ORIGINS = ['Purchase', 'Partnership'];

export default function AddCattleFlow(props: AddCattleFlowProps) {
  // Remount on every open so each registration starts from a clean form.
  return (
    <Dialog open={props.isOpen} onOpenChange={open => { if (!open) props.onClose(); }}>
      {props.isOpen && <AddCattleBody {...props} />}
    </Dialog>
  );
}

function AddCattleBody({ onClose, common, existingCattle, currentUser, defaultFarm, onSave }: AddCattleFlowProps) {
  const lockedFarm = currentUser?.farmLocation && !['Super Admin', 'Admin', 'Company'].includes(currentUser.role)
    ? currentUser.farmLocation
    : null;
  const farmNames = useMemo(() => (common.farms || []).map(f => f.name), [common.farms]);
  const { tx, language } = useText('addCattle');
  const flow = useText('flow');
  const val = useValueText();
  const originTitle = (o: string) => (KNOWN_ORIGINS.includes(o) ? tx(`o_${o}`) : o);
  const origins = common.purchaseTypes?.length ? common.purchaseTypes : KNOWN_ORIGINS;
  const sexes = common.sexes?.length ? common.sexes : ['Male', 'Female'];
  const breeds = common.breeds ?? [];
  const payments = (common.paymentMethods ?? []).filter(p => p !== 'N/A');
  const healthStatuses = common.healthStatuses?.length ? common.healthStatuses : ['Good', 'Fair', 'Poor'];
  const perKgType = common.buyTypes?.find(b => b === 'Weight') ?? 'Weight';
  const wholeType = common.buyTypes?.find(b => b !== 'Weight' && !KNOWN_ORIGINS.includes(b)) ?? 'Lumsum';

  const [step, setStep] = useState<Step>('origin');
  const [origin, setOrigin] = useState('');
  const [tag, setTag] = useState('CC-');
  const [weight, setWeight] = useState('');
  // Sex, breed and payment start empty on purpose: a default could be saved unnoticed.
  const [sex, setSex] = useState('');
  const [breed, setBreed] = useState('');
  const [age, setAge] = useState('');
  const [date, setDate] = useState(today());
  const [farm, setFarm] = useState(lockedFarm ?? (defaultFarm && farmNames.includes(defaultFarm) ? defaultFarm : farmNames.length === 1 ? farmNames[0] : ''));
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
      if (id.length <= 3) return fail(tx('eTag'));
      if (existingCattle.some(c => c.id.toLowerCase() === id.toLowerCase())) return fail(tx('eTagUsed', { tag: id }));
      if (!(kg > 0)) return fail(tx('eWeight'));
      return true;
    },
    kind: () => {
      if (!sex) return fail(tx('eSex'));
      if (breeds.length > 0 && !breed) return fail(tx('eBreed'));
      return true;
    },
    where: () => {
      if (!farm) return fail(tx('eFarm'));
      if (!date) return fail(tx('eDate'));
      return true;
    },
    price: () => {
      if (!(unit > 0)) return fail(buyType === perKgType ? tx('ePriceKg') : tx('ePricePaid'));
      if (origin === 'Purchase' && payments.length > 0 && !payment) return fail(tx('ePaid'));
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
    if (file.size > MAX_PHOTO_BYTES) { setError(tx('ePhoto')); return; }
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
      setError(e instanceof Error ? e.message : tx('eSave'));
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
    origin: { title: tx('tOrigin'), sub: tx('sOrigin') },
    tag: { title: tx('tTag'), sub: tx('sTag') },
    kind: { title: tx('tKind'), sub: tx('sKind') },
    where: { title: tx('tWhere'), sub: tx('sWhere') },
    price: { title: tx('tPrice'), sub: tx('sPrice') },
    review: { title: tx('tReview'), sub: tx('sReview') },
    done: { title: tx('tDone'), sub: tx('sDone') },
  };

  // What has been entered so far, so the person always sees what they are adding.
  const summary = [tag.trim().length > 3 ? tag.trim() : '', kg > 0 ? `${kg} kg` : '', val(sex), step === 'review' || step === 'where' || step === 'price' ? breed : '']
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
        <FlowFooter onBack={back} label={step === 'review' ? (saving ? flow.tx('saving') : tx('saveCattle')) : flow.tx('next')} busy={saving} />
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
                    <span className="text-xl font-semibold text-ink">{originTitle(o)}</span>
                    {KNOWN_ORIGINS.includes(o) && <span className="text-base text-ink-muted">{tx(`oh_${o}`)}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {step === 'tag' && (
            <>
              <Question label={tx('tagNumber')} hint={tx('tagHint')}>
                <Input aria-label={tx('tagNumber')} value={tag} onChange={e => { setTag(e.target.value); setError(''); }} autoFocus className="h-16 text-2xl font-semibold" />
              </Question>
              <Question label={tx('weightKg')}>
                <Input aria-label={tx('weightAria')} type="number" step="any" inputMode="decimal" value={weight} onChange={e => { setWeight(e.target.value); setError(''); }} className={`h-16 text-2xl font-semibold ${NUM}`} />
              </Question>
            </>
          )}

          {step === 'kind' && (
            <>
              <Question label={tx('sex')}>
                <PickList options={sexes} value={sex} labelFor={val} onChange={v => { setSex(v); setError(''); }} />
              </Question>
              <Question label={tx('age')}>
                <Input aria-label={tx('ageAria')} value={age} onChange={e => setAge(e.target.value)} placeholder={tx('agePh')} />
              </Question>
              {breeds.length > 0 && (
                <Question label={tx('breed')}>
                  <PickList options={breeds} value={breed} onChange={v => { setBreed(v); setError(''); }} />
                </Question>
              )}
            </>
          )}

          {step === 'where' && (
            <>
              <Question label={tx('dateArrived')}>
                <Input aria-label={tx('dateArrived')} type="date" value={date} max={today()} onChange={e => setDate(e.target.value)} className="h-14 text-lg" />
              </Question>
              {lockedFarm ? (
                <Question label={tx('farm')}><p className="rounded-xl bg-slate-50 px-4 py-3 text-lg font-medium text-ink">{lockedFarm}</p></Question>
              ) : (
                <Question label={tx('whichFarm')}>
                  <PickList options={farmNames} value={farm} onChange={v => { setFarm(v); setError(''); }} />
                </Question>
              )}
            </>
          )}

          {step === 'price' && (
            <>
              <Question label={tx('howPrice')}>
                <div className="flex flex-wrap gap-3">
                  <Choice selected={buyType === wholeType} onClick={() => setBuyType(wholeType)}>{tx('onePrice')}</Choice>
                  <Choice selected={buyType === perKgType} onClick={() => setBuyType(perKgType)}>{tx('perKg')}</Choice>
                </div>
              </Question>
              <Question label={buyType === perKgType ? tx('priceKg') : tx('pricePaid')}>
                <Input aria-label={tx('price')} type="number" step="any" inputMode="numeric" autoFocus value={price} onChange={e => { setPrice(e.target.value); setError(''); }} className={`h-16 text-2xl font-semibold ${NUM}`} />
                <p className="mt-3 rounded-xl bg-slate-50 p-3 text-lg text-ink">
                  {tx('total')} <span className="font-semibold">{money(total)}</span>
                  {buyType === perKgType && kg > 0 && <span className="text-ink-muted"> ({kg} kg × {money(unit)})</span>}
                </p>
              </Question>
              {origin === 'Purchase' && payments.length > 0 && (
                <Question label={tx('howPaid')}>
                  <div className="flex flex-wrap gap-3">{payments.map(p => <Choice key={p} selected={payment === p} onClick={() => { setPayment(p); setError(''); }}>{p}</Choice>)}</div>
                </Question>
              )}
              <Question label={tx('sellerName')}><Input aria-label={tx('sellerNameAria')} value={seller} onChange={e => setSeller(e.target.value)} /></Question>
              <Question label={tx('sellerPhone')}><Input aria-label={tx('sellerPhoneAria')} type="tel" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} /></Question>
            </>
          )}

          {step === 'review' && (
            <>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-4 rounded-xl bg-slate-50 p-4">
                {[
                  [tx('rTag'), tag.trim()],
                  [tx('rWeight'), `${kg} kg`],
                  [tx('rSex'), val(sex)],
                  [tx('rBreed'), breed || '—'],
                  [tx('rFarm'), farm],
                  [tx('rFrom'), originTitle(origin)],
                  [tx('rCost'), paid ? money(total) : tx('none')],
                  [tx('rArrived'), shownDay(date, language)],
                ].map(([k, v]) => (
                  <div key={k}><dt className="text-sm text-ink-muted">{k}</dt><dd className="text-lg font-semibold text-ink">{v}</dd></div>
                ))}
              </dl>
              <Question label={tx('howLook')}>
                <div className="flex flex-wrap gap-3">{healthStatuses.map(h => <Choice key={h} selected={health === h} onClick={() => setHealth(h)}>{val(h)}</Choice>)}</div>
              </Question>
              <Question label={tx('note')}><Input aria-label={tx('noteAria')} value={note} onChange={e => setNote(e.target.value)} /></Question>
              <div>
                <input id="add-photo" type="file" accept="image/*" capture="environment" className="sr-only" onChange={onPhoto} />
                {photo ? (
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo} alt={tx('photoAlt')} className="h-16 w-16 rounded-xl object-cover" />
                    <Button type="button" variant="secondary" size="sm" onClick={() => setPhoto(null)}>{tx('removePhoto')}</Button>
                  </div>
                ) : (
                  <label htmlFor="add-photo" className="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 text-lg font-medium text-ink hover:border-emerald-600">
                    <Camera className="h-5 w-5" aria-hidden /> {tx('addPhoto')}
                  </label>
                )}
              </div>
            </>
          )}

          {step === 'done' && (
            <FlowDone
              message={tx('registered', { tag: lastTag })}
              detail={addedCount > 1 ? tx('addedThisTime', { n: addedCount }) : undefined}
              again={tx('again')}
              onAgain={addAnother}
              onClose={onClose}
            />
          )}
    </FlowShell>
  );
}
