# SiteSense — Estate Intelligence Dashboard

An AI-style decision dashboard for facility and estate management. **Frontend-only demo**: a client-side IoT simulator generates live sensor-style data, and small TypeScript models do anomaly detection and forecasting — all in the browser.

> **Demo site:** Trident Academy of Technology, Bhubaneswar, Odisha (Plus Code 8RR5+44).
> **Hackathon:** Cognizant · Team Vintage · BH26PS04T004.

> ⚠️ **All data is simulated.** Building footprints are illustrative rectangles, not surveyed polygons. Outputs are **decision-support insights, not official measurements**.

---

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
```

Other scripts:

```bash
npm run build      # type-check + production build
npm run preview    # serve the production build
npm run lint       # ESLint
npm run test       # Vitest unit tests (43 tests)
npm run format     # Prettier
```

## What's inside

| Area | Highlights |
|---|---|
| **Command Centre (`/`)** | Dark 2.5D MapLibre HUD: extruded buildings coloured by status, pulsing alert markers, layer toggles (air/occupancy/waste/traffic/reports/energy), live KPI strip, alert feed, event ticker, 24h time scrubber, day/night toggle, simulation speed (1×/5×/20×), demo tour. |
| **Building drawer** | Per-building tabs (Overview + one per sensor) with 24h history, 6h forecast band, and a **"Why this fired"** explainability panel (observed vs expected, threshold, window, confidence, assumptions). |
| **Anomaly detection** | Rolling z-score (32-pt window, EWMA baseline, z=3) + simplified isolation-forest-style multivariate score. Cooldown dedupe per sensor. |
| **Forecasting** | Holt-Winters additive (24h seasonality) with 1.28σ prediction interval; seasonal-naive fallback. Bin overflow ETA from fill-rate trend × time-of-day multiplier. |
| **Recommendation engine** | Rules + forecasts + plain-language templates (no LLM). 8 recommendation types with rationale, assumptions, owner role, confidence. Accept → creates an Ops task + audit log entry. |
| **Action Centre** | Open recommendations with Accept / Dismiss / Snooze. |
| **Scenario simulator (`/scenarios`)** | 5 presets (Fest weekend, Exam day, Heatwave, Bad air day, Monsoon) + custom sliders. Before/after comparison, projected alerts and recommendations. Never corrupts the live baseline; "Reset to live" restores. |
| **Ops view (`/ops`)** | Kanban task board, waste route planner, citizen reports queue, audit timeline, shift summary. |
| **Citizen reporting (`/report`)** | Mobile-first 3-tap flow: category → location → submit. Tracking ID, status tracker (Received → Assigned → In progress → Resolved), anonymous by default, localStorage persistence, seed reports. |
| **Sustainability (`/sustainability`)** | Scorecard (Air/Waste/Energy/Water/Mobility/Resilience), editable weights, CO₂e estimate (configurable grid factor), waste diversion, climate resilience card, CSV export. |
| **Assumptions & method (`/about`)** | Simulated data, simulator design, models, thresholds, limitations, privacy stance (DPDP Act 2023 / GDPR-aware, aggregate-only). |
| **LLM-assisted insights** | Ask SiteSense box streams responses from an OpenAI-compatible endpoint (`http://127.0.0.1:8083/v1/chat/completions`) with live site context. Rules + forecasts + templates remain the backbone; the LLM is an optional layer. |

## Architecture

```
src/
  app/                 App shell, routing, providers, sim tick loop
  components/
    ui/                shadcn-style components (Button, Card, Badge, Tabs, Sheet, …)
    hud/               TopBar, LayerRail, AlertFeed, ActionCentre, Ticker, TimeScrubber, KpiStrip, CornerFrame
    map/               CampusMap (MapLibre), useMapLayers
    charts/            TimeSeriesChart, ForecastChart, Sparkline, ComparisonBars
    building/          BuildingDrawer + tabs
    explain/           WhyThisFired
  config/
    sites/             trident.ts, hospital.ts  ← the whole site is one typed file
  lib/
    sim/               prng, clock, generators, scenarios, anomalyInjector
    models/            anomaly.ts, forecast.ts, eta.ts
    reco/              engine.ts, templates.ts, llmProvider.ts, llmContext.ts
    geo/               projection.ts (metersToLngLat, polygonFromRect, GeoJSON helpers)
    scoring/           scorecard.ts
  store/               useSimStore, useReportStore (persist), useSettingsStore (persist)
  pages/               Command, Ops, Sustainability, Scenarios, Report, About
  types/               domain.ts — all domain types
```

### Data flow

1. `useSimStore.init(siteId)` generates **7 days of 15-minute history** for every sensor via deterministic, seeded generators, then injects scheduled demo anomalies (hostel bin overflow, canteen PM2.5 spike, night water leak, after-hours energy anomaly, parking surge).
2. A `setInterval` in `App.tsx` calls `tick()` every 2s ÷ speed. Each tick appends one point per sensor, runs anomaly detection, updates KPIs, and re-runs the recommendation engine.
3. The map reads memoized GeoJSON from `useMapLayers()`; charts read slices of `history`. Scrubbing sets `scrubTime`, which filters all series to that instant.

### Adding a new facility template

1. Copy `src/config/sites/trident.ts` → `src/config/sites/my-facility.ts`.
2. Change `id`, `name`, `center` (verify against the Plus Code on Google Maps), `mapStyle`, `buildings` (id/name/type/polygon/height/capacity/sensors), `roads`, `bins`, `parkingLots`, `gates`, `thresholds`, `emissions`, `scoring`, `scenarioDefaults`.
3. Add it to the `SITES` array in `src/config/sites/index.ts`.

No dashboard code changes — the HUD, map, models, charts and pages are all config-driven. The hospital template (`hospital.ts`) proves this: different building types (wards, ICU, OT, bio-medical waste) render on the same dashboard.

### Simulator design

- **Seeded PRNG** (mulberry32) → reproducible demos. "Reseed" in settings regenerates history.
- **Signals**: PM2.5 (diurnal peaks + spike events + source offsets), temperature/humidity, timetable-driven occupancy, meal-time bin fill with collection rounds, occupancy/temperature-driven energy & water, class-change traffic, congestion index.
- **Injected demo anomalies** guarantee a story: Hostel C bin overflow ~16:00, canteen PM2.5 spike at lunch, Hostel B night water leak, CS Labs after-hours energy anomaly, pre-event parking surge. "Trigger event" button re-fires the hostel surge.

### Models

- **Anomaly**: rolling z-score, window 32 (≈8h), EWMA α=0.3, threshold z=3, 2h cooldown per sensor. Isolation-forest-style score (12 shallow trees, random-axis splits) for multivariate ranking — documented as illustrative.
- **Forecast**: Holt-Winters additive, season=96 (24h), α=0.35/β=0.08/γ=0.12, interval = 1.28σ·√(1+h/96). Horizon 1–6h.
- **Bin ETA**: linear fill-rate over last 16 points × time-of-day multiplier (meal times faster, nights slower).

### LLM integration

`src/lib/reco/llmProvider.ts` implements `LLMProvider` with an OpenAI-compatible client (streaming + non-streaming). `enableRemoteLLM()` is called at startup; the Ask SiteSense box streams responses with live site context. If the endpoint is unreachable, the UI falls back to rules-based navigation and shows a toast. The recommendation engine itself remains rules + forecasts + templates — the LLM is an optional insight layer, clearly labelled.

## Privacy

- Occupancy is **aggregate-only** — never individuals.
- Reports are **anonymous by default**, stored only in localStorage.
- No backend, no analytics, no third-party calls. DPDP Act 2023 / GDPR-aware by design.

## Known limitations

- Forecasts are short-horizon (1–6h) and assume recent patterns persist.
- The isolation-forest-style score is a simplified ranking heuristic, not a production model.
- Scenario projections are first-order multipliers, not physics-based.
- The sustainability scorecard is a heuristic composite, not a certified audit.
- Map tiles need network access; the app degrades to an offline basemap when tiles fail.
- Building footprints are illustrative rectangles, not surveyed polygons.
- The hospital template is a simpler preview (fewer buildings, no roads beyond a ring).

## Tests

43 unit tests cover: PRNG determinism, z-score detection, cooldown dedupe, forecast shape/interval sanity, bin ETA, scorecard maths, and rule-engine outputs for waste/air/parking/leak/traffic/escalation/crowd scenarios.

## Screenshots

<!-- TODO: add screenshots here -->
