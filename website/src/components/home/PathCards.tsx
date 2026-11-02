import Image from 'next/image';
import Link from 'next/link';
import { KmWords } from '@/components/shared/KmWords';

export interface PathCard { key: string; label: string; title: string; body: string; cta: string; href: string; photo: string }

/**
 * "Three ways in": farmer, buyer and investor side by side as photo cards (the farmer card is wider). Phones show
 * them as tappable rows with a small photo, so all three paths are visible at once (no tabs).
 */
export function PathCards({ items }: { items: PathCard[] }) {
  return (
    <ul className="paths">
      {items.map(p => (
        <li key={p.key} className={`path path-${p.key}`}>
          <Link href={p.href} className="path-link">
            <span className="path-photo">
              <Image src={p.photo} alt="" fill sizes="(max-width: 760px) 96px, 480px" />
            </span>
            <span className="path-body">
              <span className="path-label">{p.label}</span>
              <b className="display"><KmWords text={p.title} /></b>
              <span className="path-text">{p.body}</span>
              <span className="path-cta">{p.cta} <span aria-hidden="true">→</span></span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
