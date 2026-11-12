import { useEffect, useRef, useState } from "react";
import { API_URL, api } from "./api";
import { Callout } from "./components/ui";
import Dashboard from "./pages/Dashboard";
import Landing from "./pages/Landing";
import Model from "./pages/Model";
import Predict from "./pages/Predict";

const POLL_INTERVAL = 2000;
const MAX_EVENTS = 50;
const EMPTY_STATS = { total: 0, correct: 0, flagged: 0, missed: 0, falseAlarms: 0, lowConfidence: 0 };

const TABS = [
  { id: "dashboard", label: "Live" },
  { id: "predict", label: "Classify" },
  { id: "model", label: "Model" },
];

function addToStats(s, e) {
  const actualAttack = e.simulated !== "BENIGN";
  const predictedAttack = e.predicted !== "BENIGN";
  return {
    total: s.total + 1,
    correct: s.correct + (e.correct ? 1 : 0),
    flagged: s.flagged + (predictedAttack ? 1 : 0),
    missed: s.missed + (actualAttack && !predictedAttack ? 1 : 0),
    falseAlarms: s.falseAlarms + (!actualAttack && predictedAttack ? 1 : 0),
    lowConfidence: s.lowConfidence + (e.lowConfidence ? 1 : 0),
  };
}

export default function App() {
  const [started, setStarted] = useState(false); // false = landing page
  const [tab, setTab] = useState("dashboard");
  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState(EMPTY_STATS);
  const [online, setOnline] = useState(null);
  const [paused, setPaused] = useState(true); // stream starts only when the user presses Start
  const [info, setInfo] = useState(null);
  const [infoError, setInfoError] = useState("");
  const pausedRef = useRef(paused);
  useEffect(() => { pausedRef.current = paused; }, [paused]);

  useEffect(() => {
    api.modelInfo().then(setInfo).catch((e) => setInfoError(e.message));
  }, []);

  // Each poll waits for the previous one, so a slow backend never gets overlapping requests.
  useEffect(() => {
    let timer;
    let stopped = false;
    const poll = async () => {
      if (!pausedRef.current) {
        try {
          const d = await api.simulate();
          if (stopped) return; // component unmounted while the request was in flight
          const e = {
            id: crypto.randomUUID(),
            time: new Date().toLocaleTimeString([], { hour12: false }),
            simulated: d.simulated_attack,
            predicted: d.predicted_attack,
            confidence: d.confidence,
            lowConfidence: d.low_confidence,
            severity: d.severity,
            correct: d.correct,
          };
          setEvents((prev) => [e, ...prev].slice(0, MAX_EVENTS));
          setStats((s) => addToStats(s, e));
          setOnline(true);
        } catch {
          setOnline(false);
        }
      }
      if (!stopped) timer = setTimeout(poll, POLL_INTERVAL);
    };
    poll();
    return () => { stopped = true; clearTimeout(timer); };
  }, []);

  const statusText = paused ? "Paused" : online === true ? "Connected" : online === false ? "Offline" : "Connecting…";
  const statusColor = paused ? "var(--text-3)" : online === true ? "var(--sev-none)" : online === false ? "var(--sev-critical)" : "var(--text-3)";

  const needsInfo = tab !== "dashboard";

  const open = (t) => { setTab(t); setStarted(true); };
  const goHome = () => { setPaused(true); setStarted(false); };

  if (!started) {
    return (
      <div className="shell landing-shell">
        <header className="topbar">
          <div className="brand">
            <span className="brand-mark">
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M10 2l7 3v5c0 4-3 7-7 8-4-1-7-4-7-8V5l7-3z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              </svg>
            </span>
            CyberWatch
          </div>
          <div className="topbar-right"><span className="meta">Random forest · CIC-IDS2017</span></div>
        </header>
        <Landing info={info} onStart={() => open("dashboard")} onOpenModel={() => open("model")} />
      </div>
    );
  }

  return (
    <div className="shell">
      <header className="topbar">
        <button className="brand brand-btn" onClick={goHome} title="Back to start page">
          <span className="brand-mark">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M10 2l7 3v5c0 4-3 7-7 8-4-1-7-4-7-8V5l7-3z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            </svg>
          </span>
          CyberWatch
        </button>
        <nav className="tabs" role="tablist" aria-label="Sections">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} className="tab" onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
        <div className="topbar-right">
          <span className="status" title={API_URL}>
            <span className="dot" style={{ background: statusColor }} aria-hidden="true" />
            {statusText}
          </span>
        </div>
      </header>

      <main>
        {tab === "dashboard" && (
          <Dashboard events={events} stats={stats} online={online} paused={paused}
            onTogglePause={() => setPaused((p) => !p)} maxEvents={MAX_EVENTS} />
        )}
        {needsInfo && infoError && <Callout tone="error">Couldn't load model details: {infoError}</Callout>}
        {needsInfo && !info && !infoError && <div className="empty">Loading model details…</div>}
        {tab === "predict" && info && <Predict features={info.features} />}
        {tab === "model" && info && <Model info={info} />}
      </main>
    </div>
  );
}
