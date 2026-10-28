# A number is a connected review object

A traditional workpaper makes the reviewer rebuild the context. This IDE keeps it attached to the number. Six clear destinations organize the engagement, while the X-ray Inspector shows the source page, exact extracted field, supplied computation, verification method and audit trail without losing the current view. A compact season timeline and dynamic version selector make time and provenance explicit.

The default unit of trust is a supported human conclusion, not an extraction confidence score. Independent source checks and inherited engine diagnostics are labeled separately. An adjustment records the original, reviewed value, category, conversion factor, reason, source references, author and estimated Federal/California effects. It never rewrites the engine. Unknown basis remains unknown. Tax-effect estimates and isolated supplied what-if results are not presented as recomputed final tax.

## Data model

`clients` identify households; `engagements` identify a client/year/content-digest baseline. The raw packet is immutable JSONB, read dynamically for document identities, arbitrary version labels, lines, assets and roles. Identical imports reopen the same engagement; different content creates a new baseline.

`workpaper_adjustments` stores polymorphic target keys and complete overlay history. `review_records` stores typed, engagement-scoped questions, judgments, evidence, assignments, links and approvals. `audit_events` records each committed action. The engagement's current review state is a transactional projection; the normalized records and audit update in the same transaction. `attachments` stores private evidence bytes and integrity metadata. `command_receipts` binds actor, request identity and payload to a committed revision.

Every mutation validates role and expected revision on the server, then commits state, audit and receipt atomically. A stale edit retains its draft and requires explicit acknowledgment of the current context. An interrupted response can be reconciled before retrying the same request identity. Approvals bind to content hashes; changed material reopens review. Filing gates enforce completeness and approvals, and a frozen snapshot becomes the immutable parent of an amendment.

The local prototype uses embedded Postgres; a shared adapter supports server-side Supabase/Postgres without changing the review model. Default responses mask identifiers. Client and examiner projections omit internal workpaper conversations. The fictional role switcher demonstrates permissions and is deliberately not sold as authentication.

## Tradeoffs

The implementation favors a complete local review loop over external integrations: no OCR, tax engine, live AI, email, legal e-signature or agency connection is claimed. Files remain linked by stable packet references so an original source can be attached without replacing the trace. A real hosted release still needs trusted identity, tenant policies, operational recovery, observed CPA/new-hire usability, and the applicant's own walkthrough video.
