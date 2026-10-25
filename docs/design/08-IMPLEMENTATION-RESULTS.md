# Implemented review-first design

October 24, 2026. This records the implementation following the five-agent debate. The PDF remains the feature contract. This is a local prototype release; shared hosting, the applicant's video and observed CPA/new-hire usability remain outstanding.

## What changed

- Five primary destinations: Review, Return, Evidence, Team, Filing & next year. Review controls, approvals/history, firm standards/time and every existing record/tool category remain reachable through secondary navigation.
- A functional Queue / Evidence & computation / Human decision workspace. It supports findings, documents and arbitrary return numbers; shows exact stable source/page/field identity, simulated printed content, extraction confidence, supplied computation and independent checks; and records verification, decisions, blocking notes, assigned questions and document dispositions.
- A revision-consistent `GET /api/review-context` projection with packet digest, engine version, edit/content revisions, cycle, frozen parent/hash and replay context. Coverage counts come from the same captured state, including five seeded outside filings on untouched state.
- Captured-revision writes and structured conflict details. Ordinary drafts remain in scoped memory across polling and navigation; changed facts require deliberate acknowledgment. Historical versions and replay disable financial decisions within the selected review context, with an explicit replay exit even when the selected version was not yet available. Current-v3 Operations remain a separate surface; there is no global server-wide replay write lock.
- Actor/body-bound command receipts committed atomically with state, audit and approval invalidation. Interrupted responses expose an unconfirmed state; status reconciliation precedes explicit retry using the same identity. Actor guards reject another-tab persona changes for commands, uploads and protected corrections.
- Separate draft/save/freshness states and visible refresh errors. Protected values clear on hide, timeout, dismissal, conflict and access changes; they never follow ordinary draft restoration. Successful protected writes immediately refresh the shared view.
- Exact captured export manifests with mandatory attachment hashes and correction metadata. Later uploads/corrections cannot silently enter an earlier declared revision. Bytes are verified outside the short database snapshot transaction.
- Readable sales, asset, business, state and basis views, retaining complete underlying records. Supplied results, human overlays and tax-effect estimates stay distinct; absent history stays unknown.
- Global source/decision search; URL-restorable issue/document/number selections; guarded Back/Forward and form dismissal; stacked accessible dialogs and a keyboard-aware mobile navigation drawer.
- Sage/ivory visual tokens, readable financial detail, persistent case/revision context, desktop simultaneous panes and narrow-screen pane tabs.

## Evidence actually obtained

| Check | Result and scope |
|---|---|
| `npm run check` | Passed after integration: application type-check plus the ten existing offline suites and two new context/receipt/export suites. The source suite traverses 1,877 supplied graphs, 3,012 field refs and 222 document/version maps; this is broader than checking 16 curated findings. Provider calls are mocked. |
| `npm run lint` | Passed cleanly after the final actor/cycle draft-isolation correction. |
| `scripts/test-review-api.mjs` against isolated port 3100 | Passed captured context, historical/replay read-only and exit, concurrent exact retries, request/body/actor binding, status reconciliation, structured stale conflicts, scoped client decisions and denied actor-mismatched private writes with no revision advance. |
| Existing `scripts/test-api.mjs` against isolated port 3100 | Passed prior packet/source/masking/tracing, concurrency, roles/gates, records/checks/search, uploads/private bytes, protected corrections/reveal, examination export and client-copy behavior. |
| Real browser: decision persistence | Selected duplicate mileage; opened D23 page 3 / ev-0404; confirmed 3,700 extracted miles versus 11,800 supplied miles; wrote a source-backed rationale in disposable data; moved to Team and back with draft retained; saved at revision 9; reloaded and saw the saved decision. No original packet edit or engine rerun. |
| Real browser: dialogs | Global search found 23 mileage matches; a source opened above search; Shift+Tab stayed in the source dialog; Escape closed only that layer and returned focus to its search reference; a second Escape closed search. |
| Real browser: form navigation | A Team question draft displayed unsaved state. Browser Back raised the guard; Cancel kept the Team view and exact entered draft. The test draft was then cleared without saving. |
| Production browser: role-owned drafts | Entered a disposable Team question as Priya, observed Draft · not saved, switched to Daniel, and observed an empty question field and no saved question or revision advance (r13 retained). The actor/cycle remount was observed; the role-change confirmation guard was code-inspected because the automated select action did not expose a confirmation dialog. External poll role/cycle clearing was not separately browser exercised. |
| Real browser: generic/historical navigation | Selected SchC.9 from Numbers; URL contained `ref=SchC.9`; reload restored the same computation. Switching to v1 displayed its immutable/read-only explanation. |
| Real browser: detailed records | Asset records displayed method/life/bonus/disposal and Federal/CA/AMT comparison. Sales showed 318 total records / 302 imported lots; page two retained 302 as the full-population count. State view showed aligned A-E columns and explicit unsupplied values. |
| Desktop breakpoint: 1440 × 1000 | All three panes visible together; no document-level horizontal overflow; persistent header/context and complete coverage counts visible. |
| Mobile breakpoint: 390 × 844 | One selected pane visible; switching to Decision succeeded; no document-level horizontal overflow; header controls did not overlap. Closed navigation is inert; opening focuses its current destination; Escape closes and restores the navigation trigger. Temporary viewport override reset after testing. |
| Production build | `MIRAFLORES_DIST_DIR=.next-redesign npm run build` passed after the final actor/cycle correction: compilation, TypeScript, static generation and route output succeeded. The resulting loopback production preview was opened and used for the role-owned draft check. |

The isolated server uses `MIRAFLORES_DATA_DIR` under `/tmp` and a separate `.next-redesign` directory. Browser/API mutations were made only in that disposable review, not the applicant's saved `.local` workspace. Port 3000's existing process was not stopped.

Screenshots are actual UI evidence from that disposable case: [desktop](../../outputs/redesign-desktop.png), [mobile](../../outputs/redesign-mobile.png), [mobile decision](../../outputs/redesign-mobile-decision.png). They are not proof that every browser path was exercised.

## Remaining boundaries

The localhost access gate and fictional role switcher remain explicitly labeled evaluator-sandbox behavior. The legacy masked case record is shared among demo personas; genuine staff/client identity and least-privilege deployment are not claimed. Shared hosting needs a deliberate access/storage choice and separate-session acceptance. The current runtime's embedded SQLite patch level and coordinated database/files/key restore remain deployment gates.

Filing and signature workflows remain simulations. Exact supplied scenarios and estimated effects remain separate; the engine is not rerun. The app still loads the supplied household packet; file uploads attach evidence and do not perform general OCR or import a newly computed household.

Live AI remains optional; no real provider key/connectivity was tested. Observed CPA/new-hire performance, a real shared app URL and the applicant's own video link remain open. The [independent implementation verifier](07-IMPLEMENTATION-VERIFICATION.md) distinguishes source inspection, executed evidence and unobserved conditions for all 105 indexed obligations.

## Reproduce locally

Normal development remains `npm run dev` on port 3000. If that port is already running, open the existing server. An independent run can use another port and data/build directories:

```sh
MIRAFLORES_DATA_DIR=/tmp/miraflores-disposable-review \
MIRAFLORES_DIST_DIR=.next-redesign \
node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3100
```

Run checks with `npm run check` and `npm run lint`. Set `MIRAFLORES_TEST_URL` to the disposable server when running either API acceptance script; those scripts create test decisions and evidence. No dependency installation, cloud deployment, Git push or paid AI request was performed in this implementation.
