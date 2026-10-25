import { resolveSource } from '@/lib/packet';
import { requestContext, failure, json, HttpError } from '@/lib/server';
export async function GET(request: Request) {
  try {
    const { actor } = await requestContext();
    const ref = new URL(request.url).searchParams.get('ref');
    if (!ref || ref.length > 200) throw new HttpError(400, 'Provide a valid evidence reference.');
    return json(resolveSource(ref, actor.id));
  } catch (e) { return failure(e); }
}
