# Shared case-study brief for the five-agent design review

This is the common reference for a job-assignment design review requested by the applicant. It is not a new product specification or permission to deploy, transmit a tax return, send external messages, spend money, or impersonate the applicant.

## Authority and scope

The applicant's latest explicit clarification is: **the supplied PDF is the entire assignment and the authority for what must be done**. The existing 105-item breakdown, implementation and prior reports are review aids. They cannot narrow the PDF or turn optional infrastructure ideas into required scope.

- Primary source: `/Users/rajendrathalluru/Documents/Presentation/Case_Study_Redesign_the_Tax_Workpaper (1).pdf`, all three pages. Full extracted text: `/Users/rajendrathalluru/Documents/ChatGPT/miraflores ai/analysis/case-study-current.txt`.
- The assignment asks for a complete, original web-native workpaper for **one complex fictional household**, starting after extraction and computation. The supplied JSON is the input. Building OCR, a new tax-law engine, or real agency transmission is not requested.
- Documents must be simulated from the JSON and retain stable document/page/field identity so originals could replace them later.
- The applicant wants an excellent frontend, useful visual design, a sound backend, and an architecture they can explain and defend in an interview. They explicitly asked for five agents to discuss and debate the best choices.
- The applicant has rejected OpenAI Sites hosting. GitHub repository: `https://github.com/rajendrathalluru/miraflores`. No deployment destination has been selected. Do not publish or change Git history during this review.
- A reusable import boundary is a desirable design quality. Do not confuse it with an obligation to process arbitrary raw tax documents or recompute any tax return.

## The product must prove

1. Where each number came from, how it was built, how it was checked, who changed/reviewed it, and what remains unresolved.
2. Exact source display and reverse tracing from each document into every destination, including unused reasons and related years/returns.
3. Calculation inspection; independent source checks; readable large sales/asset populations; books-to-tax and state-allocation records.
4. Preserved originals, attributable adjustments and tax effects, live revisions, differences since last review, version comparisons, what-ifs, bulk actions and undo.
5. Professional judgments, elections, due diligence and penalty decisions with authority, plus document/area/outside-filing completeness.
6. Questions/answers as evidence, blocking review notes, revision-bound sign-offs, independent review, enforced roles, collaboration, assignments, deadlines, notifications, client approval and signature workflow.
7. Extension, filing/rejection/correction, client copy, freeze, amendment lineage, self-contained notice evidence, carryforward and planning workflows.
8. Firm standards, sensitive-data protection and view logs, time/budget, computed status and search.
9. CPA records for prior/current summaries, computations, areas, documents, depreciation (method/life/bonus/federal/CA/AMT/disposals/recapture), sales, business, rentals/passive losses, K-1s, retirement/foreign items, deductions/credits/limits, payments/state split, carryovers/basis by year and prior-preparer treatment versus current decisions.

## Data and truth boundaries

- Fictional Okafor–Lindqvist household, joint 2025 return, CA to TX move, stock compensation, business, two brokerages/crypto, Swedish account, two rentals including a sale, late/corrected K-1s, S corporation basis gaps, backdoor Roth, education and charitable gifts.
- Delivered packet: 74 documents, 199 simulated pages, 3,012 extracted values and three computed versions. The source contains confident mistakes. Confidence is not verification.
- Source packet SHA-256: `ee01f8508bd2fd9854754b82fd9c4a055bdc55e2778a132002a25381c412ad19`.
- Printed source, extracted reading, imported computation, human decision, estimated overlay and supplied exact what-if are distinct facts. The engine cannot be rerun. Do not combine isolated alternatives into an asserted corrected final tax.
- Unknown historical facts must stay unknown. No invented tax law, missing basis, extraction fields, professional conclusions, user validation, filing confirmation or legal signature.

## Current implementation: inspect, do not blindly inherit

- Standard Next.js App Router, React, TypeScript, Node built-in SQLite and private local files. Optional bounded read-only Responses investigation loop; deterministic guided checks without a key.
- Server packet modules import a single JSON fixture. Curated findings and some source/report mappings are household-specific. Uploads currently register private evidence, not new households or general extraction.
- Immutable domain commands, expected revisions, atomic SQLite commits, approval invalidation, content-hashed frozen snapshots, encrypted identifier corrections, private-file hashes and access logs exist.
- Overview, Review queue, Evidence, Return/versions, Tax records, Operations, Activity and Settings exist. Rich capabilities have accumulated; UX cohesion, density, visual hierarchy and demonstrable speed need independent scrutiny.
- `../REQUIREMENTS_AUDIT.md` is the 105-item initial baseline. `../VERIFICATION.md` reports 102 bounded case capabilities verified, with shared app link, applicant video and actual CPA/new-hire usability still outstanding. This is not a claim of production readiness or general-data support.
- Current case tests, source graph checks, independent arithmetic, workflow, artifact, search, encryption and API tests pass. Do not extrapolate them into broader capability claims.
- Prototype persona selection is not verified staff identity. Non-loopback access is blocked. Public hosting, real authentication, hosted data/storage operations and genuine applicant video remain separate work.

## Required submission

Working app from a shared link loading the delivered packet and saving work with a role switcher; one page explaining core idea/data model; demonstrated errors and how the design surfaced them; a genuine applicant walkthrough video link explaining decisions/tradeoffs; tools/AI disclosure. Faster/trustworthy use by an experienced CPA and day-one usability for a new hire need observed validation.

## Debate rules

Latest explicit applicant requirement: all agents must attest to the features named in the case study **at minimum**. Every proposal must include a feature-to-design mapping, evidence and honest status. A proposal cannot trade away a required feature for aesthetic simplicity or implementation convenience. "Supported by design," "present in code," "verified by a prior test," and "independently verified in this review" are different assertions. Simulated workflows must be called simulated. The consolidated result must cover all 105 baseline IDs without omissions and retain the three known submission/usability gaps until evidence closes them.

Every reviewer must read the primary brief/full extraction, inspect relevant code and current UI evidence, state a recommendation and a credible alternative, name tradeoffs, and challenge at least one other proposal. Separate brief requirements, inferred design recommendations, existing implementation facts, and future product possibilities. Use primary official documentation for changing technical recommendations. Record sources and uncertainty.

Do not vote by popularity or claim consensus before replies. Capture accepted/rejected objections and why. Prefer a cohesive, reviewable assignment over infrastructure breadth, decorative graphics or unnecessary services. No application rewrites, package installs, server starts, Git writes, hosting or external messages in this design review. Write only your assigned review files under `docs/design/` unless the coordinator explicitly assigns another artifact.
