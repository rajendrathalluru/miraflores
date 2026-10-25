import { getBootstrap } from '@/lib/packet';
import { loadWorkspace } from '@/lib/repository';
import { requestContext, runtimeConfig, failure, json } from '@/lib/server';
export async function GET() {
  try {
    const { ownerId, actor } = await requestContext();
    return json({ ...getBootstrap(actor.id, await loadWorkspace(ownerId)), config: runtimeConfig() });
  } catch (e) { return failure(e); }
}
