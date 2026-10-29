'use client';
import { useEffect, useState, useRef } from 'react';
import {
  X,
  ScanLine,
  GitBranch,
  History,
  ChevronRight,
  FileText,
  ShieldCheck,
  ArrowUpRight,
  Check,
  Link2,
  LockKeyhole,
} from 'lucide-react';
import { Badge, Form, RefButton, Empty, EvidenceRecord } from './ui';
import { money, human, lineValue, workingValue, type Row } from '@/lib/types';
import { directEffect, assetFields, readPath, workingReference } from '@/lib/review';
export default function Inspector({
  workspace,
  version,
  selection,
  onSelect,
  onClose,
  command,
  busy,
  replay,
  onWorking,
}: {
  workspace: Row;
  version: string;
  selection: Row;
  onSelect: (r: string, version?: string) => void;
  onClose: () => void;
  command: (c: Row) => Promise<boolean>;
  busy: boolean;
  replay: string;
  onWorking: () => void;
}) {
  const [data, setData] = useState<Row | null>(null),
    [error, setError] = useState(''),
    [retry, setRetry] = useState(0),
    [tab, setTab] = useState('source'),
    [page, setPage] = useState(0),
    [fieldId, setFieldId] = useState(''),
    [reveal, setReveal] = useState(''),
    [destLimit, setDestLimit] = useState(20);
  const latest = workspace.packet.return_versions.at(-1);
  const actual = version === 'working' ? latest.version : version;
  const readOnly =
    !!replay ||
    version !== 'working' ||
    ['client', 'examiner', 'firm_administrator'].includes(workspace.actor.role) ||
    workspace.state.filing.status === 'filed';
  const req = useRef(0);
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const media = window.matchMedia('(max-width:1100px)');
    const el = panelRef.current;
    const previous = document.activeElement as HTMLElement;
    const setup = () => {
      if (media.matches) {
        el?.setAttribute('role', 'dialog');
        el?.setAttribute('aria-modal', 'true');
        el?.querySelector<HTMLElement>('[aria-label="Close inspector"]')?.focus();
      } else {
        el?.removeAttribute('role');
        el?.removeAttribute('aria-modal');
      }
    };
    setup();
    media.addEventListener('change', setup);
    const handler = (e: KeyboardEvent) => {
      if (document.querySelector('dialog[open]')) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        closeRef.current();
        return;
      }
      if (!media.matches || e.key !== 'Tab' || !el) return;
      const stops = [
        ...el.querySelectorAll<HTMLElement>(
          'button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],summary',
        ),
      ].filter((x) => x.getClientRects().length);
      const first = stops[0],
        last = stops.at(-1);
      if (
        !el.contains(document.activeElement) ||
        (e.shiftKey && document.activeElement === first) ||
        (!e.shiftKey && document.activeElement === last)
      ) {
        e.preventDefault();
        (e.shiftKey ? last : first)?.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('keydown', handler);
      media.removeEventListener('change', setup);
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  useEffect(() => {
    setPage(0);
    setFieldId('');
    setReveal('');
    setDestLimit(20);
  }, [selection.ref, actual, workspace.actor.id]);
  useEffect(() => {
    const token = ++req.current;
    setError('');
    setData(null);
    const ctrl = new AbortController();
    fetch(
      `/api/source?id=${encodeURIComponent(workspace.id)}&version=${encodeURIComponent(actual)}&ref=${encodeURIComponent(selection.ref)}${selection.finding?.refs?.[0] ? `&preferredRef=${encodeURIComponent(selection.finding.refs[0])}` : ''}${page ? `&page=${page}` : ''}${replay ? `&asOf=${replay}` : ''}`,
      { signal: ctrl.signal },
    )
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        if (token === req.current) setData(d);
      })
      .catch((e) => {
        if (token === req.current && !ctrl.signal.aborted && e.name !== 'AbortError')
          setError(e.message);
      });
    return () => ctrl.abort();
  }, [workspace.id, workspace.actor.id, actual, selection.ref, page, replay, retry]);
  useEffect(() => {
    if (!reveal) return;
    const hide = () => setReveal('');
    const timer = setTimeout(hide, 15000);
    document.addEventListener('visibilitychange', hide);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', hide);
    };
  }, [reveal]);
  const line = data?.resolved?.kind === 'line' ? data.resolved.value : null;
  const finding = selection.finding;
  const field =
    data?.fields?.find((e: Row) => e.id === fieldId) ||
    data?.fields?.find((e: Row) => e.id === selection.ref) ||
    data?.fields?.find((e: Row) => finding?.refs.includes(e.id)) ||
    data?.references?.find(
      (r: Row) =>
        r.kind === 'field' && r.value?.page === data?.page && r.document?.id === data?.document?.id,
    )?.value ||
    data?.fields?.[0];
  const doc = data?.document;
  const printed = doc?.pages?.find((p: Row) => p.page === data?.page)?.printed_content || '';
  const candidates = [
    String(field?.text_as_read || ''),
    typeof field?.value === 'number'
      ? field.value.toLocaleString('en-US')
      : String(field?.value || ''),
  ];
  const read =
    candidates.find(
      (x) =>
        x &&
        x !== '••••••••' &&
        printed.includes(x) &&
        printed.indexOf(x) === printed.lastIndexOf(x),
    ) || '';
  const match = read ? printed.indexOf(read) : -1;
  const history = workspace.state.audit
    .filter(
      (a: Row) =>
        a.target === selection.ref || a.target === field?.id || (line && a.target === line.key),
    )
    .slice()
    .reverse();
  const rates = Object.keys(latest.tax_effect_rates || {});
  const verification = workspace.state.verifications?.[selection.ref];
  const direct = line ? directEffect(line) : null;
  const asset = data?.resolved?.kind === 'asset' ? data.resolved.value : null;
  const sourceField = data?.resolved?.kind === 'field' ? data.resolved.value : !line ? field : null;
  const overlays = workspace.state.adjustments.filter(
    (a: Row) => a.target === selection.ref && a.active && a.cycle === workspace.state.cycle,
  );
  return (
    <aside ref={panelRef} className="inspector" aria-label="X-ray inspector">
      <div className="inspector-head">
        <div className="inspector-icon">
          <ScanLine size={17} />
        </div>
        <div>
          <strong>X-ray inspector</strong>
          <span>Source · Calculation · History</span>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Close inspector">
          <X size={18} />
        </button>
      </div>
      <div className="inspector-selection">
        <span className="eyebrow">{line?.form || doc?.id || 'SELECTED REFERENCE'}</span>
        <h2>
          {line?.label || doc?.title || asset?.description || sourceField?.label || selection.ref}
        </h2>
        <div className="selected-value">
          {line
            ? lineValue(
                line,
                version === 'working' ? workingValue(line, workspace.state, actual) : line.value,
              )
            : asset && data?.resolved.field
              ? String(
                  version === 'working'
                    ? workingReference(
                        readPath(asset, data.resolved.field),
                        selection.ref,
                        workspace.state,
                        actual,
                      )
                    : readPath(asset, data.resolved.field),
                )
              : field
                ? String(
                    version === 'working'
                      ? workingReference(field.value, field.id, workspace.state, actual)
                      : field.value,
                  )
                : 'Source record'}
          <Badge tone={verification ? 'green' : 'neutral'}>
            {verification ? 'Verified' : 'Review needed'}
          </Badge>
        </div>
        <code>{selection.ref}</code>
      </div>
      <div className="inspector-tabs" role="tablist" aria-label="Inspector views">
        {[
          { id: 'source', icon: FileText, label: 'Source' },
          { id: 'formula', icon: GitBranch, label: 'Formula' },
          { id: 'history', icon: History, label: 'History' },
        ].map((t) => (
          <button role="tab" aria-selected={tab === t.id} key={t.id} onClick={() => setTab(t.id)}>
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>
      <div className="inspector-content">
        {version !== 'working' &&
          !['client', 'examiner', 'firm_administrator'].includes(workspace.actor.role) && (
            <div className="notice">
              <div>
                <strong>Original engine version · read only</strong>
                <p>Switch to Working to verify evidence and save review changes.</p>
                <button className="button primary" onClick={onWorking}>
                  Switch to Working
                </button>
              </div>
            </div>
          )}
        {error ? (
          <div role="alert">
            <p className="error">{error}</p>
            <button className="button" onClick={() => setRetry((value) => value + 1)}>
              Retry loading evidence
            </button>
          </div>
        ) : !data ? (
          <div className="skeleton">Connecting the evidence…</div>
        ) : (
          <>
            {tab === 'source' && (
              <>
                {asset && (
                  <details className="panel">
                    <summary>Asset schedule details</summary>
                    <p className="micro">
                      The invoice supports purchase/disposal evidence. Depreciation, method and life
                      below are supplied engine records, not a direct reading from the invoice.
                    </p>
                    <EvidenceRecord value={asset} />
                  </details>
                )}
                {finding && (
                  <div className="insight-note">
                    <ScanLine size={15} />
                    <div>
                      <strong>{finding.kind}</strong>
                      <p>{finding.detail}</p>
                    </div>
                  </div>
                )}
                {doc ? (
                  <>
                    <div className="source-toolbar">
                      <span>
                        <FileText size={13} />
                        {doc.id} · {doc.file_name}
                      </span>
                      <select
                        aria-label="Source page"
                        value={data.page}
                        onChange={(e) => {
                          setPage(Number(e.target.value));
                          setFieldId('');
                          setReveal('');
                        }}
                      >
                        {doc.pages.map((pg: Row) => (
                          <option key={pg.page} value={pg.page}>
                            Page {pg.page} / {doc.page_count}
                          </option>
                        ))}
                      </select>
                    </div>
                    <article className="source-paper">
                      <div className="paper-top">
                        <span>SIMULATED SOURCE</span>
                        <span>{workspace.packet.household.tax_year}</span>
                      </div>
                      <h3>{doc.title}</h3>
                      <div className="paper-rule" />
                      {field && (
                        <div className="source-field-focus">
                          <div>
                            <span>SELECTED FIELD</span>
                            <strong>{field.label}</strong>
                          </div>
                          <mark>
                            {typeof field.value === 'number'
                              ? field.value.toLocaleString('en-US')
                              : String(field.value)}
                          </mark>
                        </div>
                      )}
                      <div className="paper-text">
                        {match >= 0 ? (
                          <>
                            {printed.slice(0, match)}
                            <mark>{read}</mark>
                            {printed.slice(match + read.length)}
                          </>
                        ) : (
                          printed
                        )}
                      </div>
                      <div className="paper-bottom">
                        {doc.issuer} <span>{data.page}</span>
                      </div>
                    </article>
                    {data.originalAttachment && (
                      <a
                        className="button"
                        href={`/api/attachments?id=${workspace.id}&file=${data.originalAttachment.fileId}`}
                      >
                        Original attached · download source
                      </a>
                    )}
                    {field && (
                      <div className="extraction-card">
                        <div className="flex-between">
                          <strong>
                            <span className="dot blue" /> Extracted field
                          </strong>
                          <Badge>{Math.round(field.confidence * 100)}% confidence</Badge>
                        </div>
                        <select
                          aria-label="Extracted source field"
                          value={field.id}
                          onChange={(e) => {
                            setFieldId(e.target.value);
                            setReveal('');
                          }}
                        >
                          {data.fields.map((e: Row) => (
                            <option key={e.id} value={e.id}>
                              {e.label} · {e.id}
                            </option>
                          ))}
                        </select>
                        <div className="field-reading">{reveal || String(field.value)}</div>
                        <code>
                          {doc.id} / p{field.page} / {field.field} / {field.id}
                        </code>
                        {field.position && (
                          <details className="field-map">
                            <summary>Synthetic page location</summary>
                            <p className="micro">
                              A locator from the packet, not an original scan.
                            </p>
                            <div className="field-map-page">
                              <span>
                                {doc.id} · page {field.page}
                              </span>
                              <div
                                style={{
                                  left: `${field.position.x0 * 100}%`,
                                  top: `${field.position.y0 * 100}%`,
                                  width: `${Math.max(1, (field.position.x1 - field.position.x0) * 100)}%`,
                                  height: `${Math.max(1, (field.position.y1 - field.position.y0) * 100)}%`,
                                }}
                                title={field.label}
                                aria-label={`Selected field location: ${field.label}`}
                              />
                            </div>
                          </details>
                        )}
                        {field.position && (
                          <p className="micro">
                            Synthetic locator:{' '}
                            {Object.entries(field.position)
                              .map(([k, v]) => `${k} ${Number(v).toFixed(3)}`)
                              .join(' · ')}
                            . Printed-text highlight is approximate.
                          </p>
                        )}
                        {['ssn', 'ein', 'account_number'].includes(field.value_type) &&
                          workspace.actor.sensitive_data_clearance && (
                            <button
                              className="text-button"
                              onClick={async () => {
                                if (reveal) {
                                  setReveal('');
                                  return;
                                }
                                const reason = prompt(
                                  'Reason for viewing this protected field (logged):',
                                );
                                if (!reason) return;
                                const r = await fetch('/api/reveal', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    id: workspace.id,
                                    actorId: workspace.actor.id,
                                    ref: field.id,
                                    reason,
                                  }),
                                });
                                const out = await r.json();
                                if (r.ok) setReveal(String(out.value));
                                else setError(out.error);
                              }}
                            >
                              <LockKeyhole size={12} />
                              {reveal ? 'Hide protected value' : 'Reveal for 15 seconds · logged'}
                            </button>
                          )}
                      </div>
                    )}
                  </>
                ) : data.unavailable ? (
                  <Empty
                    title="Not received at this moment"
                    detail="This document arrives later in the season."
                  />
                ) : (
                  <div className="reference-record">
                    <span className="eyebrow">{data.resolved.kind}</span>
                    <EvidenceRecord value={data.resolved.value} />
                  </div>
                )}
                {data.references?.length > 0 && (
                  <div className="inspector-section">
                    <h3>
                      <Link2 size={14} />
                      Linked evidence
                    </h3>
                    <div className="reference-list">
                      {data.references.map((r: Row) => (
                        <button key={r.ref} onClick={() => onSelect(r.ref)}>
                          <div>
                            <strong>{r.value?.label || r.document?.title || r.ref}</strong>
                            <code>
                              {r.ref}
                              {r.value?.page ? ` · page ${r.value.page}` : ''}
                            </code>
                          </div>
                          <ArrowUpRight size={14} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {data.links?.length > 0 && (
                  <div className="inspector-section">
                    <h3>Related years & records</h3>
                    {data.links.map((l: Row) => (
                      <div className="formula-node" key={l.id}>
                        <RefButton
                          onClick={() =>
                            onSelect(l.target === selection.ref ? l.related : l.target)
                          }
                        >
                          {l.target === selection.ref ? l.related : l.target}
                        </RefButton>
                        <p>{l.reason}</p>
                      </div>
                    ))}
                  </div>
                )}
                <div className="inspector-section">
                  <h3>
                    Where this source lands <Badge>{data.destinations?.length || 0}</Badge>
                  </h3>
                  {data.destinations?.length ? (
                    <div className="reference-list">
                      {data.destinations.slice(0, destLimit).map((x: Row, i: number) => (
                        <button
                          key={`${x.version}-${x.key}-${i}`}
                          onClick={() => onSelect(x.key, x.version)}
                        >
                          <div>
                            <strong>{x.label}</strong>
                            <code>
                              {x.version} · {x.key}
                            </code>
                          </div>
                          <ChevronRight size={13} />
                        </button>
                      ))}
                      {data.destinations.length > destLimit && (
                        <button
                          className="text-button"
                          onClick={() => setDestLimit(destLimit + 20)}
                        >
                          Show next {Math.min(20, data.destinations.length - destLimit)} of{' '}
                          {data.destinations.length} destinations
                        </button>
                      )}
                    </div>
                  ) : (
                    <p className="muted">
                      No direct destination recorded. Assign a disposition in Document Index.
                    </p>
                  )}
                </div>
              </>
            )}
            {tab === 'formula' && (
              <>
                <div className="inspector-section">
                  <h3>
                    <GitBranch size={15} />
                    Computation graph
                  </h3>
                  <p className="muted">
                    Supplied engine rules and dependencies. An overlay changes the reviewed input;
                    downstream engine lines are preserved.
                  </p>
                  {(data.nodes || []).map((n: Row) => (
                    <div className="formula-node" key={n.key}>
                      <button onClick={() => onSelect(n.key)}>
                        <code>{n.key}</code>
                        <strong>{lineValue(n)}</strong>
                      </button>
                      <p>{n.label}</p>
                      <small>{data.rules[n.rule] || n.rule}</small>
                      <div className="refs">
                        {(n.inputs || []).map((r: string) => (
                          <RefButton key={r} onClick={() => onSelect(r)}>
                            {r}
                          </RefButton>
                        ))}
                      </div>
                    </div>
                  ))}
                  {!data.nodes?.length && (
                    <Empty
                      title="Source-level evidence"
                      detail="This reference is not a computed return line. Follow a destination to inspect its formula."
                    />
                  )}
                </div>
              </>
            )}
            {tab === 'history' && (
              <div className="inspector-section">
                <h3>Review history</h3>
                {history.length ? (
                  history.map((a: Row) => (
                    <div className="audit-item" key={a.id}>
                      <span className="audit-dot" />
                      <div>
                        <strong>{human(a.type)}</strong>
                        <p>{a.detail}</p>
                        <small>
                          {a.name} · {new Date(a.at).toLocaleString()}
                        </small>
                      </div>
                    </div>
                  ))
                ) : (
                  <Empty
                    title="No review history yet"
                    detail="Verification, adjustments and decisions are recorded with a person, reason and time."
                  />
                )}
              </div>
            )}
            {readOnly ? (
              <div className="readonly-note">
                <LockKeyhole size={14} />
                {workspace.actor.role === 'examiner'
                  ? 'Read-only defense record'
                  : replay
                    ? 'Season replay · no changes allowed'
                    : version !== 'working'
                      ? 'Immutable engine version · switch to Working to review'
                      : 'This role or frozen record cannot change financial evidence.'}
              </div>
            ) : (
              <div className="inspector-actions">
                <h3>
                  <ShieldCheck size={16} /> Review actions
                </h3>
                {line && (
                  <>
                    <Form
                      key={`verify-${selection.ref}`}
                      title={verification ? 'Update verification' : 'Verify this number'}
                      detail="Record the method and evidence, not just a checkmark."
                      busy={busy}
                      submit="Record verification"
                      fields={[
                        {
                          name: 'method',
                          label: 'Verification method',
                          options: (
                            workspace.packet.firm?.starter_standards?.verification_types || [
                              'agreed_to_source_document',
                              'recalculated',
                            ]
                          ).map((m: string) => ({ value: m, label: human(m) })),
                        },
                        { name: 'reason', label: 'Evidence and conclusion', type: 'textarea' },
                      ]}
                      onSubmit={(d) =>
                        command({
                          type: 'verify',
                          target: line.key,
                          refs: data.references.map((r: Row) => r.ref),
                          ...d,
                        })
                      }
                    />
                    <details className="adjust-details" open={!!finding?.proposed}>
                      <summary>
                        Adjust with an audit trail <ChevronRight size={14} />
                      </summary>
                      <Form
                        key={`adjust-${selection.ref}`}
                        title="Working overlay"
                        detail={
                          direct
                            ? direct.label + '. This effect is enforced by the server.'
                            : 'Estimates use supplied rates; downstream engine lines stay intact.'
                        }
                        busy={busy}
                        submit="Save adjustment"
                        fields={[
                          {
                            name: 'value',
                            label: 'Reviewed value',
                            type: 'number',
                            value: String(
                              finding?.proposed ?? workingValue(line, workspace.state, actual),
                            ),
                          },
                          {
                            name: 'category',
                            label: 'Tax-effect category',
                            options: direct
                              ? [{ value: 'direct', label: direct.label }]
                              : rates.map((r) => ({ value: r, label: human(r) })),
                            value: direct ? 'direct' : finding?.category || 'ordinary_income',
                          },
                          {
                            name: 'direction',
                            label: 'Input-to-taxable-income factor',
                            type: 'number',
                            value: String(finding?.direction ?? 1),
                          },
                          {
                            name: 'reason',
                            label: 'Reason and supporting evidence',
                            type: 'textarea',
                          },
                        ]}
                        onSubmit={(d) =>
                          command({
                            type: 'adjust',
                            target: line.key,
                            ...d,
                            value: Number(d.value),
                            direction: Number(d.direction),
                            refs: data.references.map((r: Row) => r.ref),
                          })
                        }
                      />
                    </details>
                    {overlays.map((a: Row) => (
                      <div className="saved-adjustment" key={a.id}>
                        <Badge tone="green">Overlay saved</Badge>
                        <p>
                          {lineValue(line, a.original)} → {lineValue(line, a.value)}
                        </p>
                        <small>{a.reason}</small>
                        <button
                          className="text-button"
                          onClick={() => {
                            const reason = prompt('Reason for reversing this adjustment:');
                            if (reason) void command({ type: 'undo', id: a.id, reason });
                          }}
                        >
                          Undo adjustment
                        </button>
                      </div>
                    ))}
                  </>
                )}
                {(sourceField || asset) && (
                  <SourceCorrection
                    key={`${selection.ref}-${sourceField?.id || ''}`}
                    source={sourceField}
                    asset={asset}
                    selectedField={data.resolved.field}
                    state={workspace.state}
                    version={actual}
                    command={command}
                    busy={busy}
                    actor={workspace.actor}
                  />
                )}
                <details className="adjust-details">
                  <summary>
                    Link another year or record <Link2 size={14} />
                  </summary>
                  <Form
                    key={`link-${selection.ref}`}
                    title="Connect related evidence"
                    busy={busy}
                    fields={[
                      {
                        name: 'related',
                        label: 'Packet reference',
                        value: 'py:/return_2024/lines/F1040.11',
                      },
                      { name: 'reason', label: 'How these records relate', type: 'textarea' },
                    ]}
                    onSubmit={(d) => command({ type: 'link', target: selection.ref, ...d })}
                  />
                </details>
                {finding && (
                  <Form
                    key={`finding-${finding.id}`}
                    title="Conclude this finding"
                    detail="Saving an overlay alone does not resolve the source concern."
                    busy={busy}
                    submit="Record conclusion"
                    fields={[
                      {
                        name: 'reason',
                        label: 'Conclusion and supporting evidence',
                        type: 'textarea',
                      },
                    ]}
                    onSubmit={(d) => command({ type: 'resolve_finding', target: finding.id, ...d })}
                  />
                )}
              </div>
            )}
          </>
        )}
      </div>
      <div className="inspector-foot">
        <ShieldCheck size={12} /> Original preserved. Every change attributable.
      </div>
    </aside>
  );
}

function SourceCorrection({
  source,
  asset,
  selectedField,
  state,
  version,
  command,
  busy,
  actor,
}: {
  source: Row | null;
  asset: Row | null;
  selectedField?: string;
  state: Row;
  version: string;
  command: (c: Row) => Promise<boolean>;
  busy: boolean;
  actor: Row;
}) {
  const options = asset ? assetFields(asset) : [];
  const [field, setField] = useState(selectedField || options[0]?.key || '');
  const original = asset ? readPath(asset, field) : source?.value;
  const target = asset ? `asset:${asset.asset_id}/${field}` : source?.id;
  const sensitive = source && ['ssn', 'ein', 'account_number'].includes(source.value_type);
  const saved = state.adjustments.filter(
    (a: Row) => a.target === target && a.active && a.cycle === state.cycle,
  );
  if (sensitive && !actor.sensitive_data_clearance)
    return <p className="muted">Source correction requires sensitive-data clearance.</p>;
  return (
    <section className="panel source-correction">
      <h3>Correct source evidence</h3>
      <p className="muted">
        Original source and engine output stay intact. This correction reopens review and has no
        automatic tax effect; adjust the supported return line separately.
      </p>
      {asset && (
        <label>
          Asset property
          <select value={field} onChange={(e) => setField(e.target.value)}>
            {options.map((o) => (
              <option key={o.key} value={o.key}>
                {human(o.key)}
              </option>
            ))}
          </select>
        </label>
      )}
      <Form
        key={target}
        title={asset ? human(field) : source?.label}
        busy={busy}
        submit="Save source correction"
        fields={[
          {
            name: 'value',
            label: 'Reviewed source value',
            type: typeof original === 'number' ? 'number' : 'text',
            ...(typeof original === 'boolean'
              ? {
                  options: [
                    { value: 'true', label: 'True' },
                    { value: 'false', label: 'False' },
                  ],
                }
              : {}),
            value: sensitive
              ? ''
              : String(workingReference(original, target, state as any, version) ?? ''),
          },
          { name: 'reason', label: 'Evidence, authority and correction reason', type: 'textarea' },
        ]}
        onSubmit={(d) =>
          command({
            type: 'adjust',
            target,
            field,
            value:
              typeof original === 'number'
                ? Number(d.value)
                : typeof original === 'boolean'
                  ? d.value === 'true'
                  : original === null
                    ? d.value.trim() === ''
                      ? null
                      : Number(d.value)
                    : d.value,
            reason: d.reason,
            refs: source ? [source.id] : asset?.sources || [],
          })
        }
      />
      <Form
        title={state.verifications[target] ? 'Update source verification' : 'Verify source reading'}
        busy={busy}
        submit="Record source verification"
        fields={[
          {
            name: 'method',
            label: 'Source verification method',
            options: [
              { value: 'agreed_to_source_document', label: 'Agreed to original source' },
              { value: 'recalculated', label: 'Recalculated / corroborated' },
            ],
          },
          {
            name: 'reason',
            label: 'Source verification evidence and conclusion',
            type: 'textarea',
          },
        ]}
        onSubmit={(d) =>
          command({
            type: 'verify',
            target,
            ...d,
            refs: source ? [source.id] : asset?.sources || [],
          })
        }
      />
      {saved.map((a: Row) => (
        <div className="saved-adjustment" key={a.id}>
          <Badge>Reviewed source overlay</Badge>
          <p>
            {sensitive ? 'Protected value corrected' : `${String(a.original)} → ${String(a.value)}`}
          </p>
          <p>{a.reason}</p>
          <button
            className="text-button"
            onClick={() => {
              const reason = prompt('Reason to reverse this source correction:');
              if (reason) void command({ type: 'undo', id: a.id, reason });
            }}
          >
            Undo source correction
          </button>
        </div>
      ))}
    </section>
  );
}
