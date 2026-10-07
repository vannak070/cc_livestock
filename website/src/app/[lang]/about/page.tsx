import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { PageHead } from '@/components/shared/PageHead';
import { Reveal } from '@/components/shared/Reveal';
import { ABOUT } from '@/lib/about';
import { CONTACT } from '@/lib/contact';
import { href } from '@/lib/i18n';
import { pageLang } from '@/lib/page';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { t } = await pageLang(params);
  // A draft can be opened by its address for review, but search engines should not list it.
  return { title: t.about.title, description: t.about.sub, ...(ABOUT.ready ? {} : { robots: { index: false, follow: false } }) };
}

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

/** About us: who CamCow is, what it does, the team and the office. Content in src/lib/about.ts. */
export default async function AboutPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang, t } = await pageLang(params);
  const a = t.about;
  const draft = !ABOUT.ready;
  const todo = (what: string) => (draft ? <p className="todo"><b>{a.todo}:</b> {what}</p> : null);

  return (
    <>
      {draft && <div className="draft-note" role="note"><div className="wrap">{a.draft}</div></div>}
      <PageHead title={a.title} sub={a.sub}>
        {ABOUT.foundedYear ? <span className="kicker rise d2">{a.founded.replace('{year}', ABOUT.foundedYear)}</span> : todo(a.todoFounded)}
      </PageHead>

      <section className="section" style={{ paddingTop: 40 }}>
        <div className="wrap split" style={{ alignItems: 'flex-start' }}>
          <div className="main stack" style={{ gap: 16 }}>
            <h2 className="display h2">{a.storyTitle}</h2>
            {a.story.map(p => <p key={p.slice(0, 24)} className="lead" style={{ maxWidth: '62ch' }}>{p}</p>)}
          </div>
          <div className="side">
            <div className="card stack" style={{ gap: 12, alignItems: 'center', textAlign: 'center', background: 'var(--ground)' }}>
              <Image src="/logo.png" alt="" width={120} height={120} />
              <b style={{ fontSize: 22 }} lang="km">ខេម ខោវ</b>
              <span className="muted">CAM COW CO., LTD</span>
            </div>
          </div>
        </div>
      </section>

      <section className="section section-mint">
        <div className="wrap stack" style={{ gap: 28 }}>
          <h2 className="display h2">{a.whatTitle}</h2>
          <Reveal className="grid">
            {a.what.map(w => (
              <div key={w.title} className="card lift stack" style={{ gap: 8 }}>
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#0e6b34" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 12l5 5L20 6" /></svg>
                <h3 style={{ fontSize: 19 }}>{w.title}</h3>
                <p style={{ color: 'var(--ink-2)' }}>{w.body}</p>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      <section className="section">
        <div className="wrap stack" style={{ gap: 28 }}>
          <h2 className="display h2">{a.valuesTitle}</h2>
          <div className="grid">
            {a.values.map(v => (
              <div key={v.title} className="stack" style={{ gap: 6, borderLeft: '4px solid var(--green)', paddingLeft: 18 }}>
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

      <section className="section section-mint">
        <div className="wrap stack" style={{ gap: 24 }}>
          <h2 className="display h2">{a.officeTitle}</h2>
          <div className="grid">
            <div className="card stack" style={{ gap: 8 }}>
              <h3 style={{ fontSize: 18 }}>{a.address}</h3>
              {ABOUT.address ? <p style={{ color: 'var(--ink-2)' }}>{ABOUT.address}</p> : <p style={{ color: 'var(--ink-2)' }}>{t.contact.officeText}</p>}
              {!ABOUT.address && todo(a.todoAddress)}
              {ABOUT.mapLink
                ? <a className="btn btn-line" href={ABOUT.mapLink} target="_blank" rel="noopener noreferrer" style={{ alignSelf: 'flex-start' }}>{a.openMap}</a>
                : todo(a.todoMap)}
            </div>
            {(ABOUT.hours || draft) && (
              <div className="card stack" style={{ gap: 8 }}>
                <h3 style={{ fontSize: 18 }}>{a.hours}</h3>
                {ABOUT.hours ? <p style={{ color: 'var(--ink-2)' }}>{ABOUT.hours}</p> : todo(a.todoHours)}
              </div>
            )}
            <div className="card stack" style={{ gap: 8 }}>
              <h3 style={{ fontSize: 18 }}>{a.company}</h3>
              <p style={{ color: 'var(--ink-2)' }}>CAM COW CO., LTD</p>
              <a href={`tel:${CONTACT.phoneTel}`}>{CONTACT.phone}</a>
              <a href={CONTACT.facebook} target="_blank" rel="noopener noreferrer">{t.common.facebook}: ខេម ខោវ Cam Cow</a>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="banner">
            <h2 className="display h2" style={{ flex: '1 1 320px' }}>{a.ctaTitle}</h2>
            <div className="row" style={{ gap: 12 }}>
              <Link className="btn btn-red" href={href(lang, '/join')}>{a.ctaJoin}</Link>
              <Link className="btn btn-line" href={href(lang, '/contact')}>{a.ctaContact}</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
