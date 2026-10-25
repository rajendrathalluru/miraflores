# Miraflores workpaper

A local Next.js workpaper for the fictional Okafor-Lindqvist 2025 tax case. It connects source evidence, supplied calculations, human decisions and review history. The original 74-document / 199-page / 3,012-value packet remains unchanged. Filing and signature workflows are simulations; no return is transmitted.

## Run locally

Requires Node.js 22.13 or newer and npm. From this directory:

```sh
npm ci
npm run start:local
```

Open [the local workspace](http://127.0.0.1:3000). No AI key, connected plugin, hosting account or external database is required. SQLite and private uploaded files persist under ignored `.local/`; committed SQL migrations run automatically once. `MIRAFLORES_DATA_DIR` can select another private data directory.

To preview the production build locally:

```sh
npm run build
npm run start:local -- --production
```

The helper binds to loopback and sets `MIRAFLORES_LOCAL_PREVIEW=1` for its child process. Ordinary `npm run dev` and `npm start` also bind to `127.0.0.1:3000`; a production server rejects the persona-preview access path unless explicitly enabled. This is a local demonstration access model, not production identity verification.

## Included workflows

- Overview, source-backed review queue, evidence library, return versions, CPA records, operations, activity and settings.
- All three supplied engine versions, recursive calculation traces, exact document/page/field references, and direct plus downstream document destinations.
- Simulated source pages distinguish printed content from pipeline readings. Selected fields expose stable references and synthetic locators; approximate excerpts never imply verified original layout.
- Sixteen curated findings, reason-required adjustments, general numeric v3 line overlays, estimated effects, individual undo and atomic bulk adjustment/undo.
- Per-value verification methods, document/area completeness, structured judgments/elections/due diligence/penalty decisions with authority, outside-filing records and linked evidence.
- In-app questions and responses, assignments/deadlines, personal notifications, changes since last seen, time against budget and administrator-managed review standards.
- Detailed supplied records for assets/depreciation, sales, business, rentals/passive losses, basis, state allocation, retirement/foreign items, deductions/credit limits, payments, carryovers, prior-year/prior-preparer history and related returns. Search spans source pages, fields, calculations, communications and review records.
- Five exact precomputed what-if comparisons and saved scenario rationale; fourteen independent, read-only arithmetic/reconciliation checks against printed evidence and agency records.
- Role-enforced decisions, independent review, approval invalidation, simulated client approval/e-file authorization, frozen snapshots, filing/rejection/resubmission/acceptance records and linked amendment cycles.
- Notice-response records, 2026 carryforward handoff with history, saved planning decisions and a read-only season replay context showing which documents/versions/events were available by the selected event.
- Private evidence uploads, original-to-source binding, clearance-gated PDF/image previews or downloads, explicit logged identifier reveal, and encrypted source-backed identifier corrections.
- JSON review export, readable client copy, and a self-contained offline examination HTML package containing all supplied sources/calculations/context plus uploaded originals within the package limit.
- Durable SQLite revisions/audit, optimistic concurrency, masked source identifiers, guided investigations without credentials and optional bounded live AI investigations.

See [development notes](docs/DEVELOPMENT.md) for precise data and workflow boundaries. A frozen reviewed overlay is not a claim that the supplied engine totals equal a final corrected return.

## Optional live AI

Without a key the app labels its mode **Guided checks**. To enable optional live investigations, set `OPENAI_API_KEY` in ignored `.env.local`, using the variable names in `.env.example`; `OPENAI_MODEL` is optional. The key stays on the server. No plugin is required. See [AI setup](docs/AI_SETUP.md). Offline mocked tests do not establish real-account connectivity, and a live provider call has not been demonstrated as part of this verification.

## Verify

```sh
npm run check
npm run lint
npm run build
```

`npm run check` type-checks the app and runs ten offline suites: domain, investigation, private storage, CPA records, independent source/graph/masking acceptance, complete-workflow acceptance, offline-package acceptance, independent arithmetic checks, persisted-evidence search and protected-identifier encryption. Provider calls are mocked; no external API request is made.

With a local server running, `npm run test:api` exercises persistence, roles, tracing, concurrency and private-file access. It creates labeled development records; use a disposable development data directory when preserving a particular review state matters. See [development notes](docs/DEVELOPMENT.md) for test coverage.

## Submission materials and remaining boundaries

- [Initial line-by-line requirements audit](docs/REQUIREMENTS_AUDIT.md) records 105 atomic requirements before the gap-closing work. Its initial statuses are not the final verification result.
- [Independent verification results](docs/VERIFICATION.md) record the final status and supporting checks for every requirement, including remaining user-dependent work.
- [One-page core idea and data model](docs/CORE_IDEA.md).
- [Errors and how the design surfaced them](docs/ERROR_FINDINGS.md).
- [Applicant walkthrough script and tools/AI disclosure](docs/VIDEO_WALKTHROUGH.md). The applicant recording and accessible video link are still required.

There is no hosted deployment or shared public app URL. Pushing this repository to GitHub stores the source; it does not deploy the running application. This project does not use OpenAI Sites hosting.

Production work still requires genuine authentication/firm memberships, production database/private-storage adapters, deployment operations and backup/recovery. The fictional role switcher is not production authentication. Retention settings record policy; scheduled destruction/legal-hold operations are not implemented. Season replay is an availability read model; it does not rewind current decisions or lock all other screens to historical time. Carryforward/planning preserve supplied data and decisions, rather than prepare a computed 2026 return. Uploaded originals are not automatically extracted.

The packet's simplified engine cannot be rerun and does not compute California AMT. Baseline totals remain separate from reviewed estimates and exact isolated what-if outputs; these cannot be combined into an asserted final return. Simulated signatures and agency events are not legally effective authorization or actual IRS/FTB transmission. Qualitative acceptance by an experienced CPA/new hire, a public deployment, the applicant's recorded video and real-account AI connectivity still require their own validation.

Original packet SHA-256: `ee01f8508bd2fd9854754b82fd9c4a055bdc55e2778a132002a25381c412ad19`.
