# Applicant walkthrough and submission checklist

**Recording status: pending. Public video link: pending.** The case study requires a recording of the applicant walking through the prototype and explaining technical decisions and tradeoffs. This file is a script and checklist, not a video or a claim that a recording has been submitted. The applicant should record it after the final verification pass, then add the actual accessible link below.

- Applicant name: ____________________
- Shared app URL: ____________________
- Public/unlisted walkthrough URL: ____________________
- Verified app revision/commit: ____________________

## Suggested 7–9 minute recording

1. **Purpose and overall idea (45 seconds).** “The workpaper is a set of reviewable claims. I separate printed evidence, extracted readings, engine calculations and human decisions. Start with what is open, then follow a source trail.” Show the household and explain this is a fictional 2025 joint return with a California-to-Texas move.
2. **A confident mistake (90 seconds).** Open the duplicate-mileage finding. Show D23 page three repeating page two, the stable source field/page reference and the engine's 11,800 miles against unique 8,100. Explain that the supplied locator coordinates are synthetic and text highlights are approximate. Record verification with the actual method/conclusion, then accept a reasoned adjustment. State that the original input is preserved and the tax effect is estimated rather than a new engine run.
3. **Evidence completeness and large detail (60 seconds).** Open corrected brokerage D31 and its unread final page. Explain the $250 proceeds/$310 basis lot missing from extraction. Show the complete document index, reviewed dispositions, source destinations and grouped records for sales/assets. Do not say “all documents verified” unless the saved completeness view actually supports it.
4. **Calculations, alternatives and prior years (60 seconds).** Trace a return amount through input lines, rules and documents. Compare versions/prior-year records. Open an exact supplied what-if, such as equipment section 179, and show its changed lines and separate federal/California results. Explain that alternatives are precomputed and should not be added to one another.
5. **People and control (60–90 seconds).** Switch preparer/reviewer/client/admin personas. Show a blocking review note, assigned task/question and recorded response. Demonstrate a prohibited action and why the server rejects it. Show approvals tied to a revision and a material change reopening them. Explain that local role switching is a prototype convenience, not production staff authentication.
6. **Filing and later use (60 seconds).** Show the simulated extension/signature/filing/rejection records, immutable snapshot, amendment parent and a notice-response or client export. Open an exported record to show what it actually includes. Explain that nothing is transmitted to an agency and frozen estimated overlays are distinct from exact filed totals.
7. **Architecture and tradeoffs (60 seconds).** Use the one-page core idea. Explain Next.js, browser/server separation, SQLite, private file storage, immutable packet, command validation, expected revisions and audit/approval atomicity. State what production deployment would replace: verified identities/firm membership, database/object-storage adapters and operations. Discuss current limitations from the final verification report candidly.
8. **Tools, AI and remaining work (30–45 seconds).** Use the disclosure below. Say which assistance mode you actually demonstrated. State what is implemented, what remains, and where reviewers can find the requirement audit and evidence-backed verification results.

## Technical decisions and their tradeoffs

| Decision | Reason | Tradeoff to explain |
|---|---|---|
| Next.js modular monolith | One deployable application with a clear UI/API/domain boundary | Easy local iteration; production access and adapter work remain separate concerns. |
| Immutable source packet plus revisioned workspace | Preserve evidence and explain every change | Reviewed overlays cannot claim an exact recomputed return. |
| SQLite and local private files | Durable prototype without an external account | A multi-firm production service needs the planned database/storage and identity integrations. |
| Stable evidence references | Link calculations, source fields, prior years and decisions | Real-document replacement needs a renderer/storage adapter; no original source page images were supplied. |
| Server commands with compare-and-swap | Prevent unauthorized changes and silent lost updates | Concurrent work may require refresh/conflict resolution; do not claim operational collaboration beyond what was tested. |
| Revision-bound approvals and frozen snapshots | Make sign-off meaningful as evidence changes | Amendments must be new linked cycles; original history is retained. |
| Bounded read-only AI | Investigate without silently changing the return | AI findings require source verification and human acceptance; connectivity is not established by mocked tests. |

## Truthful tools and AI disclosure

An AI coding assistant helped inspect the supplied PDF and JSON, identify requirements and discrepancies, implement the prototype, draft documentation and tests, and perform verification. Separate agent roles audited requirements, developed features and independently checked behavior. The implementation uses Next.js, React, TypeScript, Node.js SQLite, local private files and automated offline/API tests.

The app has deterministic guided checks that require no AI credential. Optional live investigations call the OpenAI Responses API from the server and use read-only evidence tools with masked inputs, output validation and budgets. A human must accept adjustments. Offline provider tests use mocks. If no real key was configured and no real investigation succeeded during your demonstration, say **“live integration is implemented and mock-tested; account connectivity was not demonstrated.”** Do not describe guided checks as a live AI agent.

The applicant should review this disclosure for accuracy against the actual recorded build and describe their own decisions and contribution in their own words.

## Before submitting

- Record the applicant speaking and interacting with the verified build.
- Include actual technical decisions, tradeoffs and remaining limitations, rather than only a feature tour.
- Add and test the shared app link and video link in a signed-out browser or equivalent access check.
- Include the one-page core idea/data model and the errors/design report.
- Keep the final requirement matrix and verification report with the submission so partial items are visible.
- Do not claim a GitHub repository URL alone is a running app, or that this script satisfies the required video.
