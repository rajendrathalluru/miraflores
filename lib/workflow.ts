import { randomUUID } from 'node:crypto';
import {
  activeAdjustments,
  areaOf,
  areas,
  currentVersion,
  workingValue,
  emptyState,
  type Packet,
  type Row,
  type WorkState,
} from './types';
import { digest, resolveRef } from './packet';
import { inspectPacket } from './invariants';
export class DomainError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function actors(p: Packet) {
  return [
    ...(p.firm?.staff || []),
    ...(p.firm?.client_users || []),
    { id: 'examiner', name: 'IRS Examiner', role: 'examiner', sensitive_data_clearance: false },
  ];
}
export function actorFor(p: Packet, id: string) {
  const a = actors(p).find((x) => x.id === id);
  if (!a) throw new DomainError('Unknown role in this engagement.', 403);
  return a;
}
const financial = ['preparer', 'reviewer', 'partner'];
export function stateHash(p: Packet, s: WorkState, area = 'all') {
  const v = currentVersion(p);
  return digest({
    cycle: s.cycle,
    version: v.version,
    lines: v.lines
      .filter((l: Row) => area === 'all' || areaOf(l) === area)
      .map((l: Row) => [l.key, workingValue(l, s, v.version)]),
    adjustments: activeAdjustments(s, v.version).filter(
      (a) => area === 'all' || areaOf(a.target) === area,
    ),
    triage: s.triage,
    verifications: s.verifications,
    judgments: s.judgments,
    links: s.links || [],
    findings: s.findings,
    evidence: s.evidence,
  });
}
export function outsideObligations(p: Packet): { id: string; label: string; detail: string }[] {
  return (currentVersion(p).diagnostics || [])
    .filter(
      (d: Row) =>
        d.code === 'FBAR_OUTSIDE_RETURN' ||
        d.code === 'FORM_1099_FILING' ||
        /outside (?:the )?engagement/i.test(d.message),
    )
    .map((d: Row) => ({
      id: d.code,
      label:
        d.code === 'FBAR_OUTSIDE_RETURN'
          ? 'FinCEN 114 / FBAR'
          : d.code === 'FORM_1099_FILING'
            ? 'Forms 1099-NEC'
            : d.code,
      detail: d.message,
    }));
}
export function filingGates(p: Packet, s: WorkState) {
  const hash = stateHash(p, s);
  const a = inspectPacket(p, currentVersion(p));
  const incomplete = p.documents.filter((d) => !s.triage[d.id]);
  const unreviewed = areas.filter(
    (ar) =>
      currentVersion(p).lines.some((l: Row) => areaOf(l) === ar.id) &&
      !s.signoffs.some(
        (x) => x.area === ar.id && x.level === 'reviewer' && x.hash === stateHash(p, s, ar.id),
      ),
  );
  const unresolved = a.filter((f) => f.severity !== 'info' && !s.findings[f.id]);
  const steps = p.firm?.starter_standards?.required_steps || [];
  return [
    {
      id: 'documents',
      label: 'Every document accounted for',
      count: incomplete.length,
      detail: `${incomplete.length} documents need a disposition`,
    },
    {
      id: 'checks',
      label: 'Review checks and diagnostics concluded',
      count: unresolved.length,
      detail: `${unresolved.length} critical or warning findings need a supported conclusion`,
    },
    {
      id: 'areas',
      label: 'Area review is current',
      count: unreviewed.length,
      detail: `${unreviewed.length} areas await reviewer sign-off`,
    },
    {
      id: 'notes',
      label: 'Blocking review notes resolved',
      count: s.threads.filter((x) => x.blocks && x.status === 'open').length,
      detail: 'Open blocking notes prevent filing',
    },
    {
      id: 'partner',
      label: 'Partner approval matches this content',
      count: s.signoffs.some((x) => x.area === 'all' && x.level === 'partner' && x.hash === hash)
        ? 0
        : 1,
      detail: 'Content-bound partner approval',
    },
    {
      id: 'client',
      label: 'Both clients approved and authorized',
      count: (p.firm?.client_users || []).filter(
        (u: Row) =>
          !s.signoffs.some(
            (x) =>
              x.area === 'all' &&
              x.level === 'client' &&
              x.actor === u.id &&
              x.hash === hash &&
              x.signature,
          ),
      ).length,
      detail: 'Separate approval and simulated e-file authorization',
    },
    {
      id: 'standards',
      label: 'Required firm steps documented',
      count: steps.filter((x: string) => !s.checklist[x]).length,
      detail: 'Required steps need an accountable conclusion',
    },
    {
      id: 'outside',
      label: 'Outside filing responsibilities recorded',
      count: outsideObligations(p).filter((o) => !s.outside.some((x) => x.obligationId === o.id))
        .length,
      detail:
        outsideObligations(p)
          .filter((o) => !s.outside.some((x) => x.obligationId === o.id))
          .map((o) => o.label)
          .join('; ') || 'Supplied outside-filing diagnostics have an owner, deadline and scope',
    },
  ];
}
const required = (v: any, label: string) => {
  if (typeof v !== 'string' || !v.trim() || v.length > 12000)
    throw new DomainError(`${label} is required (up to 12,000 characters).`);
  return v.trim();
};
export function applyCommand(p: Packet, old: WorkState, actor: Row, c: Row): WorkState {
  const s = structuredClone(old),
    v = currentVersion(p);
  if (actor.role === 'examiner') throw new DomainError('The examiner view is read-only.', 403);
  if (c.version && c.version !== v.version)
    throw new DomainError(
      'Historical engine versions are read-only. Return to Working to save.',
      409,
    );
  if (c.replay) throw new DomainError('Replay is read-only. Return to the current workspace.', 409);
  if (actor.role === 'client' && !['thread', 'reply', 'client_approval', 'seen'].includes(c.type))
    throw new DomainError('This action requires a staff role.', 403);
  if (
    [
      'adjust',
      'undo',
      'verify',
      'triage',
      'resolve_finding',
      'judgment',
      'bulk_verify',
      'undo_batch',
      'link',
    ].includes(c.type) &&
    !financial.includes(actor.role)
  )
    throw new DomainError('A preparer, reviewer or partner is required.', 403);
  const material = [
    'adjust',
    'undo',
    'verify',
    'triage',
    'resolve_finding',
    'judgment',
    'bulk_verify',
    'undo_batch',
    'link',
    'attach',
  ];
  if (s.filing.status === 'filed' && material.includes(c.type))
    throw new DomainError('This record is frozen. A partner must open an amendment first.', 409);
  const now = new Date().toISOString(),
    id = randomUUID();
  let detail = '';
  const reason = () => required(c.reason, 'Reason');
  const target = () => {
    const l = v.lines.find((l: Row) => l.key === c.target);
    if (!l) throw new DomainError('Choose a valid return line.');
    return l;
  };
  switch (c.type) {
    case 'adjust': {
      const l = target();
      if (typeof l.value !== 'number' || !Number.isFinite(c.value))
        throw new DomainError('Only finite numeric values can be adjusted.');
      const cat = required(c.category, 'Tax-effect category');
      const rate = v.tax_effect_rates[cat];
      if (!rate) throw new DomainError('Choose a supplied tax-effect category.');
      const dir = Number(c.direction ?? 1);
      if (!Number.isFinite(dir) || Math.abs(dir) > 100)
        throw new DomainError('Invalid conversion factor.');
      const original = Number(l.value);
      const delta = (c.value - original) * dir;
      for (const a of s.adjustments)
        if (a.target === l.key && a.version === v.version && a.cycle === s.cycle) a.active = false;
      s.adjustments.push({
        id,
        target: l.key,
        original,
        value: c.value,
        category: cat,
        direction: dir,
        reason: reason(),
        refs: (c.refs || []).slice(0, 100),
        actor: actor.id,
        at: now,
        active: true,
        version: v.version,
        cycle: s.cycle,
        federal: Math.round(delta * rate.federal_per_dollar * 100) / 100,
        california: Math.round(delta * rate.california_per_dollar * 100) / 100,
      });
      delete s.verifications[l.key];
      detail = `Adjusted ${l.key}: ${original} → ${c.value}. ${c.reason}`;
      break;
    }
    case 'undo': {
      const a = s.adjustments.find((x) => x.id === c.id && x.active && x.cycle === s.cycle);
      if (!a) throw new DomainError('Active adjustment not found.');
      a.active = false;
      delete s.verifications[a.target];
      detail = `Reversed ${a.target}. ${reason()}`;
      break;
    }
    case 'verify':
    case 'bulk_verify': {
      const keys = c.type === 'bulk_verify' ? c.targets : [c.target];
      if (!Array.isArray(keys) || !keys.length || keys.length > 100)
        throw new DomainError('Choose 1–100 valid numbers.');
      const note = reason();
      const method = required(c.method, 'Verification method');
      if (c.type === 'bulk_verify') {
        s.batches ??= [];
        s.batches.push({
          id,
          targets: keys,
          before: Object.fromEntries(keys.map((key) => [key, s.verifications[key] || null])),
          actor: actor.id,
          at: now,
          cycle: s.cycle,
          active: true,
        });
      }
      for (const key of keys) {
        const l = v.lines.find((l: Row) => l.key === key);
        if (!l) throw new DomainError(`Unknown line ${key}; no changes saved.`);
        s.verifications[key] = {
          id: randomUUID(),
          batchId: c.type === 'bulk_verify' ? id : null,
          method,
          reason: note,
          refs: c.refs || [],
          actor: actor.id,
          at: now,
          value: workingValue(l, s, v.version),
          version: v.version,
          cycle: s.cycle,
        };
      }
      detail = `Verified ${keys.join(', ')} using ${method}. ${note}`;
      break;
    }
    case 'undo_batch': {
      const batch = s.batches?.find((x) => x.id === c.id && x.active && x.cycle === s.cycle);
      if (!batch) throw new DomainError('Active batch not found.');
      for (const key of batch.targets) {
        if (s.verifications[key]?.batchId !== batch.id)
          throw new DomainError(
            'A later verification changed this batch. Review those numbers individually.',
            409,
          );
      }
      for (const key of batch.targets) {
        if (batch.before[key]) s.verifications[key] = batch.before[key];
        else delete s.verifications[key];
      }
      batch.active = false;
      detail = `Reversed verification batch: ${batch.targets.join(', ')}. ${reason()}`;
      break;
    }
    case 'triage': {
      if (
        !p.documents.some((d) => d.id === c.target) ||
        !['used', 'duplicate', 'superseded', 'not_applicable', 'pending'].includes(c.status)
      )
        throw new DomainError('Invalid document or disposition.');
      if (c.status === 'pending') {
        delete s.triage[c.target];
      } else s.triage[c.target] = { status: c.status, reason: reason(), actor: actor.id, at: now };
      detail = `Document ${c.target}: ${c.status}. ${c.reason || ''}`;
      break;
    }
    case 'resolve_finding': {
      if (!inspectPacket(p, v).some((f) => f.id === c.target))
        throw new DomainError('Finding not available in this version.');
      s.findings[c.target] = {
        reason: reason(),
        actor: actor.id,
        at: now,
        status: c.status || 'concluded',
      };
      detail = `Concluded ${c.target}. ${c.reason}`;
      break;
    }
    case 'judgment': {
      s.judgments.push({
        id,
        kind: c.kind || 'judgment',
        target: c.target || 'all',
        reason: reason(),
        authority: required(c.authority, 'Supporting authority or evidence'),
        refs: c.refs || [],
        actor: actor.id,
        at: now,
      });
      detail = `Recorded ${c.kind || 'judgment'} for ${c.target || 'engagement'}`;
      break;
    }
    case 'link': {
      const target = required(c.target, 'Source reference'),
        related = required(c.related, 'Related reference');
      if (
        resolveRef(p, v, target).kind === 'unknown' ||
        resolveRef(p, v, related).kind === 'unknown'
      )
        throw new DomainError('Use valid packet references for both ends of the link.');
      s.links ??= [];
      s.links.push({ id, target, related, reason: reason(), actor: actor.id, at: now });
      detail = `Linked ${target} to ${related}. ${c.reason}`;
      break;
    }
    case 'thread': {
      const recipient = actorFor(
        p,
        c.recipient || p.firm?.assignment_at_start?.preparer || actor.id,
      );
      s.threads.push({
        id,
        title: required(c.title, 'Question / note'),
        body: required(c.body, 'Message'),
        target: c.target || 'all',
        recipient: recipient.id,
        blocks: actor.role === 'client' ? false : !!c.blocks,
        visibility: actor.role === 'client' || recipient.role === 'client' ? 'client' : 'internal',
        status: 'open',
        actor: actor.id,
        at: now,
        messages: [],
      });
      s.notifications.push({ id: randomUUID(), actor: recipient.id, title: c.title, at: now });
      detail = 'Opened a question / review note';
      break;
    }
    case 'reply': {
      const t = s.threads.find((x) => x.id === c.id);
      if (!t || (actor.role === 'client' && t.actor !== actor.id && t.recipient !== actor.id))
        throw new DomainError('Thread unavailable.', 403);
      t.messages.push({ id, body: required(c.body, 'Reply'), actor: actor.id, at: now });
      detail = 'Added an answer as evidence';
      break;
    }
    case 'close_thread': {
      if (!financial.includes(actor.role))
        throw new DomainError('A reviewer must close this note.', 403);
      const t = s.threads.find((x) => x.id === c.id);
      if (!t) throw new DomainError('Thread not found.');
      t.status = 'closed';
      t.resolution = reason();
      detail = 'Resolved a review note';
      break;
    }
    case 'signoff': {
      const area = c.area || 'all';
      const level = c.level;
      if (!areas.some((a) => a.id === area) && area !== 'all')
        throw new DomainError('Unknown area.');
      if (
        (level === 'preparer' && actor.role !== 'preparer') ||
        (level === 'reviewer' &&
          !['reviewer', 'partner', 'quality_reviewer'].includes(actor.role)) ||
        (level === 'partner' && actor.role !== 'partner') ||
        !['preparer', 'reviewer', 'partner'].includes(level)
      )
        throw new DomainError('This approval level requires a different role.', 403);
      if (
        ['reviewer', 'partner'].includes(level) &&
        s.signoffs.some((x) => x.area === area && x.level === 'preparer' && x.actor === actor.id)
      )
        throw new DomainError('You cannot review work you prepared.', 403);
      s.signoffs = s.signoffs.filter(
        (x) => !(x.area === area && x.level === level && x.cycle === s.cycle),
      );
      s.signoffs.push({
        id,
        area,
        level,
        actor: actor.id,
        hash: stateHash(p, s, area),
        at: now,
        cycle: s.cycle,
      });
      detail = `${level} signed ${area}`;
      break;
    }
    case 'client_approval': {
      if (actor.role !== 'client') throw new DomainError('Select the approving client role.', 403);
      if (!c.signature)
        throw new DomainError('Explicit simulated signature authorization is required.');
      if (c.contentHash !== stateHash(p, s))
        throw new DomainError(
          'The reviewed content changed. Review it again and explicitly authorize the current content.',
          409,
        );
      s.signoffs = s.signoffs.filter(
        (x) => !(x.level === 'client' && x.actor === actor.id && x.cycle === s.cycle),
      );
      s.signoffs.push({
        id,
        area: 'all',
        level: 'client',
        actor: actor.id,
        signature: true,
        hash: stateHash(p, s),
        at: now,
        cycle: s.cycle,
      });
      detail = 'Client approved this exact content and recorded simulated authorization';
      break;
    }
    case 'task': {
      actorFor(p, c.assignee);
      s.tasks.push({
        id,
        title: required(c.title, 'Task'),
        assignee: c.assignee,
        due: required(c.due, 'Due date'),
        target: c.target || 'all',
        status: 'open',
        actor: actor.id,
        at: now,
      });
      detail = 'Assigned work with a deadline';
      break;
    }
    case 'complete_task': {
      const t = s.tasks.find((x) => x.id === c.id);
      if (!t) throw new DomainError('Task not found.');
      t.status = 'complete';
      detail = 'Completed task';
      break;
    }
    case 'time': {
      if (!Number.isFinite(c.hours) || c.hours <= 0 || c.hours > 24)
        throw new DomainError('Enter hours between 0 and 24.');
      s.times.push({
        id,
        area: c.area,
        hours: c.hours,
        reason: reason(),
        actor: actor.id,
        at: now,
      });
      detail = `Recorded ${c.hours} hours`;
      break;
    }
    case 'checklist': {
      const key = required(c.target, 'Required step');
      s.checklist[key] = { reason: reason(), actor: actor.id, at: now };
      detail = `Completed required step: ${key}`;
      break;
    }
    case 'outside': {
      s.outside.push({
        id,
        form: required(c.form, 'Form'),
        obligationId: c.obligationId || 'custom',
        owner: required(c.owner, 'Owner'),
        due: required(c.due, 'Deadline'),
        scope: reason(),
        actor: actor.id,
        at: now,
      });
      detail = 'Recorded outside filing responsibility';
      break;
    }
    case 'standard': {
      if (actor.role !== 'firm_administrator')
        throw new DomainError('Firm administrator required.', 403);
      s.standards.push(required(c.body, 'Standard'));
      detail = 'Added a firm standard';
      break;
    }
    case 'plan': {
      s.plans.push({
        id,
        title: required(c.title, 'Plan'),
        body: required(c.body, 'Plan detail'),
        due: c.due || null,
        actor: actor.id,
        at: now,
      });
      detail = 'Saved next-year planning / handoff';
      break;
    }
    case 'extension': {
      if (!['partner', 'preparer'].includes(actor.role))
        throw new DomainError('Partner or preparer required.', 403);
      s.filing.extension = {
        id,
        reason: reason(),
        payment: Number(c.payment || 0),
        at: now,
        actor: actor.id,
        simulation: true,
      };
      detail = 'Recorded a simulated extension';
      break;
    }
    case 'file': {
      if (s.filing.status === 'filed')
        throw new DomainError(
          'This record is already frozen. Open an amendment for further work.',
          409,
        );
      if (actor.role !== 'partner')
        throw new DomainError('A partner must freeze and record filing.', 403);
      const gates = filingGates(p, s).filter((g) => g.count);
      if (gates.length)
        throw new DomainError(`Filing blocked: ${gates.map((g) => g.label).join('; ')}`, 409);
      const frozen = {
        id,
        at: now,
        actor: actor.id,
        cycle: s.cycle,
        packetHash: digest(p),
        contentHash: stateHash(p, s),
        version: v.version,
        snapshot: { ...structuredClone(s), freezes: [] },
      };
      s.freezes.push(frozen);
      s.filing = { ...s.filing, status: 'filed', at: now, frozenId: id, simulation: true };
      detail = 'Frozen filing record created; simulated submission';
      break;
    }
    case 'rejection': {
      if (actor.role !== 'partner') throw new DomainError('Partner required.', 403);
      s.filing = { ...s.filing, status: 'rejected', rejection: reason(), at: now };
      detail = 'Recorded simulated e-file rejection';
      break;
    }
    case 'amend': {
      if (actor.role !== 'partner' || !s.freezes.length)
        throw new DomainError('An existing frozen record and partner role are required.', 403);
      const prior = activeAdjustments(s, v.version);
      s.cycle++;
      for (const a of prior) s.adjustments.push({ ...a, id: randomUUID(), cycle: s.cycle });
      s.signoffs = [];
      s.filing = { status: 'amendment', parent: s.freezes.at(-1)!.id, reason: reason() };
      detail = 'Opened an amendment above the frozen record';
      break;
    }
    case 'seen': {
      s.seen[actor.id] = s.revision;
      detail = 'Marked current activity as seen';
      break;
    }
    case 'attach': {
      s.evidence.push({ ...c.record, id, actor: actor.id, at: now });
      detail = 'Attached evidence';
      break;
    }
    case 'reveal_log': {
      if (!actor.sensitive_data_clearance)
        throw new DomainError('Sensitive-data clearance required.', 403);
      detail = `Protected source viewed: ${required(c.target, 'Target')}. ${reason()}`;
      break;
    }
    default:
      throw new DomainError('Unknown workspace action.');
  }
  s.revision++;
  s.audit.push({
    id,
    at: now,
    actor: actor.id,
    name: actor.name,
    type: c.type,
    target: c.target || c.area || '',
    detail,
    revision: s.revision,
    cycle: s.cycle,
  });
  return s;
}
export { emptyState };
