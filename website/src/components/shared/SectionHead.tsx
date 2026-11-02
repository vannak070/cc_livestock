import { KmWords } from './KmWords';

/**
 * The one section heading used on the content pages (Home, About, For farmers): an optional small green label
 * with a short rule, a large navy title and an optional intro line. Form pages use plain `display h3` sub-headings.
 */
export function SectionHead({ eyebrow, title, intro, center = false }: { eyebrow?: string; title: string; intro?: string; center?: boolean }) {
  return (
    <header className={`sh${center ? ' sh-center' : ''}`}>
      {eyebrow && <span className="sh-eyebrow">{eyebrow}</span>}
      <h2 className="display h2"><KmWords text={title} /></h2>
      {intro && <p className="lead">{intro}</p>}
    </header>
  );
}
