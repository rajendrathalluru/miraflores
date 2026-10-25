# Agent 3: frontend, interaction and visual-design proposal

Review date: October 24, 2026, America/Chicago. Scope: the complete three-page assignment PDF, the supplied fictional packet and the current implementation. This is a design review, not a claim that the proposed interface is implemented.

## Recommendation

Keep Next.js, React and TypeScript. Make **one number, all its evidence, and the human decision visible together** the organizing idea. Improve the existing application rather than change frameworks. The reviewer should move between exceptions, tax areas and source documents without losing the selected return version, review history, draft rationale or exact source field.

The current app has substantial working case-specific behavior, but the expanded feature set is divided between eight main destinations, a long secondary tax-record menu and generic operation forms. The result is closer to a feature inventory than a cohesive daily review experience. A stronger job-assignment submission should demonstrate an original interaction model and truthful depth, not add an attractive dashboard over the same disconnected forms.

The packet is the assignment input. An arbitrary-document intake/OCR product, new tax-law engine, agent swarm, or broad multi-client platform would divert effort from the brief. Preserve an adapter boundary for another conforming packet without claiming general extraction or computation.

## Evidence inspected and limits of this attestation

- Read the full current extraction in `analysis/case-study-current.txt`; independently rendered and visually inspected all three PDF pages. Read `CASE_STUDY_BRAIN.md` and the 105-row baseline matrix.
- Inspected `app/page.tsx`, `app/components/workpaper-ui.tsx`, `source-viewer.tsx`, `expanded-workspace.tsx`, `record-tools.tsx`, `app/globals.css`, `app/expanded.css`, `lib/issues.ts`, `lib/records.ts` and `package.json`.
- Visually inspected `outputs/verified-expanded-workspace.png`. It proves the captured Tax records view existed, not the runtime behavior of every interaction.
- This review did not start a server, mutate application state, replay the prior test suite or conduct human usability sessions. Existing automated verification is evidence from the previous pass, distinct from this independent source/design review.
- “Present” below means an inspected code path exists. “Proposed” means the interaction/design change is not yet implemented. “Acceptance” is a required observation, not a report that it passed.

## Candid assessment of the current experience

**Keep:** the restrained ivory/sage brand; readable field identity; separate original/extracted/engine concepts; honest simulation and estimated-effect labels; persistent audit; area coverage; version differences; source-linked findings; and expandable detail rather than an editable spreadsheet.

**Improve before submission:**

1. **Review continuity.** Findings, line computations and source documents open separate dialogs. The reviewer must remember numbers across overlays. Opening one item should keep source and calculation context visible while making a decision.
2. **Operations discoverability.** `Operations` exposes generic forms for verification, adjustments, questions, filing and controls. Typing a value reference is useful as an expert fallback, but common actions should already know the selected number, field, area or document. A new hire should not need to discover an internal reference syntax.
3. **Dense records.** The screenshot shows substantial horizontal space consumed by main and secondary navigation, while key metadata is faint and small. The generic recursive `Value` renderer and record accordions ensure coverage but do not explain domain relationships. Keep raw record detail as an expandable inspector, not the primary presentation for assets, lots, basis or allocations.
4. **Review status versus correctness.** Sixteen curated findings are not the complete return. Display source disposition, verification coverage, area conclusion and open blockers separately. A resolved issue must not imply every associated field was independently verified or the supplied tax was recomputed.
5. **Accessible modal behavior.** `Dialog` currently supplies `role=dialog`, `aria-modal`, Escape and scroll lock. I found no focus trap, initial focus, focus restoration or inert background in that component. These are concrete implementation gaps; a role attribute alone does not complete an accessible modal.
6. **Live work and conflicts.** `page.tsx` refreshes on focus and every 10 seconds. On 409 it refreshes bootstrap then shows an error. Preserve rationale and show the specific changed references with a compare/resubmit path. Do not claim instantaneous updates or collaborative locking.
7. **Navigation persistence.** Main destinations are local component state rather than durable routes. Introduce linkable item/version/section state so reload, browser Back and a colleague's reference return to the same context. Never place sensitive identifier values or confidential free text in URLs.
8. **CSS coherence.** Multiple media overrides and later “reading comfort” rules complicate predictable hierarchy. Consolidate tokens and responsive rules before adding another visual layer. No current accessibility-conformance claim is warranted.
9. **Truthful persistence and freshness.** The existing sidebar's unconditional “All changes saved” is incorrect while rationale is unsaved or a command is pending/failed. Poll refresh errors are swallowed. Replace that slogan with explicit local draft, committed revision and server freshness states; a working connection never proves an unsaved decision was persisted.
10. **Identity and read scope.** Current bootstrap returns the complete masked review workspace to every demo persona. A focused client screen is not a read-access control. Define server-produced client/staff DTOs and permitted search/export results before claiming least privilege. The hosted evaluator's access session must remain separate from the fictional role switcher.

## Proposed information architecture

Use five primary destinations, with an always-visible global search and a role/context menu. All brief capabilities remain available; fewer top-level entries do not mean reduced scope.

| Destination | Default experience | Secondary views and actions |
|---|---|---|
| **Review** | Prioritized work queue with “Assigned to me,” changed since last seen, blockers and area coverage | Findings; area conclusions; document accounting; per-value verification; bulk selection; judgments, elections, due diligence and penalties; reviewed history |
| **Return** | Current/prior summary and tax computation, with supplied version selector | Dedicated assets, sales, books-to-tax, rentals/passive losses, K-1/basis, retirement/foreign, deductions/credits, payments, state allocation, carryovers and prior-preparer comparison; version diff; supplied alternatives |
| **Evidence** | Complete document index and disposition, searchable by source, year, type and use | Exact field/page viewer; all destinations across versions/years/related returns; linked files/messages/notes; corrected/late/unused records; client questions and answers |
| **Team** | Work assignments, deadlines, unread changes/questions and review notes | In-app responses; time/budget; review/partner/client approvals; author/reviewer independence; activity; permission explanations |
| **Filing & next year** | Readiness, jurisdiction states and a clearly simulated lifecycle | Extension; signature evidence; filing/rejection/correction/retry; frozen record; client copy; amendment lineage; notice package; carryforward and planning; season replay |

Firm standards and sensitive-view logs live in the administration context, with a read-only standards summary reachable from readiness. Include a client-specific focused view with questions, the understandable return summary, approval and signature evidence. The role switcher remains explicitly labeled **Demo role**, not an identity/authentication guarantee.

## Primary workspace: three panes, one selected item

At a wide desktop viewport, use approximately 25% queue, 45% evidence and 30% decision, with sensible minimum widths. The top context bar fixes household/year, engine version, edit revision, material content revision, review cycle, frozen parent/content hash when applicable, selected replay time, access session context, fictional persona and draft/frozen/amendment state. A concise summary expands to the full consistency token; it must not imply edit revision and material content revision are interchangeable. A selected item is linkable. Queue can collapse; evidence can expand to full width.

- **Left: review queue.** Title, area, why flagged, materiality label, assignee, deadline and distinct verification/decision state. Filters never hide the existence of remaining blockers. Multi-select reveals an explicit scope bar and bulk preview; show affected references, reason and reversible action before committing.
- **Center: evidence and computation.** A small provenance chain reads `Document/page/field -> extracted reading -> supplied rule/return line -> reviewed overlay`. Selecting a node opens a legible source or arithmetic view. The source field ID, page and label remain visible. Printed source and pipeline reading are separate values. Approximate text excerpts and synthetic coordinates are clearly labeled; repeated amounts never receive a false exact highlight.
- **Right: decision and accountability.** Relevant verification method, conclusion, authority where required, question/review note, proposed overlay and estimated tax effect; existing decision, author, revision and reviewers below. The action applies to the selected item automatically. Preserve the original and bind every conclusion to stable references and the reviewed revision.
- **Below, on demand:** related year/return links, all destinations, source disposition, prior preparer treatment, and change history. These are expandable context, not hidden workflow obligations.

On narrower screens use a persistent selection heading with Queue / Evidence / Decision tabs; do not shrink text to fit three panes. Keep horizontal scrolling inside genuine financial-detail tables, with row/column headers. Evidence reverse tracing must remain reachable on mobile; the existing mobile rule that hides `.document-uses` should not remove its only access point.

Every financial number has a visible origin/status affordance. Hover may enhance discovery but cannot be the sole way to inspect it. State vocabulary: **Unverified, Verified by [method], Discrepancy open, Decision recorded, Reopened, Reviewed at content revision X / cycle Y, Frozen**. “Verified” describes the saved method and scope, not a global correctness guarantee. Historical season replay is explicitly read-only; it cannot backdate a new decision. An amendment always names its frozen parent and digest.

### Persistence, freshness and conflict states

Saving and freshness are independent UI dimensions. A successful refresh does not mean an editor draft was saved; a saved revision can still be stale relative to another person's work. Show the last successful refresh time, current committed edit/content revisions and selected cycle. Use a quiet persistent status area plus an inline editor state, not competing success toasts.

| Situation | Required visible state and safe action |
|---|---|
| Editor changed, no request sent | **Draft — not saved**. Preserve ordinary rationale in memory; review/approval actions use committed content only |
| Request in flight | **Saving…** for that action; guard repeated clicks without blocking reading. Do not optimistically claim a financial decision is saved |
| Server confirms transaction | **Saved at edit revision X** with the relevant content revision/cycle; then clear only the acknowledged draft |
| Request fails before known commit | **Save failed — draft retained**; explain validation/permission/connection failure and offer deliberate retry |
| Response lost, commit uncertain | **Save status unconfirmed**; reconcile via proposed request identity/status before retry. Never silently replay a financial command |
| Poll finds a new revision | **Changes available** and affected references/actors. Update safe read context without replacing an active editor's original comparison |
| Poll fails or server cannot be reached | **Refresh unavailable — last checked [time]**; if browser offline, say **Offline** as an additional signal. Do not promise offline writes. Keep existing view and draft with stale warning |
| Same-target material facts changed | **Review changed facts before saving**. Present original/fresh values, source/rule changes and saved competing decision; retain rationale and require explicit resubmit against the new revision |
| Only unrelated/nonmaterial activity advanced the global revision | **Workspace activity changed; selected facts unchanged** if confirmed by the server's consistent comparison. Retain draft and offer explicit retry; do not auto-merge or weaken the existing global CAS |

Key non-sensitive drafts by access-session identity, selected persona, engagement/packet, engine version, item, cycle and captured content revision. Preserve them across ordinary polling and a 409 in that same context. Before changing persona, household, version or cycle, warn about the unsaved draft and offer **Stay**, **Discard and continue**, or a supported server-owned save-draft action. Do not silently carry it into the new context. After access-session logout/expiry, clear sensitive material; a protected session must not restore another person's draft.

Sensitive identifier correction fields have a stricter lifecycle: clear plaintext immediately on role/access-session change, hide, timeout, hidden-page transition and dismissal, and do not restore it following a conflict. Retain only a safe generic failure message; any re-entry requires a fresh authorized source view. Never persist identifiers in localStorage or an ordinary draft store. Preserving ordinary rationale is not permission to retain protected identifiers.

For shared access, query responses are expressly scoped: a genuine client view receives its own questions/answers, understandable return summary, relevant shared documents and current approval/signature state; internal staff reasoning, other staff work, budget and privileged exports are excluded unless policy explicitly grants them. Staff/examiner/admin views follow their separately defined permissions. Every API, guessed reference, search result and export must enforce this on the server. A controlled evaluator may explore disclosed fictional roles, but this is not evidence of real client identity or least privilege.

## Every brief feature group attested to a design surface

This mapping covers all baseline IDs without replacing their more granular verification matrix. It is design coverage; several proposed interactions still require implementation and independent verification.

| PDF group / baseline IDs | Required interaction and record binding | Current inspected support versus proposed change | Acceptance example |
|---|---|---|---|
| Purpose, people and modern workpaper: B01-B05 | Review-first shell, role-specific entry, persistent context and progressive disclosure | Present case app and roles; proposed coherent navigation and review workspace. CPA speed/day-one usability unproven | New hire locates a number, proves its source and records a conclusion unaided; experienced CPA completes equivalent task with measured time and correct reasoning |
| Evidence: E01-E12 | Select any line/field -> source page/field -> method/conclusion; reverse destinations and unused reason; links to related years/returns; attachments, messages and notes tied to stable targets | Present source viewer, synthetic-locator disclosure, methods and bound originals; proposed persistent side-by-side view and stronger reverse-link navigation | D23 page 3 opens from mileage finding; duplicate-page reason is stored without deleting the page; all related destinations and verification method remain reachable after reload |
| Calculation and scale: C01-C07 | Focused supplied computation chain; independent check result and inputs; grouped sales/assets; books and state bridges | Present record groups, checks and paginated rows; proposed domain-specific summary/detail views and visible tie-outs | Filter a broker population, reconcile its subtotal to return total, inspect one lot and identify a source disagreement without opening hundreds of rows |
| Change: H01-H07 | Original/proposed/actor/reason/effect; revision feed and changed-since; version diff; supplied alternative separated from estimates; selected-scope bulk preview and historical undo | Present adjustments, polling, diff/scenario/bulk code paths; proposed draft-preserving conflict compare and contextual bulk UI | A stale tab receives a conflict showing changed refs; its rationale survives; explicit resubmit creates a new audited revision; bulk undo leaves history intact |
| Judgment and completeness: J01-J08 | Variance explanation; typed judgment/election/diligence/penalty decisions with evidence and authority; documents, areas and outside filings with owner/deadline/disposition | Present area/disposition/judgment forms; proposed contextual actions and one completeness breakdown | A no-use document needs a specific reason; “all curated findings closed” alone does not clear document/area/outside-filing obligations |
| People: P01-P11 | Targeted questions answered by intended persona become linked evidence; blocking notes; revision-bound sign-offs; clear role controls; assignments/deadlines/notifications; client approval and simulated signature evidence | Present workflow commands and role picker; proposed role-focused task entry and honest freshness/conflict UI | Change reviewed content: reviewer and partner approval reopen atomically; client sees the reopened state; prohibited API action fails even if UI is bypassed |
| Filing/after: F01-F09 | Guided state machine with clear prerequisites and simulated acknowledgment history; immutable filing revision; amendment parent; readable client copy; offline notice package; continuity and planning | Present lifecycle/export/planning code paths; proposed one guided lifecycle workspace and permanent snapshot context | Rejected simulated filing -> supported correction -> retry; frozen original remains unchanged; notice package opens offline with cited evidence; amendment displays frozen parent |
| Firm: O01-O06 | Versioned policy -> applicable check/gate; logged reveal; time/budget; computed status; global search | Present controls, sensitive view/correction flows and logs, time and search; proposed admin/work entry points and contextual status explanation | Denied client reveal is server rejected; allowed reveal is logged; hidden/timeout clears value; search result returns to exact item; saved standard version is visible in review |
| Standard records: R01-R23 | See the dedicated record design below; every row/subtotal links into the same review context | Present broad record projections/accordions; proposed specialist views with scoped review, reconciliation and absent-value semantics | Select an asset and compare method/life/bonus/Federal/CA/AMT/disposal; inspect basis by year and distinguish missing history from zero |
| Supplied complex case and data: S01-S09 | Household/year identity, both-state context, all tax areas, client-only questions, late/corrected sources, three versions and season replay; confidence separate from verification | Present single supplied packet and most projections; proposed discoverable timeline/context entry | Replay before a late K-1: future evidence is unavailable; advance season and review exactly what arrived/changed; a 97% confident error remains open until evidence reviewed |
| Submission: D01-D08 | Shared app link, saved work, demo role, one-page idea/model, error walkthrough, human applicant video and AI/tools disclosure | Code/docs cover case prototype; shared hosted URL, actual applicant video and observed usability remain open | Recipient opens the agreed hosted link, changes role, saves and reloads; reads one-page idea; watches genuine applicant video showing real behavior and tradeoffs |

### Dedicated CPA records, without recreating spreadsheets

| Required records | Presentation and decisive interaction |
|---|---|
| R01-R04 summary, tax computation, areas, documents | Prior/current amounts with absolute/percentage changes and explanation; supplied rule dependency detail; area completeness cards; document use/disposition index |
| R05-R09 assets and depreciation | Asset summary groups by property/business/disposal; expandable asset card with side-by-side Federal/CA/AMT, method, life, bonus and current/accumulated amount; disposal/recapture links. A compact table is a lookup instrument, not an editable workpaper canvas |
| R10 sales | Broker/form category summary -> filtered lots with count, proceeds, basis, gain and missing-basis status -> exact-lot source. Aggregate check stays visible across 25-row pages; use virtualization only if measured need emerges |
| R11-R13 books, rentals, passive losses | Book profit -> individually sourced permanent/timing adjustments -> supplied taxable result; property cards with operations, sale and passive-loss beginning/activity/allowed/suspended bridge |
| R14-R16 K-1, retirement, foreign | Entity/late/corrected K-1 cards and linked line/basis history; IRA contribution/conversion/basis timeline; account/FX/foreign-credit and outside-filing checklist. Historical unknowns remain explicit |
| R17-R20 deductions, credits, payments, state | Claimed -> eligible -> limited -> allowed/carryforward views; payment ledger aligns claimed/agency/year/applied; all-state/CA allocation columns and residency timeline, each with tie-out inputs |
| R21-R23 carryovers, basis, prior treatment | Beginning + additions - used = ending with year/source links; separate missing-basis warnings; prior-preparer treatment alongside current source-backed decision and its author/authority |

## Visual system and useful graphics

Retain a quiet professional identity, with typography and hierarchy doing more work than decoration. Proposed tokens: background `#F6F7F3`, surface `#FFFFFF`, primary ink `#1F3029`, secondary ink `#4F6056`, border `#D4DED5`, accent `#245C45`, warning ink `#8A4B08`, danger ink `#9F342B`, blue comparison ink `#245E86`. These are candidate tokens, to be checked as actual text/background/control combinations before claiming WCAG compliance.

Use system/locally bundled sans text, tabular lining numerals, 15px body/14px financial rows, 12px metadata as the default lower bound, 20/28px section/page headings, 4/8/12/16/24/32px spacing, 8px corner radius, modest borders and almost no shadow outside overlays. A density preference may reduce row padding, not essential text below a comfortable size. Distinct text + icon labels carry status; color alone does not.

Useful graphics have a named question and linked evidence:

1. **Provenance chain:** why this number exists. A short DAG/list expands one dependency at a time; keyboard-accessible linear equivalent is always available. A giant animated network would obscure the review.
2. **Book/state/basis bridge:** why totals differ. Small annotated waterfalls or aligned bars accompany the full arithmetic table; missing inputs break the bridge visibly rather than fabricate a balanced result.
3. **Review coverage:** what remains unresolved. Separate document, area, verification and outside-filing counts, with blocker list. Avoid a single reassuring completion ring.
4. **Version/season timeline:** why the result changed. Sources arriving, corrected versions, judgments and approval invalidation share a readable timeline, with snapshot context and changed-ref drilldown.
5. **Comparisons:** current/prior and Federal/CA/AMT differences. Aligned values and compact variance bars support exact figures; do not replace values with charts.

Every chart has text labels, a table/list alternative and source links. No 3D charts, decorative AI art, or estimated “corrected total tax” assembled by adding isolated scenario effects. The SVG companion is a proposed layout specimen, not a screenshot of implemented behavior.

## Accessibility, keyboard and resilience

Design toward WCAG 2.2 AA and verify it; do not label the current app compliant. Check normal text at 4.5:1, large text at 3:1, visible focus, contrast of controls and all interaction states. W3C's target-size criterion uses 24x24 CSS px or listed exceptions; choose 40px ordinary controls and 44px touch targets for comfort, with properly spaced compact inline references. Do not misstate 44px as the AA minimum.

Provide skip links and named regions; semantic table headings; selection state announced independently from review state; an explicit focus order across panes. Modal/drawer opening sets focus, traps it where modal, makes background inert, and returns focus to the trigger. One modal-layer manager handles Escape: only the top layer closes, its event does not dismiss underlying dialogs, and focus returns to the correct parent trigger. Escape preserves a safe ordinary draft or invokes the same explicit unsaved-draft choice; sensitive correction dismissal clears plaintext. Route changes focus the selected heading. Status/error messages use appropriate live regions without announcing the entire refreshed screen. Test the complete lifecycle with nested source/decision views, keyboard only, 200% zoom and a narrow viewport; mobile reverse destinations are a required view, not optional metadata.

Optional documented shortcuts: `/` search when not typing; `j/k` move selected queue row without triggering mutation; Enter open context; Escape leave overlay; `?` show shortcuts. Every function remains reachable without shortcuts. Any single-key shortcut is disableable/remappable or only active with focused context. No sign-off, correction or filing action is bound to a one-key accidental commit.

At 200% zoom and narrow width, keep all fields/actions available and use a single-pane tab order. Respect `prefers-reduced-motion`; transitions can be 100-150ms opacity only, and never carry critical meaning. Persist drafts carefully as server-owned drafts or temporary memory; do not place sensitive rationale in unprotected localStorage by default. Error states retain entered evidence and show next action, not just “something failed.”

## Frontend stack decision and credible alternative

**Recommended:** keep installed Next.js App Router + React + TypeScript, CSS variables/CSS modules, existing Lucide icons, semantic HTML, native SVG for the few simple graphics and paginated detail. Keep source parsing, permissions, masked DTO construction and command validation server-side. Split the current large client page into review-context, evidence-viewer, decision-editor, records and lifecycle modules with typed view models. Use local React state for unsaved interaction, URL state for safe navigation, server responses for durable truth. Next's official guidance supports placing interactive pieces in Client Components rather than expanding the client boundary unnecessarily.

A headless accessible dialog primitive is a reasonable targeted dependency if its focus/keyboard behavior is verified against our actual nested-view use. It does not justify importing a full template UI kit or redesigning the app around library defaults. Do not add Redux, a graph database, WebSockets, a charting suite, drag/drop or a data-grid editor without a measured requirement. Current focus-aware polling plus explicit stale/revision state is sufficient for the assignment scale; a live transport can replace it later behind the same query contract.

**Credible alternative:** Vite + React Router + a separately hosted Node API. It can implement the same experience and offers an explicit SPA/API boundary. Here it would add a frontend migration, two deployment concerns and contract/CORS work with little user-facing benefit. A full AG Grid-style workbench is another credible option for large enterprise datasets, but it risks recreating a spreadsheet and is unnecessary for the supplied hundreds of lots and handful of assets. Retain targeted tables while making evidence and decisions the primary experience.

**Backend contract requested in debate:** `getReviewContext(itemRef, versionId, revision)` returns one revision-stamped, role-scoped projection containing engagement/packet digest, edit and material content revisions, review cycle, frozen parent/hash, replay context, source identity/content, extracted reading/confidence, supplied engine value/rule, saved human decision, separate estimates/supplied alternative, verification scope, blockers and changed-since markers. Commands retain `expectedRevision`; a conflict returns fresh consistency token, changed references and a distinction between selected-content changes and unrelated activity. A proposed actor-bound request identity supports ambiguous-response reconciliation and deliberate retry. These richer contracts are proposed rather than existing behavior. Server permissions and state-machine prerequisites remain authoritative; hiding a button is not enforcement.

## Five-minute applicant walkthrough

1. **0:00-0:35:** explain “a number carries its proof”; identify supplied fictional household, role and honest scope. Show readiness by distinct coverage categories, not a claimed corrected final tax.
2. **0:35-1:40:** open duplicate mileage. Display D23 page 3 and unique page totals 2,600 + 3,700 + 1,800 = 8,100 alongside supplied engine 11,800. Show stable field links and the duplicate disposition. Record reason/overlay while preserving original; effects remain estimated.
3. **1:40-2:25:** show broad detail: a broker summary -> one source lot -> return tie-out; an asset Federal/CA/AMT view. Distinguish missing basis from zero.
4. **2:25-3:10:** switch supplied version or replay late K-1 arrival; explain changed inputs and separate precomputed what-if. Show changed-since and a saved judgment/authority.
5. **3:10-4:05:** reviewer/client roles, blocking note, approval bound to revision; change content and demonstrate reopening. If using two sessions, show stale-write conflict with retained draft rather than fake simultaneous editing.
6. **4:05-4:40:** guided simulated filing/rejection/freeze/amendment; show a self-contained notice package and continuity record. Clearly label simulations.
7. **4:40-5:00:** one-page model, tradeoffs, what is implemented, tools/AI disclosure and remaining limits. The applicant records their own video; no AI impersonation.

This is the main demonstration path, not a substitute for access to the other required features. The release acceptance checklist must retain every atomic requirement.

## Debate log

- Sent architecture reviewer a challenge: avoid client composition of inconsistent endpoint snapshots; provide revision-consistent review context and conflict detail, preserve drafts, retain Next/React unless a concrete requirement justifies change.
- Architecture reviewer accepted the query-contract and draft-preservation proposal. They challenged scenario/overlay separation, frozen/amendment context and keyboard behavior. Accepted all three: no combined fictional tax total; always-visible parent revision; accessible focus is a release task.
- Replied that WebSockets and a global state library are not necessary to satisfy visible freshness/concurrency for this assignment. Current 10-second focus-aware polling + CAS can be adequate if tested in separate sessions and honestly labeled. Presence must not imply locks.
- Attestation reviewer confirmed B05 is unproven and that per-reference verification exists but is not universally visible inline. Document accounting covers 74 documents and area gates cover 13 areas; these capabilities do not establish that all fields have actually been checked. They challenged reducing the design to 16 findings. Accepted: every record group and completeness drilldown remains present; universal source/claim/computation/decision context is the organizing model.
- The coordinator cautioned that a new table library is unnecessary for the supplied 318 sales rows and that latest library APIs may differ from older examples. Accepted: retain native paginated detail; no table-library version/API is mandated. A targeted accessible-dialog primitive is the only potential frontend dependency addition, subject to actual application testing.
- SVG specimen parsed successfully as XML, rendered using the bundled Sharp runtime, and was visually inspected for clipping and overlap. This is design-artifact verification, not application verification.
- **Round 3, backend challenge accepted:** full edit/content/cycle/frozen-parent context, unrelated-activity versus financial-conflict distinction, context-keyed draft lifecycle and explicit role-scoped server DTOs. No objection rejected. I defer finer-grained CAS or moving activity state outside the aggregate until its consistency semantics are specified; the UI must accommodate the current safe aggregate revision today.
- **Round 3, assurance challenge accepted:** unconditional saved wording and swallowed polling errors are concrete trust defects. Added independent draft/save/freshness state machines, uncertain-commit reconciliation, topmost-only Escape/focus/inert/return requirements, mobile reverse tracing and protected-identifier clearing. No objection rejected. Offline write queues and real-time presence are deferred because they are not necessary to meet the assignment and introduce additional conflict/security semantics.
- **Root blueprint review:** read `04-BACKEND-DATA-PROPOSAL.md`, `05-ASSURANCE-AND-CHALLENGES.md` and draft `06-RECOMMENDED-BLUEPRINT.md`. No architectural disagreement: retain the monolith, conditional storage decision, complete feature contract and proposed-versus-proven distinction. Request the consolidated frontend section explicitly retain edit versus material content revision, cycle/parent context, role-scoped reads and uncertain save/freshness states. A plain “revision” or “all saved” label would lose the accepted safety/UX distinction.

## Primary technical/design references

- [Next.js: Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) supports a narrow interactive boundary. Installed versions remain the pinned project versions; browsing newer documentation is not a proposal to upgrade them.
- [React: Preserving and Resetting State](https://react.dev/learn/preserving-and-resetting-state) explains why component placement/key choices matter for draft survival. A revision refresh must not unexpectedly reset an editor.
- [Radix: Accessibility](https://www.radix-ui.com/primitives/docs/overview/accessibility) describes the focus and keyboard behavior supplied by its primitives, while leaving contextual labels and correct application composition to the developer. It is a candidate for targeted Dialog replacement, not a compliance guarantee.
- [W3C: Contrast Minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [Focus Not Obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html) and [Target Size Minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) ground the accessibility targets above. These are design/verification criteria, not a current compliance certificate.

Sources checked October 24, 2026. No package install, application rewrite, server start, Git mutation, hosting action or external message was performed for this proposal.
