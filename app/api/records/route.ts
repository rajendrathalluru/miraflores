import { getTaxRecords } from '@/lib/records';
import { requestContext, failure, json } from '@/lib/server';
import { loadWorkspace } from '@/lib/repository';

export async function GET(request: Request) {
  try {
    const { actor, ownerId } = await requestContext();
    return json(getTaxRecords(actor.id, new URL(request.url).searchParams.get('version') || 'v3', await loadWorkspace(ownerId)));
  } catch (error) { return failure(error); }
}
