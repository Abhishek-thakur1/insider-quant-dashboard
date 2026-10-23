# Redesign stage 1: evidence (23 Oct 2026)

All of this was captured from a **local build** (`vite build`, then `vite preview` over http) that reads the production API read-only. The data is **22 Oct 2026**, real paper trades.

**Why not the Vercel preview?** The Vercel build bakes in `VITE_API_URL=http://<EC2>:8080`. From an HTTPS page, browsers block those calls as mixed content, so no data loads. This also affects the current production dashboard, and has done since before this work. The fix is the owner's decision: remove `VITE_API_URL` from the Vercel environment, so the app uses the relative `/api` proxy.

## Screenshots
There are 18, covering 3 views (Today, Positions, History) × 3 widths (phone 390 px, tablet 820 px, desktop 1440 px) × 2 themes. The file names are `stage1-<theme>-<width>-<view>.png`.
- No width scrolls sideways.
- No JavaScript errors.
- One request per page fails after the date switch. That's the live stream closing when the view moves off "today", which is expected.

**Figures shown match the database for 22 Oct:**
- gated P&L −₹252.00 (−2.04R, 3 trades);
- all recorded −₹226.15 (11 closed);
- win rate 0/3, with "n = 3, small sample".

## Lighthouse 12.2.1 (local build)
| Profile | Performance | Accessibility | Best practices | FCP | LCP | TBT | CLS |
|---|---|---|---|---|---|---|---|
| Mobile | 90 | 100 | 82 | 2.4 s | 3.3 s | 0 ms | 0.008 |
| Desktop | 100 | 100 | 81 | 0.6 s | 0.7 s | 0 ms | 0.004 |

- The only best-practice failure is `is-on-https`, because the local server is http.
- Lighthouse needed `--max-wait-for-load=20000`, because the live stream and the 2.5 s P&L poll keep the network busy.

## Bundle
First-load JS is about 418 kB, against 766.6 kB on `main`. The chart (355 kB) and the classic dashboard (35 kB) are lazy-loaded.

## Live-update check
Scheduled for about 10:07 IST on 23 Oct (market hours, read-only). The result is added to PR #2 when it runs.
