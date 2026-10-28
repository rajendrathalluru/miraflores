# Miraflores — Tax Workpaper IDE

An evidence-first review workspace built from the architectural design and supplied assignment. Immutable pipeline output, a persistent working overlay, an exact-source inspector, and accountable human decisions.

## Run locally

Requires Node.js 22.13 or newer.

```sh
npm install
npm run dev
```

Open http://127.0.0.1:3000. If another app already uses that port:

```sh
node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3200
```

The first run imports the delivered packet unchanged. An embedded Postgres database is created in `.local/postgres`. No Supabase account, Docker, AI key, or separate database installation is required. Keep the data directory to preserve reviews. Do not run two processes against the same embedded database directory.

## Architecture

- Next.js 16 App Router, React 19, TypeScript.
- Locally bundled Inter Variable and Geist Mono; custom responsive components, native accessible dialogs, Lucide icons. No runtime font/CDN requests.
- Postgres via PGlite locally; the same transactional SQL adapter supports a dedicated Supabase/Postgres connection through server-side `DATABASE_URL`.
- Immutable packets and content digests per engagement; relational adjustments, review records, audit events, private attachments, and idempotent command receipts.
- Server-side role policies, masked default projections, client/examiner data separation, expected-revision compare-and-swap, explicit conflict acknowledgment, frozen snapshots and content-bound approvals.

The [submission package](docs/HAND_IN.md) includes a verified one-page PDF, error analysis and recording guide. Read [the core idea and model](docs/CORE_IDEA.md), [errors and evidence](docs/ERRORS_FOUND.md), and [implementation/verification boundaries](docs/IMPLEMENTATION.md).

## Import another client

Use **Import a packet**. Compatible pipeline JSON must provide the packet/household identity, document pages, extracted values, firm roles and computed return versions described in the delivered packet README. Version labels and counts are dynamic; the acceptance test imports five arbitrarily named versions for a second client. This imports structured pipeline output, not arbitrary PDFs or a new tax calculation. Files uploaded in Document Index are linked evidence and do not run OCR.

A content-identical import reopens its existing saved review. A different packet creates a separate immutable engagement rather than silently overwriting work. Changing engagements selects that packet's default demo preparer.

## Supabase / hosted Postgres

Copy `.env.example` to `.env.local`, provide `DATABASE_URL`, then start the app. The server creates a private `miraflores` schema automatically and uses it for remote connections. Use a dedicated database or schema, and a server-only connection credential; never expose it through `NEXT_PUBLIC_*`. Embedded data is not automatically migrated when switching providers. The SQL schema is in [docs/schema.sql](docs/schema.sql).

The app is an assignment demo with a fictional role switcher. Real staff authentication, tenant membership, trusted client identities, storage/backup operations and deployment verification are still required before shared use. The demo opens without workspace credentials; anyone with its URL can use the fictional roles. The role switcher is a demonstration of application permissions, not identity proof. Do not expose a raw Supabase database through anonymous grants; use RLS with authenticated membership before a public deployment. The configured Supabase session pooler has passed connection, packet read, JSON write/read and transaction rollback checks.

## Checks

```sh
npm run check
npm run format:check
npm run build
```

API tests mutate their target. Run them only against a disposable database/server:

```sh
WORKPAPER_DATA_DIR=/tmp/miraflores-qa MIRAFLORES_DIST_DIR=.next-qa \
  node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3201
# In another terminal:
TEST_URL=http://127.0.0.1:3201 node tests/api.mjs
```

Production preview: `npm run build` then `npm start -- --port 3200`. Use a persistent database volume and one local process, or a properly configured hosted Postgres database, for durable deployment.

## Honest boundaries

Tax effects are first-order estimates using the supplied version's rates, not an engine rerun or certified corrected return. Generic numeric overlays require an explicit tax-effect category and taxable-income conversion factor. What-if alternatives are supplied engine scenarios, isolated from the working overlays. Filing, approval and signature records are simulations; no return, message, payment, or email is sent externally. Historical engine output is immutable. Timeline replay shows supplied engine/document availability, not a historical reconstruction of every live review-state mutation.

No live AI service is called. AI assisted development; checks and tax-effect arithmetic in the running app are deterministic. Original source images were not supplied; the inspector renders printed JSON content and labels synthetic coordinates honestly. Private binary attachments require sensitive-data clearance to download; the database and backups require deployment-level encryption/access protection. This is a working prototype, not a professional tax or production-security certification.

## Deployment

Docker and Compose configuration are included for Linux container hosts, with a native Vercel configuration as an alternative. See [deployment instructions](docs/DEPLOYMENT.md) for secrets, commands, health checks and platform limits.

## Completed audit follow-up

See [completion verification](docs/COMPLETION_VERIFICATION.md) for direct payment/credit effects, source/asset review edits, shared firm policy, unread changes, expanded independent checks, reconciliations, complete archive recovery/carryforward, and printable client/notice records. Extended API checks run only against disposable databases:

```sh
TEST_URL=http://127.0.0.1:3204 node tests/completion-api.mjs
TEST_URL=http://127.0.0.1:3204 node tests/lifecycle-api.mjs
```
