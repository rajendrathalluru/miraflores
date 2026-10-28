import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { load, clientName, policy, persist } from '@/lib/db';
import { validateHandoff, inheritedMetadata, restoredState } from '@/lib/handoff';
import { validatePacket, digest, mask } from '@/lib/packet';
import { getActor, guard, json, failure } from '@/lib/server';
import { emptyState, applyCommand, DomainError } from '@/lib/workflow';
export const runtime = 'nodejs';
export async function POST(req: NextRequest) {
  try {
    guard(req);
    const { database, packet } = await load(req.nextUrl.searchParams.get('id') || undefined);
    const actor = await getActor(packet);
    if (
      !['preparer', 'partner', 'firm_administrator'].includes(actor.role) ||
      !actor.sensitive_data_clearance
    )
      throw new DomainError('A cleared preparer, partner or administrator is required.', 403);
    const text = await req.text();
    if (Buffer.byteLength(text) > 64 * 1024 * 1024)
      throw new DomainError('Archive import exceeds 64 MB.', 413);
    let input;
    try {
      input = JSON.parse(text);
    } catch {
      throw new DomainError('Invalid archive JSON.');
    }
    if (input.actorId !== actor.id)
      throw new DomainError('Role changed; refresh before importing.', 409);
    let source;
    try {
      source = validateHandoff(input.handoff);
    } catch (e: any) {
      throw new DomainError(e.message);
    }
    if ((source.packet.firm?.name || '') !== (packet.firm?.name || ''))
      throw new DomainError('Archive belongs to a different firm.');
    const next = input.mode === 'next_year';
    if (!next && input.mode !== 'restore') throw new DomainError('Choose restore or next_year.');
    const targetPacket = next ? input.packet : source.packet;
    validatePacket(targetPacket);
    if (
      next &&
      (targetPacket.packet.client_id !== source.packet.packet.client_id ||
        targetPacket.household.tax_year !== source.packet.household.tax_year + 1)
    )
      throw new DomainError(
        'A next-year packet must have the same client ID and the following tax year.',
      );
    const suffix = digest({
      archive: input.handoff.digest,
      packet: digest(targetPacket),
      mode: input.mode,
    }).slice(0, 12);
    const id = `${targetPacket.packet.client_id}-${targetPacket.household.tax_year}-${next ? 'carry' : 'restore'}-${suffix}`;
    const archiveId = `${id}-prior`;
    await database.transaction(async (tx) => {
      await tx.query('INSERT INTO clients(id,name) VALUES($1,$2) ON CONFLICT(id) DO NOTHING', [
        targetPacket.packet.client_id,
        clientName(targetPacket),
      ]);
      const rules = await policy(tx, targetPacket);
      const state = next ? emptyState(targetPacket) : restoredState(source, suffix, actor);
      state.inherited = inheritedMetadata(input.handoff, archiveId);
      state.standards = rules.rules;
      state.firmPolicyRevision = rules.revision;
      if (next) {
        state.revision = 1;
        state.audit.push({
          id: randomUUID(),
          type: 'carryforward',
          actor: actor.id,
          name: actor.name,
          at: new Date().toISOString(),
          target: 'all',
          cycle: 0,
          revision: 1,
          detail: `Opened ${targetPacket.household.tax_year} from a genuine pipeline packet. Complete ${source.packet.household.tax_year} review/evidence archived; current-year verification and approvals start fresh.`,
        });
      }
      const inserted = await tx.query(
        'INSERT INTO engagements(id,client_id,tax_year,packet_hash,raw_packet,state,revision) VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7) ON CONFLICT(id) DO NOTHING RETURNING id',
        [
          id,
          targetPacket.packet.client_id,
          targetPacket.household.tax_year,
          digest(targetPacket),
          JSON.stringify(targetPacket),
          JSON.stringify(state),
          state.revision,
        ],
      );
      if (!inserted.rows.length) return;
      await tx.query(
        'INSERT INTO handoff_archives(id,engagement_id,content_hash,payload) VALUES($1,$2,$3,$4::jsonb)',
        [archiveId, id, input.handoff.digest, JSON.stringify(input.handoff)],
      );
      if (!next)
        for (const f of source.attachments)
          await tx.query(
            'INSERT INTO attachments(id,engagement_id,name,mime,content_hash,data_base64) VALUES($1,$2,$3,$4,$5,$6)',
            [`${suffix}-${f.id}`, id, f.name, f.mime, f.content_hash, f.data_base64],
          );
      await persist(tx, id, state.revision, state);
    });
    return json({
      id,
      message: next
        ? 'Next-year engagement created with complete prior history.'
        : 'Review archive restored into a separate engagement.',
    });
  } catch (e) {
    return failure(e);
  }
}
export async function GET(req: NextRequest) {
  try {
    guard(req);
    const { database, packet, state, row } = await load(
      req.nextUrl.searchParams.get('id') || undefined,
    );
    const actor = await getActor(packet);
    if (['client', 'examiner'].includes(actor.role))
      throw new DomainError('Internal prior-review access requires a staff role.', 403);
    if (!state.inherited?.archiveId)
      throw new DomainError('No prior review archive is linked.', 404);
    const result = await database.query(
      'SELECT payload FROM handoff_archives WHERE id=$1 AND engagement_id=$2',
      [state.inherited.archiveId, row.id],
    );
    const bundle = result.rows[0]?.payload;
    if (!bundle) throw new DomainError('Prior review archive not found.', 404);
    if (req.nextUrl.searchParams.get('view') === 'history')
      return json(
        mask({
          metadata: state.inherited,
          packet: bundle.payload.packet,
          state: bundle.payload.state,
          files: bundle.payload.attachments.map((f: any) => ({
            id: f.id,
            name: f.name,
            mime: f.mime,
            content_hash: f.content_hash,
          })),
        }),
      );
    if (!actor.sensitive_data_clearance)
      throw new DomainError('Clearance required to download original archived evidence.', 403);
    await database.transaction(async (tx) => {
      const r = await tx.query('SELECT * FROM engagements WHERE id=$1 FOR UPDATE', [row.id]);
      const logged = applyCommand(packet, r.rows[0].state, actor, {
        type: 'reveal_log',
        target: state.inherited!.archiveId,
        reason: 'Downloaded complete prior review archive and original evidence.',
      });
      await persist(tx, row.id, r.rows[0].revision, logged);
    });
    return new NextResponse(JSON.stringify(bundle), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="prior-review-archive.json"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    return failure(e);
  }
}
