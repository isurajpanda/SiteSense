# SiteSense — Presenter Demo Script (~5 minutes)

## Before you start

```bash
npm install
npm run dev
```

Open http://localhost:5173. The simulation pre-generates 7 days of history, so charts and the scrubber work immediately. Wait ~10 seconds for the first alerts to fire.

---

## 1. The HUD — "A live view of the whole estate" (60s)

- **KPIs** (top-left): people on site, campus AQI (indicative), bins above 80%, open reports, parking occupancy, energy right now. Numbers count up live.
- **Ticker** (bottom): scrolling events. **LIVE** indicator blinks.
- **Top bar**: site switcher, role switcher, simulated clock, day/night toggle, play/pause + 1×/5×/20× speed, "Simulated data" badge.
- **Left rail**: layer toggles with live counts.
- **Right rail**: Live Alerts feed + Action Centre.
- Point out the **"Demo layout: illustrative building positions, simulated data"** badge — honesty first.

## 2. The red pulse — bin overflow story (90s)

1. Click **"Trigger event"** (top-left) — a red pulse appears on **Girls Hostel (Block C)**.
2. Click the pulse (or the alert in the feed) → camera flies to the building, drawer opens.
3. Show the **bin forecast chart** (24h history + 6h forecast band) and the **"Why this fired"** panel: observed vs expected, threshold, confidence, assumptions.
4. Go to the **Action Centre** (right rail): *"Reroute waste collection to Hostel C first…"*
5. Click **Accept** → toast confirms. Switch to **Operations** (`/ops`) → the task appears in the Kanban **New** column, and the audit timeline logs the acceptance.

## 3. Air quality layer (45s)

1. Toggle **Air Quality** in the left rail → coloured circles appear per building (CPCB India bands: Good → Severe).
2. Focus the **Canteen** — the lunch PM2.5 hotspot is visible.
3. The Action Centre shows the **air-quality advisory** draft for hostels. Expand it to show rationale + assumptions.

## 4. Scenario simulator — Fest weekend (60s)

1. Go to `/scenarios`.
2. Click the **Fest weekend** preset → before/after comparison bars appear (parking, waste, energy all spike).
3. Show the **alerts it would trigger** and the **recommendations it would issue**.
4. Try the **Heatwave** preset → cooling energy and water spike.
5. Click **Reset to live** → clean return to baseline (the live simulation is untouched).

## 5. Student phone view → Ops resolution (60s)

1. Go to `/report` (works best in a phone-sized viewport).
2. **3 taps**: pick "Waste overflow" → pick "Canteen and Food Court" → Submit.
3. Note the **tracking ID** (e.g. `SSR-X7K2`) and the status tracker.
4. Go back to the HUD — the report pin appears on the map (Citizen Reports layer).
5. Switch role to **Operations** (top bar) → the report is in the **Citizen Reports Queue**. Change status to **Resolved**.
6. Back in `/report` → the tracker shows **Resolved**; the reporter can thumbs-up.

## 6. Sustainability scorecard (45s)

1. Go to `/sustainability`.
2. Show sub-scores, trend sparklines, overall grade.
3. Click **"How this is calculated"** → weights are editable; drag a weight and watch the overall score change.
4. Show the **CO₂e** estimate (grid factor stated) and **waste diversion**.
5. Click **Export CSV** → downloads a client-generated summary.

## 7. Assumptions & method (30s)

1. Go to `/about`.
2. Walk through: simulated data, simulator design, models, explainability, privacy (DPDP/GDPR), limitations.
3. The **"Decision-support insights, not official measurements"** disclaimer appears on every screen footer.

## 8. Config-driven proof — hospital template (30s)

1. In the top bar, switch the site to **City General Hospital**.
2. The same HUD re-renders: wards, ICU, OT, bio-medical waste store, diagnostic labs — different building types, different sensors, same dashboard.
3. This proves the app is facility-agnostic: swap one config file, run any estate.

---

## Shortcuts for presenters

| Action | How |
|---|---|
| Auto-run steps 1–3 | **Demo tour** button (top-left) |
| Force the hostel bin story | **Trigger event** button |
| Jump to any building | Click an alert, or type in **Ask SiteSense** ("bin", "air", "parking", "energy") |
| Replay history | **Replay 24h** scrubber (bottom) |
| Change role | Top bar role switcher (persisted) |
| Change site | Top bar site switcher (persisted) |
| Reseed simulation | Settings → Reseed (regenerates all history with a new seed) |

## Ask SiteSense (LLM)

Type a question in the Ask SiteSense box (e.g. "what's the waste situation?"). The app streams a response from the configured OpenAI-compatible endpoint with live site context. If the endpoint is down, it falls back to rules-based navigation and shows a toast.
