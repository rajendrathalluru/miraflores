import { requestContext, failure, json } from '@/lib/server';
import { loadWorkspace } from '@/lib/repository';
import { searchWorkpaper } from '@/lib/search';
export async function GET(request: Request) {
  try {
    const { actor, ownerId } = await requestContext();
    const query = new URL(request.url).searchParams.get('q') ?? '';
    return json(searchWorkpaper(query, actor.id, await loadWorkspace(ownerId)));
  } catch (e) { return failure(e); }
}
