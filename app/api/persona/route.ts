import { cookies } from 'next/headers';
import { actors } from '@/lib/packet';
import { requestContext, readBody, failure, json, HttpError } from '@/lib/server';
export async function POST(request: Request) {
  try {
    await requestContext(true);
    const { actorId } = await readBody(request);
    if (typeof actorId !== 'string' || !actors.some(a => a.id === actorId)) throw new HttpError(400, 'Choose an available demo persona.');
    (await cookies()).set('mf-persona', actorId, { httpOnly: true, sameSite: 'strict', path: '/', maxAge: 60 * 60 * 24 * 7, secure: new URL(request.url).protocol === 'https:' });
    return json({ actorId });
  } catch (e) { return failure(e); }
}
