import type { ReactNode } from 'react';

/** The top of an inner page: a short green rule, title and one line under it, on a soft mint wash. */
export function PageHead({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  return (
    <section className="page-head">
      <div className="wrap stack" style={{ position: 'relative', gap: 12 }}>
        <span className="head-rule rise" aria-hidden="true" />
        <h1 className="display h2 rise">{title}</h1>
        {sub && <p className="lead rise d1">{sub}</p>}
        {children}
      </div>
    </section>
  );
}
