import Image from 'next/image';
import { KmWords } from '@/components/shared/KmWords';
import type { Dict } from '@/lib/i18n';
import { StandHeading, StandIcon, type StandIconName } from './StandParts';
import { siteImages } from '@/lib/site-images';

const FEATURE_ICONS: StandIconName[] = ['cash', 'percent', 'calendar', 'repeat'];
/** Who does each of the seven loan steps (same order as loan.steps): the stop takes that party's colour. */
const STEP_BY = ['farmer', 'ardb', 'all', 'farmer', 'camcow', 'ardb', 'farmer'] as const;

/**
 * The farm loan (stand 3): three partners, seven steps (each coloured and tagged by who does it, with a key) and the
 * loan terms. The farmer repays the bank from the
 * cattle sales; CamCow supplies and buys back but never repays the loan.
 */
export async function LoanDetails({ t, lang }: { t: Pick<Dict, 'loan'>; lang: 'km' | 'en' }) {
  const img = await siteImages();
  const l = t.loan;
  const km = lang === 'km';
  const logos = [
    <span key="farmer" className="ln-party-icon"><StandIcon name="farmer" size={48} /></span>,
    <Image key="camcow" src="/logo-2026.png" alt="" width={96} height={96} className="ln-party-logo" />,
    <Image key="ardb" src={img['partner-ardb']} alt="" width={96} height={96} className="ln-party-logo" style={{ objectFit: 'contain' }} />,
  ];
  return (
    <div className="stack" style={{ gap: 44 }}>
      <div className="stack" style={{ gap: 22 }}>
        <StandHeading text={l.partiesTitle} />
        <ul className="ln-parties">
          {l.parties.map((p, i) => (
            <li key={p.name}>
              {logos[i]}
              <span className="ln-party-label">{p.label}</span>
              <b>{p.name}</b>
              <span>{p.body}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="ln-steps">
        <div className="st-why-head">
          <h2 className="display h3"><KmWords text={l.stepsTitle} /></h2>
          <p>{l.stepsSub}</p>
        </div>
        <ul className="ln-key" aria-label={l.stepsKey}>
          {(['farmer', 'camcow', 'ardb'] as const).map((k, i) => <li key={k}><span className={`ln-key-dot ln-by-${k}`} aria-hidden="true" />{l.parties[i].name}</li>)}
        </ul>
        <ol>
          {l.steps.map((s, i) => {
            const by = STEP_BY[i] ?? 'all';
            const who = by === 'all' ? l.stepAll : l.parties[{ farmer: 0, camcow: 1, ardb: 2 }[by]].name;
            return (
              <li key={s}>
                <span className={`ln-no ln-by-${by}`}>{km ? '១២៣៤៥៦៧'[i] : i + 1}</span>
                <span className="ln-step-text"><b>{s}</b><small className={`ln-who ln-who-${by}`}>{who}</small></span>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="stack" style={{ gap: 18 }}>
        <StandHeading text={l.featuresTitle} />
        <ul className="ln-features">
          {l.features.map((f, i) => (
            <li key={f.label}>
              <span className="st-dot st-dot-lg"><StandIcon name={FEATURE_ICONS[i % FEATURE_ICONS.length]} /></span>
              <span><small>{f.label}</small><b>{f.value}</b></span>
            </li>
          ))}
        </ul>
        <p className="small muted" style={{ margin: 0 }}>{l.termsNote}</p>
      </div>

    </div>
  );
}
