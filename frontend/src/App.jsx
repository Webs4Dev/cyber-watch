import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend
} from "recharts";

// ─── Config ────────────────────────────────────────────────────────────────
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const POLL_INTERVAL = 2000;
const MAX_LOGS = 50;
const CONFIDENCE_THRESHOLD = 0.6;

// ─── 78 feature names (CIC-IDS2017 standard) ──────────────────────────────
const FEATURE_NAMES = [
  "Destination Port","Flow Duration","Total Fwd Packets","Total Backward Packets",
  "Total Length of Fwd Packets","Total Length of Bwd Packets","Fwd Packet Length Max",
  "Fwd Packet Length Min","Fwd Packet Length Mean","Fwd Packet Length Std",
  "Bwd Packet Length Max","Bwd Packet Length Min","Bwd Packet Length Mean",
  "Bwd Packet Length Std","Flow Bytes/s","Flow Packets/s","Flow IAT Mean",
  "Flow IAT Std","Flow IAT Max","Flow IAT Min","Fwd IAT Total","Fwd IAT Mean",
  "Fwd IAT Std","Fwd IAT Max","Fwd IAT Min","Bwd IAT Total","Bwd IAT Mean",
  "Bwd IAT Std","Bwd IAT Max","Bwd IAT Min","Fwd PSH Flags","Bwd PSH Flags",
  "Fwd URG Flags","Bwd URG Flags","Fwd Header Length","Bwd Header Length",
  "Fwd Packets/s","Bwd Packets/s","Min Packet Length","Max Packet Length",
  "Packet Length Mean","Packet Length Std","Packet Length Variance",
  "FIN Flag Count","SYN Flag Count","RST Flag Count","PSH Flag Count",
  "ACK Flag Count","URG Flag Count","CWE Flag Count","ECE Flag Count",
  "Down/Up Ratio","Average Packet Size","Avg Fwd Segment Size",
  "Avg Bwd Segment Size","Fwd Header Length.1","Fwd Avg Bytes/Bulk",
  "Fwd Avg Packets/Bulk","Fwd Avg Bulk Rate","Bwd Avg Bytes/Bulk",
  "Bwd Avg Packets/Bulk","Bwd Avg Bulk Rate","Subflow Fwd Packets",
  "Subflow Fwd Bytes","Subflow Bwd Packets","Subflow Bwd Bytes",
  "Init_Win_bytes_forward","Init_Win_bytes_backward","act_data_pkt_fwd",
  "min_seg_size_forward","Active Mean","Active Std","Active Max","Active Min",
  "Idle Mean","Idle Std","Idle Max","Idle Min",
];

// ─── Realistic random value generator per feature ─────────────────────────
const rand = (min, max) => Math.random() * (max - min) + min;
const randInt = (min, max) => Math.floor(rand(min, max + 1));
const round2 = n => Math.round(n * 100) / 100;

const generateFeatureValue = (name) => {
  if (name === "Destination Port") return randInt(1, 65535);

  if (name === "Fwd PSH Flags" || name === "Bwd PSH Flags" ||
      name === "Fwd URG Flags" || name === "Bwd URG Flags") {
    return randInt(0, 1);
  }
  if (/Flag Count$/.test(name)) return randInt(0, 3);

  if (name.includes("Win_bytes")) return randInt(-1, 65535);

  if (name === "act_data_pkt_fwd") return randInt(0, 40);
  if (name === "min_seg_size_forward") return randInt(0, 60);

  if (/Header Length/.test(name)) return randInt(20, 1200);

  if (/Bytes\/s|Packets\/s/.test(name)) return round2(rand(0, 500000));

  if (/Duration|IAT|Active|Idle/.test(name)) return round2(rand(0, 2000000));

  if (/Ratio/.test(name)) return round2(rand(0, 5));

  if (/Bulk/.test(name)) return randInt(0, 2000);

  if (/^Total (Fwd|Backward) Packets$/.test(name) || /Subflow (Fwd|Bwd) Packets/.test(name)) {
    return randInt(1, 100);
  }
  if (/Total Length|Subflow (Fwd|Bwd) Bytes/.test(name)) return randInt(0, 20000);

  if (/Length|Segment Size|Packet Size|Variance/.test(name)) return round2(rand(0, 1500));

  return round2(rand(0, 1000));
};

const generateRandomFeatures = () => FEATURE_NAMES.map(name => String(generateFeatureValue(name)));

// ─── Threat logic ──────────────────────────────────────────────────────────
const classifyThreat = (predicted, confidence) => {
  if (predicted === "BENIGN") return "BENIGN";
  if (predicted === "UNKNOWN") return "UNKNOWN";
  if (confidence > 0.9) return "CRITICAL";
  if (confidence > 0.75) return "HIGH";
  return "MEDIUM";
};

const SEV = {
  BENIGN:   { color: "#4ade80", dim: "#4ade8014", border: "#4ade8035" },
  UNKNOWN:  { color: "#fb923c", dim: "#fb923c14", border: "#fb923c35" },
  MEDIUM:   { color: "#facc15", dim: "#facc1514", border: "#facc1535" },
  HIGH:     { color: "#f87171", dim: "#f8717114", border: "#f8717135" },
  CRITICAL: { color: "#ff4444", dim: "#ff444420", border: "#ff444450" },
};

// ─── Shared mini-components ────────────────────────────────────────────────
const Badge = ({ level }) => {
  const s = SEV[level] || SEV.UNKNOWN;
  return (
    <span style={{
      display: "inline-block", padding: "2px 9px", borderRadius: 4,
      fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase",
      color: s.color, background: s.dim, border: `1px solid ${s.border}`,
    }}>{level}</span>
  );
};

const ConfBar = ({ value }) => {
  const pct = Math.round(value * 100);
  const color = pct >= 90 ? "#ff4444" : pct >= 75 ? "#f87171" : pct >= 60 ? "#facc15" : "#4ade80";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 120 }}>
      <div style={{ flex: 1, height: 3, background: "#1e293b", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 2, transition: "width 0.4s ease" }} />
      </div>
      <span style={{ color: "#475569", fontFamily: "monospace", fontSize: 11, minWidth: 30 }}>{pct}%</span>
    </div>
  );
};

const PulseDot = ({ active, color }) => (
  <span style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", width: 14, height: 14 }}>
    {active && <span style={{ position: "absolute", width: 14, height: 14, borderRadius: "50%", background: color, opacity: 0, animation: "ping 1.5s ease-out infinite" }} />}
    <span style={{ width: 8, height: 8, borderRadius: "50%", background: active ? color : "#1e293b", display: "block" }} />
  </span>
);

const StatCard = ({ label, value, accent }) => (
  <div style={{ flex: 1, minWidth: 100, background: "#0a1525", border: "1px solid #1e293b", borderTop: `2px solid ${accent}`, borderRadius: 8, padding: "13px 16px" }}>
    <div style={{ color: accent, fontSize: 21, fontWeight: 700, fontFamily: "monospace", lineHeight: 1 }}>{value}</div>
    <div style={{ color: "#334155", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 5 }}>{label}</div>
  </div>
);

// ─── Custom Recharts Tooltip ───────────────────────────────────────────────
const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#0f1f35", border: "1px solid #1e293b", borderRadius: 6, padding: "8px 12px", fontFamily: "monospace", fontSize: 12 }}>
      {label && <div style={{ color: "#475569", marginBottom: 4 }}>{label}</div>}
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || "#94a3b8" }}>{p.name}: {typeof p.value === "number" ? p.value.toFixed ? p.value.toFixed(2) : p.value : p.value}</div>
      ))}
    </div>
  );
};

// ─── Dashboard Page ────────────────────────────────────────────────────────
function DashboardPage({ logs, stats, online }) {
  const threatRate = stats.total > 0 ? `${((stats.threats / stats.total) * 100).toFixed(1)}%` : "—";

  // Confidence over time (last 20)
  const confData = [...logs].reverse().slice(-20).map((l, i) => ({
    i: i + 1, conf: +(l.confidence * 100).toFixed(1), level: l.level,
  }));

  // Severity distribution for pie
  const pieData = Object.entries(SEV).map(([key, s]) => ({
    name: key,
    value: logs.filter(l => l.level === key).length,
    color: s.color,
  })).filter(d => d.value > 0);

  // Attack type frequency bar chart
  const attackCounts = {};
  logs.forEach(l => { attackCounts[l.predicted] = (attackCounts[l.predicted] || 0) + 1; });
  const barData = Object.entries(attackCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name: name.length > 14 ? name.slice(0, 13) + "…" : name, count }));

  // Events per 10-second bucket
  const now = Date.now();
  const buckets = {};
  logs.forEach(l => {
    const bucket = Math.floor((now - l.id) / 10000);
    const label = `${bucket * 10}s ago`;
    buckets[label] = (buckets[label] || 0) + 1;
  });
  const timeData = Object.entries(buckets).reverse().slice(0, 12).map(([t, c]) => ({ t, c }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

      {/* Stats row */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <StatCard label="Scanned"     value={stats.total}   accent="#38bdf8" />
        <StatCard label="Benign"      value={stats.benign}  accent="#4ade80" />
        <StatCard label="Threats"     value={stats.threats} accent="#f87171" />
        <StatCard label="Unknown"     value={stats.unknown} accent="#fb923c" />
        <StatCard label="Threat Rate" value={threatRate}    accent="#facc15" />
      </div>

      {/* Charts row */}
      {logs.length >= 3 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>

          {/* Confidence over time */}
          <div style={{ background: "#0a1525", border: "1px solid #1e293b", borderRadius: 10, padding: "16px 12px 10px" }}>
            <div style={{ color: "#475569", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 14, paddingLeft: 4 }}>
              Confidence · last 20 events
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={confData} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="i" tick={{ fill: "#334155", fontSize: 10 }} />
                <YAxis domain={[0, 100]} tick={{ fill: "#334155", fontSize: 10 }} />
                <Tooltip content={<ChartTip />} />
                <Line type="monotone" dataKey="conf" name="conf %" stroke="#38bdf8" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Severity pie */}
          <div style={{ background: "#0a1525", border: "1px solid #1e293b", borderRadius: 10, padding: "16px 12px 10px" }}>
            <div style={{ color: "#475569", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 14, paddingLeft: 4 }}>
              Severity distribution
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} opacity={0.85} />)}
                </Pie>
                <Tooltip content={<ChartTip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: "#475569" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Attack type bar */}
          <div style={{ background: "#0a1525", border: "1px solid #1e293b", borderRadius: 10, padding: "16px 12px 10px" }}>
            <div style={{ color: "#475569", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 14, paddingLeft: 4 }}>
              Top predicted labels
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={barData} margin={{ top: 0, right: 8, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: "#334155", fontSize: 9 }} angle={-30} textAnchor="end" interval={0} />
                <YAxis tick={{ fill: "#334155", fontSize: 10 }} />
                <Tooltip content={<ChartTip />} />
                <Bar dataKey="count" name="count" radius={[3, 3, 0, 0]}>
                  {barData.map((entry, i) => {
                    const lvl = entry.name === "BENIGN" ? "BENIGN" : entry.name === "UNKNOWN" ? "UNKNOWN" : "HIGH";
                    return <Cell key={i} fill={SEV[lvl]?.color || "#38bdf8"} opacity={0.75} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Event rate over time */}
          <div style={{ background: "#0a1525", border: "1px solid #1e293b", borderRadius: 10, padding: "16px 12px 10px" }}>
            <div style={{ color: "#475569", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 14, paddingLeft: 4 }}>
              Event volume · 10s buckets
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={timeData} margin={{ top: 0, right: 8, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="t" tick={{ fill: "#334155", fontSize: 9 }} angle={-30} textAnchor="end" interval={0} />
                <YAxis tick={{ fill: "#334155", fontSize: 10 }} />
                <Tooltip content={<ChartTip />} />
                <Bar dataKey="c" name="events" fill="#38bdf8" opacity={0.6} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Live log table */}
      <div style={{ background: "#0a1525", border: "1px solid #1e293b", borderRadius: 10, overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #0f1f35", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ color: "#334155", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase" }}>Live event log</span>
          <span style={{ color: "#1e293b", fontFamily: "monospace", fontSize: 10 }}>{logs.length} / {MAX_LOGS}</span>
        </div>

        {online === false && logs.length > 0 && (
          <div style={{ background: "#f8717109", borderBottom: "1px solid #f8717120", padding: "6px 16px", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#f87171", display: "block" }} />
            <span style={{ fontFamily: "monospace", fontSize: 11, color: "#f87171" }}>Backend offline — showing cached events</span>
          </div>
        )}

        {logs.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center", color: "#1e293b", fontFamily: "monospace", fontSize: 12 }}>
            waiting for events…
          </div>
        ) : (
          <div style={{ overflowX: "auto", maxHeight: "340px", overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 620 }}>
              <thead>
                <tr>
                  {["Time", "Simulated", "Predicted", "Confidence", "Severity"].map(h => (
                    <th key={h} style={{
                      fontFamily: "monospace", fontSize: 10, fontWeight: 500,
                      letterSpacing: "0.12em", textTransform: "uppercase", color: "#334155",
                      padding: "9px 14px", textAlign: "left", borderBottom: "1px solid #0f1f35",
                      background: "#060d1a", position: "sticky", top: 0, whiteSpace: "nowrap",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const s = SEV[log.level] || SEV.UNKNOWN;
                  return (
                    <tr key={log.id} className="log-row">
                      <td style={{ fontFamily: "monospace", color: "#334155", fontSize: 11, padding: "9px 14px", borderBottom: "1px solid #0a1525" }}>{log.time}</td>
                      <td style={{ color: "#475569", fontSize: 12, padding: "9px 14px", borderBottom: "1px solid #0a1525" }}>{log.simulated}</td>
                      <td style={{ fontFamily: "monospace", color: s.color, fontSize: 11, padding: "9px 14px", borderBottom: "1px solid #0a1525" }}>{log.predicted}</td>
                      <td style={{ padding: "9px 14px", borderBottom: "1px solid #0a1525" }}><ConfBar value={log.confidence} /></td>
                      <td style={{ padding: "9px 14px", borderBottom: "1px solid #0a1525" }}><Badge level={log.level} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Predict Page ──────────────────────────────────────────────────────────
function PredictPage() {
  const [features, setFeatures] = useState(() => Array(78).fill(""));
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteText, setPasteText] = useState("");

  const handleChange = (i, val) => {
    const f = [...features];
    f[i] = val;
    setFeatures(f);
  };

  const handlePaste = () => {
    const vals = pasteText.trim().split(/[\s,]+/).map(v => v.trim()).filter(Boolean);
    if (vals.length !== 78) {
      setError(`Expected 78 values, got ${vals.length}`);
      return;
    }
    setFeatures(vals);
    setError("");
    setPasteMode(false);
    setPasteText("");
  };

  const handleClear = () => {
    setFeatures(Array(78).fill(""));
    setResult(null);
    setError("");
  };

  const handleRandomize = () => {
    setFeatures(generateRandomFeatures());
    setResult(null);
    setError("");
  };

  const handleSubmit = async () => {
    const parsed = features.map(f => parseFloat(f));
    if (parsed.some(isNaN)) {
      setError("All 78 fields must be filled with numeric values.");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch(`${API_URL}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ features: parsed }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();
      // Backend returns: { attack_type, confidence }
      const level = classifyThreat(data.attack_type, data.confidence);
      setResult({ ...data, level });
    } catch (e) {
      setError(e.message || "Request failed");
    } finally {
      setLoading(false);
    }
  };

  const filled = features.filter(f => f !== "").length;
  const filtered = FEATURE_NAMES.map((name, i) => ({ name, i }))
    .filter(({ name }) => name.toLowerCase().includes(search.toLowerCase()));

  const s = result ? (SEV[result.level] || SEV.UNKNOWN) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

      {/* Result card */}
      {result && (
        <div style={{
          background: s.dim, border: `1px solid ${s.border}`,
          borderRadius: 10, padding: "20px 24px",
          display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap",
        }}>
          <div>
            <div style={{ color: "#475569", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>Prediction Result</div>
            <div style={{ color: s.color, fontFamily: "monospace", fontSize: 22, fontWeight: 700 }}>{result.attack_type}</div>
          </div>
          <div style={{ borderLeft: "1px solid #1e293b", paddingLeft: 20 }}>
            <div style={{ color: "#475569", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>Confidence</div>
            <div style={{ color: "#e2e8f0", fontFamily: "monospace", fontSize: 22, fontWeight: 700 }}>{(result.confidence * 100).toFixed(2)}%</div>
          </div>
          <div style={{ borderLeft: "1px solid #1e293b", paddingLeft: 20 }}>
            <div style={{ color: "#475569", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>Severity</div>
            <Badge level={result.level} />
          </div>
          <button onClick={() => setResult(null)} style={{
            marginLeft: "auto", background: "transparent", border: "1px solid #1e293b",
            color: "#334155", borderRadius: 6, padding: "6px 12px", cursor: "pointer", fontSize: 12,
          }}>Dismiss</button>
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{
          flex: 1, minWidth: 200,
          background: "#0a1525", border: "1px solid #1e293b",
          borderRadius: 7, padding: "7px 12px", display: "flex", alignItems: "center", gap: 8,
        }}>
          <span style={{ color: "#1e293b", fontSize: 13 }}>⌕</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search features…"
            style={{
              background: "transparent", border: "none", outline: "none",
              color: "#94a3b8", fontFamily: "monospace", fontSize: 12, flex: 1,
            }}
          />
        </div>

        <div style={{ fontFamily: "monospace", fontSize: 11, color: filled === 78 ? "#4ade80" : "#334155" }}>
          {filled}/78 filled
        </div>

        <button onClick={() => setPasteMode(p => !p)} style={{
          background: "#0a1525", border: "1px solid #1e293b", color: "#94a3b8",
          borderRadius: 7, padding: "7px 14px", cursor: "pointer", fontSize: 12, fontFamily: "monospace",
        }}>
          {pasteMode ? "Cancel paste" : "Paste values"}
        </button>

        <button onClick={handleRandomize} style={{
          background: "#0a1525", border: "1px solid #1e3a5f", color: "#38bdf8",
          borderRadius: 7, padding: "7px 14px", cursor: "pointer", fontSize: 12, fontFamily: "monospace",
        }}>
          ⚄ Randomize
        </button>

        <button onClick={handleClear} style={{
          background: "#0a1525", border: "1px solid #1e293b", color: "#475569",
          borderRadius: 7, padding: "7px 14px", cursor: "pointer", fontSize: 12,
        }}>Clear</button>

        <button onClick={handleSubmit} disabled={loading} style={{
          background: loading ? "#0f1f35" : "#38bdf8", color: loading ? "#334155" : "#060d1a",
          border: "none", borderRadius: 7, padding: "7px 18px",
          cursor: loading ? "not-allowed" : "pointer", fontWeight: 600, fontSize: 13,
          fontFamily: "monospace", letterSpacing: "0.04em", transition: "background 0.2s",
        }}>
          {loading ? "Running…" : "Predict →"}
        </button>
      </div>

      {/* Paste area */}
      {pasteMode && (
        <div style={{ background: "#0a1525", border: "1px solid #1e293b", borderRadius: 10, padding: 16 }}>
          <div style={{ color: "#475569", fontSize: 11, marginBottom: 10 }}>
            Paste 78 comma- or space-separated numeric values:
          </div>
          <textarea
            value={pasteText}
            onChange={e => setPasteText(e.target.value)}
            placeholder="0, 1234, 56.7, 0, ..."
            rows={4}
            style={{
              width: "100%", background: "#060d1a", border: "1px solid #1e293b",
              borderRadius: 6, padding: "10px 12px", color: "#94a3b8",
              fontFamily: "monospace", fontSize: 12, resize: "vertical", outline: "none",
            }}
          />
          <button onClick={handlePaste} style={{
            marginTop: 10, background: "#38bdf8", color: "#060d1a",
            border: "none", borderRadius: 6, padding: "6px 16px",
            cursor: "pointer", fontWeight: 600, fontSize: 12,
          }}>Apply</button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          background: "#ff444412", border: "1px solid #ff444430",
          borderRadius: 8, padding: "10px 16px", color: "#f87171",
          fontFamily: "monospace", fontSize: 12,
        }}>⚠ {error}</div>
      )}

      {/* Feature grid */}
      <div style={{
        background: "#0a1525", border: "1px solid #1e293b", borderRadius: 10, overflow: "hidden",
      }}>
        <div style={{ padding: "11px 16px", borderBottom: "1px solid #0f1f35", color: "#334155", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase" }}>
          Feature Inputs · 78 network flow features (CIC-IDS2017)
        </div>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: 0,
          maxHeight: "60vh", overflowY: "auto", padding: "4px 0",
        }}>
          {filtered.map(({ name, i }) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "7px 14px", borderBottom: "1px solid #0a1525",
            }}>
              <span style={{ color: "#1e293b", fontFamily: "monospace", fontSize: 10, minWidth: 20, textAlign: "right" }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <span style={{ color: "#334155", fontSize: 11, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={name}>
                {name}
              </span>
              <input
                type="number"
                value={features[i]}
                onChange={e => handleChange(i, e.target.value)}
                placeholder="0"
                style={{
                  width: 80, background: features[i] !== "" ? "#0f1f35" : "#060d1a",
                  border: `1px solid ${features[i] !== "" ? "#1e3a5f" : "#0f1f35"}`,
                  borderRadius: 5, padding: "4px 8px",
                  color: "#94a3b8", fontFamily: "monospace", fontSize: 12,
                  outline: "none", textAlign: "right", transition: "border 0.2s, background 0.2s",
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Root App ──────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [logs, setLogs] = useState([]);
  const [online, setOnline] = useState(null);
  const [stats, setStats] = useState({ total: 0, threats: 0, unknown: 0, benign: 0 });
  const statsRef = useRef({ total: 0, threats: 0, unknown: 0, benign: 0 });

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/simulate`, { signal: AbortSignal.timeout(4000) });
      if (!res.ok) throw new Error("non-200");
      const data = await res.json();
      const predicted = data.predicted_attack;
      const confidence = data.confidence;
      const level = classifyThreat(predicted, confidence);
      const entry = {
        id: Date.now() + Math.random(),
        time: new Date().toLocaleTimeString("en-US", { hour12: false }),
        simulated: data.simulated_attack,
        predicted, confidence, level,
      };
      const s = { ...statsRef.current };
      s.total++;
      if (level === "BENIGN") s.benign++;
      else if (level === "UNKNOWN") s.unknown++;
      else s.threats++;
      statsRef.current = s;
      setStats({ ...s });
      setLogs(prev => [entry, ...prev].slice(0, MAX_LOGS));
      setOnline(true);
    } catch {
      setOnline(false);
    }
  }, []);

  useEffect(() => {
    poll();
    const id = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [poll]);

  const TABS = [
    { id: "dashboard", label: "Dashboard" },
    { id: "predict",   label: "Predict" },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=DM+Sans:wght@400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body, #root { height: 100%; }
        body { background: #060d1a; font-family: 'DM Sans', system-ui, sans-serif; color: #cbd5e1; -webkit-font-smoothing: antialiased; }
        @keyframes ping { 0% { transform: scale(1); opacity: 0.3; } 100% { transform: scale(2.5); opacity: 0; } }
        @keyframes slideIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
        .log-row { animation: slideIn 0.2s ease; }
        .log-row:hover td { background: #0f1f35 !important; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 2px; }
        input[type=number]::-webkit-inner-spin-button { opacity: 0; }
        input[type=number]:hover::-webkit-inner-spin-button { opacity: 0.5; }
      `}</style>

      <div style={{ maxWidth: 1140, margin: "0 auto", padding: "24px 20px", minHeight: "100vh", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* ── Top bar ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 0, flexWrap: "wrap", rowGap: 12 }}>

          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginRight: 28 }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 2L17 6V14L10 18L3 14V6L10 2Z" stroke="#38bdf8" strokeWidth="1.2" fill="none"/>
              <circle cx="10" cy="10" r="2.5" fill="#38bdf8" opacity="0.7"/>
            </svg>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 16, fontWeight: 500, color: "#e2e8f0", letterSpacing: "0.05em" }}>
              CyberWatch
            </span>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 2, background: "#0a1525", border: "1px solid #1e293b", borderRadius: 8, padding: 3 }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                background: tab === t.id ? "#1e293b" : "transparent",
                border: "none", borderRadius: 6,
                padding: "6px 18px", cursor: "pointer",
                color: tab === t.id ? "#e2e8f0" : "#334155",
                fontFamily: "'IBM Plex Mono', monospace", fontSize: 12,
                fontWeight: tab === t.id ? 500 : 400,
                letterSpacing: "0.04em",
                transition: "all 0.15s",
              }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Status */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#0a1525", border: "1px solid #1e293b", borderRadius: 8, padding: "7px 13px" }}>
            <PulseDot active={online === true} color="#4ade80" />
            <span style={{
              fontFamily: "'IBM Plex Mono', monospace", fontSize: 11,
              color: online === true ? "#4ade80" : online === false ? "#f87171" : "#334155",
              letterSpacing: "0.06em",
            }}>
              {online === true ? "Live" : online === false ? "Offline" : "Connecting…"}
            </span>
            {online === true && <span style={{ color: "#1e293b", fontSize: 10, marginLeft: 1 }}>· {API_URL}</span>}
          </div>
        </div>

        {/* ── Page content ── */}
        {tab === "dashboard"
          ? <DashboardPage logs={logs} stats={stats} online={online} />
          : <PredictPage />
        }

        {/* ── Footer ── */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", paddingTop: 6, borderTop: "1px solid #0a1525" }}>
          {Object.entries(SEV).map(([k, v]) => (
            <span key={k} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "#1e293b" }}>
              <span style={{ width: 5, height: 5, borderRadius: 1, background: v.color, display: "block" }} />
              {k}
            </span>
          ))}
          <span style={{ marginLeft: "auto", fontFamily: "monospace", fontSize: 9, color: "#0f172a" }}>
            threshold={CONFIDENCE_THRESHOLD} · poll={POLL_INTERVAL}ms
          </span>
        </div>

      </div>
    </>
  );
}