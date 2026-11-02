import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { KmWords } from '@/components/shared/KmWords';
import { ABOUT } from '@/lib/about';
import { CONTACT, contactAddress, contactMapLink } from '@/lib/contact';
import { ContactCard } from '@/components/shared/ContactCard';
import { ManagementMessage } from '@/components/stand/ManagementMessage';
import { PageHead } from '@/components/shared/PageHead';
import { SectionHead } from '@/components/shared/SectionHead';
import { LoanTeaser, PartnerStrip, ValueCards, ValueChain, VisionMission, WhyPanel } from '@/components/stand/StandParts';
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

function Icon({ d, size = 26 }: { d: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
}

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

/**
 * About us: the shared page top (PageHead) with the company card beside it, a sticky row of section links, then
 * Leadership (message), Who we are, Vision & mission, Values, How we produce, Our beef and Contact. Each section opens
 * with SectionHead, like Home and For farmers. Content: src/lib/about.ts and the about/stand texts; facts only from the
 * public snapshot.
 */
export default async function AboutPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang, t } = await pageLang(params);
  const a = t.about;
  const draft = !ABOUT.ready;
  const todo = (what: string) => (draft ? <p className="todo"><b>{a.todo}:</b> {what}</p> : null);
  const s = await getSnapshot();
  // The network line on the company card, only once enough farms are published (src/lib/launch.ts).
  const network = showLiveNumbers(s.farms.length)
    ? a.cardNetworkValue.replace('{farms}', s.summary.memberFarms).replace('{provinces}', String(s.summary.provinces))
    : '';
  const sections: [string, string][] = [
    ['message', a.navMessage], ['who', a.navWho], ['vision', a.navVision], ['values', a.navValues],
    ['chain', a.navChain], ['beef', a.navBeef], ['contact', a.navContact],
  ];

  return (
    <>
      {draft && <div className="draft-note" role="note"><div className="wrap">{a.draft}</div></div>}

      <PageHead
        eyebrow={a.title}
        title={a.statement}
        sub={a.sub}
        aside={
          <div className="ab2-card" aria-label={a.company}>
            <div className="ab2-card-top">
              <Image src="/logo-2026.png" alt="" width={84} height={84} priority />
              <div>
                <b lang="km">ខេម ខោវ</b>
                <span>CAM COW CO., LTD</span>
              </div>
            </div>
            <p className="ab2-slogan"><KmWords text={t.stand.slogan} /></p>
            <dl>
              <div><dt><Icon d={ICON.pin} size={18} />{a.cardOffice}</dt><dd lang={lang}>{contactAddress(lang)}</dd></div>
              <div><dt><Icon d={ICON.phone} size={18} />{a.cardPhone}</dt><dd><a href={`tel:${CONTACT.phoneTel}`}>{CONTACT.phone}</a></dd></div>
              {network && <div><dt><Icon d={ICON.fair} size={18} />{a.cardNetwork}</dt><dd>{network}</dd></div>}
              {ABOUT.hours && <div><dt><Icon d={ICON.clock} size={18} />{a.hours}</dt><dd>{ABOUT.hours}</dd></div>}
            </dl>
          </div>
        }
      >
        <div className="row" style={{ gap: 10 }}>
          <Link className="btn btn-red" href={href(lang, '/join')}>{a.ctaJoin} <span aria-hidden="true">→</span></Link>
          <a className="btn btn-line" href="#contact">{a.navContact}</a>
        </div>
        {ABOUT.foundedYear ? <span className="ab-founded">{a.founded.replace('{year}', ABOUT.foundedYear)}</span> : todo(a.todoFounded)}
      </PageHead>

      <nav className="ab2-nav" aria-label={a.title}>
        <div className="wrap ab2-nav-in">
          {sections.map(([id, label]) => <a key={id} href={`#${id}`}>{label}</a>)}
        </div>
      </nav>

      <section className="section anchor" id="message">
        <div className="wrap">
          <ManagementMessage t={t} lang={lang} />
        </div>
      </section>

      <section className="section section-paper anchor" id="who">
        <div className="wrap ab2-who">
          <SectionHead eyebrow={a.navWho} title={a.whoTitle} />
          <div className="stack" style={{ gap: 14, minWidth: 0 }}>
            <p className="lead" style={{ margin: 0, color: 'var(--ink)' }}>{t.stand.aboutBody}</p>
            {a.story.slice(1).map(p => <p key={p.slice(0, 24)} style={{ margin: 0, color: 'var(--ink-2)' }}>{p}</p>)}
          </div>
        </div>
      </section>

      <section className="section anchor" id="vision">
        <div className="wrap stack" style={{ gap: 28 }}>
          <SectionHead eyebrow={a.navVision} title={a.visionMissionTitle} />
          <VisionMission t={t} lang={lang} />
        </div>
      </section>

      <section className="section section-paper anchor" id="values">
        <div className="wrap stack" style={{ gap: 28 }}>
          <SectionHead eyebrow={a.navValues} title={t.stand.valuesTitle} intro={a.valuesIntro} />
          <ValueCards t={t} />
        </div>
      </section>

      <section className="section anchor" id="chain">
        <div className="wrap stack" style={{ gap: 32 }}>
          <SectionHead eyebrow={a.navChain} title={t.stand.chainTitle} intro={a.chainIntro} center />
          <ValueChain t={t} />
        </div>
      </section>

      <section className="section section-paper anchor" id="beef">
        <div className="wrap stack" style={{ gap: 32 }}>
          <SectionHead eyebrow={a.navBeef} title={t.stand.supplyTitle} intro={t.stand.supplySub} />
          <WhyPanel t={t} />
          <PartnerStrip t={t} lang={lang} />
          <LoanTeaser t={t} to={href(lang, '/for-farmers#loans')} />
        </div>
      </section>

      {(ABOUT.team.length > 0 || draft) && (
        <section className="section">
          <div className="wrap stack" style={{ gap: 28 }}>
            <SectionHead eyebrow={a.navMessage} title={a.teamTitle} />
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

      <section className="section anchor" id="contact">
        <div className="wrap stack" style={{ gap: 24 }}>
          <SectionHead eyebrow={a.navContact} title={a.contactTitle} intro={a.officeSub} />
          <ContactCard lang={lang} t={t} />
          <div className="row" style={{ gap: 10 }}>
            <a className="btn btn-line" href={contactMapLink} target="_blank" rel="noopener noreferrer"><Icon d={ICON.pin} size={18} />{t.contact.directions}</a>
            <span className="small muted"><Icon d={ICON.building} size={16} /> {a.company}: CAM COW CO., LTD</span>
          </div>
        </div>
      </section>
    </>
  );
}
