import { traceLine } from '@/lib/packet';
import { loadWorkspace } from '@/lib/repository';
import { requestContext, failure, json, HttpError } from '@/lib/server';
export async function GET(request: Request, context: { params: Promise<{ key: string }> }) {
  try {
    const { ownerId, actor } = await requestContext();
    const { key } = await context.params;
    const version = new URL(request.url).searchParams.get('version') || 'v3';
    if (!['v1','v2','v3'].includes(version)) throw new HttpError(400, 'Unknown return version.');
    return json(traceLine(key, version, actor.id, await loadWorkspace(ownerId)));
  } catch (e) { return failure(e); }
}
