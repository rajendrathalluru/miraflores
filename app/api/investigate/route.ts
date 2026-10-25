import { runInvestigation } from '@/lib/agent';
import { loadWorkspace } from '@/lib/repository';
import { masked, maskSensitiveText } from '@/lib/packet';
import { requestContext, readBody, database, failure, json, HttpError } from '@/lib/server';

export async function POST(request: Request) {
  try {
    const { ownerId, actor } = await requestContext(true);
    if (actor.role === 'client') throw new HttpError(403, 'Investigations are available to the preparation and review team.');
    const { prompt, issueId, expectedRevision } = await readBody(request);
    if (typeof prompt !== 'string' || prompt.trim().length < 3 || prompt.length > 1500) throw new HttpError(400, 'Enter an investigation request between 3 and 1,500 characters.');
    if (issueId !== undefined && (typeof issueId !== 'string' || issueId.length > 100)) throw new HttpError(400, 'Choose a valid review issue.');
    const workspace = await loadWorkspace(ownerId);
    if (workspace.revision !== expectedRevision) throw new HttpError(409, 'The workspace changed. Refresh before starting an investigation.');
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const safePrompt = maskSensitiveText(prompt.trim());
    // Reserve the budget atomically before contacting the paid service, including
    // in-flight runs so concurrent requests cannot bypass the per-owner bound.
    const reserved = await database().prepare('INSERT INTO agent_runs (id, owner_id, actor_id, input_revision, prompt, mode, result, created_at) SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM agent_runs WHERE owner_id = ? AND created_at > ?) < 6')
      .bind(id, ownerId, actor.id, workspace.revision, safePrompt, 'pending', '{"status":"running"}', createdAt, ownerId, new Date(Date.now() - 60_000).toISOString()).run();
    if (reserved.meta.changes !== 1) throw new HttpError(429, 'Please wait a minute before starting another investigation.');
    let result;
    try {
      result = masked(await runInvestigation({ prompt: safePrompt, issueId, actorId: actor.id, workspace, apiKey: process.env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL }));
      await database().prepare('UPDATE agent_runs SET mode = ?, result = ? WHERE id = ? AND owner_id = ?').bind(result.mode, JSON.stringify(result), id, ownerId).run();
    } catch (error) {
      await database().prepare('UPDATE agent_runs SET mode = ?, result = ? WHERE id = ? AND owner_id = ?').bind('failed', '{"status":"failed"}', id, ownerId).run();
      throw error;
    }
    const current = await loadWorkspace(ownerId);
    return json({ id, result, workspace: masked(current), inputRevision: workspace.revision, stale: current.revision !== workspace.revision, createdAt });
  } catch (e) { return failure(e); }
}

export async function GET() {
  try {
    const { ownerId, actor } = await requestContext();
    if (actor.role === 'client') throw new HttpError(403, 'Investigation history is available to the review team.');
    const rows = await database().prepare('SELECT id, actor_id AS actorId, input_revision AS inputRevision, prompt, mode, result, created_at AS createdAt FROM agent_runs WHERE owner_id = ? ORDER BY created_at DESC LIMIT 20').bind(ownerId).all<{ id: string; actorId: string; inputRevision: number; prompt: string; mode: string; result: string; createdAt: string }>();
    return json(masked({ runs: rows.results.map(r => ({ ...r, result: JSON.parse(r.result) })) }));
  } catch (e) { return failure(e); }
}
