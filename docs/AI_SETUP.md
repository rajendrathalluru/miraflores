# Investigation assistant

The workspace works without an API key. In that mode it displays **Guided checks**, deterministic matching of the packet's known review issues, authorized source tracing and document lookup. It does not claim that a language model investigated the question or discovered a new error.

`lib/agent.ts` also implements an optional live tool loop through the OpenAI Responses API. `runInvestigation({ prompt, issueId?, actorId, workspace, apiKey?, model? })` returns a summary, sourced findings, executed tool steps, existing adjustment proposal IDs and `mode: 'rules' | 'live'`. It never changes the supplied workspace. The API owns saving the investigation and invoking a domain command after a preparer accepts a proposal.

## Server configuration

For the local Next.js app, optionally set `OPENAI_API_KEY` in the ignored `.env.local` file. A deployed server can use its own secret manager. Leave it unset to use Guided checks; an API connection is not required to run the workspace. Do not paste a key into chat, source control or the browser. The API reads that environment value and passes it to `runInvestigation`; the client cannot select or supply credentials. Optionally set `OPENAI_MODEL`; the documented default is `gpt-5.4-mini`. Account access and usage limits still determine whether a live request succeeds. The [official model page](https://developers.openai.com/api/docs/models/gpt-5.4-mini) confirms support for function calling and structured output.

For an optional Codex-assisted secure key setup, use the **OpenAI Developers** plugin's provisioning flow when available. That plugin is not a runtime or hosting dependency. No key or paid live API call was used while implementing this module.

## Read-only tool boundary

The model can call `searchEvidence`, `traceLine`, `runChecks` and `getDocument`. Each operates on the same actor-validated, masked packet read boundary as the UI. A tool cannot write an adjustment, grant clearance, approve work, send a question, transmit a return, execute code or make arbitrary network/database requests. The engagement and v3 baseline are fixed by the server, and the investigation records the current workspace revision. The API must reject stale revisions when a proposal is later accepted.

Source text and client messages are untrusted evidence, never agent instructions. The packet's identifier masker also sanitizes the question before it leaves the server and sanitizes the live result. Results must follow a strict JSON schema. Application validation rejects unknown source references and unavailable/already-active adjustment proposal IDs. References are evidence pointers; a human must still assess whether they support a conclusion. The list of executed steps is built by the application, not asserted by the model.

Live requests use `store: false`, with at most six requests, one read tool per turn, 1,800 output tokens per response, bounded tool payloads and a 45-second total abort timer. Prompt length is capped at 1,500 characters. A failed, incomplete, unsupported or invalid response produces an explicit Guided checks fallback. `store: false` controls Responses storage and is not a claim of zero retention or a replacement for the firm's data-processing policies.

The API integration follows [official function-calling guidance](https://developers.openai.com/api/docs/guides/function-calling) and the Responses `text.format` schema described in [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses). No external tax research or tax engine is available to the agent. It must distinguish imported engine values, local arithmetic, estimated tax effects and unknowns; live prose cannot turn the supplied data into a recomputed filing-ready return.

## Verification before enabling live mode

Exercise mileage duplication, employer stock basis, agency payment reconciliation and the unread brokerage page. Verify exact source links, no duplicate proposals after acceptance, rejection of unknown references, prompt-injection resistance, limited identifiers in all tool output, clean timeout fallback, and denied reads for unavailable personas. Re-run the same prompts on both the default model and any configured replacement. A real account-backed integration run remains necessary after credentials are configured.
