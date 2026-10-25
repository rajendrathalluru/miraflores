# Five-agent design debate

Review date: October 24, 2026. Status: five reviewers completed the cross-review, response and final challenge rounds. All attest that the revised blueprint retains every PDF feature; no architectural objection remains. This is agreement on the proposed design and its evidence limits, not implementation completion.

## Participants

| Reviewer | Responsibility and report | Attestation after peer responses |
|---|---|---|
| `case_feature_attestation` | [PDF contract and 105-row matrix](01-CASE-FEATURE-ATTESTATION.md) | All PDF features retained; strengthened partial rows after backend/assurance findings; no remaining scope/architecture disagreement |
| `solution_architecture_debate` | [Architecture and alternatives](02-ARCHITECTURE-PROPOSAL.md) | All feature groups retained; accepted consistency/access/export/runtime objections; no remaining architecture disagreement |
| `frontend_experience_debate` | [Frontend/visual design](03-FRONTEND-DESIGN-PROPOSAL.md) and [proposed specimen](03-FRONTEND-WIREFRAME.png) | All groups and CPA records retained; accepted save/draft/access/focus objections; no remaining architecture disagreement |
| `backend_data_debate` | [Backend/data design](04-BACKEND-DATA-PROPOSAL.md) | Final review accepted revised blueprint and every PDF feature; no remaining architectural dissent |
| `assurance_debate` | [Independent assurance and acceptance](05-ASSURANCE-AND-CHALLENGES.md) | Final independent reread accepted the revised blueprint and full PDF contract; no unresolved design objection, with implementation/acceptance gates open |

The workspace permits three simultaneous subagents. Five distinct reviewers participate in staggered rounds; this is not a claim of five concurrent processes or five runtime AI agents in the product.

## Process

- Round 1: independent requirements, architecture and frontend proposals, with direct peer challenges.
- Round 2: backend and assurance reviewers critique those proposals against the original PDF and actual implementation.
- Round 3: the initial reviewers respond to objections and revise their recommendations.
- Final challenge: backend and assurance reviewers assess the revisions; the coordinator records decisions, dissent and the complete feature contract.

Every reviewer must distinguish actual code, prior test evidence, newly checked behavior, proposed design and future possibilities. The PDF is the product scope. All its required features must be represented; a prettier or simpler design cannot silently omit them.

## Recorded debates

These are actual proposal/challenge/reply exchanges from the five reviewers, followed by coordinator consolidation. Agreement was recorded after replies rather than inferred from similar independent reports. Evidence references below are source inspection and proposed validation unless explicitly described otherwise.

### 1. Scope: the complete supplied workpaper

**Proposal:** design the complete workpaper around claims and evidence. **Challenge:** the requirements reviewer objected to a smaller polished dashboard built only around the 16 curated issues, and to adding upstream OCR/tax computation that would displace the brief. **Reply/resolution:** architecture and frontend accepted all PDF groups and all R01-R23 records; every reviewer retained the packet's post-extraction scope. **Tradeoff:** depth in the supplied case before generic onboarding. **Features:** all 105, especially B01-B05, J06-J08, R01-R23 and S01-S09. **Check:** all 105 matrix IDs occur exactly once; actual acceptance still must execute every obligation.

### 2. Modular monolith versus a framework/services rewrite

**Proposal:** retain Next.js/React/TypeScript with explicit query, command, packet, repository, blob and artifact modules. **Challenge:** requirements asked which PDF need justified independently deployed services; each reviewer considered a credible split frontend/API alternative. **Reply/resolution:** no missing framework capability justified rewriting the current domain foundation. React/Vite plus a Node or Python API remains credible under a different team/deployment constraint; services and autonomous tax agents were rejected for this submission. **Tradeoff:** shared deployment and simpler transactions rather than independent service scaling. **Features:** B01-B04, P03-P06, F05-F07, D01-D03. **Check:** application journeys and atomic invariants, not diagram complexity.

### 3. SQLite versus PostgreSQL

**Proposal:** SQLite/private files on one durable host; PostgreSQL/private object storage for stateless or multiple-instance hosting. **Challenge:** backend challenged automatic normalization, nonportable SQL, aggregate-wide conflicts and an unqualified WAL recommendation. It inspected Node 22.15.0/embedded SQLite 3.49.1 and raised the documented patched-runtime condition; architecture, assurance and coordinator checked the official WAL source. **Reply/resolution:** keep conditional storage adapters, verify the database actually embedded in the selected runtime, implement/test a real PostgreSQL adapter if selected and rehearse coordinated restore. No corruption was observed. **Tradeoff:** minimum assignment infrastructure versus operational fit. **Features:** P06, F05/F07, O02, D01/D03. **Deferred:** host and consequent adapter. **Sources:** [SQLite use cases](https://sqlite.org/whentouse.html), [WAL](https://sqlite.org/wal.html), [PostgreSQL isolation](https://www.postgresql.org/docs/current/transaction-iso.html).

### 4. One review context versus browser composition of endpoints

**Proposal:** Queue/Evidence/Decision together. **Challenge:** frontend asked architecture to prevent mixing source, engine and review snapshots; backend required edit/material-content revisions, packet identity, cycle and frozen parent/hash. Assurance added historical replay semantics. **Reply/resolution:** a role-scoped ReviewContext captures the complete consistency token and provenance from one state. Backend caught the missing explicit replay token and vague frontend revision label in the coordinator's first draft; both were added and rechecked. **Tradeoff:** one deliberate read contract rather than ad hoc client joins. **Features:** B02, E01-E07, H04/H05, P04, F05-F09 and R02. **Check:** all panels agree on packet/version/revisions/cycle; historical replay does not backdate decisions.

### 5. Safe concurrency, unrelated activity and retries

**Proposal:** retain optimistic revision checks. **Challenge:** backend observed even harmless activity can advance global edit revision; a lost response can also leave a committed action looking failed. **Reply/resolution:** preserve global CAS now, distinguish unrelated activity in conflicts, preserve safe rationale, and propose actor/body-bound request identity for reconciliation/idempotent retry. Automatic financial-command replay was rejected. Partitioning actor-local activity is deferred until semantics and tests exist. **Tradeoff:** conservative rejection is safer than silent overwrite; better explanations reduce frustration. **Features:** H01-H03/H06-H07, P04/P06, D03. **Check:** independent sessions, stale-write rejection, lost-response retry with exactly one authored effect and audit history.

### 6. Draft, save and freshness truth

**Proposal:** preserve work during refresh/conflict. **Challenge:** assurance found unconditional “All changes saved,” swallowed polling failures and different risks for ordinary rationale versus sensitive identifier plaintext. **Reply/resolution:** frontend specified independent draft/save/freshness states, including uncertain commit; ordinary drafts remain scoped to access session/persona/engagement/item. Sensitive values clear on hide, timeout, dismissal, conflict or role/session change and are never restored as ordinary drafts. Assurance and backend requested these distinctions in the consolidated document; coordinator added them explicitly. The specimen's “Saved work” label became “Draft · not saved.” **Tradeoff:** honest intermediate states require more deliberate interaction logic. **Features:** B02/B05, H01-H03, O02, D03. **Check:** pending, failed, offline/stale, conflict and interrupted-response paths, with no cross-role draft leak.

### 7. Polling versus WebSockets

**Proposal:** focus-aware polling with visible freshness and server CAS. **Challenge:** architecture asked whether “live” requires a transport service; frontend and assurance challenged any instant-collaboration claim. **Reply/resolution:** retain polling at assignment scale, state its bounded refresh behavior and test separate cookie jars sharing the same engagement. Ordinary tabs sharing a persona cookie do not demonstrate separate selected roles. WebSockets/presence are deferred until a measured need. **Tradeoff:** bounded latency with less infrastructure. **Features:** H02/H03, P05/P06. **Check:** both sessions observe changes within declared behavior and conflicting writes never silently overwrite.

### 8. Access identity, demonstration role and client visibility

**Proposal:** preserve the PDF's role switcher. **Challenge:** backend and assurance found the local owner/persona is not genuine identity and bootstrap sends every persona the entire masked workspace. Masking does not hide internal staff notes/budget. **Reply/resolution:** requirements, frontend and architecture accepted separate trusted evaluator access, workspace scope and fictional persona. A disclosed evaluator sandbox is defensible; genuine client/team claims require server-enforced role-specific query/search/export DTOs and direct-read denial. Blanket production multi-client identity was rejected as an invented assignment prerequisite. **Tradeoff:** deliberate demo access with honest limits versus a broader identity integration. **Features:** B03, P05/P06, O02, D01/D03/D04. **Check:** role-specific denied commands and reads, guessed references, export/reveal routes and shared-session persistence.

### 9. Revision-exact offline export

**Proposal:** a self-contained notice/examination record. **Challenge:** assurance found the route loads state before querying all attachment/correction rows; backend, requirements, architecture and coordinator confirmed that code. A newer file may enter an older declared revision and missing expected hashes currently pass. **Reply/resolution:** capture exact IDs plus metadata consistently, require every hash, read immutable bytes outside the short transaction and fail/retry inconsistent manifests. F07 is now partial in the row attestation. **Tradeoff:** explicit snapshot assembly/retry rather than long transactions spanning blob I/O. **Features:** E08, F05/F07, P06, D03. **Check:** deterministic interleaved upload/correction/export plus offline completeness. This was source-inspected, not reproduced or repaired in this review.

### 10. Private bytes, keys and recovery

**Proposal:** keep private local files and encrypted corrections behind adapters. **Challenge:** architecture/backend noted staging plus SQL is not one atomic transaction, crash cleanup differs from caught-error cleanup, and the database alone cannot restore originals or decrypt corrections. **Reply/resolution:** immutable content-hashed keys, old-unreferenced-stage reconciliation and coordinated DB/files/protection-key recovery with a real restore exercise. **Tradeoff:** explicit lifecycle/recovery rather than a distributed transaction or elaborate service. **Features:** E08/E12, F05/F07, O02, D03. **Check:** crash/orphan boundaries, restored hashes/decryption and offline artifact creation. No restore was executed here.

### 11. Accessibility versus attractive overlays

**Proposal:** a restrained three-pane workspace and specialist record views. **Challenge:** frontend found missing modal focus trapping/return/inert behavior; assurance added topmost-only Escape and mobile reverse tracing hidden by CSS. **Reply/resolution:** all accepted concrete keyboard/focus/layer/mobile requirements; candidate accessible Dialog primitive is optional, actual behavior verification is mandatory. Native paginated detail remains adequate; a heavy data grid/library is deferred. **Tradeoff:** interaction correctness and readable domain relationships before decorative graphics. **Features:** B04/B05, E02/E03, C03/C04 and R01-R23. **Check:** keyboard, zoom, contrast, actual narrow-screen reverse links and observed tasks.

### 12. Confidence, verification and financial truth

**Proposal:** useful independent checks and optional read-only AI. **Challenge:** requirements/architecture challenged treating confidence as verification or adding exact isolated alternatives to estimated overlays into a supposed corrected final tax. **Reply/resolution:** every reviewer retained separate source observation, extracted reading, imported computation, independent verification, human conclusion, estimated overlay and exact supplied scenario. AI may find/explain evidence; a person records decisions and deterministic gates remain authoritative. **Tradeoff:** less automation, stronger defensibility. **Features:** B02, C01/C07, E04, H01/H05, F04, S08/S09. **Check:** confident mistake remains visible; unknown basis stays unknown; supplied scenarios do not silently mutate the reviewed return.

### 13. Feature attestation versus a completion certificate

**Proposal:** use prior verification as supporting evidence. **Challenge:** requirements and assurance rejected interpreting “102 verified” as newly retested, hosted, production or complete professional review. **Reply/resolution:** all reports distinguish inspected code, prior test results, proposed work, simulations and missing observations. The row matrix strengthens P05/P06/O02/D03 plus newly inspected F07/H02 limits. **Tradeoff:** explicit limits rather than an attractive unsupported score. **Features:** all 105. **Check:** fresh acceptance after implementation, not agent agreement.

### 14. Submission and usability evidence

**Proposal:** five representative demonstration journeys plus the complete acceptance contract. **Challenge:** assurance corrected any implication that five observed tasks or a participant count is literal PDF wording. **Reply/resolution:** five tasks are a proposed assessment method; the experienced-CPA/new-hire bar and shared app/model/errors/video/disclosure deliverables come from the PDF. A source repository is not a working app URL; a video script is not the applicant's recording. **Tradeoff:** focused narrative plus complete accessible capability. **Features:** B05 and D01-D08. **Open:** actual shared deployment, genuine applicant video and observed usability; proposed fixes also need implementation/testing.

## What the review produced

- One shared [case-study brain](CASE_STUDY_BRAIN.md), with the PDF expressly controlling scope.
- Five independent role reports, direct cross-agent challenges, formal responses and final backend/assurance review.
- A [recommended blueprint and build order](06-RECOMMENDED-BLUEPRINT.md), with architecture diagram and all-feature acceptance contract.
- A labeled [frontend specimen](03-FRONTEND-WIREFRAME.png), rendered and visually inspected as a design artifact.
- A complete 105-ID index. This is coverage evidence, not 105 new test passes.

No application rewrite, package install, server start, Git mutation, deployment, external communication or new application acceptance run was performed for this review. The backend's in-memory runtime metadata query and the SVG render are specifically limited checks. No agent vote grants implementation completion or closes applicant-only deliverables.
