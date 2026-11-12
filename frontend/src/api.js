export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, { signal: AbortSignal.timeout(8000), ...options });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.detail || `Server returned ${res.status}`);
  return body;
}

export const api = {
  simulate: () => request("/simulate", { signal: AbortSignal.timeout(4000) }),
  modelInfo: () => request("/model-info"),
  sample: () => request("/sample"),
  predict: (features) =>
    request("/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ features }),
    }),
};
