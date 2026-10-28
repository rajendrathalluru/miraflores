import { NextRequest } from 'next/server';
import { load, listEngagements } from '@/lib/db';
import { guard, getActor, project, json, failure } from '@/lib/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  try {
    guard(req);
    const { packet, state, row } = await load(req.nextUrl.searchParams.get('id') || undefined);
    const actor = await getActor(packet);
    return json({
      ...project(packet, state, actor),
      id: row.id,
      engagements:
        actor.role === 'client'
          ? [{ id: row.id, name: 'Your household', tax_year: packet.household.tax_year }]
          : await listEngagements(),
    });
  } catch (e) {
    return failure(e);
  }
}
