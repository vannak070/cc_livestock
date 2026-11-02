import Image from 'next/image';
import { KmWords } from '@/components/shared/KmWords';
import { LEADERS } from '@/lib/about';
import type { Dict } from '@/lib/i18n';
import { siteImages } from '@/lib/site-images';

/**
 * "Message from our management": the group photo with the message as a quote and the signature. The two leaders'
 * own photos are in the Vision and Mission cards (as on stand 1). Names come from LEADERS in lib/about.ts; until
 * they are filled in the message is signed by "the management".
 */
export async function ManagementMessage({ t, lang }: { t: Pick<Dict, 'management'>; lang: 'km' | 'en' }) {
  // The group photo (CamCow's leaders with member farmers), replaceable in the office.
  const groupPhoto = (await siteImages())['team-group'];
  const m = t.management;
  const named = LEADERS.filter(l => l.name[lang]);
  return (
    <div className="mg">
      <figure className="mg-photo">
        <Image src={groupPhoto} alt={m.signedBy} width={1500} height={1000} style={{ objectFit: 'cover' }} sizes="(max-width: 900px) 100vw, 560px" priority />
      </figure>
      <div className="mg-text">
        <span className="mg-eyebrow">{m.eyebrow}</span>
        <h2 className="display h3"><KmWords text={m.title} /></h2>
        <blockquote>
          {m.message.map(p => <p key={p.slice(0, 24)}>{p}</p>)}
        </blockquote>
        <p className="mg-sign">— {named.length ? named.map(l => l.name[lang]).join(' · ') : m.signedBy}</p>
      </div>
    </div>
  );
}
