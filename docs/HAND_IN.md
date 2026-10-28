# Submission package

1. **App:** https://miraflores-mocha.vercel.app/ — redeploy the final code before submitting this URL. Confirm that the new source checks and reconciliation/archive panels are present and that a harmless review save survives reload.
2. **Core idea and data model:** [one-page PDF](../output/pdf/core-idea.pdf).
3. **Errors and how the design surfaces them:** [error analysis](ERRORS_FOUND.md).
4. **Your own video:** record yourself using [the walkthrough guide](WALKTHROUGH.md), upload the recording to your chosen video host, and insert its share link in your submission. A script is not a video deliverable.
5. **Tool disclosure:** Codex assisted design translation, coding, test authoring and browser verification. Runtime checks are deterministic; no AI provider is called by the app.

[Implementation follow-up](COMPLETION_VERIFICATION.md) explains the audit fixes, verification and prototype boundaries. The [original audit](REQUIREMENTS_AUDIT.md) is historical and should not be mistaken for the final implementation status.

## Before sending

- Push and redeploy the current code; confirm Production `DATABASE_URL` is configured.
- Open the live URL in a fresh browser and verify source tracing, saved review state and the client/examiner views.
- Provide your own video link. Do not expose database secrets or full identifiers while recording.
- Describe filing, signatures and agency actions as simulations, and tax effects as supplied-rate estimates.
- Use invented/demo data. Anyone with the public URL can choose a fictional role, by the user's requested demo configuration.

## Verification at handoff

22 regression tests, the production build, and three API suites against a standalone production server passed. Browser checks confirmed reconciliation saving, exact payment effects, asset-source edits, filing freeze/amendment, client/examiner views and responsive layouts. See the completion verification record for the scope and limits.
