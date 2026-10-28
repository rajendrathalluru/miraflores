import { NextRequest } from 'next/server';
import { load, importPacket } from '@/lib/db';
import { guard, getActor, json, failure } from '@/lib/server';
import { DomainError } from '@/lib/workflow';
import { validatePacket } from '@/lib/packet';
export async function POST(req: NextRequest) {
  try {
    guard(req);
    const { database, packet } = await load(req.nextUrl.searchParams.get('id') || undefined);
    const a = await getActor(packet);
    if (!['partner', 'preparer', 'firm_administrator'].includes(a.role))
      throw new DomainError('Packet import requires a preparer, partner or administrator.', 403);
    if (Number(req.headers.get('content-length') || 0) > 12 * 1024 * 1024)
      throw new DomainError('Packet limit is 12 MB.', 413);
    const text = await req.text();
    if (Buffer.byteLength(text) > 12 * 1024 * 1024)
      throw new DomainError('Packet limit is 12 MB.', 413);
    let p;
    try {
      p = JSON.parse(text);
    } catch {
      throw new DomainError('The file is not valid JSON.');
    }
    try {
      validatePacket(p);
    } catch (e: any) {
      throw new DomainError(e.message);
    }
    if (!p.firm?.staff?.length) throw new DomainError('A packet must define firm.staff roles.');
    return json({
      id: await importPacket(database, p),
      message: 'Packet imported. Existing content-identical packets reuse their saved engagement.',
    });
  } catch (e) {
    return failure(e);
  }
}
