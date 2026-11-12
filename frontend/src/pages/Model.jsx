import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, SeverityBadge, StatTile } from "../components/ui";
import { pct } from "../format";

function F1Tooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="card" style={{ padding: "6px 10px" }}>
      <div className="strong">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="meta">{p.name}: {p.value.toFixed(3)}</div>
      ))}
    </div>
  );
}

// F1 per class for the served model vs the comparison model (two series, so legend + value labels).
function F1Chart({ info }) {
  const data = info.classes.map((c) => ({
    name: c,
    served: info.model.per_class[c]["f1-score"],
    comparison: info.comparison.per_class[c]["f1-score"],
  }));
  const fmt = (v) => v.toFixed(2);
  return (
    <>
      <div className="legend">
        <span><i style={{ background: "var(--chart-1)" }} />{info.model.name}</span>
        <span><i style={{ background: "var(--chart-2)" }} />{info.comparison.name}</span>
      </div>
      <ResponsiveContainer width="100%" height={data.length * 44 + 30}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 44, bottom: 0, left: 0 }} barGap={2}>
          <CartesianGrid horizontal={false} stroke="var(--grid)" />
          <XAxis type="number" domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]} tick={{ fill: "var(--text-3)", fontSize: 12 }}
            axisLine={{ stroke: "var(--grid)" }} tickLine={false} />
          <YAxis type="category" dataKey="name" width={130} tick={{ fill: "var(--text-2)", fontSize: 12 }}
            axisLine={false} tickLine={false} />
          <Tooltip content={<F1Tooltip />} cursor={{ fill: "var(--surface-2)" }} />
          <Bar dataKey="served" name="Random forest" fill="var(--chart-1)" radius={[0, 4, 4, 0]} barSize={12} isAnimationActive={false}>
            <LabelList dataKey="served" position="right" formatter={fmt} fill="var(--text-2)" fontSize={11} />
          </Bar>
          <Bar dataKey="comparison" name="Neural network" fill="var(--chart-2)" radius={[0, 4, 4, 0]} barSize={12} isAnimationActive={false}>
            <LabelList dataKey="comparison" position="right" formatter={fmt} fill="var(--text-3)" fontSize={11} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </>
  );
}

export default function Model({ info }) {
  const m = info.model;
  const cmp = info.comparison;
  const trained = new Date(info.trained_at).toLocaleString();

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Model performance</h1>
          <p>
            {m.name}, evaluated once on {info.split_sizes.test.toLocaleString()} held-out flows. Trained {trained}.
          </p>
        </div>
      </div>

      <div className="tiles">
        <StatTile label="Accuracy" value={pct(m.accuracy, 2)} sub="Dominated by benign traffic" icon="target" tone="teal" />
        <StatTile label="Macro F1" value={m.macro_f1.toFixed(3)} sub="Every class weighted equally" icon="layers" tone="indigo" />
        <StatTile label="False alarm rate" value={pct(m.benign_false_alarm_rate, 2)} sub="Benign flows flagged as attacks"
          icon="bell" tone="amber" />
        <StatTile label="Low confidence" value={pct(m.low_confidence_share, 2)}
          sub={`Confidence below ${info.confidence_threshold}`} icon="gauge" tone="teal" />
      </div>

      <div className="grid-2">
        <Card title="Why this model" meta={`same split, vs ${cmp.name}`} flush tone="indigo">
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Metric</th><th className="num">Random forest (served)</th><th className="num">Neural network</th></tr>
              </thead>
              <tbody>
                <tr><td>Accuracy</td><td className="num strong">{pct(m.accuracy, 2)}</td><td className="num">{pct(cmp.accuracy, 2)}</td></tr>
                <tr><td>Macro F1</td><td className="num strong">{m.macro_f1.toFixed(3)}</td><td className="num">{cmp.macro_f1.toFixed(3)}</td></tr>
                <tr><td>False alarm rate</td><td className="num strong">{pct(m.benign_false_alarm_rate, 2)}</td><td className="num">{pct(cmp.benign_false_alarm_rate, 2)}</td></tr>
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Data notes" tone="amber">
          <ul style={{ margin: 0, paddingLeft: 18, color: "var(--text-2)", display: "grid", gap: 6 }}>
            <li>{info.features.length} features after dropping {info.dropped_columns.length} constant or duplicated columns.</li>
            <li>Duplicate and conflicting rows removed before splitting, so no flow appears in both training and test data.</li>
            <li>Split: {info.split_sizes.train.toLocaleString()} train · {info.split_sizes.val.toLocaleString()} validation · {info.split_sizes.test.toLocaleString()} test.</li>
            <li>Classes with very few test flows (Heartbleed, Infiltration) have unreliable scores.</li>
            {info.dropped_classes.length > 0 && <li>Too rare to train: {info.dropped_classes.join(", ")}.</li>}
          </ul>
        </Card>
      </div>

      <Card title="F1 by class" meta="higher is better · test set" tone="teal">
        <F1Chart info={info} />
      </Card>

      <Card title="Per-class results" meta={`${m.name} · test set`} flush tone="indigo">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Class</th>
                <th>Severity</th>
                <th className="num">Precision</th>
                <th className="num">Recall</th>
                <th className="num">F1</th>
                <th className="num">Test flows</th>
              </tr>
            </thead>
            <tbody>
              {info.classes.map((c) => {
                const r = m.per_class[c];
                return (
                  <tr key={c}>
                    <td className="strong">{c}</td>
                    <td><SeverityBadge severity={info.severity[c] ?? "medium"} /></td>
                    <td className="num">{r.precision.toFixed(3)}</td>
                    <td className="num">{r.recall.toFixed(3)}</td>
                    <td className="num">{r["f1-score"].toFixed(3)}</td>
                    <td className="num">{r.support.toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
