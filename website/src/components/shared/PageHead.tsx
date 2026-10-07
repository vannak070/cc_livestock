import type { ReactNode } from 'react';
import { HeroLines } from './HeroLines';

/** The top of an inner page: title, one line under it, field rows behind. */
export function PageHead({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  return (
    <section className="page-head">
      <HeroLines />
      <div className="wrap stack" style={{ position: 'relative', gap: 12 }}>
        <h1 className="display h2 rise">{title}</h1>
        {sub && <p className="lead rise d1">{sub}</p>}
        {children}
      </div>
    </section>
  );
}
