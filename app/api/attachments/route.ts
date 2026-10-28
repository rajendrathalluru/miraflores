import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { load, persist } from '@/lib/db';
import { guard, getActor, json, failure } from '@/lib/server';
import { applyCommand, DomainError } from '@/lib/workflow';
import { digest } from '@/lib/packet';
export async function POST(req: NextRequest) {
  try {
    guard(req);
    const data = await req.formData();
    const id = String(data.get('engagementId'));
    const { database, packet } = await load(id);
    const actor = await getActor(packet);
    if (!['preparer', 'reviewer', 'partner'].includes(actor.role))
      throw new DomainError('Staff evidence access required.', 403);
    if (actor.id !== data.get('actorId'))
      throw new DomainError('Your role changed. Refresh before uploading.', 409);
    const file = data.get('file');
    if (!(file instanceof File) || file.size > 8 * 1024 * 1024 || !file.size)
      throw new DomainError('Choose a nonempty file up to 8 MB.');
    const bytes = Buffer.from(await file.arrayBuffer()),
      fileId = randomUUID();
    const hash = digest(bytes.toString('base64'));
    await database.transaction(async (tx) => {
      const { rows } = await tx.query('SELECT * FROM engagements WHERE id=$1 FOR UPDATE', [id]);
      if (rows[0].revision !== Number(data.get('revision')))
        throw new DomainError('Workspace changed before upload. Refresh and try again.', 409);
      const state = applyCommand(packet, rows[0].state, actor, {
        type: 'attach',
        record: {
          fileId,
          name: file.name,
          size: file.size,
          mime: file.type,
          hash,
          target: String(data.get('target') || 'all'),
          visibility: data.get('visibility') === 'examiner' ? 'examiner' : 'internal',
        },
      });
      await tx.query(
        'INSERT INTO attachments(id,engagement_id,name,mime,content_hash,data_base64) VALUES($1,$2,$3,$4,$5,$6)',
        [fileId, id, file.name, file.type, hash, bytes.toString('base64')],
      );
      await persist(tx, id, rows[0].revision, state);
    });
    return json({ ok: true, fileId });
  } catch (e) {
    return failure(e);
  }
}
export async function GET(req: NextRequest) {
  try {
    guard(req);
    const id = req.nextUrl.searchParams.get('id') || '';
    const { database, packet } = await load(id);
    const actor = await getActor(packet);
    if (!actor.sensitive_data_clearance)
      throw new DomainError(
        'Clearance is required to download an original unredacted attachment.',
        403,
      );
    const { rows } = await database.query(
      'SELECT * FROM attachments WHERE engagement_id=$1 AND id=$2',
      [id, req.nextUrl.searchParams.get('file')],
    );
    if (!rows[0]) throw new DomainError('File not found.', 404);
    const f = rows[0];
    if (digest(f.data_base64) !== f.content_hash)
      throw new DomainError('Attachment integrity check failed.', 409);
    await database.transaction(async (tx) => {
      const { rows } = await tx.query('SELECT * FROM engagements WHERE id=$1 FOR UPDATE', [id]);
      const logged = applyCommand(packet, rows[0].state, actor, {
        type: 'reveal_log',
        target: 'attachment:' + f.id,
        reason: 'Downloaded original unredacted evidence.',
      });
      await persist(tx, id, rows[0].revision, logged);
    });
    return new NextResponse(Buffer.from(f.data_base64, 'base64'), {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${f.name.replace(/[^\w. -]/g, '_')}"`,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (e) {
    return failure(e);
  }
}
