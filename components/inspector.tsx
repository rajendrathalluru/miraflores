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
import { Badge, Form, RefButton, Empty } from './ui';
import { money, human, lineValue, workingValue, type Row } from '@/lib/types';
export default function Inspector({
  workspace,
  version,
  selection,
  onSelect,
  onClose,
  command,
  busy,
  replay,
}: {
  workspace: Row;
  version: string;
  selection: Row;
  onSelect: (r: string, version?: string) => void;
  onClose: () => void;
  command: (c: Row) => Promise<boolean>;
  busy: boolean;
  replay: string;
}) {
  const [data, setData] = useState<Row | null>(null),
    [error, setError] = useState(''),
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
        if (e.name !== 'AbortError') setError(e.message);
      });
    return () => ctrl.abort();
  }, [workspace.id, workspace.actor.id, actual, selection.ref, page, replay]);
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
    .filter((a: Row) => a.target === selection.ref || (line && a.target === line.key))
    .slice()
    .reverse();
  const rates = Object.keys(latest.tax_effect_rates || {});
  const verification = workspace.state.verifications?.[selection.ref];
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
          <span>Every number has a story.</span>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Close inspector">
          <X size={18} />
        </button>
      </div>
      <div className="inspector-selection">
        <span className="eyebrow">{line?.form || doc?.id || 'SELECTED REFERENCE'}</span>
        <h2>{line?.label || doc?.title || selection.ref}</h2>
        <div className="selected-value">
          {line
            ? lineValue(
                line,
                version === 'working' ? workingValue(line, workspace.state, actual) : line.value,
              )
            : field
              ? String(field.value)
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
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : !data ? (
          <div className="skeleton">Connecting the evidence…</div>
        ) : (
          <>
            {tab === 'source' && (
              <>
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
                    <pre>
                      {JSON.stringify(data.resolved.value, null, 2) ||
                        'Select a linked source below.'}
                    </pre>
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
                    title="A clean audit trail starts here"
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
                  <ShieldCheck size={16} /> Make the review explicit
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
                        detail="Estimates use the packet’s supplied rates; no engine recomputation."
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
                            options: rates.map((r) => ({ value: r, label: human(r) })),
                            value: finding?.category || 'ordinary_income',
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
