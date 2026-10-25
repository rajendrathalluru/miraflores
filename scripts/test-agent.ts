/** Run after compiling this script with its imports (CommonJS + resolveJsonModule).
 * All live-service responses are mocked. This script never calls an external API.
 */
import assert from 'node:assert/strict';
import { runInvestigation } from '../lib/agent';
import type { InvestigationInput, InvestigationResult } from '../lib/agent';
import { applyCommand, initialWorkspace } from '../lib/domain';
import { actors } from '../lib/packet';

type JsonRecord = Record<string, unknown>;
type MockRequest = { url: string; body: JsonRecord; init: RequestInit; number: number };

const TEST_API_KEY = 'test-only-not-a-real-key';
const SYNTHETIC_IDENTIFIER = '123-45-6789';
const preparer = actors.find((actor) => actor.role === 'preparer');
assert.ok(preparer, 'The packet needs a preparer persona.');
const actorId = preparer.id;
const liveInput = (): InvestigationInput => ({
  prompt: 'Investigate duplicate mileage', issueId: 'duplicate-mileage', actorId,
  workspace: initialWorkspace(), apiKey: TEST_API_KEY,
});

function outputResult(sourceRefs = ['doc:D23#page3'], proposalIssueIds = ['duplicate-mileage']) {
  return {
    summary: 'Review the repeated trip page before accepting a mileage correction.',
    findings: [{ title: 'Repeated mileage', detail: 'Page 3 repeats page 2; verify the unique trip totals.', sourceRefs }],
    proposalIssueIds,
  };
}

function completed(output: unknown[]): Response {
  return new Response(JSON.stringify({ status: 'completed', output }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
}

function toolCall(name = 'runChecks', args: JsonRecord = { query: 'mileage' }, callId = 'test-call') {
  return { type: 'function_call', name, arguments: JSON.stringify(args), call_id: callId };
}

function finalMessage(result: unknown) {
  return { type: 'message', content: [{ type: 'output_text', text: JSON.stringify(result) }] };
}

async function withMockService<T>(
  responder: (request: MockRequest) => Response | Promise<Response>,
  run: () => Promise<T>,
): Promise<T> {
  const previous = globalThis.fetch;
  let number = 0;
  globalThis.fetch = async (request, init) => {
    const url = request instanceof Request ? request.url : String(request);
    assert.equal(url, 'https://api.openai.com/v1/responses', 'The agent must only use the fixed Responses endpoint.');
    assert.ok(init && typeof init.body === 'string');
    const body = JSON.parse(init.body) as JsonRecord;
    assert.equal(body.store, false);
    assert.deepEqual(body.include, ['reasoning.encrypted_content']);
    assert.equal(body.parallel_tool_calls, false);
    assert.equal(body.max_output_tokens, 1800);
    assert.ok(init.signal, 'Every live request must carry the total-budget abort signal.');
    assert.ok(!init.body.includes(TEST_API_KEY), 'Credentials must never appear in the model payload.');
    return responder({ url, body, init, number: ++number });
  };
  try { return await run(); } finally { globalThis.fetch = previous; }
}

function assertNoSecret(result: InvestigationResult) {
  assert.ok(!JSON.stringify(result).includes(TEST_API_KEY));
  assert.ok(!JSON.stringify(result).includes(SYNTHETIC_IDENTIFIER));
}

async function main() {
  const originalFetch = globalThis.fetch;
  // Any accidental network call outside an explicit mock is an immediate test failure.
  globalThis.fetch = async () => { throw new Error('Unexpected external network request in agent tests.'); };
  let passed = 0;
  const test = async (name: string, run: () => Promise<void>) => {
    await run(); passed++; console.log(`PASS ${name}`);
  };
  try {
    await test('actual-packet guided checks, exact sources and free-text search', async () => {
      const workspace = initialWorkspace();
      const before = JSON.stringify(workspace);
      const cases = [
        { prompt: 'Investigate duplicate mileage', issueId: 'duplicate-mileage', ref: 'doc:D23#page3' },
        { prompt: 'Reconcile federal estimates', issueId: 'federal-payments', ref: 'doc:D67#page1' },
        { prompt: 'Reconcile California payment year', issueId: 'california-payments', ref: 'doc:D68#page1' },
        { prompt: 'Find employer stock missing basis', issueId: 'rsu-basis', ref: 'doc:D11#page2' },
        { prompt: 'Find unread Meridian brokerage sale', issueId: 'missing-brokerage-page', ref: 'doc:D31#page32' },
      ];
      for (const entry of cases) {
        const result = await runInvestigation({ ...entry, actorId, workspace });
        assert.equal(result.mode, 'rules');
        assert.match(result.summary, /No language model was called/);
        assert.equal(result.findings.length, 1);
        assert.ok(result.findings[0].sourceRefs.includes(entry.ref), `Missing exact evidence anchor for ${entry.issueId}.`);
        assert.ok(result.proposalIssueIds.includes(entry.issueId));
        assert.ok(result.steps.some((step) => step.tool === 'traceLine'));
        assert.ok(result.steps.some((step) => step.tool === 'getDocument'));
        const freeText = await runInvestigation({ prompt: entry.prompt, actorId, workspace });
        assert.ok(freeText.findings.some((finding) => finding.title === result.findings[0].title), `Free-text search missed ${entry.issueId}.`);
      }
      assert.equal(JSON.stringify(workspace), before, 'Investigating must not mutate working tax state.');
    });

    await test('mocked live tool loop, stateless reasoning and privacy', async () => {
      const input = liveInput();
      input.prompt = `Investigate mileage for identifier ${SYNTHETIC_IDENTIFIER}`;
      const before = JSON.stringify(input.workspace);
      let calls = 0;
      const result = await withMockService(({ body, init, number }) => {
        calls = number;
        assert.ok(!String(init.body).includes(SYNTHETIC_IDENTIFIER), 'The outbound question must be masked.');
        const history = body.input as JsonRecord[];
        if (number === 1) {
          assert.equal(body.tool_choice, 'required');
          return completed([
            { type: 'reasoning', id: 'reason-test', summary: [], encrypted_content: 'opaque-test-content' },
            toolCall('getDocument', { documentId: 'D23', page: 3 }),
          ]);
        }
        assert.ok(history.some((item) => item.type === 'reasoning' && item.encrypted_content === 'opaque-test-content'));
        const toolOutput = history.find((item) => item.type === 'function_call_output');
        assert.ok(toolOutput && typeof toolOutput.output === 'string');
        const returned = JSON.parse(toolOutput.output) as JsonRecord;
        assert.equal(returned.sourceRef, 'doc:D23#page3');
        assert.ok(!/\d{3}-\d{2}-\d{4}/.test(toolOutput.output));
        const answer = outputResult();
        answer.findings[0].detail += ` Unnecessary identifier ${SYNTHETIC_IDENTIFIER} must be masked.`;
        return completed([finalMessage(answer)]);
      }, () => runInvestigation(input));
      assert.equal(result.mode, 'live');
      assert.equal(calls, 2);
      assert.equal(result.steps[0].tool, 'getDocument');
      assert.match(result.summary, /workspace revision 0/);
      assertNoSecret(result);
      assert.equal(JSON.stringify(input.workspace), before);
    });

    await test('unknown citations and unavailable proposals reject live conclusions', async () => {
      for (const invalid of [outputResult(['doc:D99#page1']), outputResult(['doc:D23#page3'], ['nonexistent-adjustment'])]) {
        const result = await withMockService(({ number }) => completed(number === 1
          ? [toolCall()]
          : [finalMessage(invalid)]), () => runInvestigation(liveInput()));
        assert.equal(result.mode, 'rules');
        assert.match(result.summary, /Live AI was attempted/);
        assert.ok(!result.summary.includes('No language model was called'), 'Fallback must disclose that live AI was attempted.');
        assert.ok(!result.findings.some((finding) => finding.sourceRefs.includes('doc:D99#page1')));
        assertNoSecret(result);
      }
    });

    await test('request budget, invalid tools and service failures remain safe', async () => {
      let calls = 0;
      const bounded = await withMockService(({ body, number }) => {
        calls = number;
        if (number === 6) assert.equal(body.tool_choice, 'none');
        return completed([toolCall('runChecks', { query: 'mileage' }, `bounded-${number}`)]);
      }, () => runInvestigation(liveInput()));
      assert.equal(calls, 6);
      assert.equal(bounded.mode, 'rules');

      const denied = await withMockService(({ body, number }) => {
        if (number === 1) return completed([toolCall('sendEmail', { body: 'An untrusted request to write.' })]);
        const output = (body.input as JsonRecord[]).find((item) => item.type === 'function_call_output');
        assert.ok(output && typeof output.output === 'string' && output.output.includes('invalid or unavailable'));
        return completed([finalMessage(outputResult())]);
      }, () => runInvestigation(liveInput()));
      assert.ok(denied.steps.some((step) => step.detail.includes('Rejected')));

      const unavailable = await withMockService(() => new Response('Provider error with no safe public details.', { status: 401 }), () => runInvestigation(liveInput()));
      assert.equal(unavailable.mode, 'rules');
      assert.ok(!JSON.stringify(unavailable).includes('Provider error'));

      const incomplete = await withMockService(() => new Response(JSON.stringify({ status: 'incomplete', output: [] }), { status: 200 }), () => runInvestigation(liveInput()));
      assert.equal(incomplete.mode, 'rules');
      for (const result of [bounded, denied, unavailable, incomplete]) assertNoSecret(result);
    });

    await test('active adjustments, invalid actors and prompt limits', async () => {
      const workspace = applyCommand(initialWorkspace(), {
        type: 'accept_adjustment', issueId: 'duplicate-mileage', reason: 'Verified the duplicated source page for this test.',
      }, actorId);
      const before = JSON.stringify(workspace);
      const result = await runInvestigation({ prompt: 'Mileage', issueId: 'duplicate-mileage', actorId, workspace });
      assert.deepEqual(result.proposalIssueIds, []);
      assert.match(result.findings[0].detail, /already active/);
      assert.equal(JSON.stringify(workspace), before);

      await assert.rejects(runInvestigation({ prompt: 'Mileage', actorId: 'not-a-persona', workspace: initialWorkspace() }));
      await assert.rejects(runInvestigation({ prompt: 'x'.repeat(1501), actorId, workspace: initialWorkspace() }), /1,500/);
      await assert.rejects(runInvestigation({ prompt: 'Mileage', issueId: 'not-an-issue', actorId, workspace: initialWorkspace() }), /not available/);
    });

    console.log(`${passed} agent test groups passed. All provider calls mocked; no external API requests.`);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Agent tests failed.');
  process.exitCode = 1;
});
