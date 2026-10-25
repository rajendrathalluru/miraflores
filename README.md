# Miraflores workpaper

A local Next.js application for reviewing the fictional Okafor-Lindqvist 2025 tax packet. It keeps source evidence, reviewed adjustments, decisions, and approvals together. The original 74-document / 199-page / 3,012-value packet remains unchanged on the server. No tax return is transmitted.

## Run locally

Requires Node.js 22.13 or newer and npm. From this directory:

```sh
npm ci
npm run start:local
```

Open [the local workspace](http://127.0.0.1:3000). The helper runs ordinary Next.js development mode on loopback and enables the explicit local-preview persona workflow. A key, connected plugin, hosting account, and external database are not required.

SQLite and uploaded originals persist under `.local/` by default. SQL migrations run automatically once, recorded in the local migration ledger. Set `MIRAFLORES_DATA_DIR` to choose another private local directory. Keep that directory and ignored environment files out of source control.

To exercise the production build locally:

```sh
npm run build
npm run start:local -- --production
```

`npm run dev` and `npm start` also invoke standard Next.js directly on `127.0.0.1:3000`. The production server does not enable the local-preview access path unless `MIRAFLORES_LOCAL_PREVIEW=1` is explicitly set; the helper sets it only for its child process.

## Included workflows

- Overview, review queue, evidence library, return versions, activity, and settings.
- All supplied document pages and extracted fields, field highlights, reverse destinations, and calculation/source tracing.
- Sixteen curated source discrepancies, reconciliation problems, and judgment questions.
- Reason-required adjustments, separate estimated effects, undo, notes, drafted questions, and investigation outcomes.
- Role-enforced actions, independent review, invalidation after changes, simulated client approval, and immutable reviewed snapshots.
- Durable SQLite revisions and audit history, optimistic concurrency, masked identifiers, and JSON review export.
- Local private-file uploads and clearance-gated original downloads with view logs.
- Guided investigation without credentials, plus an optional bounded live AI tool loop and saved run history.

These are local application capabilities. The fictional role switcher is not production staff authentication.

## Optional live AI

The app works without an API key and labels that mode **Guided checks**. To enable live investigation, supply `OPENAI_API_KEY` in an ignored `.env.local` file, using the variable names in `.env.example`. `OPENAI_MODEL` is optional. No plugin is required. The key stays on the server; the browser has no key-entry field. See [AI setup](docs/AI_SETUP.md) for tool boundaries and mocked-test coverage.

## Verify

```sh
npm run check
```

This type-checks the app, compiles domain, investigation, and private-storage test suites into a fresh temporary directory, runs them, and removes that temporary output. Provider calls are mocked; it makes no external API requests.

With a local server running, `npm run test:api` exercises API persistence, permissions, tracing, and concurrent-write rejection. It creates labeled development records. See [development notes](docs/DEVELOPMENT.md) for details.

## Boundaries

This is an initial working increment, not the complete case-study submission or a filing-ready tax system. The supplied engine cannot be rerun: imported totals remain the baseline, while adjustments show labeled estimates. Findings are curated rather than a general extraction engine. All source identifiers are masked by default. Uploaded originals are not automatically extracted or rendered in the browser. Future scripted case evidence is browseable; a replay clock is not enforced.

Production work requires genuine authentication and firm memberships, a PostgreSQL/Supabase repository and storage adapter, and deployment operations. Those integrations are not implemented. Additional case-study scope includes full tax-area records, general adjustments and bulk actions, filing/rejection replay, amendments, notice-response packages, carryforward/planning, configurable standards and retention, and the required applicant video.

There is no hosted deployment or hosted URL in this implementation. It does not use OpenAI Sites hosting, Cloudflare Workers, D1, or R2. See [development notes](docs/DEVELOPMENT.md) for the standard Next.js and local SQLite architecture.

Original packet SHA-256: `ee01f8508bd2fd9854754b82fd9c4a055bdc55e2778a132002a25381c412ad19`.
