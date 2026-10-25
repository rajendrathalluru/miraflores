# Local development

## Runtime and access

The active application is standard Next.js App Router on Node.js, with React, TypeScript, and lucide icons. It uses Node's built-in SQLite API and local private files. Node.js 22.13 or newer is required; SQLite may print an experimental-feature warning in supported Node 22 releases.

From the `workpaper` directory, use `npm ci` on a new checkout, then `npm run start:local`. The current development checkout may already have dependencies installed. The active scripts do not invoke Sites, Vinext, Vite, Wrangler, Workers, D1, or R2.

The local helper starts Next.js at `http://127.0.0.1:3000`, binds only loopback, and sets `MIRAFLORES_LOCAL_PREVIEW=1` for its child process. The role switcher selects fictional staff/client personas inside the local development owner's workspace. Server-side domain checks enforce each role; hiding a button is not the permission boundary. This is development access, not verified staff identity or production authentication.

| Command | Purpose |
|---|---|
| `npm run start:local` | Development server with explicit local-preview access |
| `npm run dev` | Standard Next development server on loopback port 3000 |
| `npm run build` | Standard Next production build |
| `npm run start:local -- --production` | Exercise the built app locally with preview access |
| `npm start` | Standard Next production server on loopback port 3000 |
| `npm run check` / `npm test` | Application typecheck and three offline test suites |
| `npm run typecheck` | TypeScript check without tests |
| `npm run lint` | ESLint for authored application/domain/test files |
| `npm run test:api` | Integration tests against the running local server |

The production server rejects development-preview access unless explicitly enabled. The helper's `--production` option is for local build testing; it does not make the application production ready. No public host or URL is provisioned.

## Persistence

`lib/database.ts` provides the SQLite adapter. The default database is `.local/workpaper.sqlite`, with WAL journal files when in use. It applies committed `.sql` migrations from `drizzle/` in sorted order, once each, tracked in `local_migrations`. Startup handles migration execution; do not manually replay already applied SQL.

`lib/local-storage.ts` stores private uploaded bytes under `.local/files/`. Validated object keys map to opaque hashed filenames rather than filesystem paths. Writes use a private temporary file and atomic rename. Metadata and ownership remain in the database. The API controls authorized access, size limits, content handling, and view logging.

Set `MIRAFLORES_DATA_DIR` to relocate both database and private files. The default `.local/`, generated output, and environment files are ignored by Git. If an override points elsewhere, protect and back up that directory separately; this repository's ignore rules do not cover arbitrary external paths.

Workspace writes go through `lib/repository.ts` and the immutable reducer in `lib/domain.ts`. Expected-revision checks prevent a session from silently replacing another's newer decision. Commands append audit history; material changes invalidate active approvals. Frozen simulations retain deep-copied reviewed state and a content hash. A freeze does not recompute a return or submit anything to an agency.

For a separate development dataset, point `MIRAFLORES_DATA_DIR` to a new private directory before starting. Preserve an existing database together with its uploaded files if its evidence/history matters. Stop the process before a filesystem-level backup of a SQLite store, or use a SQLite-aware backup procedure.

## Optional environment configuration

The application works without a language-model credential. Guided checks are deterministic lookups of the supplied case and are labeled accordingly.

For optional live investigation, set `OPENAI_API_KEY` in ignored `.env.local`, or supply it through the process environment. `OPENAI_MODEL` selects a supported model for that integration. Do not put a real credential in `.env.example`, source control, a browser field, or chat. Next.js loads `.env.local`; no plugin or hosted provisioning service is mandatory.

The live module calls the OpenAI Responses endpoint from the server. Its tools are read-only packet/trace/check/document reads, with masked evidence and bounded request budgets. A human preparer still accepts any proposed adjustment through the domain workflow. Read [AI setup](AI_SETUP.md) before enabling it. Offline tests mock provider calls and do not prove real-account connectivity.

## Source and application boundaries

`data/packet.json` is the supplied packet copied byte for byte. Server code imports it; it is never put in `public/` or overwritten by adjustments. Pinned SHA-256: `ee01f8508bd2fd9854754b82fd9c4a055bdc55e2778a132002a25381c412ad19`.

- `lib/contracts.ts`: browser-safe serializable types.
- `lib/packet.ts`: masked server reads, metadata, evidence resolution, source index, calculation graphs.
- `lib/issues.ts`: curated findings, exact source references, explicit estimate methods.
- `lib/domain.ts`: decisions, undo, notes, investigation outcomes, independent approvals, filing gate.
- `lib/repository.ts`, `lib/database.ts`, `lib/local-storage.ts`: local persistence and future adapter boundaries.
- `lib/agent.ts`: guided investigation and optional live read tools.
- `app/api/`: access/input validation and calls to the domain/repository.

Only contracts and public response data should enter client components. Imported source text and user-entered evidence are untrusted data, not application/model instructions. Source identifiers are masked even for cleared personas; authorized original-file downloads are a separate logged workflow.

The packet has three engine snapshots plus future scripted events. v3 is its defined current engine snapshot. Later acceptances, payments, quality review, and examination records are replay material, not proof that a particular numerical reviewed return was filed.

## Checks

`scripts/run-checks.mjs` type-checks the application, compiles `scripts/test-domain.ts`, `scripts/test-agent.ts`, and `tests/scripts/test-storage.ts` with the installed TypeScript compiler into a fresh temporary CommonJS package, runs all three, and removes only that temporary output. It needs no `tsx`, browser, running app, API key, or network. To run the unit suites while changing a server adapter: `node scripts/run-checks.mjs --unit-only`.

Domain tests cover curated source references/lines, all-version source resolution, permissions, stale revisions, masking, undo, reopening an investigation, review independence, invalidation, and blocked/frozen filing. They always check the imported packet's pinned hash. A byte comparison to the original user folder also runs when that folder exists on the current machine.

Investigation tests exercise guided source paths and mocked live loops, citations, budgets, masking, denial, and safe fallback. They reject accidental external requests.

API tests require a local server. Their default is loopback; `MIRAFLORES_TEST_URL` may specify another loopback URL. They write labeled development notes, resolve the test note, upload a labeled text fixture, verify cleared-only byte-for-byte download, and may store a guided run. Use a disposable development data directory if the current workspace should stay untouched.

Run `npm run build` separately to validate Next.js output. Standalone build tracing includes the source packet and SQL migrations. Local database files, uploads, and `.env.local` are not public assets.

## Production work remaining

This increment has no hosted deployment. The planned broader-firm application requires real authentication/authorization and a PostgreSQL/Supabase database and private-storage adapter; those production integrations are not implemented. A fictional persona cookie is not proof of a staff member's identity.

Production work also includes memberships/isolation, live collaboration, migration/deployment operations, backup/recovery, standards/retention controls, and the remaining case-study workflows listed in the README. The supplied tax engine cannot be rerun: baseline values plus estimated overlays must never be presented as an exact recalculated filing-ready return.
