# Agent 1: case-study feature attestation and product contract

Review date: October 24, 2026, America/Chicago. Reviewer: case-study requirements and product agent. This is a design review, not a new execution of the acceptance suites or a certification that this return is correct.

## Authority and attestation

I read all three pages of the applicant's PDF through the complete page-delimited extraction at `../../../analysis/case-study-current.txt`, the shared brain, the initial 105-row audit and the subsequent verification report. I inspected the current packet/read models, workflow commands, revision repository, source viewer, detailed-record components, server access boundary, one-page explanation and the saved masked UI screenshot. The **PDF is the product specification**. The 105 IDs are only an indexing aid, and the previous verifier's conclusions are supporting evidence that I challenge where their breadth would mislead an employer.

The PDF asks for a workpaper for **one supplied fictional household**, starting after extraction and computation. It explicitly excludes a full extraction/tracing pipeline and says tax results are computed. General raw-upload processing, OCR, a tax-law engine, multi-client onboarding and production e-file integrations are not minimum assignment requirements. They must not displace any required review, record or lifecycle capability.

I attest that the architecture recommendation below retains a concrete design obligation for every functional capability and submission deliverable in the PDF. I do **not** attest that every professional task on the supplied return is completed, that the engine can be rerun, that a legal signature or agency transaction happened, or that today's review reran the existing tests. Some features operate as explicit case-study simulations. The prior report's phrase “102 verified” means reported bounded prototype capability; it cannot mean 102 production-ready or independently reverified requirements in this design discussion.

### Evidence and status conventions

- **C/PV**: present in inspected code or a closely inspected shared implementation boundary; the named suite and `../VERIFICATION.md` report prior behavior verification. This review did not execute that suite. Individual deep paths are not all independently re-read.
- **SIM/PV**: the same evidence level, with a simulated document, authorization, agency event or scenario workflow. Simulation is a deliberate assignment boundary, not proof of an external event.
- **PARTIAL**: a material boundary remains, even if a narrower local capability previously passed.
- **USER/OPEN**: missing external or observed evidence that implementation alone cannot establish.

Evidence aliases below resolve to actual repository files: **packet** = `lib/packet.ts`; **domain** = `lib/domain.ts`; **workflow** = `lib/workflow.ts`; **records** = `lib/records.ts`; **source UI** = `app/components/source-viewer.tsx`; **record UI** = `app/components/record-tools.tsx` and `app/components/expanded-workspace.tsx`; **repo** = `lib/repository.ts`; **server** = `lib/server.ts`; **packages** = `lib/packages.ts`. Test aliases: **acceptance** = `scripts/test-acceptance.ts`; **domain-test** = `scripts/test-domain.ts`; **workflow-test** = `scripts/test-workflow-acceptance.ts`; **records-test** = `scripts/test-records.ts`; **checks-test** = `scripts/test-checks-acceptance.ts`; **search-test** = `scripts/test-search-acceptance.ts`; **package-test** = `scripts/test-package-acceptance.ts`; **identifier-test** = `scripts/test-identifiers-acceptance.ts`; **API-test** = `scripts/test-api.mjs`. Every PV statement also refers to the precise scope in `../VERIFICATION.md`.

## Complete feature-to-design mapping

Each baseline ID appears exactly once in the tables. “Required behavior” is the PDF obligation paraphrased into an observable result; the last column is the architecture acceptance contract, not a claim of new implementation.

### Purpose and audience

| ID | PDF page | Required behavior | Current evidence and honest status | Architecture acceptance obligation |
|---|---:|---|---|---|
| B01 | 1 | Working original web workpaper for this complex household. | C/PV locally: `app/page.tsx`, record UI, API-test. Hosted hand-in still open below. | One coherent application must join evidence, calculations, decisions and lifecycle; do not substitute a slide deck or a future platform plan. |
| B02 | 1 | Know provenance, treatment, checker and unresolved work for a number. | C/PV: packet, domain, workflow verification/overlay records; acceptance and workflow-test. | A claim detail must expose source, supplied computation, review method, authorship and unresolved status together. |
| B03 | 1 | Serve preparer, reviewer, partner, client, administrator, future preparer and examiner. | C/PV bounded actions plus handoff/export; workflow, packages, workflow-test. PARTIAL audience read policy: all personas receive the masked whole workspace. | Define each audience's allowed records/actions. Controlled evaluator inspection is distinct from a genuine client view; future-year/offline views retain context. |
| B04 | 1 | Invent from purpose, rather than recreate spreadsheet workpapers. | C/PV: evidence-first screens and claim/source dialogs; saved UI screenshot. Originality is a design judgment. | Review journeys are primary. Tables support sales/assets, rather than become the application model or canvas. |
| B05 | 1 | Experienced CPA faster/more trusting; new hire usable on day one. | USER/OPEN: no observed study; screenshot and code cannot prove this bar. | Recommended operationalization: observe five tasks with a CPA and new hire; report time, help and understanding. The PDF sets the bar, not a literal study protocol or sample size. |

### Evidence

| ID | PDF page | Required behavior | Current evidence and honest status | Architecture acceptance obligation |
|---|---:|---|---|---|
| E01 | 1 | Trace any supplied return number to exact source references. | C/PV: packet graph traversal, trace API; acceptance reports all 1,877 graphs. | Every line must remain referenceable by version and key; traces preserve stable evidence IDs. |
| E02 | 1 | Display the source document and identify the exact field/location. | SIM/PV: source UI displays document/page/EV/field; approximate excerpts and synthetic positions labeled. | Stable field identity is exact; text highlights are approximate. Never claim invented coordinates prove original layout. |
| E03 | 1 | Follow a document to all destinations, or a reason it was unused. | C/PV graph/dispositions: acceptance reports 222 maps. PARTIAL responsive access: peer code review found mobile `.document-uses` hidden. | Reverse graph includes downstream totals; used/unused reasons are attributable. Preserve an accessible reverse-trace path at narrow widths. |
| E04 | 1 | Record how each number was verified. | C/PV: workflow `verify_value`, preserved history; workflow-test. Records support review, not completion of all review. | Any line/source can store method, conclusion, evidence, actor and revision independently of extraction confidence. |
| E05 | 1 | Link related items across the current return. | C/PV: workflow `link_evidence`, packet resolver; workflow-test and search-test. | Shared reference types link calculations, documents and local decisions without copying untraceable text. |
| E06 | 1 | Link related items across years. | C/PV: prior-year pointers/comparisons and links; records-test, workflow-test. | Year is explicit in references and comparisons; unknown prior facts remain unknown. |
| E07 | 1 | Link related returns. | C/PV: records household/related-return group and outside-filing records; records-test. | Related-return identity, adviser and responsibility are visible; do not imply the related return was prepared here. |
| E08 | 1 | Attach files as evidence. | C/PV: private attachment routes/storage, atomic metadata/hash registration; API-test. Current maximum is 8 MB/file. | Store bytes privately with content hash and stable evidence identity; failed/stale writes must not orphan registered evidence. |
| E09 | 1 | Attach messages as evidence. | C/PV: imported communications and recipient-enforced local question/answer; workflow-test. No external sending. | Questions, answers and provenance persist and resolve as sources; local messages must not masquerade as email delivery. |
| E10 | 1 | Attach notes as evidence. | C/PV: domain notes plus local evidence links/resolver; workflow-test, search-test. | Notes are durable authored records, referenceable from claims and preserved after resolution. |
| E11 | 1 | Simulate missing originals from JSON. | SIM/PV: all 199 `printed_content` pages via packet/source UI; acceptance. | Reproduce supplied content without inventing extraction on unread pages; mark sources simulated. |
| E12 | 1 | Replace simulated documents with originals without breaking traces. | C/PV adapter: workflow `bind_original`, private preview/source UI; workflow-test/API-test. No OCR. | Bind original bytes to the same document/page/field IDs; layout mismatch stays explicit and original access stays gated. |

### Calculation and large detail

| ID | PDF page | Required behavior | Current evidence and honest status | Architecture acceptance obligation |
|---|---:|---|---|---|
| C01 | 1 | Show how any supplied number was built. | C/PV: packet trace, rule/input/source graph; acceptance. | Distinguish imported rule explanation from an independently validated calculation. |
| C02 | 1 | Reconcile figures that should agree. | C/PV: `lib/checks.ts`, workflow reconciliation; checks-test/workflow-test. | Show both independently derived sides, components, delta and conclusion; never mark a documented difference matched. |
| C03 | 1 | Review hundreds of sales without overload. | C/PV: complete sales population, searchable 25-row pages in record UI; records-test. No timed capacity benchmark. | Summaries tie to full lot populations; filters/pagination retain totals, source links and explicit omissions. |
| C04 | 1 | Review many assets without overload. | C/PV: records asset register, jurisdiction columns and expandable records; records-test. | Asset identity and method/life/jurisdiction differences remain scannable before opening full detail. |
| C05 | 1 | Take business books to taxable income. | C/PV: printed-books/engine bridge in checks and business schedules; checks-test. | Display bridge components, permanent/timing treatment and unresolved mismatches; no invented engine rerun. |
| C06 | 1 | Split income between states. | C/PV: residency/all-state/CA read model plus independent payroll comparison; records/checks-test. | Allocation must tie source facts, periods and jurisdiction columns; working comparison is not a recomputed CA return. |
| C07 | 1 | Run checks that distrust engine output. | C/PV: printed/agency arithmetic in `lib/checks.ts`; 14 outcomes reported by checks-test. | Independent source checks form a separate module; engine totals cannot be their expected truth by circular logic. |

### Change

| ID | PDF page | Required behavior | Current evidence and honest status | Architecture acceptance obligation |
|---|---:|---|---|---|
| H01 | 2 | Adjust with original, author, reason and tax effect retained. | C/PV: domain curated adjustments and workflow `adjust_line`; workflow-test. Effects are estimates. | Original is immutable; overlay records distinguish computed supplied alternatives from rate/user-entered estimates. |
| H02 | 2 | See changes live. | C/PV with delay: focus/visibility refresh, 10-second polling and CAS. PARTIAL trust feedback: polling errors swallowed and sidebar always says saved. | Show last successful refresh, Saving/Saved/Failed/Unavailable separately; stale writes fail with safe draft preserved. Do not claim instantaneous streaming. |
| H03 | 2 | See changes since the viewer last looked. | C/PV: workflow `mark_seen` and actor-specific lastSeen; workflow-test. | Compute unread changes from a durable per-viewer watermark, not a shared page visit flag. |
| H04 | 2 | Compare versions. | C/PV: records versionDiffs and record UI; records-test covers source-only changes. | Diff values, added/removed lines, inputs, rules and sources with version-bound navigation. |
| H05 | 2 | Try what-ifs. | SIM/PV: five exact supplied alternatives, workflow `save_scenario`; records/workflow-test. | Preserve scenario base, exact outcome and choices; a saved proposal does not update the reviewed return or combine alternatives. |
| H06 | 2 | Act on many items at once. | C/PV: workflow `bulk_adjust`, overlap protection and batch record; workflow-test. | A batch validates before one atomic revision; no partial acceptance on one invalid item. |
| H07 | 2 | Undo individual or bulk changes. | C/PV: domain undo, workflow `undo_line`/`undo_bulk`; workflow-test. | Undo records who/why/when and keeps prior history; dependent approvals reopen. |

### Judgment and completeness

| ID | PDF page | Required behavior | Current evidence and honest status | Architecture acceptance obligation |
|---|---:|---|---|---|
| J01 | 2 | Flag significant prior-year swings. | C/PV: prior/current comparisons and administrator variance policy; records/UI/workflow-test. | Threshold and dollar basis are visible/configurable; flags prompt explanation rather than assert error. |
| J02 | 2 | Record judgment and supporting authority. | C/PV: workflow `judgment`, evidence and authority; workflow-test. | Judgment is a structured authored conclusion linked to facts/authority, independent of numeric adjustment. |
| J03 | 2 | Record elections. | C/PV: election category and saved scenario proposals; workflow-test. | Record rationale/authority and distinguish a proposal from applied/filed election. |
| J04 | 2 | Record due diligence. | C/PV: required diligence applicability/conclusion/authority gates; workflow-test. | Nonapplicability needs a reason; missing required conclusion/evidence must block review, not disappear. |
| J05 | 2 | Record penalty decisions. | C/PV: penalty judgment, supplied annualized alternative and extension context; workflow/records. | Keep method, authority, payment facts and decision; exact alternative and estimated overlay remain distinct. |
| J06 | 2 | Account for every document. | C/PV: all 74 dispositions default review gate; workflow-test. | Complete count includes corrected, duplicate, unused and unextracted documents with reasoned disposition. |
| J07 | 2 | Consider every tax area. | C/PV: 13 area reviews and default gate; workflow-test/record UI. | Area completeness is separate from “all 16 curated issues closed”; supporting unknowns stay visible. |
| J08 | 2 | Identify outside filings. | C/PV: five seeded outside/related filing responsibilities and dispositions; workflow-test. | Identify owner/adviser, deadline, status and supporting conclusion without implying external completion. |

### People and review

| ID | PDF page | Required behavior | Current evidence and honest status | Architecture acceptance obligation |
|---|---:|---|---|---|
| P01 | 2 | Client questions become evidence. | C/PV: workflow add/answer question, local refs and notifications; workflow-test and prior browser report. | Recipient, answer, actor, time and target persist; answer can support a claim without overwriting prior source. |
| P02 | 2 | Colleague questions become evidence. | C/PV: same recipient-enforced question model; workflow-test. | Colleague response has the same durable provenance as client response, not an ephemeral chat-only answer. |
| P03 | 2 | Review notes can block filing. | C/PV: domain note gates, workflow blockers; domain/workflow-test. | Blocking note resolution is attributable and conditions approval/freeze on the server. |
| P04 | 2 | Sign-offs reopen when signed content changes. | C/PV: material revision and invalidation in domain/workflow/repo; workflow-test. | Commit content change, invalidation and audit atomically; signatures bind to content revision. |
| P05 | 2 | Enforce roles. | C/PV local action enforcement; PARTIAL identity/read policy: fictional cookie persona, constant owner and whole masked workspace returned to all roles. | Preserve explicit Demo role; separate hosted access/session from role selection and enforce declared read/command/resource policy server-side. Do not claim current client least privilege. |
| P06 | 2 | Several people can work concurrently. | C/PV revision concurrency; PARTIAL actual shared sessions: only loopback/local owner currently exists. API-test reports [200,409]. | Hosted viewers need shared durable case state with isolated sessions, refresh and stale-write recovery. Do not equate multiple tabs with verified staff identity. |
| P07 | 2 | Assign work. | C/PV: workflow tasks, assignee-only completion; workflow-test. | Task targets are evidence/area/claim references with owner and audit, not disconnected to-do text. |
| P08 | 2 | Track deadlines. | C/PV: supplied and assigned dates, strict calendar validation; workflow-test. | Due dates persist with responsible actor and clearly separate statutory/context dates from assigned work deadlines. |
| P09 | 2 | Notify people. | C/PV local in-app recipient notifications/acknowledgment; workflow-test. | Notify actionable assignment/question/response changes; external email is optional and must not be claimed sent. |
| P10 | 2 | Record client approval. | C/PV: domain client approval follows current independent review; workflow-test. | Approval points to the client-visible reviewed revision and is invalidated on relevant change. |
| P11 | 2 | Record e-file signature. | SIM/PV: both joint clients typed local attestation; workflow-test. Not legal agency authorization. | Signer, exact consent statement, reviewed revision and cycle persist; UI labels simulation. |

### Filing and after

| ID | PDF page | Required behavior | Current evidence and honest status | Architecture acceptance obligation |
|---|---:|---|---|---|
| F01 | 2 | Manage extensions. | SIM/PV: workflow extension record uses supplied v2 estimate/reference; workflow-test. | Retain payment assessment, decision and date context; do not claim an extension transmitted. |
| F02 | 2 | Manage filing. | SIM/PV: freeze plus jurisdiction filing state machine; workflow-test. | Federal/CA submissions reference an authorized frozen snapshot, with explicit simulated event records. |
| F03 | 2 | Handle rejection and correction. | SIM/PV: jurisdiction rejection/resubmit and fresh correction-review cycle; workflow-test. | Preserve failed attempt, correction cause, new approvals/signatures where content changed and jurisdiction-specific status. |
| F04 | 2 | Give the client a copy. | C/PV generated artifact: packages clientCopy contains 627 supplied v3 lines and separate overlays; package-test. | Client copy is readable, complete for supplied computation and explicit about unrecomputed effects and simulation. |
| F05 | 2 | Freeze at filing. | C/PV: deep snapshot plus hash in domain/repo; workflow-test. | Frozen content cannot be edited; downstream correspondence appends without silently mutating the filed record. |
| F06 | 2 | Amend on top. | SIM/PV: workflow `start_amendment`, parent snapshot/cycle; workflow-test. | New work derives from preserved original and requires fresh review; no destructive “unfreeze and replace.” |
| F07 | 2 | Answer a notice using a self-contained record. | C/PV serial offline artifact; PARTIAL concurrency: route loads state then all attachment/correction rows, allowing a mixed-revision manifest. Code-inspected risk, not reproduced failure. | Capture one declared state/revision and exact evidence IDs/metadata consistently; require every expected hash. Read immutable bytes outside transaction; exclude newer work or explicitly retry. Artifact remains usable offline. |
| F08 | 2 | Carry forward everything with history. | C/PV: 2026 handoff with supplied carryovers/assets/basis and history; workflow-test. | Handoff preserves ancestry and warns overlays were not recomputed into imported carryovers. |
| F09 | 2 | Plan next year. | C/PV: year-specific plans plus supplied 2026 context; workflow-test/records. | Plans retain assumptions, supporting references, author and year; no unsupported forecast certainty. |

### Firm capabilities

| ID | PDF page | Required behavior | Current evidence and honest status | Architecture acceptance obligation |
|---|---:|---|---|---|
| O01 | 2 | Apply firm-wide standards. | C/PV for this case: administrator standards/gates and history; workflow-test. No deployed multi-firm control plane. | Version standards and apply operative review gates; settings text alone is not enforcement. |
| O02 | 2 | Protect sensitive data. | C/PV local masking, encryption/private files and clearance; identifier/API-test. PARTIAL hosted/read/recovery: masking whole workspace is not least privilege and DB/files/key restore untested. | Enforce declared role-specific reads/search/export, private storage and logged sensitive access. Recover DB, immutable files and protection key together; disclose evaluator inspection policy. |
| O03 | 2 | Log sensitive views. | C/PV: original/reveal/export log routes and readable operations view; API-test. | Every successful private reveal/download/export is attributable; masking is separate from logged access. |
| O04 | 2 | Compare time with budget. | C/PV: workflow time entries and budget; workflow-test. | Preserve author/area/duration and show actual/remaining/variance, rather than only original budget text. |
| O05 | 2 | Show status. | C/PV: computed blockers, task/jurisdiction/cycle/deadline status; workflow and operations API. | Derive status from facts; unresolved evidence/completeness cannot be hidden by a manual “ready” badge. |
| O06 | 2 | Search the workpaper. | C/PV: `lib/search.ts`, API/record UI; search-test. | Search source pages, extracted values, records and saved work while preserving resolving version/source references and masking. |

### CPA records

| ID | PDF page | Required behavior | Current evidence and honest status | Architecture acceptance obligation |
|---|---:|---|---|---|
| R01 | 2 | Current return summary versus last year. | C/PV: records prior comparison and variance UI; records-test. | Compare supplied equivalent lines, show prior sources and retain missing values as missing. |
| R02 | 2 | Tax computation. | C/PV: all version line/rule/input records and trace; acceptance. | Full supplied computation remains inspectable; do not conflate imported values with recomputed correctness. |
| R03 | 2 | Area summaries. | C/PV: 13 summaries with amounts/findings/doc coverage/conclusions; records-test and prior browser report. | Each area joins source, calculation, judgment, owner and remaining work; counts are not a substitute for conclusions. |
| R04 | 2 | Document index. | C/PV: packet document index and evidence UI; acceptance. | All 74 docs/199 pages remain discoverable with status/year/correction/use metadata. |
| R05 | 2 | Depreciation per asset. | C/PV: records asset group and register; records-test. | Complete selected-version population has stable asset identity and source-linked detail. |
| R06 | 2 | Asset method and life. | C/PV: register columns plus expanded fields; records-test. | Method/life are visible before opening raw details, and unknowns are explicit. |
| R07 | 2 | Bonus depreciation. | C/PV: supplied asset detailed fields and form lines; records-test. | Preserve bonus/179 treatment and jurisdiction details without inventing a new depreciation calculation. |
| R08 | 2 | Federal/CA/AMT depreciation. | C/PV: side-by-side register columns; records-test. | Align jurisdictions by asset and surface actual differing treatment, not three disconnected lists. |
| R09 | 2 | Disposals and recapture. | C/PV: asset disposal fields and F4797/source records; records-test. | Connect disposal date, accumulated depreciation and recapture computation to the same asset/evidence. |
| R10 | 2 | Sales detail. | C/PV: sales group plus independent printed-lot reconciliation; records/checks-test. | Full lot population and aggregate tie-outs remain reachable; missing printed lot stays a mismatch, not fabricated engine data. |
| R11 | 2 | Books-to-tax record. | C/PV: business group and independent bridge; records/checks-test. | Distinguish source books, supplied tax mapping, adjustment and unresolved delta. |
| R12 | 2 | Rental records. | C/PV: rentals group includes SchE/disposals/assets; records-test. | Group by property and maintain operating/source/disposal links rather than flattening them into one unexplained total. |
| R13 | 2 | Passive losses. | C/PV: F8582/activity and carryover records; records-test. | Incoming, allowed/current and suspended amounts retain year/property context and supplied limitation explanations. |
| R14 | 2 | K-1 lines. | C/PV: supplied K-1 sources/supplements, SchE/F7203 and basis group; records-test. | Entity, corrected/late version and state supplements stay linked; do not fill basis gaps by inference. |
| R15 | 2 | Retirement items. | C/PV: retirement group and F8606/F8889/source records; records-test. | Show basis, contribution/conversion, source year and supplied ordering/limitation separately. |
| R16 | 2 | Foreign items. | C/PV: retirement/foreign group, FX refs and outside filing workflow; records/workflow-test. | Currency/date/reference, reporting responsibility and unknown historical facts must remain visible. |
| R17 | 2 | Deductions with limits. | C/PV: SchA/F8283/limit groups and judgments; records-test. | Claimed/source/limited/carryover values are distinguishable and traceable. |
| R18 | 2 | Credits with limits. | C/PV: credit/phaseout forms and required diligence; records/workflow-test. | Eligibility, phaseout and required supporting conclusion are inspectable; missing diligence blocks sign-off. |
| R19 | 2 | Payment records. | C/PV: IRS/FTB ledgers, dates/designation, extension and checks; records/checks-test. | Reconcile client claim to agency record by tax year/date/application rather than summing all transfers. |
| R20 | 2 | State split. | C/PV: residency and all-state/CA lines with independent comparison; records/checks-test. | Allocation trace and jurisdiction differences remain source bound; no unsupported final CA correction. |
| R21 | 2 | Carryovers. | C/PV: incoming/outgoing per version and handoff; records/workflow-test. | Preserve origin year, use/outgoing direction and explicit overlay reconciliation warning. |
| R22 | 2 | Basis by year. | C/PV: multi-year prior basis and current F7203 group; records-test. | Null historical years remain unresolved; record evidence and decisions without invented rollforward amounts. |
| R23 | 2 | Prior preparer treatment versus current changes. | C/PV: records paired comparisons/current adjustment/audit; records-test and prior browser report. | Show prior fact/method, supplied current treatment and our actual decisions side by side; unknown prior method stays unknown. |

### Case and data constraints

| ID | PDF page | Required behavior | Current evidence and honest status | Architecture acceptance obligation |
|---|---:|---|---|---|
| S01 | 2 | Preserve fictional joint 2025 household and CA-to-TX move. | C/PV: immutable packet/household projection; records-test. | Case identity/year/residency are authoritative fixture facts, never real taxpayer claims. |
| S02 | 2 | Cover every named complex household tax area. | C/PV: supplied forms/records, 13-area coverage and judgments; records/workflow-test. | Stock, business, investments/crypto, foreign, rentals/sale, K-1/basis, Roth, education and noncash gifts stay accessible. |
| S03 | 2 | Handle late/corrected records and client-only answers. | C/PV: corrected metadata/diffs, question workflow and replay; records/workflow-test. | Preserve superseded evidence and receipt order; current answer or correction does not erase earlier provenance. |
| S04 | 2 | Load supplied documents/values with source and confidence. | C/PV: SHA-pinned 74/199/3,012 packet; acceptance. | Import/adapter preserves delivered IDs/content; confidence describes extraction confidence, not verification. |
| S05 | 2 | Use all three computed versions. | C/PV: v1/v2/v3 records, trace and diffs; acceptance/records-test. | Version identity follows every calculation/source comparison; do not mix versions in one asserted total. |
| S06 | 2 | Make client answers, prior years, agency/staff/context useful. | C/PV: records communications/reference/prior/household and resolvers; records/search-test. | Discoverable context has stable evidence references and joins review workflows. |
| S07 | 2 | Replay supplied season timeline. | SIM/PV: workflow set_replay and historical availability read model; records/workflow-test. | Historical read view filters receipt/version availability without backdating current decisions. |
| S08 | 2 | Surface confident mistakes. | C/PV: printed/extracted distinction, 16 curated findings and independent checks; acceptance/checks-test. | Retain discrepancy even at 97–98% confidence; source truth, extraction and engine are separate facts. |
| S09 | 2 | Start after extraction/computation; no tax-law/document-reading engine required. | C/PV: read-only imported computation, estimates and exact supplied alternatives clearly separated. | No OCR/vector/RAG/tax-engine dependency on the critical path. A reusable packet adapter is an internal boundary, not a new product scope. |

### Submission deliverables

| ID | PDF page | Required behavior | Current evidence and honest status | Architecture acceptance obligation |
|---|---:|---|---|---|
| D01 | 3 | Working app from a shared link. | PARTIAL: local app only; server explicitly rejects non-loopback and unconfigured production. GitHub is not app hosting. | Provision controlled hosted demo with persistence and separate visitor sessions; verify shared-link journeys before calling submission complete. |
| D02 | 3 | Load packet as delivered. | C/PV: packet SHA and byte-preserving overlays; acceptance. | Preserve pinned original artifact and immutable imported values; migration cannot rewrite fixture meaning. |
| D03 | 3 | Save everything. | C/PV local SQL CAS/related metadata transactions; API-test. PARTIAL hosted durability, crash-orphan recovery, export consistency and truthful save/freshness display. Restore not exercised. | Persist/reload decisions/history/files/corrections on durable hosting; coordinate DB/files/key restore, stage/reconcile orphan files safely and show actual save/error state. No atomic SQL+filesystem claim. |
| D04 | 3 | Include role switcher. | C/PV: eight supplied personas and server cookie route; API-test/prior browser report. | Demo role remains explicit and separate from genuine authenticated person; restore role without losing evidence or case state. |
| D05 | 3 | One page on core idea and model. | C/PV artifact: `../CORE_IDEA.md` inspected; describes claims, source graph, decisions and snapshots. | Keep a genuinely concise submission page consistent with final code and tradeoffs. |
| D06 | 3 | Explain found errors and how design surfaced them. | C/PV artifact: `../ERROR_FINDINGS.md` and source-backed queue/checks; previous verifier report. | Present several concrete source→wrong reading/output→design discovery chains; separate proven mismatch from judgment. |
| D07 | 3 | Applicant video with decisions/tradeoffs and video link. | USER/OPEN: `../VIDEO_WALKTHROUGH.md` is script/checklist, not recording. | Applicant records genuine walkthrough of final deployed demo; accessible video link is required. |
| D08 | 3 | Disclose tools, including AI use. | C/PV artifact: README/AI setup/walkthrough disclosures; previous verifier report. | Disclose agent-assisted development and actual offline/live boundaries; do not imply live AI was tested without credential evidence. |

## Five assignment-winning journeys

1. **A suspicious amount becomes a defensible claim.** Open a supplied tax line, trace to the exact document/page/field, compare printed source with extracted reading, run a separate source check, record the verification method, and accept a reasoned correction with explicitly estimated effect. Return to a single coherent review view. Demo the high-confidence provider ID or duplicate mileage, rather than relying on an AI summary as proof.
2. **A reviewer sees exactly what changed and cannot approve stale work.** Switch from preparer to independent reviewer, inspect changes since last seen and source-only version differences, open a blocking note, see approval prevented, resolve with evidence, then change underlying reviewed content and watch sign-off reopen. Show stale concurrent edit rejection, not merely a static “collaboration” badge.
3. **A CPA resolves dense populations without losing the whole.** Move from an area summary into the full sales ledger or federal/CA/AMT asset register, filter/page it, tie the total to source/return, and expose the missing Meridian lot or state allocation mismatch. Full detail is required; a prettier summary cannot replace it.
4. **An unanswered fact becomes attributable evidence.** Assign a client question to the right joint client, switch role, answer in app, switch back, inspect the durable answer and link it into a judgment/diligence record. Show no outside message was sent and no confident conclusion was invented before the answer.
5. **A reviewed return survives filing and later examination.** In a clearly isolated completed demonstration fixture, obtain independent review/current joint attestations, freeze a hashed record, record a simulated rejection/correction, open an amendment above the preserved snapshot, and download an offline notice package. Show next-year handoff and histories. Do not fake completing the real unresolved case merely to make the button green.

The employer should trust the demo because each action is explainable, source-bound, persisted, reversible where appropriate, and visibly prevented when its preconditions fail. It should be possible to inspect the same fact from a return line, document, task, question or audit event. Show one failure path in the video; that is stronger evidence than five green status cards.

## Information architecture constraints

- Keep one stable case/year/revision context, and show the active fictional persona and simulation state. A person must know whether they are looking at current review, a historical replay, a what-if or a frozen cycle.
- The primary workflow should be open work → claim → evidence/calculation → decision → review. A contextual source panel should retain the selected claim, version, page and field instead of making the reviewer remember them across disconnected screens.
- Detail tables are appropriate for sales, assets and comparisons. Paginate/search full populations; do not default to card-per-sale, decorative graphs or arbitrary “top five” samples.
- Every status needs drilldown to underlying facts and blockers. Completeness must surface all 74 documents, all areas, diligence and outside filings; the 16 findings are not the whole workpaper.
- Keep these labels semantically distinct: printed source, extraction reading/confidence, supplied engine value, verification conclusion, human judgment, estimated overlay, exact supplied alternative, simulated agency event. Color alone is insufficient.
- Use revision/history as a visible product concept. Server-side role and transition rules are the authority; disabled buttons are only guidance. Keyboard navigation, readable contrast, clear errors, source anchors and saved-work feedback support the PDF's usability bar.

## Recommendation, credible alternative and challenges

**Recommendation:** keep the current TypeScript/React/Next.js modular monolith, and improve the claim/source/decision review experience before adding breadth. Use one domain command boundary for all material decisions, one atomic persistence boundary for revision/audit/invalidation, separate immutable packet/read models and a storage adapter for private originals. Retain the reusable input-adapter seam; do not market it as general ingestion. For an employer-facing shared demo, use persistent hosted application storage and a controlled demo-access/session layer while keeping the required fictional role switcher. The exact host and database must be selected with the backend reviewer; the current loopback server cannot simply be pushed and called deployed.

**Credible alternative:** React/Vite with a small Fastify API and PostgreSQL/private object storage, using the same domain contracts and invariants. That cleanly separates frontend/static hosting from the API and would be reasonable from scratch. For this existing application it introduces migration and deployment work without satisfying a PDF feature that Next.js cannot handle. A split stack should be chosen only for a demonstrable team/deployment constraint, not fashion.

**Objection to infrastructure expansion:** no case feature currently requires microservices, a graph database, a vector database, Kafka, a workflow SaaS, multiple autonomous agents in production or a general tax platform. The graph is a typed data/reference model; a graph database is not necessary to traverse 1,877 supplied line graphs. Repeated data projections and the loose `Entry` contract deserve cleanup, but neither is a reason to rewrite the app before submission.

**Objection to AI-first architecture:** AI is optional investigation assistance, not a source of tax truth or approval authority. A tool loop may retrieve masked evidence and suggest where to inspect. Deterministic checks, explicit human conclusions, role gates and freeze integrity remain mandatory with AI unavailable.

**Objection to unqualified verification:** the previous report's local tests support capabilities, not observed CPA speed, production authentication, general-data coverage, agency integration or a shared deployment. This review keeps those boundaries visible. Specifically, P05/P06/O02/D03 have reported local mechanisms but require a hosted/session/storage check before claiming the shared-team hand-in works. Newly inspected F07 export consistency and H02/save-feedback defects also remain open; they are not hidden behind the historical count. B05/D01/D07 remain open until evidence exists.

## Debate record

- Sent architecture reviewer a requirement-first challenge: identify a concrete PDF need before proposing an independently deployed service; preserve immutable sources, estimates/scenarios and revision-bound approvals. The reviewer replied that none of the brief requires services beyond a modular monolith and explicitly challenged my attestation to keep supplied exact what-ifs separate from estimated overlays. **Accepted**: H01/H05/C01/F04/S09 now state that boundary directly.
- **Accepted frontend reply:** its five-destination IA retains every detailed record group and all completeness drilldowns. It adopts a universal claim/source/calculation/decision context, explicitly separates Unverified/Verified-by-method/Discrepancy/Decision/Reopened, and agrees that capability is not all-line completion. This addresses my concern about a smaller polished 16-finding dashboard replacing the full workpaper. Proposed IA still requires implementation and observation.
- **Accepted backend objection on audience reads:** inspecting bootstrap and packet confirms `workspace: masked(workspace)` is returned to all fictional personas. Mutation enforcement and identifier masking are valuable but do not prove a client cannot read internal staff notes, tasks, audit or budget. B03/P05/O02 now retain this distinction. A controlled evaluator may intentionally inspect roles; that declared sandbox policy must not be advertised as genuine client least privilege.
- **Accepted assurance/backend export objection:** I read the examination route and confirmed state is loaded before separately selecting all attachments and corrections. A newly committed row can be included without its presence/expected hash in the declared state. F07 is now explicitly partial for concurrency, not simply prior-verified. One captured revision and exact evidence manifest, mandatory expected hashes and an interleaving regression are required. No failure reproduction or repair occurred in this review.
- **Accepted save/freshness objection:** source inspection confirms the unconditional “All changes saved” label and swallowed polling failure. H02/D03 now demand actual draft/saving/saved/failed/refresh-unavailable states, safe rationale preservation and explicit stale-command resubmission. A pending or failed command must not inherit a saved badge. Sensitive values must clear on role/hide/timeout and should not be placed in persistent browser draft storage.
- **Accepted recovery/runtime boundary:** file rename is not a transaction with SQL; caught failures can clean up but process death can leave staging orphans. Save/export durability includes DB, files and identifier key, plus a tested clean restore and safe orphan reconciliation. Backend's fresh runtime metadata and cited SQLite WAL patch condition are a hosting-selection check, not proof of local corruption or reason for an untested emergency rewrite.
- **Accepted assurance scope correction:** the proposed five observed tasks are my recommendation to make the PDF's qualitative CPA/new-hire bar assessable. The PDF does not literally prescribe five tasks, a participant count or an experiment. The actual shared app link, one-page model, errors/design explanation, genuine applicant video link and tools disclosure are literal required hand-in items.
- **Rejected overbroad release interpretation:** a real production multi-client identity system, cloud database and external e-file integration are not literal prerequisites for a fictional evaluator sandbox. A controlled separately gated demo with explicit roles, durable storage, server-enforced declared policies and actual separate-session verification can satisfy this assignment. This does not waive role enforcement, sensitive protection, saving or collaboration; it avoids inventing unrelated platform scope.
- **Deferred choices:** exact host, SQLite versus PostgreSQL and a modal-library dependency depend on hosting/runtime and measured interaction constraints. Neither migration nor package choice wins a feature by itself. Agent count does not decide design truth; concrete requirements/evidence do.

## Consolidated blueprint review

I read `04-BACKEND-DATA-PROPOSAL.md`, `05-ASSURANCE-AND-CHALLENGES.md` and the coordinator's draft `06-RECOMMENDED-BLUEPRINT.md`. **The proposed blueprint retains every PDF feature at design-contract level.** Its modular monolith, five destinations, role-specific revision-consistent query contract, deterministic checks, atomic review invariants, revision-bound export and conditional hosting choice answer the objections above without dropping required detail. Its build order appropriately fixes integrity/access/save/focus gaps before polishing the visual surface or demonstrating the shared link.

There is no remaining disagreement on feature scope or architecture direction. The remaining uncertainty is evidence: the proposal is not implemented, hosted or newly tested by this discussion. Do not turn this agreement into a fresh “105 passed” claim. All 105 row IDs remain traceable, including the newly strengthened partial boundaries. Final acceptance must retain them even if the top-level navigation becomes smaller.

## Product acceptance before hand-in

All PDF feature groups must remain reachable in the final IA and mapped to a current code/test or openly stated limitation. The final acceptance pass should execute the five journeys on the actual shared link, reload persisted changes from another session, demonstrate role denial/stale-edit rejection/sign-off invalidation, inspect exact source identity and open the exported record offline. The applicant must supply the genuine video, accessible link and accurate tools disclosure. CPA/new-hire observations should be reported as actual results or an honest outstanding limitation. No architecture diagram or agent consensus closes those items by itself.
