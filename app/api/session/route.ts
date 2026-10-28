import { NextRequest, NextResponse } from 'next/server';
import { load } from '@/lib/db';
import { guard, failure } from '@/lib/server';
import { actorFor } from '@/lib/workflow';
export async function POST(req: NextRequest) {
  try {
    guard(req);
    const b = await req.json();
    const { packet } = await load(b.engagementId);
    const actorId = b.actorId || packet.firm?.staff?.[0]?.id;
    actorFor(packet, actorId);
    const response = NextResponse.json({ ok: true });
    response.cookies.set('workpaper_actor', actorId, {
      httpOnly: true,
      sameSite: 'strict',
      secure: req.nextUrl.protocol === 'https:',
      path: '/',
    });
    return response;
  } catch (e) {
    return failure(e);
  }
}
