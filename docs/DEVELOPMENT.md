# Local development

## Runtime and access

The application is Next.js App Router, React, TypeScript and lucide icons on Node.js 22.13 or newer, with Node's built-in SQLite API and private local files. Supported Node 22 releases may print a SQLite experimental-feature warning. The active scripts do not invoke Sites, Vinext, Vite, Wrangler, Workers, D1 or R2.

On a new checkout run `npm ci`, then `npm run start:local`. The helper binds to `http://127.0.0.1:3000` and sets `MIRAFLORES_LOCAL_PREVIEW=1` for its child process. Eight fictional personas share the local owner's workspace. Server-side commands enforce action roles; the role switcher is a demo mechanism, not proof of a staff member's identity. The production server rejects preview access unless explicitly enabled, and non-loopback hostnames are rejected.

| Command | Purpose |
|---|---|
| `npm run start:local` | Development server with explicit local-preview access |
| `npm run dev` | Standard Next development server on loopback port 3000 |
| `npm run build` | Standard Next production build |
| `npm run start:local -- --production` | Exercise the built app locally with preview access |
| `npm start` | Standard Next production server on loopback port 3000 |
| `npm run check` / `npm test` | Application typecheck and all offline suites |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint for authored application/domain/test files |
| `npm run test:api` | Integration checks against the running local server |

No public host or URL is provisioned. The production-preview helper does not make this deployment production ready.

## Persistence and commands

`lib/database.ts` opens `.local/workpaper.sqlite` by default, with WAL journal files. Sorted committed SQL migrations in `drizzle/` run once, recorded in `local_migrations`. Do not manually replay already applied SQL. `MIRAFLORES_DATA_DIR` relocates both the database and private files. The default `.local/`, generated output and environment files are ignored by Git; protect an override directory separately.

`lib/repository.ts` loads the revisioned workspace and commits through an expected-revision compare-and-swap. `lib/domain.ts` handles the original review commands; `lib/workflow.ts` handles the expanded workpaper operations. A material change, audit entry and approval invalidation share the same saved workspace revision. The API rechecks permission and input/reference validity; hiding a button is not the permission boundary. A stale writer receives a conflict rather than silently replacing newer work.

Workflow records include verification, document/area completeness, judgments and authority, evidence links, question/answer threads, assignments/notifications/last-seen revision, scenarios, adjustment batches, general numeric line overlays, reconciliations, original bindings, extensions/signatures/filing events, notices, carryforwards, planning, time and standards. General overlays preserve the original v3 line and require a reason plus explicit estimated federal/California effects; dependency calculations are not rerun.

Review gates include open notes, high-priority findings, document and area completeness according to current standards, independent reviewer/partner approval, client approval and current client authorizations. Material edits invalidate active sign-offs; signatures remain evidence but their content revision becomes stale. Frozen snapshots deep-copy the reviewed record and store a content hash. An amendment opens a new cycle referencing its frozen parent. Filing, rejection, resubmission and acceptance are state-checked simulations, not agency network operations.

The browser refreshes shared workspace state periodically; compare-and-swap remains the write boundary. This supports concurrent local sessions without claiming production identity, distributed collaboration or conflict-free merging. Persona selection is stored in a browser cookie.

Stop the application before a filesystem-level backup, or use a SQLite-aware backup. Preserve the database together with private files. A new private `MIRAFLORES_DATA_DIR` creates a separate development dataset.

## Evidence and detailed records

`data/packet.json` is byte-for-byte unchanged, server-only and never under `public/`. Its pinned SHA-256 is `ee01f8508bd2fd9854754b82fd9c4a055bdc55e2778a132002a25381c412ad19`. Source text, extracted readings and engine results can conflict; none silently replaces another.

`lib/packet.ts` returns masked documents/fields, source resolution and calculation graphs for all three versions. Reverse destinations include downstream calculated totals. Stable document/page/field references identify the exact supplied record. Source-viewer highlights are approximate reflowed-text excerpts. Repeated text is not assigned to its first occurrence, and the supplied synthetic coordinates are explicitly not original-page layout evidence.

`lib/records.ts` exposes complete supplied record groups: assets/depreciation (federal/CA/AMT), sales, business, rentals/passive losses, basis, state allocation, retirement/foreign, deductions/credits/limits, payments, carryovers, prior-year and prior-preparer history, household/related returns, client communications and reference data. Records are searchable/paginated; raw supplied values remain identifiable as supplied records. `lib/search.ts` searches source pages/fields, three-version return lines, client communications, prior-year/basis, related returns, assets and application-owned review records.

The supplied five `what_if.alternatives` are exact isolated scenario results against uncorrected v3. Saving a scenario stores rationale without changing the reviewed return. General adjustment estimates and separate alternatives must not be added together as a final tax result.

`lib/checks.ts` independently parses printed trip entries, detects repeated mileage sheets, groups duplicate bank-sweep evidence, sums all printed Meridian sale lots (including unread M18), totals IRS/FTB payment records, recomputes book arithmetic and a book-to-engine bridge, and compares California wage sources. `/api/checks` returns fourteen read-only checks with amounts, deltas, method, sources and statuses. Five checks agree, eight mismatch and one source-allocation comparison requires judgment for the unchanged packet. An agreement proves only the named comparison. Book arithmetic uses source-stated comparison amounts; the bridge deliberately exposes the engine's own treatments, and a sourcing candidate is not a final accepted allocation.

## Private originals and view logs

`lib/local-storage.ts` validates keys, maps them to opaque hashed filenames, writes a private temporary file and renames atomically. Uploaded bytes live under `.local/files/`; metadata/ownership remain in the database. The upload API accepts PDF, PNG, JPEG, text, CSV and JSON under 8 MB, registers an evidence record and uses workspace concurrency/role checks.

A cleared staff member can bind a registered private attachment to a supplied document while preserving its document/page/field identity. The source viewer can switch to an original PDF/image in a sandboxed frame or use the direct view/download link. JSON/text/CSV remain download-only. Synthetic source coordinates are not asserted to map to the uploaded original. Uploads are not automatically extracted, and binding an original does not itself verify its contents.

Original access is clearance checked, owner scoped and logged in `sensitive_views`. `/api/attachments/[id]?preview=1` permits inline MIME only for PDF/PNG/JPEG; other downloads are octet streams. Responses disable caching and sniffing and apply a restrictive sandbox CSP. The operations screen displays recent view logs. Imported source identifiers are masked by default; private originals and an explicit sensitive-source view are separate logged access paths.

For SSN, EIN, account-number and IP PIN fields, a cleared staff member can explicitly reveal the selected reading and printed page. `/api/sensitive-source` checks clearance on every request, logs the view and returns a no-store response. The source viewer hides revealed values after 60 seconds, on page/field/persona change, when the page becomes hidden and when the dialog closes. No automatic bootstrap/search/export includes these revealed values.

Cleared tax staff can submit source-backed identifier corrections through `/api/identifier-corrections`. The API validates the expected format, encrypts the value with AES-256-GCM using a fresh 12-byte IV and authenticated record identity, and atomically commits the encrypted row with the workspace revision/audit/approval invalidation. Only reference/ID/redacted-reason metadata enters the public workspace; neither plaintext nor a suffix is copied there. Direct public command requests cannot create phantom correction records. Decryption requires a new explicit cleared, logged request. The original packet is never changed.

The randomly generated 32-byte protection key is an owner-only `identifier-key.bin` file in the private data directory. Preserve that key with a protected database backup: losing it makes stored corrections unreadable. A local file key protects this prototype's correction values at rest; it is not a production KMS or substitute for genuine identity and host access controls. Masked exports include correction metadata rather than silently exposing protected values.

## Export and post-filing records

- `/api/export`: development JSON review export. This is distinct from the full examination package.
- `/api/client-copy`: readable HTML preview with supplied v3 totals, separate estimated effects, adjustments, approvals, authorizations, questions and simulated status. It is not a filed Form 1040.
- `/api/exam-package`: self-contained offline HTML, containing all 74 source documents/199 pages/3,012 fields, all 1,877 lines across three versions, rules/assets/carryovers/diagnostics, complete masked supporting packet, workspace/history and private original bytes. Attachments have SHA-256 manifests; the canonical masked record has its own digest. Passive JSON and escaped HTML avoid executing document content. No running server or external assets are needed to inspect it.

The examination package rejects missing original files and a total original payload over 64 MB. Client personas cannot export it; private originals require clearance and create view logs. The source packet and review prose are masked, but embedded original bytes remain exact and can contain sensitive material.

Notice responses link evidence. A 2026 handoff preserves supplied carryovers/assets/basis and review history, with a warning to reconcile reviewed overlays before next-year preparation. Planning saves assumptions/decisions beside the packet's supplied safe-harbor and due-date references; it does not compute a 2026 return.

Season replay stores a selected supplied event and returns a **read-only availability context** filtered by event time: available documents, engine versions and events. It does not rewind current workspace decisions or restrict every other screen to historical time. Future scripted acceptances, payments and notices remain distinguishable from current v3 and from actual user-recorded simulation events.

## Optional AI

Guided checks require no credential and are labeled as deterministic case checks. Optional live investigations use `OPENAI_API_KEY` in ignored `.env.local` or the process environment; `OPENAI_MODEL` is optional. No plugin or hosting service is required. Never put a real key in source control, `.env.example`, browser input or chat.

The server calls the OpenAI Responses endpoint with masked inputs and bounded read-only evidence tools. A person still accepts any proposed change through the domain workflow. Read [AI setup](AI_SETUP.md). Mocked offline tests do not prove real-account connectivity; a live provider call has not been demonstrated in this verification.

## Verification

`scripts/run-checks.mjs` type-checks the application, compiles the offline test suites into a fresh temporary CommonJS package, runs them and removes only that temporary output:

1. Domain permissions, source references, immutability, masking, revisions, undo, approval invalidation, independent review and frozen snapshots.
2. Guided and mocked-live investigation paths, citations, budgets, masking and safe fallback.
3. Private local storage bytes, key validation and private access behavior.
4. Supplied CPA record groups and packet projections.
5. Independent source/calculation-graph/masking acceptance across all document destinations and source fields.
6. Independent expanded-workflow acceptance, including permissions, completeness, invalidation and lifecycle state transitions.
7. Independent offline-package acceptance: complete packet/context, valid anchors, passive escaped data, record/attachment hashes, exact originals and client-copy boundaries.
8. Independent source-arithmetic comparisons and exact reconciliation results.
9. Persisted evidence search, stable references, masking and read-only behavior.
10. Protected identifier validation, concurrent private-key initialization, encryption roundtrip, authenticated metadata, tamper detection, redaction and permission denial.

Use `node scripts/run-checks.mjs --unit-only` to skip application typechecking while iterating on a server adapter. It needs no `tsx`, browser, app server, AI key or network. The packet hash is always checked; optional byte comparison to the original source folder runs when that path exists.

`npm run test:api` requires a running loopback server (`MIRAFLORES_TEST_URL` may select another loopback URL). It writes labeled development records, tests concurrent writes and role rejection, uploads a synthetic file, checks cleared-only byte-for-byte access and may store a guided investigation. Use a disposable data directory when review-state preservation matters. Run `npm run lint` and `npm run build` separately; standalone tracing includes the packet and SQL migrations.

## Remaining production and submission work

There is no hosted URL. Production identity/firm membership/isolation, PostgreSQL or Supabase/private object-storage adapters, deployment operations, backup/recovery and production load/security validation remain. This project does not deploy to OpenAI Sites, and a GitHub source push alone does not host an app.

Administrator settings record review gates, budget, variance thresholds and retention years. Retention policy is not a scheduled records-destruction/legal-hold system. Qualitative usability acceptance by an experienced CPA and a new hire has not been demonstrated. The applicant must record the walkthrough and provide an accessible video link and running app link; the supplied script is not that recording.

The simplified source engine cannot be rerun and does not compute California AMT. General overlays, sensitivity estimates and isolated what-if results remain distinct from an exact combined final tax return. Simulated authorizations and agency events are not legally effective e-file signatures or actual IRS/FTB transmissions. These boundaries are part of the review record, not evidence that every line of the case brief is already complete.
