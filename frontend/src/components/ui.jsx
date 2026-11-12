import { SEVERITY, pct } from "../format";

// Tone = one of the three brand colours (teal, indigo, amber); see DESIGN.md.
const toneClass = (tone) => (tone ? ` tone-${tone}` : "");

const ICONS = {
  activity: <path d="M2 8h3l2-5 2 10 2-5h3" />,
  target: <><circle cx="8" cy="8" r="5.5" /><circle cx="8" cy="8" r="2" /></>,
  alert: <><path d="M8 2.5l6 10.5H2L8 2.5z" /><path d="M8 7v2.5M8 11.2v.1" /></>,
  eyeOff: <><path d="M2 8s2.2-4 6-4 6 4 6 4-2.2 4-6 4-6-4-6-4z" /><path d="M3 13L13 3" /></>,
  bell: <><path d="M4 11V7.5a4 4 0 018 0V11l1 1.5H3L4 11z" /><path d="M6.5 14h3" /></>,
  help: <><circle cx="8" cy="8" r="6" /><path d="M6.3 6.3a1.8 1.8 0 113 1.4c-.8.4-1.3.9-1.3 1.6M8 11.3v.1" /></>,
  layers: <><path d="M8 2l6 3-6 3-6-3 6-3z" /><path d="M2 8l6 3 6-3M2 11l6 3 6-3" /></>,
  gauge: <><path d="M2.5 11a5.5 5.5 0 1111 0" /><path d="M8 11l3-3.5" /></>,
};

export function Icon({ name, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

export function SeverityBadge({ severity }) {
  const s = SEVERITY[severity] ?? SEVERITY.medium;
  return (
    <span className="badge">
      <span className="dot" style={{ background: s.color }} aria-hidden="true" />
      {s.label}
    </span>
  );
}

export function Card({ title, meta, children, flush = false, tone }) {
  return (
    <section className={`card${toneClass(tone)}`}>
      {title && (
        <div className="card-head">
          <h2>{title}</h2>
          {meta && <span className="meta">{meta}</span>}
        </div>
      )}
      {flush ? children : <div className="card-body">{children}</div>}
    </section>
  );
}

export function StatTile({ label, value, sub, icon, tone = "teal" }) {
  return (
    <div className={`card tile${toneClass(tone)}`}>
      <div className="tile-top">
        <span className="tile-label">{label}</span>
        {icon && <span className="tile-icon"><Icon name={icon} /></span>}
      </div>
      <div className="tile-value">{value}</div>
      {sub && <div className="tile-sub">{sub}</div>}
    </div>
  );
}

export function ConfidenceMeter({ value, low }) {
  return (
    <span className="meter" title={low ? "Below the confidence threshold" : undefined}>
      <span className="meter-track">
        <span className={`meter-fill${low ? " low" : ""}`} style={{ width: pct(value, 0) }} />
      </span>
      <span className="num">{pct(value, 0)}</span>
    </span>
  );
}

export function Callout({ children, tone }) {
  return (
    <div className={`callout${tone === "error" ? " error" : ""}`} role={tone === "error" ? "alert" : "status"}>
      {children}
    </div>
  );
}

export function CheckIcon() {
  return (
    <svg className="result-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8.5l3 3 7-7" stroke="var(--teal)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CrossIcon() {
  return (
    <svg className="result-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 4l8 8M12 4l-8 8" stroke="var(--sev-critical)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
