import type { Dict } from '@/lib/i18n';

const STEP_ICONS = [
  'M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z M7 7h.01',
  'M3 11h18a9 9 0 0 1-18 0z M8 7c0-2 1-3 2-3s2 1 2 3 M14 7c0-2 1-3 2-3',
  'M12 3v18 M5 8h14 M5 8l-3 7a3 3 0 0 0 6 0L5 8z M19 8l-3 7a3 3 0 0 0 6 0l-3-7z',
  'M22 11.1V12a10 10 0 1 1-5.9-9.1 M22 4 12 14l-3-3',
];

/**
 * "How it works": the four recorded steps of an animal on a member farm. For farmers shows them in a row; Home
 * stacks them (`vertical`) beside a farm photo. Phones always stack them.
 */
export function HowTimeline({ t, lang, vertical = false }: { t: Pick<Dict, 'home'>; lang: 'km' | 'en'; vertical?: boolean }) {
  const km = lang === 'km';
  return (
    <ol className={`timeline${vertical ? ' timeline-v' : ''}`}>
      {t.home.steps.map((step, i) => (
        <li key={step.title} className="t-step">
          <span className="t-badge" aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={STEP_ICONS[i]} /></svg>
          </span>
          <div className="t-card">
            <span className="step-no">{km ? `ជំហាន ${'០១២៣៤'[i + 1]}` : `STEP ${i + 1}`}</span>
            <h3>{step.title}</h3>
            <p>{step.body}</p>
            <span className="t-record"><b>{t.home.recorded}:</b> {step.record}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}
