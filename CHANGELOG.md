# Changelog

Newest first.

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
