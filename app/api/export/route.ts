import { NextRequest, NextResponse } from 'next/server';
import { load, persist } from '@/lib/db';
import { actorFor, applyCommand, DomainError } from '@/lib/workflow';
import { guard, getActor, project, failure } from '@/lib/server';
import { mask, digest } from '@/lib/packet';
export async function GET(req: NextRequest) {
  try {
    guard(req);
    const { packet, state, row, database } = await load(
      req.nextUrl.searchParams.get('id') || undefined,
    );
    const a = await getActor(packet);
    const kind = req.nextUrl.searchParams.get('kind');
    if (a.role === 'client' && kind === 'carryforward')
      throw new DomainError('Staff handoff access required.', 403);
    const projected = project(
      packet,
      state,
      kind === 'defense' && a.role !== 'client' ? actorFor(packet, 'examiner') : a,
    );
    const files =
      a.role === 'client' || a.role === 'examiner' || !a.sensitive_data_clearance
        ? []
        : (
            await database.query(
              'SELECT id,name,mime,content_hash,data_base64 FROM attachments WHERE engagement_id=$1',
              [row.id],
            )
          ).rows.filter((f) =>
            state.evidence.some(
              (e) => e.fileId === f.id && (kind !== 'defense' || e.visibility === 'examiner'),
            ),
          );
    for (const f of files)
      if (digest(f.data_base64) !== f.content_hash)
        throw new Error('Attachment integrity mismatch.');
    if (files.length)
      await database.transaction(async (tx) => {
        const { rows } = await tx.query('SELECT * FROM engagements WHERE id=$1 FOR UPDATE', [
          row.id,
        ]);
        const logged = applyCommand(packet, rows[0].state, a, {
          type: 'reveal_log',
          target: 'export:r' + state.revision,
          reason: 'Exported a captured record containing original evidence files.',
        });
        await persist(tx, row.id, rows[0].revision, logged);
      });
    const content =
      kind === 'carryforward'
        ? mask({
            priorEngagement: row.id,
            sourceRevision: state.revision,
            packetHash: digest(packet),
            household: projected.packet.household,
            carryovers: packet.return_versions.at(-1)?.carryovers_out,
            basis: packet.prior_years?.basis_records,
            assets: packet.return_versions.at(-1)?.assets,
            judgments: projected.state.judgments,
            plans: projected.state.plans,
            history: projected.state.audit,
          })
        : {
            format: 'miraflores-defense-record-1',
            exportedAt: new Date().toISOString(),
            engagement: row.id,
            revision: state.revision,
            packetHash: digest(packet),
            ...projected,
            attachments: files,
          };
    return new NextResponse(JSON.stringify(content, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${kind === 'carryforward' ? 'carryforward' : 'workpaper'}-${packet.household.tax_year}-r${state.revision}.json"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    return failure(e);
  }
}
