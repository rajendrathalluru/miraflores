import { NextRequest } from 'next/server';
import { load } from '@/lib/db';
import { guard, getActor, json, failure } from '@/lib/server';
import { resolveRef, trace, mask } from '@/lib/packet';
import { DomainError } from '@/lib/workflow';
import type { Row } from '@/lib/types';
export async function GET(req: NextRequest) {
  try {
    guard(req);
    const { packet: p, state } = await load(req.nextUrl.searchParams.get('id') || undefined);
    const a = await getActor(p);
    if (a.role === 'client')
      throw new DomainError('This source belongs to the staff workpaper.', 403);
    const version = req.nextUrl.searchParams.get('version') || p.return_versions.at(-1)!.version;
    const v = p.return_versions.find((x) => x.version === version);
    if (!v) throw new DomainError('Version not found.', 404);
    const ref = req.nextUrl.searchParams.get('ref') || '';
    const asOf = req.nextUrl.searchParams.get('asOf');
    if (asOf && v.computed_at > asOf)
      throw new DomainError('This engine output did not exist at the selected replay point.', 409);
    const resolved = resolveRef(p, v, ref);
    let t = trace(p, v, ref);
    if (!t.nodes.length) t = { nodes: [], refs: [ref] };
    const references = t.refs
      .map((r) => ({ ref: r, ...resolveRef(p, v, r) }))
      .filter((r) => !asOf || !r.document || r.document.received_at <= asOf);
    const field =
      references.find(
        (r) => r.ref === req.nextUrl.searchParams.get('preferredRef') && r.kind === 'field',
      ) || references.find((r) => r.kind === 'field');
    const document = resolved.document || field?.document;
    const page = Number(
      req.nextUrl.searchParams.get('page') || resolved.page || field?.value?.page || 1,
    );
    const available = document && (!asOf || document.received_at <= asOf);
    const evDoc = new Map(p.extracted_values.map((e) => [e.id, e.document_id]));
    const destination = p.return_versions.flatMap((ver) => {
      const parents = new Map<string, string[]>();
      for (const l of ver.lines)
        for (const input of l.inputs || [])
          parents.set(input, [...(parents.get(input) || []), l.key]);
      const sourceDocument = (r: string, seen = new Set<string>()): string[] => {
        if (seen.has(r)) return [];
        seen.add(r);
        if (evDoc.has(r)) return [evDoc.get(r)!];
        if (r.startsWith('asset:'))
          return (
            ver.assets.find((a: Row) => a.asset_id === r.slice(6).split('/')[0])?.sources || []
          ).flatMap((x: string) => sourceDocument(x, seen));
        const d = p.documents.find((d) => d.id === r || `doc:${d.id}` === r.split('#')[0]);
        return d ? [d.id] : [];
      };
      const direct = ver.lines
        .filter(
          (l: Row) =>
            l.key === ref ||
            (resolved.kind !== 'line' &&
              (l.sources || []).some(
                (r: string) =>
                  r === ref ||
                  (resolved.kind === 'document' && sourceDocument(r).includes(document?.id || ref)),
              )),
        )
        .map((l: Row) => l.key);
      const visited = new Set<string>();
      const queue = [...direct];
      while (queue.length) {
        const key = queue.shift()!;
        if (visited.has(key)) continue;
        visited.add(key);
        queue.push(...(parents.get(key) || []));
      }
      return ver.lines
        .filter((l: Row) => visited.has(l.key))
        .map((l: Row) => ({
          version: ver.version,
          key: l.key,
          label: l.label,
          value: l.value,
          direct: direct.includes(l.key),
        }));
    });
    return json(
      mask({
        resolved:
          resolved.kind === 'line'
            ? resolved
            : { kind: resolved.kind, value: resolved.value, field: resolved.field },
        nodes: t.nodes,
        references,
        document: available ? document : null,
        page,
        fields: available
          ? p.extracted_values.filter((e) => e.document_id === document.id && e.page === page)
          : [],
        destinations: destination,
        rules: p.engine_reference?.rules || {},
        links: (state.links || []).filter((x) => x.target === ref || x.related === ref),
        originalAttachment:
          state.evidence.findLast(
            (e) =>
              e.fileId &&
              e.target === document?.id &&
              (a.role !== 'examiner' || e.visibility === 'examiner'),
          ) || null,
        unavailable: !!document && !available,
      }),
    );
  } catch (e) {
    return failure(e);
  }
}
