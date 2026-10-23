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
