import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  Callout, Card, CheckIcon, ConfidenceMeter, CrossIcon, SeverityBadge, StatTile,
} from "../components/ui";
import { API_URL } from "../api";
import { pct } from "../format";

// What went right or wrong for one event, from a security point of view.
function outcome(e) {
  if (e.correct) return "Correct";
  if (e.simulated === "BENIGN") return "False alarm";
  if (e.predicted === "BENIGN") return "Missed attack";
  return "Wrong attack type";
}

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { name, count } = payload[0].payload;
  return (
    <div className="card" style={{ padding: "6px 10px" }}>
      <div className="strong">{name}</div>
      <div className="meta">{count} events</div>
    </div>
  );
}

function PredictedChart({ events }) {
  const counts = {};
  events.forEach((e) => { counts[e.predicted] = (counts[e.predicted] || 0) + 1; });
  const data = Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  if (data.length === 0) return <div className="empty">No events yet</div>;
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 32 + 24)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 40, bottom: 0, left: 0 }}>
        <CartesianGrid horizontal={false} stroke="var(--grid)" />
        <XAxis type="number" allowDecimals={false} tick={{ fill: "var(--text-3)", fontSize: 12 }}
          axisLine={{ stroke: "var(--grid)" }} tickLine={false} />
        <YAxis type="category" dataKey="name" width={130} tick={{ fill: "var(--text-2)", fontSize: 12 }}
          axisLine={false} tickLine={false} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--surface-2)" }} />
        <Bar dataKey="count" fill="var(--chart-1)" radius={[0, 4, 4, 0]} barSize={16} isAnimationActive={false}>
          <LabelList dataKey="count" position="right" fill="var(--text-2)" fontSize={12} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function EventTable({ events, paused }) {
  if (events.length === 0) {
    return <div className="empty">{paused ? "Stream paused. Press Start stream to replay test flows." : "Waiting for events…"}</div>;
  }
  return (
    <div className="table-wrap" style={{ maxHeight: 420 }}>
      <table>
        <thead>
          <tr>
            <th>Time</th>
            <th>Actual traffic</th>
            <th>Predicted</th>
            <th>Confidence</th>
            <th>Severity</th>
            <th>Result</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => {
            const result = outcome(e);
            return (
              <tr key={e.id}>
                <td className="mono">{e.time}</td>
                <td>{e.simulated}</td>
                <td className="strong">{e.predicted}</td>
                <td><ConfidenceMeter value={e.confidence} low={e.lowConfidence} /></td>
                <td><SeverityBadge severity={e.severity} /></td>
                <td>
                  <span className={`result${e.correct ? "" : " result-bad"}`}>
                    {e.correct ? <CheckIcon /> : <CrossIcon />}
                    {result}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function Dashboard({ events, stats, online, paused, onTogglePause, maxEvents }) {
  const accuracy = stats.total ? pct(stats.correct / stats.total) : "—";

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Live detection</h1>
          <p>
            Replays network flows from the held-out test set, which the model never saw in training.
            The sample is balanced, so attacks appear far more often than in real traffic.
          </p>
        </div>
        <button className={`btn${paused ? " btn-primary" : ""}`} onClick={onTogglePause}>
          {paused ? (stats.total ? "Resume stream" : "Start stream") : "Pause stream"}
        </button>
      </div>

      {online === false && (
        <Callout tone="error">
          Can't reach the CyberWatch API at <span className="mono">{API_URL}</span>. Check that the backend is running on
          that address (set it with VITE_API_URL in frontend/.env). {events.length > 0 && "Showing the last events received."}
        </Callout>
      )}

      <div className="tiles">
        <StatTile label="Events analysed" value={stats.total} icon="activity" tone="indigo" />
        <StatTile label="Session accuracy" value={accuracy} sub={`${stats.correct} of ${stats.total} correct`} icon="target" tone="teal" />
        <StatTile label="Attacks flagged" value={stats.flagged} icon="alert" tone="amber" />
        <StatTile label="Missed attacks" value={stats.missed} sub="Attack predicted as benign" icon="eyeOff" tone="indigo" />
        <StatTile label="False alarms" value={stats.falseAlarms} sub="Benign predicted as attack" icon="bell" tone="teal" />
        <StatTile label="Low confidence" value={stats.lowConfidence} sub="Below threshold" icon="help" tone="amber" />
      </div>

      <div className="grid-2">
        <Card title="Predicted class" meta={`last ${events.length} events`} tone="teal">
          <PredictedChart events={events} />
        </Card>
        <Card title="Errors this session" meta="what the model got wrong" tone="amber">
          <ErrorSummary events={events} />
        </Card>
      </div>

      <Card title="Event log" meta={`${events.length} / ${maxEvents} most recent`} flush tone="indigo">
        <EventTable events={events} paused={paused} />
      </Card>
    </div>
  );
}

function ErrorSummary({ events }) {
  const errors = events.filter((e) => !e.correct);
  if (errors.length === 0) {
    return <div className="empty">{events.length ? "No misclassifications in the recent events" : "No events yet"}</div>;
  }
  const groups = {};
  errors.forEach((e) => {
    const key = `${e.simulated}→${e.predicted}`;
    groups[key] = groups[key] || { actual: e.simulated, predicted: e.predicted, kind: outcome(e), count: 0 };
    groups[key].count++;
  });
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr><th>Actual</th><th>Predicted as</th><th>Type</th><th className="num">Count</th></tr>
        </thead>
        <tbody>
          {Object.values(groups).sort((a, b) => b.count - a.count).map((g) => (
            <tr key={`${g.actual}-${g.predicted}`}>
              <td>{g.actual}</td>
              <td className="strong">{g.predicted}</td>
              <td>{g.kind}</td>
              <td className="num">{g.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
