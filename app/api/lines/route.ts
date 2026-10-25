import { getBootstrap } from '@/lib/packet';
import { loadWorkspace } from '@/lib/repository';
import { requestContext, failure, json, HttpError } from '@/lib/server';
export async function GET(request: Request) {
  try {
    const { ownerId, actor } = await requestContext();
    const version = new URL(request.url).searchParams.get('version') || 'v3';
    if (!['v1','v2','v3'].includes(version)) throw new HttpError(400, 'Choose version v1, v2 or v3.');
    const bootstrap = getBootstrap(actor.id, await loadWorkspace(ownerId));
    // packet adapter exposes per-version lines separately to retain original values.
    const { getVersionLines } = await import('@/lib/packet');
    return json({ lines: getVersionLines(version, actor.id), version, revision: bootstrap.workspace.revision });
  } catch (e) { return failure(e); }
}
