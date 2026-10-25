import { buildReviewContext } from '@/lib/review-context';
import { loadWorkspace } from '@/lib/repository';
import { requestContext, failure, json, HttpError } from '@/lib/server';

export async function GET(request: Request) {
  try {
    const { ownerId, actor } = await requestContext();
    const query = new URL(request.url).searchParams;
    const since = query.get('sinceRevision');
    const options = { issueId: query.get('issueId') || undefined, ref: query.get('ref') || undefined,
      version: query.get('version') || 'v3', sinceRevision: since === null ? undefined : Number(since) };
    if (options.issueId && options.issueId.length > 100) throw new HttpError(400, 'Choose a valid review issue.');
    return json(buildReviewContext(await loadWorkspace(ownerId), actor.id, options));
  } catch (error) { return failure(error); }
}
