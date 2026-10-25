# Case-study requirements audit

Audit date: October 24, 2026 (America/Chicago). This is the **initial, independent baseline** taken before the requested gap-closing development. Later implementation and verification must be recorded in a separate final-results section or verification report, rather than rewriting the initial findings as though they had already worked.

Source: `/Users/rajendrathalluru/Documents/Presentation/Case_Study_Redesign_the_Tax_Workpaper (1).pdf`, all three pages. Each page was extracted and visually inspected, including the ending on page 3. The packet README and actual app source were also inspected. Document statements are reference requirements; they do not authorize sending messages, transmitting a return, publishing a site, or impersonating the applicant in the required video.

The PDF has 3 pages and a compact set of paragraphs. The atomic rows below preserve every material obligation in order, splitting compound sentences into testable requirements. Repeated titles, page numbers, the invitation to send sooner, and the permission to choose any stack/tools are contextual rather than software features.

Status meanings:

- **Complete**: the current code implements this bounded requirement for the supplied fictional case. This does not establish production readiness or qualitative CPA acceptance.
- **Partial**: some support exists, but a material part is missing, generic, or only browseable.
- **Missing**: no operative implementation found at the baseline.
- “Read-only source” means data in the packet exists; it is not itself a completed workflow.

## Baseline requirement matrix

| ID | Page | Atomic requirement, paraphrased | Initial status | Implementation evidence and concrete gap |
|---|---:|---|---|---|
| B01 | 1 | A working, web-native workpaper for the one complex household | Partial | Next.js App Router app exists with a single household, review/evidence/version/activity screens. Broad workpaper scope below remains unfinished. `app/page.tsx`, `README.md`. |
| B02 | 1 | Preserve where numbers came from, what was done, who checked, and what remains open | Partial | Source graph, adjustments, notes, audit, approvals exist. No general per-number verification record; only curated findings are actionable. `lib/packet.ts`, `lib/domain.ts`. |
| B03 | 1 | Serve preparer, reviewer, partner, client, firm administrator, future preparer, and later examiner | Partial | All supplied personas are selectable, with meaningful preparer/reviewer/partner/client actions. Administrator has no policy workflow; future-year and examination workspaces absent. `lib/contracts.ts:Role`, `app/page.tsx`, `lib/domain.ts`. |
| B04 | 1 | Invent a purpose-built experience rather than recreate spreadsheet workpapers | Complete | Evidence-first navigation, review cards, source viewer, and dialogs form an original web interface. Tabular detail is subordinate to those workflows. `app/page.tsx`, `app/components/source-viewer.tsx`. |
| B05 | 1 | Be faster and more trustworthy to an experienced CPA and usable by a new hire on day one | Partial | Clear source/decision UI exists. No observed CPA or new-hire usability validation, onboarding exercise, or measured time/comprehension evidence. This qualitative bar cannot be certified by unit tests. |
| E01 | 1 | Trace return numbers to supplied exact source references | Complete | `traceLine()` traverses inputs/rules/sources for all three versions; tests resolve every supplied return-line source. `/api/trace/[key]`, `/api/evidence`, `scripts/test-domain.ts`. |
| E02 | 1 | Display the source document and identify the specific field/location when tracing | Partial | At baseline, `SourceViewer` opens the right page and shows field ID/label; `sourceRange()` highlights text heuristically and repeated text can select the wrong occurrence. Supplied coordinates are synthetic per the packet README, not authoritative original layout. Display the stable source-field identity and label any text excerpt as approximate. |
| E03 | 1 | Show every destination of a document, or why it did not land | Partial | `getDocument().uses` enumerates direct return-line destinations in all versions. `DocumentMeta.usedIn/supersededIn` and extraction reason exist. A no-use view gives a generic explanation rather than a documented, reviewed disposition for that particular document. |
| E04 | 1 | Record how each number was verified | Missing | No verification entity/method, verifier, source links, or per-number verification status. Investigation prose is tied to one of 16 findings. Firm's supplied verification types are not usable. |
| E05 | 1 | Link related items across the current return | Partial | Calculation inputs and issue sources link some items. No general relationship/evidence-link creation or reverse links for app-owned decisions. |
| E06 | 1 | Link related items across years | Partial | `resolveSource('py:/...')` resolves pointers, but the interface has only a static prior-year AGI card and no linked comparative year workspace. |
| E07 | 1 | Link related returns | Missing | `household.related_returns` exists in packet, absent from public model/UI. |
| E08 | 1 | Attach files as evidence | Partial | Durable private upload/download with metadata exists, limited to six MIME types and 8 MB. UI uploads to the general library, without a selected number/document/decision target. `app/api/attachments/route.ts`, `lib/local-storage.ts`. |
| E09 | 1 | Attach messages as evidence | Partial | Imported client questionnaire/messages/call notes resolve by source ID. User-created questions remain drafts and cannot receive/link answers as new evidence. |
| E10 | 1 | Attach notes as evidence | Partial | Review notes can link to curated issue IDs. No general evidence linking to a return line, asset, source field, year, or related return. |
| E11 | 1 | Create simulated source documents from JSON because originals are not supplied | Complete | All supplied pages render `printed_content` with a clear simulated-source label, separate pipeline readings, page navigation, and field lists. `getDocument()`, `SourceViewer`. |
| E12 | 1 | Make simulated sources replaceable by real documents without changing tracing links | Partial | Stable document/field/page IDs and a viewer boundary exist. Uploaded originals are separate blobs and cannot be bound as replacement source pages; no real-source viewer adapter. |
| C01 | 1 | Show how numbers were built | Complete | Return-line explorer opens supplied rule explanations, input lines, and source references for v1/v2/v3. Graph traversal is recursive and cycle guarded. This shows the supplied computation; it does not independently certify it. |
| C02 | 1 | Reconcile figures that ought to agree | Partial | Sixteen curated discrepancy/judgment/check findings include payments, income overlap, and basis. No generalized reconciliation record or coverage across totals, books, assets, sales, payments, and agency records. |
| C03 | 1 | Handle hundreds of sales without overwhelming review | Partial | Form filtering/search reduces return lines, including F8949. No grouped sales review, source-lot drilldown, aggregate reconciliation, pagination/virtualization, or bulk review state. |
| C04 | 1 | Handle many assets without overwhelming review | Partial | Individual `asset:` sources resolve. `return_versions[*].assets` is not exposed as a browsable asset register with grouping/filtering. |
| C05 | 1 | Take business books to taxable income | Partial | SchC lines and selected issues can be traced. No dedicated bridge from book totals through permanent/timing adjustments to taxable income. |
| C06 | 1 | Split income between states | Partial | California schedules/lines exist and can be traced. No dedicated allocation bridge that reconciles all-state and CA amounts by income area/residency period. |
| C07 | 1 | Run checks that do not trust engine output | Partial | Curated findings compare contradictory source values, and the assistant retrieves those findings. No general independent arithmetic/reconciliation check runner with per-check outcomes. High-confidence mistakes are correctly not treated as verified. |
| H01 | 2 | Adjust while preserving original value, actor, reason, and tax effect | Partial | Immutable original packet plus reason-required curated adjustments and rate-based estimated effects are implemented. No arbitrary return-line adjustment. Tax effects are estimates, not a rerun, as required by the packet limitation. `Adjustment`, `applyCommand()`. |
| H02 | 2 | See changes live | Partial | The author refreshes after a command. Other tabs/users see no automatic refresh or subscription. |
| H03 | 2 | See what changed since the current viewer last looked | Missing | Audit history exists, but there is no per-person last-seen revision or unread-change view. |
| H04 | 2 | Compare versions | Partial | Can switch all three versions and compare summary cards. No dedicated line-by-line diff, added/removed lines, or reasons using `changes_from_previous`. |
| H05 | 2 | Try what-if scenarios | Missing | Five complete precomputed scenarios and their changed lines exist in `what_if.alternatives`, but are not exposed. No saved scenario decisions. |
| H06 | 2 | Act on many items at once | Missing | Reducer/API/UI support one action on one issue at a time. |
| H07 | 2 | Undo bulk or individual changes without deleting history | Partial | Individual curated adjustment undo exists and is tested. Bulk action/undo does not exist. |
| J01 | 2 | Flag significant prior-year swings | Partial | Static AGI +95.1% card exists. No general threshold-driven prior-year variance table, explanations, or unresolved flags. Supplied 10% and $1,000 policy is displayed only. |
| J02 | 2 | Record professional judgment calls and supporting authority | Partial | Judgment investigation prose is required, but authority is not a separate validated field and decisions are limited to curated issues. |
| J03 | 2 | Record elections | Missing | No election record or selection workflow; supplied what-if choices remain unexposed. |
| J04 | 2 | Record due diligence | Missing | No structured due-diligence checklist, applicability, conclusion, evidence, or reviewer state. Starter policy mentions it only. |
| J05 | 2 | Record penalty decisions | Missing | Penalty is in imported return summaries and annualized what-if data. No recorded method/waiver/payment-penalty reasoning workflow. |
| J06 | 2 | Prove every document is used or accounted for | Partial | All 74 docs indexed with extraction/use metadata. No preparer disposition/verification/completeness gate for each document, including unextracted/corrected/unrelated documents. |
| J07 | 2 | Prove every tax area was considered | Missing | No full area applicability/completion register. A short queue of curated findings is not tax-area completeness. |
| J08 | 2 | Identify every outside filing | Missing | Related returns and FBAR/1099-NEC deadlines are present only in raw packet. No engagement-scope/outside-filing register, owner, deadline, or disposition. |
| P01 | 2 | Questions to clients become durable evidence | Partial | Staff can save a question draft, explicitly not sent. No in-app response, acknowledgment, evidence link, or closed-loop question status. No external sending is authorized merely by the PDF. |
| P02 | 2 | Questions to colleagues become durable evidence | Missing | No recipient/assignee field, response workflow, or colleague discussion entity. |
| P03 | 2 | Review notes can block filing | Complete | Open notes block approvals and freeze. Resolution is recorded, and tests exercise the gate. `applyCommand()` and `scripts/test-domain.ts`. |
| P04 | 2 | Sign-offs reopen when signed content changes | Complete | Material commands atomically invalidate active sign-offs and record invalidation revision/time. Tests cover state immutability and reopening. |
| P05 | 2 | Enforce roles | Partial | Server domain enforces tax action roles and independent review. Some uploads are not role checked; administrator has no policy action. Fictional persona cookie is explicitly local demo access, not production authentication. |
| P06 | 2 | Several people can work at once | Partial | SQLite persistence + expected-revision compare-and-swap prevent silent lost writes. No automatic cross-session update or presence, and persona selection is a browser-wide cookie. |
| P07 | 2 | Assign work | Missing | Packet initial staff assignments are not displayed/editable, and findings/areas cannot be assigned. |
| P08 | 2 | Track deadlines | Missing | `firm.deadlines` remains in raw packet; no task deadline/due-state workflow. |
| P09 | 2 | Notify people about actionable changes | Missing | Only transient success toasts exist. No durable per-person notifications, unread markers, or assignment/review alerts. In-app notifications can be built without sending external messages. |
| P10 | 2 | Record client approval tied to reviewed result | Complete | Client persona approval follows reviewer and partner review and binds to content revision. It is a fictional demo approval, explicitly not real legal authorization. |
| P11 | 2 | Record e-file signature | Missing | Imported signature/rejection timeline documents exist, but no signature evidence/authorization record or workflow. The existing approval text explicitly disclaims real e-file authorization. |
| F01 | 2 | Manage extensions | Missing | Complete supplied extension calculation exists in `what_if.extension`; not exposed as a workflow or record. |
| F02 | 2 | Manage filing | Partial | Partner can freeze a reviewed overlay. No submission-attempt record, jurisdiction state, acknowledgment, payment tracking, or filing timeline. Actual agency transmission is outside a local prototype and is not authorized by this audit. |
| F03 | 2 | Handle e-file rejection and correction | Missing | Packet contains rejection/acceptance events and identity correction evidence, but no replay/correction/resubmission workflow. |
| F04 | 2 | Give the client a return copy | Partial | JSON review export exists. It is neither a readable client return package nor a client-specific copy with authorization, amounts, next steps, and evidence boundaries. |
| F05 | 2 | Freeze the filing record | Complete | Deep-copied reviewed overlay/approvals plus packet SHA and content hash are persisted; later material writes are blocked. This is an internal simulated filing record, not an assertion that baseline engine figures were actually filed. |
| F06 | 2 | Amend on top of the frozen record | Missing | Frozen state rejects changes with a message telling the user to create an amendment workflow, but no amendment command/entity exists. |
| F07 | 2 | Answer notices with a self-contained record | Missing | `/api/export` deliberately excludes full document pages/evidence, private attachments and full source packet; no notice response builder. UI calls it “self-contained,” while API honestly says it is not the completed examination package. |
| F08 | 2 | Carry forward records and history | Missing | Supplied incoming/outgoing carryovers are not a functional next-year handoff; no carryforward snapshot/history link. |
| F09 | 2 | Plan next year | Missing | `planning_reference_2026` and post-filing rates are unexposed; no saved assumptions, payments schedule, or plan record. |
| O01 | 2 | Support firm-wide standards | Partial | Eight standards are hardcoded display text. No administrator editing, standard version, applicability, or enforcement of all required steps. |
| O02 | 2 | Protect sensitive data | Partial | Recursive masking + source-secret patterns, no client packet bundling, private local files, loopback gate, no-store reads. No production identity/membership boundary; local SQLite directory encryption/retention operations are not implemented. |
| O03 | 2 | Log sensitive-data views | Partial | Cleared uploaded-original downloads write `sensitive_views`. Imported identifiers remain masked for everyone, with no logged authorized reveal, and no in-app view-log screen. |
| O04 | 2 | Track time against budget | Missing | Supplied area budgets remain in raw packet. No time entry, author, duration, area allocation, or budget variance. |
| O05 | 2 | Track firm/work status | Partial | Static “In review,” queue/readiness counts, and revision exist. No computed engagement status transitions, assignments, deadlines, or firm overview. |
| O06 | 2 | Search workpaper records | Partial | Separate issue/document/return-line searches exist. No unified search over source pages, client communications, decisions, notes, assets, prior-year records, and filing artifacts. |
| R01 | 2 | Return summary compared with last year | Partial | Current federal/CA cards plus one prior-year AGI card. No comprehensive prior/current summary with variances and explanations. |
| R02 | 2 | Tax computation | Complete | Supplied return lines, dependencies, rules, form filtering, and version selection are browsable. This is the provided calculation record, not a new tax engine. |
| R03 | 2 | Tax-area summaries | Missing | No complete area inventory with totals, evidence, decisions, checks, open work, owner, and review status. |
| R04 | 2 | Document index | Complete | All 74 document records and 199 simulated pages are indexed with title/type/year/extraction/use metadata and filters. |
| R05 | 2 | Depreciation by individual asset | Partial | `asset:` evidence can resolve, but there is no full asset register for review. |
| R06 | 2 | Show each asset's method and life | Partial | Supplied asset source records may display as raw evidence JSON. No structured columns/comparison. |
| R07 | 2 | Show each asset's bonus depreciation | Partial | Present in supplied assets/return lines, not a dedicated register. |
| R08 | 2 | Compare depreciation federal, California, and AMT | Partial | Separate imported values exist; no side-by-side asset comparison with differences highlighted. |
| R09 | 2 | Show asset disposals and recapture | Partial | Supplied sale/recapture lines and prior assets can be traced, but no asset disposal reconciliation. |
| R10 | 2 | Sales detail | Partial | F8949 line filtering and source lots exist. No grouped lot ledger/sales summary-to-return tie-out and review workflow. |
| R11 | 2 | Books-to-tax record | Partial | SchC line tracing exists; missing dedicated book-to-tax bridge and reviewed adjustments/reconciliation. |
| R12 | 2 | Rental records | Partial | SchE and sale lines exist; no per-property operating summary/asset/history page. |
| R13 | 2 | Passive-loss records | Partial | Form/source line evidence exists; no explicit beginning/activity/allowed/suspended carryforward reconciliation. |
| R14 | 2 | K-1 line records | Partial | Supplied SchE/F7203 and source fields trace, but no entity-by-entity K-1 line register with corrected/late status, state supplements, basis gaps, and reconciliation. |
| R15 | 2 | Retirement item records | Partial | F8606 and source evidence available; no dedicated IRA contribution/conversion/basis timeline and checks. |
| R16 | 2 | Foreign item records | Partial | Foreign account/FX finding and trace exist. No dedicated account/FX/credit/FBAR outside-filing summary. |
| R17 | 2 | Deductions with limits | Partial | SchA and limit calculation lines exist. No area-specific review view of claimed/source/limited/carryforward amounts. |
| R18 | 2 | Credits with limits | Partial | Credit form lines and some findings exist. No credit eligibility/limit/due-diligence review view. |
| R19 | 2 | Payment records | Partial | Return payment lines, agency pointers, two curated discrepancies. No ledger reconciling taxpayer claims, IRS/FTB records, tax year, application, and payment dates. |
| R20 | 2 | State split record | Partial | CA schedule lines exposed; no dedicated all-state/CA income allocation reconciliation. |
| R21 | 2 | Carryover records | Partial | Prior-year pointers may resolve; `carryovers_out` not exposed in a dedicated incoming/used/outgoing record. |
| R22 | 2 | Basis by year | Partial | Prior-year basis pointers/F7203 lines exist; no multi-year basis rollforward with gaps/changes visible. |
| R23 | 2 | Compare prior preparer's actions against current changes | Partial | Raw prior-preparer evidence can resolve by pointer and current audit exists separately. No linked treatment comparison, provenance, or handoff narrative. |
| S01 | 2 | Correctly represent the invented joint 2025 household and CA-to-TX move | Complete | Household header, current return, sources, and CA schedules preserve that supplied case. No actual taxpayer/filing claim. |
| S02 | 2 | Cover stock compensation, business, investments/crypto, foreign, rentals/sale, K-1s, S-corporation basis, Roth, education, and noncash gifts | Partial | Packet is loaded and all forms/docs browseable. Curated issues cover selected areas, but structured records/completeness above are missing. |
| S03 | 2 | Handle late/corrected documents and client-only answers | Partial | Corrected metadata, three versions, source answers, and curated issues exist. No event replay clock/intake-triggered availability or in-app response lifecycle. |
| S04 | 2 | Start at extraction; load delivered 74-document/~3,000-value packet and confidence | Complete | Immutable 74/199/3,012 packet with source IDs/confidence, SHA pinned in tests. No new extraction pipeline is necessary. |
| S05 | 2 | Use all three computed versions | Complete | All three versions and their return lines are selectable and source resolvable. |
| S06 | 2 | Expose client answers, prior years, IRS data, and firm staff as usable evidence | Partial | Some sources resolve by ID/pointer and all staff available. Much of the packet has no discovery/index UI. |
| S07 | 2 | Replay the season using the supplied timeline | Missing | Timeline records resolve by ID but have no browseable/replay workflow; future evidence is available at the baseline. |
| S08 | 2 | Do not mistake confidence for truth; surface confident mistakes | Complete | Source and pipeline values shown separately; 16 curated findings identify actual contradictions with source links. Confidence is labeled extraction confidence. |
| S09 | 2 | Use provided tax results rather than build tax-law/document-reading machinery | Complete | Engine values remain supplied baselines; no fabricated rerun. Effects are explicitly estimates. A general extraction/tax engine is unnecessary. |
| D01 | 3 | Deliver a working app run from a link | Partial | Loopback app link works locally. No shared hosted URL/deployment; user rejected OpenAI Sites, and GitHub upload alone does not host the app. Deployment requires a separately chosen target/auth model. |
| D02 | 3 | Load packet exactly as delivered | Complete | Packet SHA and optional byte comparison to original source tested. Domain edits create overlays rather than mutate the packet. |
| D03 | 3 | Save everything | Partial | Commands, audit, AI runs, uploaded files persist. Many required workflows do not yet exist; attachment metadata writes are not workspace revision/audit events. |
| D04 | 3 | Include a role switcher | Complete | Eight supplied fictional staff/client personas via server-set local cookie and labeled role picker. |
| D05 | 3 | Provide one page explaining the core idea and data model | Missing | Root architecture report and development docs are much longer and not the requested one-page deliverable. |
| D06 | 3 | Report errors found and how the design surfaced them | Partial | Curated issues plus root task-review report explain many errors. No concise submission-ready error/design evidence document linked from app. |
| D07 | 3 | Video of applicant walking prototype, technical decisions, and tradeoffs | Missing | No applicant recording or video link. A script/checklist can be prepared; the assistant cannot truthfully record itself as the human applicant. |
| D08 | 3 | Disclose tools, including how AI was used | Partial | README/AI setup disclose optional runtime assistance, but no development/submission tools-and-AI disclosure. |

## Priority development plan

1. **Complete the review foundation**: a general verification/evidence-link model; structured decisions with authority; full document/area/outside-filing completeness; independent checks; meaningful required-step gates. Prevent completeness from being inferred from “16 findings resolved.”
2. **Expose existing supplied records**: full prior-year summary/diffs; area records, assets and depreciation dimensions, sales, book-to-tax, state allocation, basis/carryovers, payment reconciliation; use precomputed what-ifs and extension data. Do not invent a tax-engine rerun.
3. **Finish team workflows**: assignment/deadline/time records, per-person notifications/last-seen revision, question/response evidence, and refresh of concurrent work. Server enforcement must match visible UI actions.
4. **Add the lifecycle**: event replay with source availability, signature evidence, filing-attempt/rejection/acceptance records, immutable freeze, amendment derived from a frozen parent, readable client copy, self-contained notice package, carryforward handoff and saved planning.
5. **Make firm rules operative**: administrator-edited/versioned standards, applicability and required steps, sensitive-view-log screen, retention state and time-budget comparisons. Displayed promises must match implemented enforcement.
6. **Prepare hand-in materials**: one-page idea/model, error/design report, truthful AI/tool disclosure, and applicant recording script. Public deployment and the applicant's recorded video remain distinct human/account-dependent deliverables.

## Baseline risks that verification must specifically check

- The Activity export link says “Download self-contained record” but the API explicitly states it is not the completed self-contained examination package. Either build the package or label the current export accurately.
- The Settings policy list is display text, not proof every rule or required step is enforced. It includes retention, authority and prior-year review claims without corresponding workflows.
- Baseline `sourceRange()` finds the first matching text or label-like segment; repeated amounts and extraction errors can mislead. The packet's `position` values are synthetic, so coordinate display must not pretend to prove a physical original-page location. Stable field references and explicit approximate-excerpt labels are needed.
- Clearance is a local persona attribute, not authenticated production identity. A hosted deployment needs an appropriate demo/authentication decision before removing the existing loopback production guard.
- Saved user prose can contain anything, including copied document instructions. It must remain untrusted evidence and must not become runtime/model instructions.
- Freeze currently proves a reviewed overlay was preserved; it does not prove the supplied uncorrected engine totals equal a final filed return. Keep exact precomputed outcomes, estimated effects, and simulated agency events distinct.

## Verification handoff

The verification agent should independently revisit every atomic row after development, list concrete UI/API/test evidence, and classify remaining items honestly. Passing the existing unit tests does not by itself close missing brief requirements. Validate persistence across reload, permission rejection through API calls, stale-write behavior, approval invalidation, source precision, snapshot immutability, replay boundaries, and self-contained export offline readability. Record any applicant video/public-hosting limitation separately from implementation defects.
