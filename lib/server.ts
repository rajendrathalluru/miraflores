import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import {
  actorFor,
  actors,
  DomainError,
  filingGates,
  outsideObligations,
  stateHash,
} from './workflow';
import { mask, digest } from './packet';
import { inspectPacket } from './invariants';
import {
  areas,
  areaOf,
  currentVersion,
  estimatedTotals,
  type Packet,
  type WorkState,
  type Row,
} from './types';
export function guard(req: NextRequest) {
  if (!['GET', 'HEAD'].includes(req.method)) {
    const origin = req.headers.get('origin');
    if (
      origin &&
      (new URL(origin).host !== (req.headers.get('host') || req.nextUrl.host) ||
        new URL(origin).protocol !== req.nextUrl.protocol)
    )
      throw new DomainError('Cross-origin changes are not allowed.', 403);
  }
}
export async function getActor(p: Packet) {
  const jar = await cookies();
  const id = jar.get('workpaper_actor')?.value || p.firm?.staff?.[0]?.id;
  if (!id) throw new DomainError('This packet must define at least one firm staff role.', 400);
  return actorFor(p, id);
}
export function failure(e: any) {
  return NextResponse.json(
    { error: e.message || 'Unable to complete this action.' },
    { status: e.status || 500, headers: { 'Cache-Control': 'no-store' } },
  );
}
export function json(value: any) {
  return NextResponse.json(value, { headers: { 'Cache-Control': 'no-store' } });
}
export function project(p: Packet, s: WorkState, actor: Row) {
  const latest = currentVersion(p);
  if (actor.role === 'client')
    return mask({
      packet: {
        packet: p.packet,
        household: {
          tax_year: p.household.tax_year,
          people: p.household.people.map((x: Row) => ({ id: x.id, name: x.name, role: x.role })),
        },
        return_versions: p.return_versions.map((v: Row) => ({
          version: v.version,
          summary: v.summary,
          computed_at: v.computed_at,
        })),
        firm: {
          client_users: p.firm?.client_users,
          staff: (p.firm?.staff || []).map((x: Row) => ({ id: x.id, name: x.name, role: x.role })),
        },
      },
      state: {
        revision: s.revision,
        cycle: s.cycle,
        filing: s.filing,
        threads: s.threads.filter(
          (x) => x.visibility === 'client' && (x.actor === actor.id || x.recipient === actor.id),
        ),
        signoffs: s.signoffs.filter((x) => x.level === 'client'),
        notifications: s.notifications.filter((x) => x.actor === actor.id),
      },
      actor,
      actors: actors(p),
      gates: [],
      findings: [],
      areaHashes: {},
      contentHash: stateHash(p, s),
      reviewedEstimate: estimatedTotals(latest, s),
    });
  const safeState =
    actor.role === 'examiner'
      ? {
          ...s,
          freezes: s.freezes.map((f) => ({
            ...f,
            snapshot: {
              revision: f.snapshot.revision,
              cycle: f.snapshot.cycle,
              adjustments: f.snapshot.adjustments,
              verifications: f.snapshot.verifications,
              triage: f.snapshot.triage,
              findings: f.snapshot.findings,
              signoffs: f.snapshot.signoffs,
              judgments: f.snapshot.judgments,
              filing: f.snapshot.filing,
            },
          })),
          inherited: s.inherited
            ? {
                sourceEngagement: s.inherited.sourceEngagement,
                sourceYear: s.inherited.sourceYear,
                sourceRevision: s.inherited.sourceRevision,
              }
            : undefined,
          firmPolicyEvents: [],
          seenPolicy: {},
          threads: [],
          times: [],
          notifications: [],
          standards: [],
          tasks: [],
          audit: s.audit.filter((x) =>
            [
              'adjust',
              'undo',
              'verify',
              'bulk_verify',
              'triage',
              'judgment',
              'file',
              'amend',
            ].includes(x.type),
          ),
          judgments: s.judgments.filter((x) => x.kind !== 'internal'),
          evidence: s.evidence.filter((x) => x.visibility === 'examiner'),
          plans: [],
        }
      : s;
  const safePacket =
    actor.role === 'examiner'
      ? {
          ...p,
          firm: {
            staff: (p.firm?.staff || []).map((x: Row) => ({
              id: x.id,
              name: x.name,
              role: x.role,
            })),
          },
          client: {},
          household: { ...p.household, bank_account_for_refund_or_payment: undefined },
        }
      : p;
  return mask({
    packet: safePacket,
    state: safeState,
    actor,
    actors: actors(p),
    findings: inspectPacket(p, latest),
    findingsByVersion: Object.fromEntries(
      p.return_versions.map((v) => [v.version, inspectPacket(p, v)]),
    ),
    gates: filingGates(p, s),
    outsideObligations: outsideObligations(p),
    contentHash: stateHash(p, s),
    areaHashes: Object.fromEntries(areas.map((a) => [a.id, stateHash(p, s, a.id)])),
    packetHash: digest(p),
  });
}
