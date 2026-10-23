# AGENTS.md: insider-quant-dashboard

The frontend for the Ninefifteen paper-trading engine: Vite + React, deployed on Vercel. **Paper trading only, with no proven edge.** The engine and its API live in the `insider-quant-engine` repo, and its `AGENTS.md` is the source of truth for the API.

## Routes
The routes use a query string and a hash only, never a path. `vercel.json` has no SPA fallback, so a path route would 404. The rules and their tests are in `src/route.ts` and `tests/route.test.mjs`.

| URL | View |
|---|---|
| `/` | **New dashboard** (`src/redesign/App2.tsx`); the default since 2026-10-23 |
| `/?view=classic` | Classic dashboard (`src/ClassicApp.tsx`) |
| `/#classic` | Classic dashboard |
| `/#new`, `/?view=new` | New dashboard (old links keep working) |

`?view=` wins over the hash, so `/?view=classic#new` shows the classic dashboard. Unknown values fall back to the new one.
- **Links between the views:**
  - The classic view has "Back to new dashboard" (`/`), in the desktop sidebar and the phone header.
  - The new view has "Classic view" (`?view=classic`), in the desktop sidebar and, below 1024px, a footer.

## The new dashboard (`src/redesign/`)
| File | Role |
|---|---|
| `tokens.css` | Design system v2: colour, 4 px spacing, radius, elevation, type scale, glass cards, motion keyframes, layout (bottom nav on phone, sidebar from 1024 px, auto-fit grid, masonry), 44 px touch targets, `prefers-reduced-motion` guard |
| `format.ts` | ₹, R and % formatting with sign and arrow (never colour alone), Indian grouping, IST clock, market state, 15:15 countdown. Tested in `tests/format.test.mjs` |
| `logic.ts` | Pure data shaping: stop-to-target progress, implied price, cumulative R and ₹ series, ranges, per-detector rows with a small-sample flag (n < 30), filter funnel, heat tiles. Tested in `tests/logic.test.mjs` |
| `data.ts` | Data hooks. The existing endpoints, plus `/api/signals` and `/api/health` (engine PR #24), each re-read every 30 s |
| `motion.tsx`, `ui.tsx`, `Sparkline.tsx` | Count-up, change flash, skeleton, staggered reveal; empty states and trade rows; a tiny SVG sparkline |
| `charts.tsx` | Hand-built SVG charts, loaded only with the views that use them: equity curve (R or ₹, ranges, crosshair tooltip, arrow-key stepping), detector bars (n on every row, small-sample chip), filter funnel, signal timeline (outcome shown by shape as well as colour), heat tiles |
| `App2.tsx` | Shell (top bar, state banner, nav), Today, Positions, trade drawer |
| `views/*View.tsx` | Signals (timeline, funnel, heat tiles, feed), History (equity curve, detector bars, heatmap, list, CSV) and Health, lazy-loaded |

**Rules:**
- Real data only; a view that needs data the API lacks says so and lists an API request.
- Every P&L view says paper.
- No external network calls; fonts are bundled.
- Charts are hand-built SVG. Recharts is used only by the classic view, so it's bundled only into the classic chunk.
- **API requests (not done here):**
  - the watchlist with day change per symbol, so the heat tiles can colour the whole watchlist;
  - the Nifty level and day change for the top bar;
  - a `since`/`limit` on `/api/trades/history`, which is capped at 200;
  - publish `ticksPer5m`;
  - the filter's score breakdown per trade, for the trade drawer.

## API access, kept as is
- **`src/apiBase.ts`, `resolveApiBase()`:** on an HTTPS page, an `http://` `VITE_API_URL` is ignored and the relative `/api` route is used, through the Vercel rewrite in `vercel.json`. This avoids mixed content.
- **The event stream gets cut:** the rewrite closes `/api/events` after about 151 s. Both views therefore re-read today's data every 30 s, and the new view also re-reads after a reconnect.
- Don't change `vercel.json`, the env vars or the API contract from this repo.

## Deployment
- Three Vercel projects build from `main`: `insider-quant-dashboard-nz36` (it owns **ninefifteen.vercel.app**, the owner's site), `insider-quant-dashboard` and `insider-quant-dashboard-fk2a`.
- A merge to `main` deploys all three. Previews sit behind Vercel login.
- **Merges that deploy happen only outside 09:00-15:30 IST**, unless the owner explicitly says otherwise.
- **To roll back a merge:** `git revert -m 1 <merge-sha>` on `main`, then push. That redeploys the previous behaviour.

## Checks
- `npx tsc` must report 0 errors. `npm run build` runs `tsc && vite build`; in PowerShell 5 run the two steps separately.
- `npm test` must pass (node:test).
- There's no linter in this repo.
