import { useState } from "react";
import { api } from "../api";
import { Callout, Card, SeverityBadge } from "../components/ui";
import { pct } from "../format";

export default function Predict({ features }) {
  const [values, setValues] = useState(() => Array(features.length).fill(""));
  const [sampleLabel, setSampleLabel] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");

  const reset = (next, label = null) => {
    setValues(next);
    setSampleLabel(label);
    setResult(null);
    setError("");
  };

  const loadSample = async () => {
    try {
      const s = await api.sample();
      reset(s.features.map(String), s.label);
    } catch (e) {
      setError(e.message);
    }
  };

  const applyPaste = () => {
    const vals = pasteText.trim().split(/[\s,]+/).filter(Boolean);
    if (vals.length !== features.length) {
      setError(`Expected ${features.length} values, got ${vals.length}.`);
      return;
    }
    reset(vals);
    setPasteOpen(false);
    setPasteText("");
  };

  const submit = async () => {
    const parsed = values.map(Number);
    if (values.some((v) => v.trim() === "") || parsed.some((v) => !Number.isFinite(v))) {
      setError(`All ${features.length} fields need a number.`);
      return;
    }
    setLoading(true);
    setError("");
    try {
      setResult(await api.predict(parsed));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const filled = values.filter((v) => v !== "").length;
  const visible = features
    .map((name, i) => ({ name, i }))
    .filter(({ name }) => name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Classify a flow</h1>
          <p>
            Enter the {features.length} flow features (CIC-IDS2017 format), or load a real flow from the
            held-out test set to see how the model handles it.
          </p>
        </div>
        <div className="toolbar">
          <button className="btn" onClick={loadSample}>Load test flow</button>
          <button className="btn" onClick={() => setPasteOpen((o) => !o)} aria-expanded={pasteOpen}>
            Paste values
          </button>
          <button className="btn" onClick={() => reset(Array(features.length).fill(""))}>Clear</button>
          <button className="btn btn-primary" onClick={submit} disabled={loading}>
            {loading ? "Predicting…" : "Predict"}
          </button>
        </div>
      </div>

      {error && <Callout tone="error">{error}</Callout>}

      {result && (
        <Card title="Result" tone="teal">
          <div className="result-card">
            <div>
              <div className="tile-label">Predicted</div>
              <div className="tile-value">{result.attack_type}</div>
            </div>
            <div>
              <div className="tile-label">Confidence</div>
              <div className="tile-value">{pct(result.confidence)}</div>
            </div>
            <div>
              <div className="tile-label">Severity</div>
              <div style={{ marginTop: 8 }}><SeverityBadge severity={result.severity} /></div>
            </div>
            {sampleLabel && (
              <div>
                <div className="tile-label">Actual label</div>
                <div className="tile-value" style={{ color: "var(--text-2)" }}>{sampleLabel}</div>
              </div>
            )}
          </div>
          {result.low_confidence && (
            <div style={{ marginTop: 16 }}>
              <Callout>Low confidence: the model is unsure about this flow. Treat the prediction with caution.</Callout>
            </div>
          )}
        </Card>
      )}

      {pasteOpen && (
        <Card title="Paste values" tone="amber" meta={`${features.length} numbers, comma or space separated, in the order below`}>
          <textarea className="input" rows={4} value={pasteText} onChange={(e) => setPasteText(e.target.value)}
            placeholder="80, 1234, 2, 0, …" aria-label="Feature values" />
          <div className="toolbar" style={{ marginTop: 12 }}>
            <button className="btn btn-primary" onClick={applyPaste}>Apply</button>
          </div>
        </Card>
      )}

      <Card
        tone="indigo"
        title="Features"
        meta={sampleLabel ? `Loaded test flow · ${filled}/${features.length} filled` : `${filled}/${features.length} filled`}
        flush
      >
        <div className="card-body" style={{ paddingBottom: 12 }}>
          <input className="input" style={{ width: "100%" }} type="search" placeholder="Filter features"
            value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Filter features" />
        </div>
        <div className="feature-grid">
          {visible.map(({ name, i }) => (
            <div className="feature-row" key={name}>
              <label htmlFor={`f-${i}`} title={name}>{name}</label>
              <input id={`f-${i}`} className="input" inputMode="decimal" value={values[i]} placeholder="0"
                onChange={(e) => {
                  const next = [...values];
                  next[i] = e.target.value;
                  setValues(next);
                  setSampleLabel(null);
                }} />
            </div>
          ))}
          {visible.length === 0 && <div className="empty">No feature matches “{search}”</div>}
        </div>
      </Card>
    </div>
  );
}
