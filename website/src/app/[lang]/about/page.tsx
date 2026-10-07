import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Reveal } from '@/components/shared/Reveal';
import { ABOUT } from '@/lib/about';
import { CONTACT } from '@/lib/contact';
import { href } from '@/lib/i18n';
import { showLiveNumbers } from '@/lib/launch';
import { pageLang } from '@/lib/page';
import { getSnapshot } from '@/lib/snapshot/read';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { t } = await pageLang(params);
  // A draft can be opened by its address for review, but search engines should not list it.
  return { title: t.about.title, description: t.about.sub, ...(ABOUT.ready ? {} : { robots: { index: false, follow: false } }) };
}

/** Simple line icons (24px grid), one per "What we do" card, value and office card. */
const ICON = {
  cattle: 'M4 9c0-2 1.5-3 3-3h10c1.5 0 3 1 3 3v3a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6z M7 6 5 3 M17 6l2-3 M9 12h.01 M15 12h.01 M10 16h4',
  vet: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z M12 9v6 M9 12h6',
  record: 'M5 3h14v18H5z M9 8h6 M9 12h6 M9 16h3',
  buyer: 'M3 7h11v9H3z M14 10h4l3 3v3h-7z M7 19a2 2 0 1 0 0-.01 M17 19a2 2 0 1 0 0-.01',
  honest: 'M4 4h16v16H4z M8 12l3 3 5-6',
  fair: 'M7 11l3-3 4 4 3-3 4 4 M3 15l4-4 M14 12l-3 3a2 2 0 0 1-3-3',
  healthy: 'M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10z',
  pin: 'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  phone: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 6v6l4 2',
  building: 'M4 21V5l8-3 8 3v16 M9 21v-5h6v5 M8 8h.01 M12 8h.01 M16 8h.01 M8 12h.01 M12 12h.01 M16 12h.01',
  facebook: 'M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z',
  send: 'M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z',
};
const WHAT_ICONS = [ICON.cattle, ICON.vet, ICON.record, ICON.buyer];
const VALUE_ICONS = [ICON.honest, ICON.fair, ICON.healthy];

function Icon({ d, size = 26 }: { d: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
}

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

/**
 * About us: a plain statement of who CamCow is beside a company card
 * (office, phone, the network once there are enough farms), then what it
 * does, how it works with farms, its values, the team and the office. Kept
 * different from the home page on purpose (no photo hero, no numbers strip). Content: src/lib/about.ts
 * and the about texts; facts only from the public snapshot.
 */
export default async function AboutPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang, t } = await pageLang(params);
  const a = t.about;
  const km = lang === 'km';
  const draft = !ABOUT.ready;
  const todo = (what: string) => (draft ? <p className="todo"><b>{a.todo}:</b> {what}</p> : null);
  const s = await getSnapshot();
  // The network line on the company card, only once enough farms are published (src/lib/launch.ts).
  const network = showLiveNumbers(s.farms.length)
    ? a.cardNetworkValue.replace('{farms}', s.summary.memberFarms).replace('{provinces}', String(s.summary.provinces))
    : '';

  return (
    <>
      {draft && <div className="draft-note" role="note"><div className="wrap">{a.draft}</div></div>}

      <section className="ab-head">
        <div className="wrap ab-head-in">
          <div className="ab-statement">
            <span className="ab-eyebrow rise">{a.title}</span>
            <h1 className="display rise d1">{a.statement}</h1>
            <p className="lead rise d2">{a.sub}</p>
            {ABOUT.foundedYear ? <span className="ab-founded rise d3">{a.founded.replace('{year}', ABOUT.foundedYear)}</span> : todo(a.todoFounded)}
          </div>
          <aside className="ab-idcard rise d2" aria-label={a.company}>
            <div className="ab-idcard-top">
              <Image src="/logo.png" alt="" width={64} height={64} />
              <div>
                <b lang="km">ខេម ខោវ</b>
                <span>CAM COW CO., LTD</span>
              </div>
            </div>
            <dl>
              <div><dt><Icon d={ICON.pin} size={18} />{a.cardOffice}</dt><dd>{ABOUT.address || t.contact.officeText}</dd></div>
              <div><dt><Icon d={ICON.phone} size={18} />{a.cardPhone}</dt><dd><a href={`tel:${CONTACT.phoneTel}`}>{CONTACT.phone}</a></dd></div>
              {network && <div><dt><Icon d={ICON.fair} size={18} />{a.cardNetwork}</dt><dd>{network}</dd></div>}
              {ABOUT.hours && <div><dt><Icon d={ICON.clock} size={18} />{a.hours}</dt><dd>{ABOUT.hours}</dd></div>}
            </dl>
            <Link className="btn btn-red" href={href(lang, '/join')}>{a.ctaJoin}</Link>
          </aside>
        </div>
      </section>

      <section className="section">
        <div className="wrap ab-story">
          <div className="stack" style={{ gap: 16, minWidth: 0 }}>
            <h2 className="display h2">{a.storyTitle}</h2>
            {a.story.map(p => <p key={p.slice(0, 24)} className="lead" style={{ maxWidth: '62ch' }}>{p}</p>)}
          </div>
          <blockquote className="ab-promise">
            <span>{a.missionLabel}</span>
            <p>{t.home.title1}<br />{t.home.title2}</p>
            <Image src="/logo.png" alt="" width={56} height={56} />
          </blockquote>
        </div>
      </section>

      <section className="section section-mint">
        <div className="wrap stack" style={{ gap: 28 }}>
          <h2 className="display h2">{a.whatTitle}</h2>
          <Reveal className="grid">
            {a.what.map((w, i) => (
              <div key={w.title} className="card lift stack" style={{ gap: 10 }}>
                <span className="ab-icon"><Icon d={WHAT_ICONS[i % WHAT_ICONS.length]} /></span>
                <h3 style={{ fontSize: 19 }}>{w.title}</h3>
                <p style={{ color: 'var(--ink-2)' }}>{w.body}</p>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      <section className="section">
        <div className="wrap stack" style={{ gap: 28 }}>
          <h2 className="display h2">{a.stepsTitle}</h2>
          <ol className="ab-steps">
            {t.home.steps.map((st, i) => (
              <li key={st.title}>
                <span className="ab-step-no">{km ? '១២៣៤'[i] : i + 1}</span>
                <b>{st.title}</b>
                <span>{st.body}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section section-white" style={{ borderTop: '1px solid var(--line)' }}>
        <div className="wrap stack" style={{ gap: 28 }}>
          <h2 className="display h2">{a.valuesTitle}</h2>
          <div className="grid">
            {a.values.map((v, i) => (
              <div key={v.title} className="ab-value">
                <span className="ab-icon ab-icon-red"><Icon d={VALUE_ICONS[i % VALUE_ICONS.length]} /></span>
                <h3 style={{ fontSize: 20 }}>{v.title}</h3>
                <p style={{ color: 'var(--ink-2)' }}>{v.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {(ABOUT.team.length > 0 || draft) && (
        <section className="section section-white" style={{ borderTop: '1px solid var(--line)' }}>
          <div className="wrap stack" style={{ gap: 28 }}>
            <h2 className="display h2">{a.teamTitle}</h2>
            {ABOUT.team.length === 0 ? todo(a.todoTeam) : (
              <ul className="grid" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {ABOUT.team.map(m => (
                  <li key={m.name} className="card stack" style={{ gap: 10, alignItems: 'center', textAlign: 'center' }}>
                    {m.photo
                      ? <Image src={`/team/${m.photo}`} alt={m.name} width={140} height={140} style={{ borderRadius: '50%', objectFit: 'cover' }} />
                      : <span className="team-initials" aria-hidden="true">{initials(m.name)}</span>}
                    <b style={{ fontSize: 18 }}>{m.name}</b>
                    <span className="muted">{m.role}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      <section className="section section-white ab-visit-section">
        <div className="wrap stack" style={{ gap: 28 }}>
          <div className="stack" style={{ gap: 6 }}>
            <h2 className="display h2">{a.officeTitle}</h2>
            <p className="lead" style={{ margin: 0 }}>{a.officeSub}</p>
          </div>
          <div className="ab-visit">
            <div className="ab-visit-office">
              <span className="ab-icon ab-icon-red"><Icon d={ICON.pin} /></span>
              <h3>{a.cardOffice}</h3>
              <p>{ABOUT.address || t.contact.officeText}</p>
              {!ABOUT.address && todo(a.todoAddress)}
              {ABOUT.hours ? <p className="ab-visit-hours"><Icon d={ICON.clock} size={18} />{ABOUT.hours}</p> : todo(a.todoHours)}
              <div className="row" style={{ gap: 10, marginTop: 'auto', paddingTop: 8 }}>
                {ABOUT.mapLink ? <a className="btn btn-line" href={ABOUT.mapLink} target="_blank" rel="noopener noreferrer">{t.contact.directions}</a> : todo(a.todoMap)}
                <a className="btn btn-red" href={`tel:${CONTACT.phoneTel}`}><Icon d={ICON.phone} size={18} />{t.common.callUs}</a>
              </div>
            </div>
            <div className="ab-reach">
              <h3>{a.reachTitle}</h3>
              <a className="ab-reach-row" href={`tel:${CONTACT.phoneTel}`}>
                <span className="ab-icon"><Icon d={ICON.phone} size={20} /></span>
                <span><small>{a.cardPhone}</small><b>{CONTACT.phone}</b></span>
              </a>
              {CONTACT.telegram && (
                <a className="ab-reach-row" href={CONTACT.telegram} target="_blank" rel="noopener noreferrer">
                  <span className="ab-icon"><Icon d={ICON.send} size={20} /></span>
                  <span><small>Telegram</small><b>{CONTACT.telegram.replace(/^https?:\/\//, '')}</b></span>
                </a>
              )}
              <a className="ab-reach-row" href={CONTACT.facebook} target="_blank" rel="noopener noreferrer">
                <span className="ab-icon"><Icon d={ICON.facebook} size={20} /></span>
                <span><small>{t.common.facebook}</small><b><span lang="km">ខេម ខោវ</span> Cam Cow</b></span>
              </a>
              <div className="ab-reach-row ab-reach-static">
                <span className="ab-icon"><Icon d={ICON.building} size={20} /></span>
                <span><small>{a.company}</small><b>CAM COW CO., LTD</b></span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
