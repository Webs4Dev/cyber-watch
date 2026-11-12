# CyberWatch design system: "Midnight teal"

**Brief:** an operator console for watching a network-attack classifier. Mood: confident, modern, trustworthy.
Deep navy base with three brand colours (teal, indigo, amber). Dark only. Dense: tables over decoration.

## Principles
- **Three brand colours, each with a job.** Teal is the primary (active tab, primary button, focus, main chart series, "correct"). Indigo is the secondary (second chart series, header gradient, alternating card and tile accents). Amber is for highlights and attention (low confidence, callouts, flagged counts).
- **Severity has its own fixed colours** (green / yellow / orange / red) and always appears with a text label. Never use a brand colour to mean severity.
- Spread the three colours evenly across tiles and cards, so no single colour dominates.
- Numbers are the interface: big stat values, aligned table columns (`tabular-nums`), monospace only for raw feature values and timestamps.
- No neon glow, no glyph icons. Icons are simple 16px line SVGs in `components/ui.jsx`.

## Tokens (defined in `src/index.css`)
| Role | Token | Value |
|---|---|---|
| Page | `--bg` | `#0b1220` (plus two faint indigo/teal radial glows at the top) |
| Card | `--surface` | `#111a2e` |
| Raised (hover, inputs) | `--surface-2` | `#18233b` |
| Hairline border | `--border` | `rgba(148,163,184,0.14)` |
| Primary text | `--text` | `#e6edf7` (14.7:1 on card) |
| Secondary text | `--text-2` | `#b6c2d6` (9.6:1) |
| Muted text | `--text-3` | `#8494ad` (5.6:1) |
| Gridline | `--grid` | `#1f2b45` |
| Brand 1 | `--teal` | `#2dd4bf` (soft: 12% alpha) |
| Brand 2 | `--indigo` | `#818cf8` (soft: 14% alpha) |
| Brand 3 | `--amber` | `#fbbf24` (soft: 12% alpha) |
| Chart series 1 / 2 | `--chart-1` / `--chart-2` | `#14a394` / `#6d72f0` (darker steps, validated for colour blindness on the card surface) |
| Severity | `--sev-none` / `--sev-medium` / `--sev-high` / `--sev-critical` | `#0ca30c` / `#fab219` / `#ec835a` / `#d03b3b` |

Chart fills use `--chart-*`, not the bright UI colours: large bright areas glare, and the bright pair fails the lightness band.
The two chart colours separate well, but for one colour-vision type they sit in the "needs labels" band. So two-series charts always get a legend and value labels.

## Type
System UI sans (`system-ui, -apple-system, "Segoe UI", sans-serif`): native-tool feel, no web-font download. Monospace: `ui-monospace, "SF Mono", Menlo, monospace`.
Scale: 12 (meta) · 13 (body, tables) · 14 (controls) · 16 (brand) · 22 (page title) · 28 (stat values). Headings weight 650. Never smaller than 12px.

## Spacing, radius, motion
- 4px grid: 4 · 8 · 12 · 16 · 20 · 24 · 28.
- Radius: 6px controls, 8px icon chips, 10px cards, 999px badges and pills.
- Motion: 120ms colour/background transitions only. Respect `prefers-reduced-motion`.

## Components
- **Header**: gradient shield mark (teal → indigo), active tab in teal on teal-soft, and a 2px teal → indigo → amber rule underneath.
- **Card**: navy surface, hairline border, 10px radius. The title has a 3px accent bar in the card's `tone` (`teal` | `indigo` | `amber`).
- **Stat tile**: label plus a tinted icon chip in the tile's tone, then the value at 28px and an optional sub-line.
- **Severity badge**: dot in the severity colour plus a text label on `--surface-2`.
- **Table**: 13px, sticky header, hairline row dividers, numbers right-aligned.
- **Buttons**: primary = teal with dark ink (`#042f2e`, 7.8:1). Secondary = surface with a border that turns indigo on hover. Focus ring is teal.
- **Callout**: amber-soft background with an amber left bar. The error variant uses a red bar.
- **Charts** (Recharts): solid hairline grid, axes in `--text-3`, bars with 4px rounded ends, value labels at bar ends, legend above whenever there are two or more series.

## Landing page (`pages/Landing.jsx`)
The one place allowed to be more expressive than the console:
- Display title at 64px (48px under 900px), with "Watch" in a teal → indigo → amber gradient.
- Faint 40px grid behind the hero, faded out with a radial mask.
- Hero figure: an inline SVG of the pipeline (flow features → decision trees → vote → verdict), labelled as simplified.
  Looping motion is limited to this figure (packets travelling along the edges, the highlighted verdict cycling) and the eyebrow dot.
  It uses brand colours only, never severity colours, and no glow.
- All animation is switched off under `prefers-reduced-motion`.
- Every number on the page comes from `/model-info`; nothing is hardcoded.
