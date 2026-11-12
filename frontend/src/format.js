export const SEVERITY = {
  none: { label: "Benign", color: "var(--sev-none)" },
  medium: { label: "Medium", color: "var(--sev-medium)" },
  high: { label: "High", color: "var(--sev-high)" },
  critical: { label: "Critical", color: "var(--sev-critical)" },
};

export const pct = (v, digits = 1) => `${(v * 100).toFixed(digits)}%`;
