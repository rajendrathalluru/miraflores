import { NextRequest, NextResponse } from 'next/server';
import { load, persist } from '@/lib/db';
import { guard, getActor, project, failure } from '@/lib/server';
import { actorFor, applyCommand, DomainError } from '@/lib/workflow';
import { digest, mask } from '@/lib/packet';
import { reviewReport } from '@/lib/report';
import { workingValue } from '@/lib/types';
export const runtime = 'nodejs';
export async function GET(req: NextRequest) {
  try {
    guard(req);
    const { database, packet, state, row } = await load(
      req.nextUrl.searchParams.get('id') || undefined,
    );
    const actor = await getActor(packet);
    const kind = req.nextUrl.searchParams.get('kind') === 'client' ? 'client' : 'defense';
    if (actor.role === 'client' && kind !== 'client')
      throw new DomainError('Defense record requires staff or examiner access.', 403);
    const safe = project(
      packet,
      state,
      kind === 'client'
        ? actor.role === 'client'
          ? actor
          : actorFor(packet, packet.firm.client_users[0].id)
        : actorFor(packet, 'examiner'),
    );
    const files =
      kind === 'defense' && actor.sensitive_data_clearance
        ? (
            await database.query('SELECT * FROM attachments WHERE engagement_id=$1', [row.id])
          ).rows.filter((f) =>
            state.evidence.some((e) => e.fileId === f.id && e.visibility === 'examiner'),
          )
        : [];
    for (const f of files)
      if (digest(f.data_base64) !== f.content_hash) throw Error('Evidence integrity mismatch.');
    const noticeId = req.nextUrl.searchParams.get('notice');
    const notice =
      kind === 'defense'
        ? packet.tax_agency_records?.notices?.find((n: any) => n.id === noticeId)
        : undefined;
    const copyState =
      kind === 'client'
        ? {
            ...safe.state,
            adjustments: [],
            verifications: {},
            triage: {},
            judgments: [],
            freezes: [],
            audit: [],
          }
        : safe.state;
    // Client projection intentionally exposes only aggregate estimates, never internal overlays.
    if (kind === 'client')
      copyState.adjustments = [
        {
          active: true,
          version: packet.return_versions.at(-1)!.version,
          cycle: state.cycle,
          federal: safe.reviewedEstimate?.federal || 0,
          california: safe.reviewedEstimate?.california || 0,
        },
      ];
    const html = reviewReport(safe.packet, copyState, {
      kind,
      engagement: row.id,
      files,
      notice: mask(notice),
      packetHash: digest(packet),
      clientLines:
        kind === 'client'
          ? mask(
              packet.return_versions.at(-1)!.lines.map((l: any) => ({
                key: l.key,
                label: l.label,
                value: workingValue(l, state, packet.return_versions.at(-1)!.version),
              })),
            )
          : undefined,
    });
    if (files.length)
      await database.transaction(async (tx) => {
        const r = await tx.query('SELECT * FROM engagements WHERE id=$1 FOR UPDATE', [row.id]);
        const logged = applyCommand(packet, r.rows[0].state, actor, {
          type: 'reveal_log',
          target: `report:r${state.revision}`,
          reason: 'Downloaded a printable defense record containing original evidence.',
        });
        await persist(tx, row.id, r.rows[0].revision, logged);
      });
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="miraflores-${kind}-${packet.household.tax_year}-r${state.revision}.html"`,
        'Cache-Control': 'no-store',
        'Content-Security-Policy':
          "default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'",
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (e) {
    return failure(e);
  }
}
