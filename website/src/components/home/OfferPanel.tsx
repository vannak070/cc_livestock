/** Shown in the hero instead of live numbers while the network is small (src/lib/launch.ts). */
export function OfferPanel({ title, items, note }: { title: string; items: readonly { title: string; body: string }[]; note: string }) {
  return (
    <div className="live rise d3">
      <div className="live-head"><span>{title}</span></div>
      <ul className="live-grid" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {items.map(item => (
          <li key={item.title} className="tile stack" style={{ gap: 6 }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#138e46" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12l5 5L20 6" /></svg>
            <b style={{ fontSize: 18, color: 'var(--ink)' }}>{item.title}</b>
            <span className="small muted">{item.body}</span>
          </li>
        ))}
      </ul>
      <p className="small" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--green-700)', fontWeight: 500, margin: 0 }}>
        <span className="live-dot" aria-hidden="true"><i className="pulse" /><i /></span>{note}
      </p>
    </div>
  );
}
