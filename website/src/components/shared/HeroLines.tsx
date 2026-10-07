/** Faint field rows that draw themselves behind a page's top area. */
export function HeroLines() {
  const rows = [400, 360, 320, 280, 240];
  return (
    <svg className="hero-lines" viewBox="0 0 1280 420" preserveAspectRatio="none" aria-hidden="true">
      {rows.map((y, i) => (
        <path key={y} className="draw" style={{ animationDelay: `${0.2 + i * 0.25}s` }} d={`M-20 ${y} Q 640 ${y - 150} 1300 ${y}`} fill="none" stroke={i === rows.length - 1 ? '#138e46' : '#0e6b34'} strokeWidth="2" />
      ))}
    </svg>
  );
}
