import { pct } from "../format";

// ── Hero figure: flow features → random-forest trees → vote → verdict ──────────
// Purely illustrative (the real model has 69 features and 100 trees), so it's labelled as such.
const INPUTS = ["Flow duration", "Fwd packets", "Packet length", "TCP flags", "Inter-arrival", "Bytes / s"];
const INPUT_X = 132;
const inputY = (i) => 62 + i * 50;
const TREES = [82, 182, 282];
const ROOT_X = 236;
const VOTE_X = 352;
const OUTPUTS = ["BENIGN", "DDoS", "PortScan"];
const OUT_X = 412;
const outY = (i) => 122 + i * 60;

const curve = (x1, y1, x2, y2) => {
  const mx = (x1 + x2) / 2;
  return `M${x1} ${y1} C${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
};

function Tree({ y, delay }) {
  const kids = [y - 22, y + 22];
  const leaves = [y - 33, y - 11, y + 11, y + 33];
  return (
    <g>
      {kids.map((ky) => <line key={ky} x1={ROOT_X} y1={y} x2={ROOT_X + 40} y2={ky} className="fig-edge strong" />)}
      {leaves.map((ly, i) => (
        <line key={ly} x1={ROOT_X + 40} y1={kids[i < 2 ? 0 : 1]} x2={ROOT_X + 80} y2={ly} className="fig-edge strong" />
      ))}
      {leaves.map((ly) => <line key={`v${ly}`} x1={ROOT_X + 80} y1={ly} x2={VOTE_X} y2={y} className="fig-edge" />)}
      <circle cx={ROOT_X} cy={y} r="6" className="fig-node tree" style={{ animationDelay: `${delay}s` }} />
      {kids.map((ky) => <circle key={ky} cx={ROOT_X + 40} cy={ky} r="4.5" className="fig-node tree" />)}
      {leaves.map((ly) => <circle key={ly} cx={ROOT_X + 80} cy={ly} r="3.5" className="fig-node leaf" />)}
      <rect x={VOTE_X - 6} y={y - 6} width="12" height="12" rx="3" className="fig-node vote" />
    </g>
  );
}

function ForestFigure() {
  return (
    <svg className="fig" viewBox="0 0 520 380" role="img"
      aria-label="Diagram: flow features feed several decision trees, whose votes decide the verdict">
      <defs>
        <linearGradient id="fig-brand" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--teal)" />
          <stop offset="1" stopColor="var(--indigo)" />
        </linearGradient>
      </defs>

      <text x={INPUT_X} y="26" className="fig-caption" textAnchor="end">Flow features</text>
      <text x={ROOT_X + 40} y="26" className="fig-caption" textAnchor="middle">Decision trees</text>
      <text x={OUT_X + 50} y="26" className="fig-caption" textAnchor="middle">Verdict</text>

      {/* input → tree edges, each with a travelling "packet" */}
      {INPUTS.map((_, i) => TREES.map((ty, t) => {
        const d = curve(INPUT_X + 6, inputY(i), ROOT_X - 7, ty);
        return (
          <g key={`${i}-${t}`}>
            <path d={d} className="fig-edge" />
            <path d={d} pathLength="200" className="fig-pulse teal" style={{ animationDelay: `${-(i * 0.45 + t * 0.8)}s` }} />
          </g>
        );
      }))}

      {/* vote → verdict edges */}
      {TREES.map((ty, t) => OUTPUTS.map((_, o) => {
        const d = curve(VOTE_X + 7, ty, OUT_X - 2, outY(o));
        return (
          <g key={`o${t}-${o}`}>
            <path d={d} className="fig-edge" />
            <path d={d} pathLength="200" className="fig-pulse indigo" style={{ animationDelay: `${-(t * 0.6 + o * 1.1)}s` }} />
          </g>
        );
      }))}

      {TREES.map((ty, t) => <Tree key={ty} y={ty} delay={t * 0.7} />)}

      {INPUTS.map((label, i) => (
        <g key={label}>
          <text x={INPUT_X - 12} y={inputY(i) + 4} className="fig-label" textAnchor="end">{label}</text>
          <circle cx={INPUT_X} cy={inputY(i)} r="5" className="fig-node input" />
        </g>
      ))}

      {OUTPUTS.map((label, o) => (
        <g key={label} className="fig-out" style={{ animationDelay: `${o * 2}s` }}>
          <rect x={OUT_X} y={outY(o) - 15} width="100" height="30" rx="15" className="fig-out-pill" />
          <circle cx={OUT_X + 16} cy={outY(o)} r="4" fill="url(#fig-brand)" />
          <text x={OUT_X + 28} y={outY(o) + 4} className="fig-out-label">{label}</text>
        </g>
      ))}

      <text x="260" y="366" className="fig-caption" textAnchor="middle">
        Simplified: the served model reads 69 features with 100 trees
      </text>
    </svg>
  );
}

const STEPS = [
  { n: "01", tone: "teal", title: "Capture the flow", text: "Each network flow is summarised as 69 numeric features: timings, packet sizes, flags and rates." },
  { n: "02", tone: "indigo", title: "Forest votes", text: "100 decision trees each cast a vote. The share of votes for the winner is the confidence." },
  { n: "03", tone: "amber", title: "Verdict + severity", text: "The flow is labelled benign or one of 9 attack types, with a severity and a low-confidence flag." },
];

export default function Landing({ info, onStart, onOpenModel }) {
  const m = info?.model;
  const stats = [
    { label: "Test accuracy", value: m ? pct(m.accuracy, 2) : "—" },
    { label: "Macro F1", value: m ? m.macro_f1.toFixed(3) : "—" },
    { label: "Attack types", value: info ? info.classes.length - 1 : "—" },
    { label: "Held-out flows", value: info ? info.split_sizes.test.toLocaleString() : "—" },
  ];

  return (
    <div className="landing">
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow"><span className="eyebrow-dot" aria-hidden="true" />AI network intrusion detection</span>
          <h1 className="hero-title">Cyber<span className="hero-grad">Watch</span></h1>
          <p className="hero-lead">
            A machine-learning model that reads network traffic and flags attacks (DDoS, port scans, botnets and more)
            as they happen. Trained on the CIC-IDS2017 dataset.
          </p>
          <div className="toolbar">
            <button className="btn btn-primary btn-lg" onClick={onStart}>
              Start the test flow
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"
                strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" /></svg>
            </button>
            <button className="btn btn-lg" onClick={onOpenModel}>See how it performs</button>
          </div>
          <dl className="hero-stats">
            {stats.map((s) => (
              <div key={s.label}>
                <dt>{s.label}</dt>
                <dd>{s.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="card hero-figure">
          <ForestFigure />
        </div>
      </section>

      <ol className="steps">
        {STEPS.map((s) => (
          <li key={s.n} className={`card step tone-${s.tone}`}>
            <span className="step-n">{s.n}</span>
            <div>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
