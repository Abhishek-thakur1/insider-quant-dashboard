# Changelog

Newest first.

## 2026-10-23: UI polish stage 2, part 1 (`feat/ui-stage2`; preview only, not merged)
- **Design system v2** (`tokens.css`): spacing, type, radius and elevation scales; glass cards; motion keyframes; mobile-first layout with 44 px touch targets and safe-area insets; reduced-motion support.
- **Tested logic:** `format.ts` and `logic.ts`, with 15 new tests (24 in total).
- **Shell:**
  - top bar: market (open, pre-open, closed, holiday), IST clock, stream state, last update, PAPER;
  - a state banner for closed, holiday, weekend, pre-open, reconnecting and error;
  - five sections: Today, Positions, Signals, History, Health.
- **Today:**
  - count-up stat cards with sparklines and a change flash;
  - a visible data-quality note;
  - open-position cards with a stop-to-target bar, an entry tick and a 15:15 countdown;
  - staggered trade lists and intentional empty states.
- **Signals:** every fire with its score against the threshold, the outcome (alerted, passed, or rejected at which gate), regime and flags. From `/api/signals`.
- **Health:** coarse engine status with an explanation, stocks seen, last Nifty candle, and the user's stream state. From `/api/health`.
- **History:** moved into a lazy view; charts arrive in part 2.
- **First-load JS:** 136.0 → 138.7 kB gzipped (+2.6 kB).

## 2026-10-23: redesign is the default (`feat/redesign-default`)
- `/` now shows the new dashboard. The classic one is at `/?view=classic`, and `/#classic` also works. `/#new` still opens the new one. `?view=` wins over the hash. The rules are in `src/route.ts`, with 5 tests in `tests/route.test.mjs`.
- Classic gets a "Back to new dashboard" link. The new view's link is renamed "Classic view", and phones get a footer copy of it.
- No change to the API, `vercel.json`, env vars, the HTTPS API fallback or the 30 s refresh.
- Added `AGENTS.md` and this changelog.

## Earlier on 2026-10-23 (PRs #1-#6, #2)
These are reconstructed from the PR history.
- **#1, re-applied as #5:** the closed-trade modal shows "not recorded" instead of invented levels.
- **#4:** HTTPS pages ignore an `http://` API URL and use the `/api` route, fixing mixed content.
- **#6:** a 30 s polling fallback, because the `/api` rewrite cuts the event stream at about 151 s.
- **#2:** redesign stage 1 at `#new`, with the classic view kept as the default.
