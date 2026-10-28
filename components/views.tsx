'use client';
import { useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  ShieldCheck,
  FileText,
  Check,
  ChevronRight,
  Plus,
  Link2,
  AlertTriangle,
  Clock,
  TrendingUp,
  GitBranch,
  Download,
  Users,
  CheckCheck,
  FolderOpen,
  Layers,
  Search,
  Undo2,
  MessageSquare,
  LockKeyhole,
  Scale,
} from 'lucide-react';
import { useWork } from './context';
import { salesRows } from '@/lib/sales';
import { Badge, Empty, Form, SectionTitle, RefButton } from './ui';
import {
  areas,
  areaOf,
  money,
  human,
  lineValue,
  workingValue,
  estimatedTotals,
  type Row,
} from '@/lib/types';
export function Dashboard() {
  const { data, packet, state, version, select, open, setView } = useWork();
  const openFindings = data.findings.filter((f: Row) => !state.findings[f.id]);
  const independent = openFindings.filter((f: Row) => f.independent);
  const critical = openFindings.filter((f: Row) => f.severity === 'critical');
  const reviewed = Object.keys(state.verifications).length;
  const totals = estimatedTotals(version, state as any);
  const prior = packet.prior_years?.return_2024?.lines || {};
  const current = version.summary.federal;
  const [filter, setFilter] = useState('all');
  const shown = openFindings.filter(
    (f: Row) =>
      filter === 'all' ||
      (filter === 'independent' && f.independent) ||
      (filter === 'critical' && f.severity === 'critical'),
  );
  return (
    <>
      <div className="page-topline">
        <span className="eyebrow">ENGAGEMENT WORKSPACE</span>
        <Badge tone="blue">
          <span className="dot" /> {human(state.filing.status)}
        </Badge>
      </div>
      <SectionTitle
        eyebrow=""
        title="Clarity, before you sign."
        description="One return. Every source, decision, and next step connected."
        action={
          <button className="button" onClick={() => open('activity')}>
            <HistoryIcon />
            Review activity
            <ArrowUpRight size={13} />
          </button>
        }
      />
      <div className="metrics-grid">
        <Metric
          label="Federal balance due"
          value={money(current.balance_due + totals.federal)}
          foot={`${money(current.balance_due)} engine baseline`}
          tone="navy"
          onClick={() => select('F1040.37')}
        />
        <Metric
          label="California refund"
          value={money(
            Math.abs(Math.min(0, version.summary.california.balance_due + totals.california)),
          )}
          foot="Estimated working balance"
          onClick={() => select('F540NR.97')}
        />
        <Metric
          label="Numbers verified"
          value={`${reviewed}`}
          foot={`of ${version.lines.length} supplied return lines`}
          progress={reviewed / version.lines.length}
          onClick={() => setView('return')}
        />
        <Metric
          label="Documents accounted for"
          value={`${Object.keys(state.triage).length}`}
          suffix={`/ ${packet.documents.length}`}
          foot="Every source has a disposition"
          progress={Object.keys(state.triage).length / packet.documents.length}
          onClick={() => setView('documents')}
        />
      </div>
      <div className="focus-banner">
        <div className="focus-symbol">
          <ScanIcon />
        </div>
        <div>
          <div className="eyebrow">INDEPENDENT CHECKS · CURRENT ENGINE VERSION</div>
          <h2>{critical.length} things worth a closer look.</h2>
          <p>Confidence is a reading. Verification is a conclusion.</p>
        </div>
        <button
          className="button primary"
          onClick={() => {
            if (independent[0]) select(independent[0].target, independent[0]);
          }}
        >
          {independent.length ? 'Review first finding' : 'Inspect the return'}
          <ArrowRight size={15} />
        </button>
        <div className="focus-grid" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </div>
      </div>
      <div className="section-row">
        <div>
          <h2>
            Review queue <span className="count-pill">{openFindings.length}</span>
          </h2>
          <p>Surface disagreements. Follow the evidence. Keep the original.</p>
        </div>
        <div className="segmented">
          {[
            { id: 'all', label: 'All findings' },
            { id: 'critical', label: 'Critical' },
            { id: 'independent', label: 'Independent' },
          ].map((x) => (
            <button key={x.id} aria-pressed={filter === x.id} onClick={() => setFilter(x.id)}>
              {x.label}
            </button>
          ))}
        </div>
      </div>
      <div className="findings-list">
        {shown.map((f: Row, i: number) => (
          <button className="finding-row" onClick={() => select(f.target, f)} key={f.id}>
            <div className={`finding-symbol ${f.severity}`}>
              <AlertTriangle size={16} />
            </div>
            <div className="finding-main">
              <div>
                <span className="finding-area">{human(f.area)}</span>
                <span className="separator-dot">·</span>
                <span>{f.independent ? 'Source check' : 'Engine diagnostic'}</span>
              </div>
              <h3>{f.title}</h3>
              <p>{f.detail}</p>
              <div className="finding-refs">
                {f.refs.slice(0, 3).map((r: string) => (
                  <code key={r}>{r}</code>
                ))}
                {f.refs.length > 3 && <span>+{f.refs.length - 3}</span>}
              </div>
            </div>
            <div className="finding-end">
              <Badge
                tone={
                  f.severity === 'critical' ? 'red' : f.severity === 'warning' ? 'amber' : 'neutral'
                }
              >
                {f.severity === 'critical' ? 'Needs attention' : human(f.severity)}
              </Badge>
              <ArrowUpRight size={16} />
            </div>
          </button>
        ))}
        {!shown.length && (
          <Empty
            title="No findings in this view"
            detail="Completeness and professional review remain separate from automated checks."
          />
        )}
      </div>
      <div className="dashboard-bottom">
        <section className="panel">
          <div className="panel-heading">
            <h2>Return at a glance</h2>
            <button className="text-button" onClick={() => setView('return')}>
              View return
              <ArrowUpRight size={13} />
            </button>
          </div>
          {[
            ['Adjusted gross income', 'F1040.11', current.agi],
            ['Taxable income', 'F1040.15', current.taxable_income],
            ['Total federal tax', 'F1040.24', current.total_tax],
            ['Total payments', 'F1040.33', current.payments],
          ].map(([label, key, value]) => (
            <button className="summary-line" onClick={() => select(String(key))} key={key}>
              <span>{label}</span>
              <div>
                <strong>{money(value)}</strong>
                {prior[String(key)] !== undefined && <small>PY {money(prior[String(key)])}</small>}
              </div>
              <ArrowUpRight size={12} />
            </button>
          ))}
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>Up next</h2>
            <Clock size={15} />
          </div>
          {(packet.firm?.deadlines || []).slice(0, 4).map((d: Row) => (
            <div className="deadline" key={d.what}>
              <div className="date-tile">
                <span>
                  {new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short' })}
                </span>
                <strong>{d.date.slice(-2)}</strong>
              </div>
              <div>
                <strong>{d.what}</strong>
                <span>{d.date} · Packet schedule</span>
              </div>
            </div>
          ))}
        </section>
      </div>
      <div className="method-note">
        <ShieldCheck size={15} />
        <span>
          Pipeline output stays intact. Reviewed overlays and estimated tax effects are separate
          from the supplied computation.
        </span>
      </div>
    </>
  );
}
function HistoryIcon() {
  return <Clock size={14} />;
}
function ScanIcon() {
  return <GitBranch size={26} />;
}
function Metric({
  label,
  value,
  suffix,
  foot,
  tone = '',
  progress,
  onClick,
}: {
  label: string;
  value: string;
  suffix?: string;
  foot: string;
  tone?: string;
  progress?: number;
  onClick: () => void;
}) {
  return (
    <button className={`metric ${tone}`} onClick={onClick}>
      <div>
        <span>{label}</span>
        <ArrowUpRight size={14} />
      </div>
      <strong>
        {value}
        <small>{suffix}</small>
      </strong>
      {progress !== undefined && (
        <div className="metric-progress">
          <i style={{ width: `${Math.max(2, progress * 100)}%` }} />
        </div>
      )}
      <p>{foot}</p>
    </button>
  );
}
export function ReturnView() {
  const { packet, state, version, working, select, command, readOnly, busy, open } = useWork();
  const [area, setArea] = useState('overview'),
    [query, setQuery] = useState(''),
    [page, setPage] = useState(1),
    [selected, setSelected] = useState<string[]>([]);
  const prior = packet.prior_years?.return_2024?.lines || {};
  let lines = version.lines.filter(
    (l: Row) =>
      (area === 'all' || areaOf(l) === area) &&
      `${l.label} ${l.key} ${l.note || ''}`.toLowerCase().includes(query.toLowerCase()),
  );
  const pages = Math.ceil(lines.length / 30);
  const rows = lines.slice((page - 1) * 30, page * 30);
  return (
    <>
      <SectionTitle
        eyebrow="RETURN & AREAS"
        title="The return, in context."
        description="Every supplied line, linked to its rule, dependencies, and source."
        action={
          <button className="button" onClick={() => open('scenario')}>
            <GitBranch size={14} />
            What-if sandbox
          </button>
        }
      />
      <div className="area-scroll">
        {[{ id: 'all', name: 'All areas' }, ...areas].map((a) => (
          <button
            key={a.id}
            aria-pressed={area === a.id}
            onClick={() => {
              setArea(a.id);
              setPage(1);
              setSelected([]);
            }}
          >
            {a.name}
            <span>
              {version.lines.filter((l: Row) => a.id === 'all' || areaOf(l) === a.id).length}
            </span>
          </button>
        ))}
      </div>
      <div className="table-toolbar">
        <div className="search-input">
          <Search size={15} />
          <input
            aria-label="Search return lines"
            placeholder="Find a line, form, or amount…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <span>
          {lines.length} lines · {version.version}
        </span>
        {!readOnly && area !== 'all' && (
          <button
            className="button"
            disabled={busy}
            onClick={() =>
              void command({
                type: 'signoff',
                area,
                level:
                  packet.firm?.staff.find((a: Row) => a.id === document.body.dataset.actor)
                    ?.role === 'preparer'
                    ? 'preparer'
                    : 'reviewer',
              })
            }
          >
            <ShieldCheck size={14} />
            Sign off area
          </button>
        )}
      </div>
      {state.batches?.some((b: Row) => b.active && b.cycle === state.cycle) && !readOnly && (
        <div className="bulk-bar">
          <span>Last verification batch is reversible</span>
          <button
            className="text-button"
            onClick={() => {
              const batch = state.batches.findLast((b: Row) => b.active && b.cycle === state.cycle);
              const reason = prompt('Reason for undoing the last verification batch:');
              if (reason) void command({ type: 'undo_batch', id: batch.id, reason });
            }}
          >
            Undo last batch
            <Undo2 size={14} />
          </button>
        </div>
      )}
      {selected.length > 0 && (
        <div className="bulk-bar">
          <strong>{selected.length} selected</strong>
          <button
            className="text-button"
            onClick={() => {
              const reason = prompt(
                'Verification method and supporting evidence for these selected numbers:',
              );
              if (reason)
                void command({
                  type: 'bulk_verify',
                  targets: selected,
                  method: 'agreed_to_source_document',
                  reason,
                });
            }}
          >
            Verify selected atomically
            <CheckCheck size={14} />
          </button>
          <button className="text-button" onClick={() => setSelected([])}>
            Clear
          </button>
        </div>
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {!readOnly && (
                <th className="check-cell">
                  <span className="sr-only">Select</span>
                </th>
              )}
              <th>Line & description</th>
              <th className="number">Prior year</th>
              <th className="number">Engine {version.version}</th>
              <th className="number">{working ? 'Working' : 'Selected'}</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((l: Row) => {
              const value = working ? workingValue(l, state as any, version.version) : l.value;
              const adjusted = value !== l.value;
              const v = state.verifications[l.key];
              return (
                <tr key={l.key}>
                  {!readOnly && (
                    <td className="check-cell">
                      <input
                        type="checkbox"
                        aria-label={`Select ${l.key}`}
                        checked={selected.includes(l.key)}
                        onChange={(e) =>
                          setSelected(
                            e.target.checked
                              ? [...selected, l.key]
                              : selected.filter((x) => x !== l.key),
                          )
                        }
                      />
                    </td>
                  )}
                  <td>
                    <button className="line-description" onClick={() => select(l.key)}>
                      <code>{l.key}</code>
                      <strong>{l.label}</strong>
                      {l.note && <small>{l.note}</small>}
                    </button>
                  </td>
                  <td className="number muted">
                    {prior[l.key] === undefined ? '—' : money(prior[l.key])}
                  </td>
                  <td className={`number ${adjusted ? 'struck' : ''}`}>{lineValue(l)}</td>
                  <td className="number">
                    <button
                      className={`number-button ${adjusted ? 'changed' : ''}`}
                      onClick={() => select(l.key)}
                    >
                      {lineValue(l, value)}
                    </button>
                  </td>
                  <td>
                    <Badge tone={v ? 'green' : adjusted ? 'blue' : 'neutral'}>
                      {v ? 'Verified' : adjusted ? 'Adjusted' : 'Unverified'}
                    </Badge>
                  </td>
                  <td>
                    <button
                      className="icon-button"
                      aria-label={`Inspect ${l.key}`}
                      onClick={() => select(l.key)}
                    >
                      <ArrowUpRight size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pages={pages} setPage={setPage} total={lines.length} />
      <div className="panel lower-panel">
        <div className="panel-heading">
          <h2>Prior preparer → current review</h2>
          <Badge>History preserved</Badge>
        </div>
        <p>
          {packet.prior_years?.prior_preparer_workpaper?.summary_memo ||
            'No prior preparer memo supplied.'}
        </p>
        <details>
          <summary>Prior notes, basis gaps, carryovers and open items</summary>
          <RecordTree value={packet.prior_years} />
        </details>
      </div>
    </>
  );
}
export function DocumentsView() {
  const { data, packet, state, version, select, command, busy, readOnly, open } = useWork();
  const [query, setQuery] = useState(''),
    [filter, setFilter] = useState('all');
  const docs = packet.documents.filter(
    (d: Row) =>
      (filter === 'all' ||
        (filter === 'pending' && !state.triage[d.id]) ||
        (filter === 'used' && version.documents_used.includes(d.id)) ||
        (filter === 'superseded' && version.documents_superseded?.includes(d.id))) &&
      `${d.id} ${d.title} ${d.file_name}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <SectionTitle
        eyebrow="DOCUMENT INDEX"
        title="Nothing left unaccounted for."
        description="See what arrived, where it landed, and what still needs a conclusion."
        action={
          !readOnly && (
            <button className="button primary" onClick={() => open('evidence')}>
              <Plus size={15} />
              Attach evidence
            </button>
          )
        }
      />
      <div className="mini-stats">
        <div>
          <strong>{packet.documents.length}</strong>
          <span>source documents</span>
        </div>
        <div>
          <strong>{version.documents_used.length}</strong>
          <span>used by this engine version</span>
        </div>
        <div>
          <strong>{Object.keys(state.triage).length}</strong>
          <span>review dispositions recorded</span>
        </div>
        <div>
          <strong>{state.evidence.length}</strong>
          <span>reviewer attachments</span>
        </div>
      </div>
      <div className="table-toolbar">
        <div className="search-input">
          <Search size={15} />
          <input
            aria-label="Search documents"
            placeholder="Search source documents…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select
          aria-label="Document filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">All documents</option>
          <option value="pending">Needs disposition</option>
          <option value="used">Used by engine</option>
          <option value="superseded">Superseded</option>
        </select>
      </div>
      <div className="document-grid">
        {docs.map((d: Row) => (
          <article className="document-card" key={d.id}>
            <button className="document-open" onClick={() => select(d.id)}>
              <div className="document-icon">
                <FileText size={20} />
              </div>
              <Badge tone={state.triage[d.id] ? 'green' : d.marked_corrected ? 'amber' : 'neutral'}>
                {state.triage[d.id]
                  ? human(state.triage[d.id].status)
                  : d.marked_corrected
                    ? 'Corrected'
                    : 'Needs disposition'}
              </Badge>
              <h3>{d.title}</h3>
              <span>
                {d.id} · {d.page_count} pages · {d.document_type}
              </span>
              <p>{d.issuer}</p>
              <div className="document-card-foot">
                <span>
                  {new Date(d.received_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
                <span>
                  {version.documents_used.includes(d.id)
                    ? 'In engine output'
                    : 'Not in this version'}
                  <ArrowUpRight size={12} />
                </span>
              </div>
            </button>
            {!readOnly && (
              <div className="document-triage">
                <select
                  aria-label={`Disposition ${d.id}`}
                  defaultValue=""
                  disabled={busy}
                  onChange={(e) => {
                    const status = e.target.value;
                    if (!status) return;
                    const reason = prompt(
                      `Why is ${d.id} ${human(status).toLowerCase()}? Include related document references.`,
                    );
                    if (reason) void command({ type: 'triage', target: d.id, status, reason });
                    e.target.value = '';
                  }}
                >
                  <option value="">Record disposition…</option>
                  {['used', 'duplicate', 'superseded', 'not_applicable', 'pending'].map((x) => (
                    <option value={x} key={x}>
                      {human(x)}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </article>
        ))}
      </div>
      {state.evidence.length > 0 && (
        <section className="panel lower-panel">
          <h2>Additional evidence</h2>
          {state.evidence.map((e: Row) => (
            <div className="summary-line" key={e.id}>
              <div>
                <strong>{e.name || e.title}</strong>
                <p>{e.body || e.hash}</p>
              </div>
              {e.fileId ? (
                <a className="text-button" href={`/api/attachments?id=${data.id}&file=${e.fileId}`}>
                  Download
                  <Download size={13} />
                </a>
              ) : (
                <RefButton onClick={() => select(e.target)}>{e.target}</RefButton>
              )}
            </div>
          ))}
        </section>
      )}
    </>
  );
}
export function AssetsView() {
  const { packet, version, select } = useWork();
  const [tab, setTab] = useState('assets');
  return (
    <>
      <SectionTitle
        eyebrow="ASSETS & BASIS"
        title="The long view, by asset."
        description="Federal, California and AMT treatment, with the history kept intact."
      />
      <div className="tabs">
        {[
          'assets',
          'sales',
          'books to tax',
          'state split',
          'basis & carryovers',
          'retirement & foreign',
          'deductions & limits',
        ].map((t) => (
          <button key={t} aria-selected={tab === t} onClick={() => setTab(t)}>
            {human(t)}
          </button>
        ))}
      </div>
      {tab === 'assets' ? (
        <>
          <div className="mini-stats">
            <div>
              <strong>{version.assets.length}</strong>
              <span>assets on the schedule</span>
            </div>
            <div>
              <strong>
                {money(
                  version.assets.reduce(
                    (s: number, a: Row) =>
                      s + (a.federal?.['depreciation_' + packet.household.tax_year] || 0),
                    0,
                  ),
                )}
              </strong>
              <span>federal depreciation</span>
            </div>
            <div>
              <strong>
                {money(
                  version.assets.reduce(
                    (s: number, a: Row) =>
                      s + (a.california?.['depreciation_' + packet.household.tax_year] || 0),
                    0,
                  ),
                )}
              </strong>
              <span>California depreciation</span>
            </div>
          </div>
          <div className="asset-list">
            {version.assets.map((a: Row) => (
              <article className="panel asset-card" key={a.asset_id}>
                <div className="flex-between">
                  <div className="asset-title">
                    <div className="asset-icon">
                      <Layers size={21} />
                    </div>
                    <div>
                      <code>{a.asset_id}</code>
                      <h3>{a.description}</h3>
                      <p>{a.activity}</p>
                    </div>
                  </div>
                  <Badge tone={a.disposed ? 'amber' : 'green'}>
                    {a.disposed ? 'Disposed' : 'In service'}
                  </Badge>
                </div>
                <div className="asset-data">
                  <div>
                    <span>Cost basis</span>
                    <strong>{money(a.cost)}</strong>
                  </div>
                  <div>
                    <span>Method / life</span>
                    <strong>{a.method}</strong>
                    <small>
                      {a.life_years} years · {a.placed_in_service}
                    </small>
                  </div>
                  <div>
                    <span>Federal</span>
                    <strong>
                      {money(a.federal?.['depreciation_' + packet.household.tax_year], 2)}
                    </strong>
                  </div>
                  <div>
                    <span>California</span>
                    <strong>
                      {money(a.california?.['depreciation_' + packet.household.tax_year], 2)}
                    </strong>
                  </div>
                  <div>
                    <span>AMT</span>
                    <strong>
                      {money(a.amt?.['depreciation_' + packet.household.tax_year], 2)}
                    </strong>
                  </div>
                </div>
                <div className="refs">
                  {a.sources.map((r: string) => (
                    <RefButton key={r} onClick={() => select(r)}>
                      {r}
                    </RefButton>
                  ))}
                  <RefButton onClick={() => select(`asset:${a.asset_id}`)}>
                    Full asset · disposal & recapture
                  </RefButton>
                </div>
              </article>
            ))}
          </div>
        </>
      ) : tab === 'sales' ? (
        <Sales />
      ) : tab === 'books to tax' ? (
        <>
          <h2>Business books → Schedule C</h2>
          <p className="muted">
            Supplied inputs and tax treatments. Click any amount for the complete graph.
          </p>
          <LineList lines={version.lines.filter((l: Row) => l.form === 'SchC')} />
        </>
      ) : tab === 'state split' ? (
        <StateSplit />
      ) : tab === 'basis & carryovers' ? (
        <>
          <div className="panel lower-panel">
            <h2>Basis history · unknown stays unknown</h2>
            <RecordTree value={packet.prior_years?.basis_records} />
          </div>
          <div className="panel lower-panel">
            <h2>Carryovers into this return</h2>
            <RecordTree value={packet.prior_years?.carryovers_into_2025} />
            <h2>Supplied carryovers out</h2>
            <RecordTree value={version.carryovers_out} />
          </div>
          <LineList lines={version.lines.filter((l: Row) => l.form === 'F7203')} />
        </>
      ) : tab === 'retirement & foreign' ? (
        <>
          <LineList
            lines={version.lines.filter((l: Row) =>
              ['F8606', 'F8889', 'F8938', 'ScheduleS'].includes(l.form),
            )}
          />
          <RecordTree value={packet.fx_rates} />
        </>
      ) : (
        <LineList
          lines={version.lines.filter((l: Row) =>
            ['SchA', 'F8283', 'F8863', 'F2441', 'F8812', 'F8867'].includes(l.form),
          )}
        />
      )}
    </>
  );
}
function LineList({ lines }: { lines: Row[] }) {
  const { select, state, version, working } = useWork();
  return (
    <div className="panel line-list">
      {lines.map((l) => (
        <button className="summary-line" key={l.key} onClick={() => select(l.key)}>
          <div>
            <code>{l.key}</code>
            <strong>{l.label}</strong>
          </div>
          <span className="mono">
            {lineValue(l, working ? workingValue(l, state as any, version.version) : l.value)}
          </span>
          <ArrowUpRight size={13} />
        </button>
      ))}
    </div>
  );
}
function Sales() {
  const { packet, version, select } = useWork();
  const [query, setQuery] = useState(''),
    [page, setPage] = useState(1),
    [cohort, setCohort] = useState('all');
  const all = salesRows(packet as any, version);
  const list = all.filter(
    (l: Row) =>
      (cohort === 'all' || l.sourceDocument === cohort) &&
      `${l.label} ${l.key} ${l.sourceDocument}`.toLowerCase().includes(query.toLowerCase()),
  );
  const proceeds = all.reduce((s: number, l: Row) => s + (l.proceeds ?? 0), 0);
  const gain = all.reduce((s: number, l: Row) => s + Number(l.gain || 0), 0);
  const groups = [...new Set<string>(all.map((l: Row) => String(l.sourceDocument)))];
  return (
    <>
      <div className="mini-stats">
        <div>
          <strong>{all.length}</strong>
          <span>individual lots · summary rows excluded</span>
        </div>
        <div>
          <strong>{money(proceeds, 2)}</strong>
          <span>
            full-population proceeds
            {all.some((l: Row) => l.proceeds === null) ? ' · incomplete sources' : ''}
          </span>
        </div>
        <div>
          <strong>{money(gain, 2)}</strong>
          <span>supplied net gain · all lots</span>
        </div>
      </div>
      <div className="area-scroll">
        <button
          aria-pressed={cohort === 'all'}
          onClick={() => {
            setCohort('all');
            setPage(1);
          }}
        >
          All sources <span>{all.length}</span>
        </button>
        {groups.map((g) => (
          <button
            key={g}
            aria-pressed={cohort === g}
            onClick={() => {
              setCohort(g);
              setPage(1);
            }}
          >
            {g} · {packet.documents.find((d: Row) => d.id === g)?.issuer || 'Source'}
            <span>{all.filter((l: Row) => l.sourceDocument === g).length}</span>
          </button>
        ))}
      </div>
      <div className="table-toolbar">
        <div className="search-input">
          <Search size={15} />
          <input
            placeholder="Search brokerage, lot, or asset…"
            aria-label="Search sales"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Badge>Full totals stay fixed across pages</Badge>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Lot & source</th>
              <th className="number">Proceeds</th>
              <th className="number">Reported basis</th>
              <th className="number">Engine gain</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.slice((page - 1) * 25, page * 25).map((l: Row) => (
              <tr key={l.key}>
                <td>
                  <button className="line-description" onClick={() => select(l.key)}>
                    <code>
                      {l.key} · {l.sourceDocument}
                    </code>
                    <strong>{l.label.split(' (acquired')[0]}</strong>
                    <small>{l.label.match(/acquired.*?(?=;)/)?.[0] || ''}</small>
                  </button>
                </td>
                <td className="number">{money(l.proceeds, 2)}</td>
                <td className="number">{money(l.basis, 2)}</td>
                <td className="number">
                  <button className="number-button" onClick={() => select(l.key)}>
                    {money(l.gain, 2)}
                  </button>
                </td>
                <td>
                  <button
                    className="icon-button"
                    aria-label={`Inspect ${l.key}`}
                    onClick={() => select(l.key)}
                  >
                    <ArrowUpRight size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination
        page={page}
        pages={Math.ceil(list.length / 25)}
        setPage={setPage}
        total={list.length}
      />
    </>
  );
}
function StateSplit() {
  const { version, select } = useWork();
  const groups = new Map<string, Row[]>();
  version.lines
    .filter((l: Row) => l.form === 'SchCA540NR')
    .forEach((l: Row) => {
      const key = l.line.split('.')[0];
      groups.set(key, [...(groups.get(key) || []), l]);
    });
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Schedule CA (540NR)</th>
            {['A · Federal', 'B · Subtractions', 'C · Additions', 'D · Total', 'E · CA source'].map(
              (x) => (
                <th key={x} className="number">
                  {x}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {[...groups].map(([key, lines]) => (
            <tr key={key}>
              <td>
                <code>Line {key}</code>
                <p>{lines[0]?.label?.replace(/\s*\(column.*$/i, '')}</p>
              </td>
              {['A', 'B', 'C', 'D', 'E'].map((c) => {
                const l = lines.find((l) => l.line.endsWith('.' + c));
                return (
                  <td key={c} className="number">
                    {l ? (
                      <button className="number-button" onClick={() => select(l.key)}>
                        {lineValue(l)}
                      </button>
                    ) : (
                      <small>Not supplied</small>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function PeopleView() {
  const { data, packet, state, version, command, busy, readOnly, open, select } = useWork();
  const [tab, setTab] = useState('questions');
  return (
    <>
      <SectionTitle
        eyebrow="PEOPLE & Q&A"
        title="A conversation becomes evidence."
        description="Clear owners, durable answers, and review notes that matter."
        action={
          !readOnly && (
            <button className="button primary" onClick={() => open('question')}>
              <Plus size={14} />
              New question
            </button>
          )
        }
      />
      <div className="tabs">
        {[
          'questions',
          'assignments',
          'judgment & authority',
          'approvals',
          'source conversations',
        ].map((t) => (
          <button key={t} aria-selected={tab === t} onClick={() => setTab(t)}>
            {human(t)}
          </button>
        ))}
      </div>
      {tab === 'questions' ? (
        <>
          {state.threads.length ? (
            state.threads.map((t: Row) => (
              <article className="panel thread" key={t.id}>
                <div className="flex-between">
                  <div className="thread-icon">
                    <MessageSquare size={16} />
                  </div>
                  <Badge tone={t.status === 'closed' ? 'green' : t.blocks ? 'red' : 'blue'}>
                    {t.status === 'closed'
                      ? 'Resolved'
                      : t.blocks
                        ? 'Blocks filing'
                        : 'Open question'}
                  </Badge>
                </div>
                <h2>{t.title}</h2>
                <p>{t.body}</p>
                <div className="thread-meta">
                  To {data.actors.find((a: Row) => a.id === t.recipient)?.name} · {t.visibility} ·{' '}
                  <button className="text-button" onClick={() => select(t.target)}>
                    {t.target}
                  </button>
                </div>
                {t.messages.map((m: Row) => (
                  <blockquote key={m.id}>
                    <p>{m.body}</p>
                    <small>
                      {data.actors.find((a: Row) => a.id === m.actor)?.name} ·{' '}
                      {new Date(m.at).toLocaleDateString()}
                    </small>
                  </blockquote>
                ))}
                {!readOnly && (
                  <div className="thread-actions">
                    <button
                      className="button"
                      onClick={() => {
                        const body = prompt('Reply with evidence or supporting references:');
                        if (body) void command({ type: 'reply', id: t.id, body });
                      }}
                    >
                      Reply
                    </button>
                    {t.status === 'open' && (
                      <button
                        className="text-button"
                        onClick={() => {
                          const reason = prompt('Resolution and supporting evidence:');
                          if (reason) void command({ type: 'close_thread', id: t.id, reason });
                        }}
                      >
                        Resolve note
                        <Check size={14} />
                      </button>
                    )}
                  </div>
                )}
              </article>
            ))
          ) : (
            <Empty
              title="Space for the questions that matter"
              detail="Ask the client, consult a colleague, or create a blocking review note. Answers remain part of the record."
            />
          )}
        </>
      ) : tab === 'assignments' ? (
        <>
          <div className="split-forms">
            {!readOnly && (
              <Form
                title="Assign the next step"
                busy={busy}
                fields={[
                  { name: 'title', label: 'Task' },
                  {
                    name: 'assignee',
                    label: 'Assignee',
                    options: data.actors
                      .filter((a: Row) => a.role !== 'examiner')
                      .map((a: Row) => ({ value: a.id, label: a.name })),
                  },
                  { name: 'due', label: 'Due date', type: 'date' },
                  { name: 'target', label: 'Linked reference', optional: true },
                ]}
                onSubmit={(d) => command({ type: 'task', ...d })}
              />
            )}
            <div>
              {state.tasks.map((t: Row) => (
                <article className="panel task" key={t.id}>
                  <Badge tone={t.status === 'complete' ? 'green' : 'amber'}>
                    {human(t.status)}
                  </Badge>
                  <h3>{t.title}</h3>
                  <p>
                    {data.actors.find((a: Row) => a.id === t.assignee)?.name} · Due {t.due}
                  </p>
                  {!readOnly && t.status !== 'complete' && (
                    <button
                      className="text-button"
                      onClick={() => void command({ type: 'complete_task', id: t.id })}
                    >
                      Complete task
                      <Check size={14} />
                    </button>
                  )}
                </article>
              ))}
            </div>
          </div>
        </>
      ) : tab === 'judgment & authority' ? (
        <>
          <div className="split-forms">
            {!readOnly && (
              <Form
                title="Record professional judgment"
                busy={busy}
                fields={[
                  {
                    name: 'kind',
                    label: 'Record type',
                    options: [
                      'judgment',
                      'election',
                      'due_diligence',
                      'penalty_decision',
                      'prior_year_variance',
                    ].map((x) => ({ value: x, label: human(x) })),
                  },
                  { name: 'target', label: 'Line / area / related return' },
                  { name: 'reason', label: 'Decision and rationale', type: 'textarea' },
                  { name: 'authority', label: 'Authority or evidence relied on', type: 'textarea' },
                ]}
                onSubmit={(d) => command({ type: 'judgment', ...d })}
              />
            )}
            <div>
              {state.judgments.map((j: Row) => (
                <article className="panel task" key={j.id}>
                  <Badge>{human(j.kind)}</Badge>
                  <h3>{j.target}</h3>
                  <p>{j.reason}</p>
                  <blockquote>{j.authority}</blockquote>
                </article>
              ))}
            </div>
          </div>
        </>
      ) : tab === 'approvals' ? (
        <>
          <div className="notice">
            <ShieldCheck size={17} />
            <p>
              Approvals bind to a content hash. Relevant evidence, verification or overlay changes
              make the old approval stale. A preparer cannot approve their own work as reviewer.
            </p>
          </div>
          {areas
            .filter((a) => version.lines.some((l: Row) => areaOf(l) === a.id))
            .map((a) => (
              <div className="panel approval-row" key={a.id}>
                <div>
                  <h3>{a.name}</h3>
                  <code>{data.areaHashes[a.id]?.slice(0, 16)}</code>
                </div>
                {['preparer', 'reviewer'].map((level) => {
                  const sign = state.signoffs.find(
                    (s: Row) => s.area === a.id && s.level === level,
                  );
                  const fresh = sign && sign.hash === data.areaHashes[a.id];
                  return (
                    <button
                      key={level}
                      className={`button ${fresh ? 'approved' : ''}`}
                      disabled={busy || readOnly}
                      onClick={() => void command({ type: 'signoff', area: a.id, level })}
                    >
                      {fresh ? <Check size={13} /> : <ShieldCheck size={13} />} {human(level)}
                      {sign && !fresh ? ' · Reopened' : ''}
                    </button>
                  );
                })}
              </div>
            ))}
        </>
      ) : (
        <RecordTree value={packet.client} />
      )}
    </>
  );
}
export function FilingView() {
  const { data, packet, state, command, busy, readOnly, open } = useWork();
  const [tab, setTab] = useState('filing');
  return (
    <>
      <SectionTitle
        eyebrow="FILING & FIRM"
        title="Ready means accounted for."
        description="Close the review, preserve the record, and give next year a head start."
        action={
          <a className="button" href={`/api/export?id=${data.id}&kind=defense`}>
            <Download size={14} />
            Defense record
          </a>
        }
      />
      <div className="tabs">
        {[
          'filing',
          'completeness',
          'outside filings',
          'next year',
          'firm standards',
          'time & budget',
          'activity',
        ].map((t) => (
          <button key={t} aria-selected={tab === t} onClick={() => setTab(t)}>
            {human(t)}
          </button>
        ))}
      </div>
      {tab === 'filing' ? (
        <>
          <div className="filing-header">
            <div className="filing-orbit">
              <ShieldCheck size={28} />
            </div>
            <div>
              <Badge tone={data.gates.every((g: Row) => !g.count) ? 'green' : 'amber'}>
                {data.gates.every((g: Row) => !g.count)
                  ? 'Ready for partner review'
                  : 'Review in progress'}
              </Badge>
              <h2>
                {data.gates.filter((g: Row) => g.count).length} gates before the final signature.
              </h2>
              <p>Filing and signatures are recorded simulations. No tax return is transmitted.</p>
            </div>
          </div>
          <div className="gate-list">
            {data.gates.map((g: Row) => (
              <div className="gate" key={g.id}>
                <div className={`gate-symbol ${g.count ? 'pending' : 'done'}`}>
                  {g.count ? <Clock size={16} /> : <Check size={16} />}
                </div>
                <div>
                  <strong>{g.label}</strong>
                  <p>{g.detail}</p>
                </div>
                <Badge tone={g.count ? 'amber' : 'green'}>
                  {g.count ? `${g.count} remaining` : 'Complete'}
                </Badge>
              </div>
            ))}
          </div>
          <div className="filing-actions">
            <button
              className="button"
              disabled={busy || readOnly}
              onClick={() => void command({ type: 'signoff', level: 'partner', area: 'all' })}
            >
              <ShieldCheck size={15} />
              Partner sign-off
            </button>
            <button
              className="button primary"
              disabled={busy || readOnly || data.gates.some((g: Row) => g.count)}
              onClick={() => {
                if (confirm('Freeze this exact record and record a simulated filing?'))
                  void command({ type: 'file' });
              }}
            >
              <LockKeyhole size={15} />
              Freeze & record filing
            </button>
            {state.freezes.length > 0 && (
              <button
                className="button"
                disabled={busy}
                onClick={() => {
                  const reason = prompt('Reason for opening an amendment:');
                  if (reason) void command({ type: 'amend', reason });
                }}
              >
                Open amendment
              </button>
            )}
          </div>
          <div className="split-forms">
            {!readOnly && (
              <>
                <Form
                  title="Record extension"
                  busy={busy}
                  submit="Save simulated extension"
                  fields={[
                    { name: 'payment', label: 'Extension payment', type: 'number' },
                    { name: 'reason', label: 'Rationale and record', type: 'textarea' },
                  ]}
                  onSubmit={(d) => command({ type: 'extension', ...d, payment: Number(d.payment) })}
                />
                <Form
                  title="Record e-file rejection"
                  busy={busy}
                  fields={[
                    {
                      name: 'reason',
                      label: 'Rejection code, cause and next step',
                      type: 'textarea',
                    },
                  ]}
                  onSubmit={(d) => command({ type: 'rejection', ...d })}
                />
              </>
            )}
          </div>
          {state.freezes.map((f: Row) => (
            <div className="panel task" key={f.id}>
              <Badge tone="green">Frozen cycle {f.cycle + 1}</Badge>
              <h3>{new Date(f.at).toLocaleString()}</h3>
              <code>{f.contentHash}</code>
            </div>
          ))}
          <details className="panel">
            <summary>Supplied agency records and notices</summary>
            <RecordTree value={packet.tax_agency_records} />
          </details>
        </>
      ) : tab === 'completeness' ? (
        <>
          <p className="muted">
            Required steps from the supplied firm standard. The actual source and sign-off gates are
            checked separately.
          </p>
          {(packet.firm?.starter_standards?.required_steps || []).map((step: string) => (
            <div className="panel checklist-row" key={step}>
              <span className={`check-ring ${state.checklist[step] ? 'done' : ''}`}>
                {state.checklist[step] && <Check size={13} />}
              </span>
              <div>
                <strong>{step}</strong>
                {state.checklist[step] && <p>{state.checklist[step].reason}</p>}
              </div>
              <button
                className="button"
                disabled={busy || readOnly}
                onClick={() => {
                  const reason = prompt(`Evidence for completing “${step}”: `);
                  if (reason) void command({ type: 'checklist', target: step, reason });
                }}
              >
                {state.checklist[step] ? 'Update record' : 'Record completion'}
              </button>
            </div>
          ))}
        </>
      ) : tab === 'outside filings' ? (
        <>
          <div className="split-forms">
            {!readOnly && (
              <Form
                title="Identify an outside filing"
                busy={busy}
                fields={[
                  {
                    name: 'obligationId',
                    label: 'Scope item from supplied diagnostics',
                    options: [
                      ...(data.outsideObligations || []).map((o: Row) => ({
                        value: o.id,
                        label: o.label,
                      })),
                      { value: 'custom', label: 'Additional obligation' },
                    ],
                  },
                  { name: 'form', label: 'Form / obligation' },
                  { name: 'owner', label: 'Responsible person / provider' },
                  { name: 'due', label: 'Due date', type: 'date' },
                  { name: 'reason', label: 'Scope and supporting evidence', type: 'textarea' },
                ]}
                onSubmit={(d) => command({ type: 'outside', ...d })}
              />
            )}
            <div>
              {state.outside.map((f: Row) => (
                <article className="panel task" key={f.id}>
                  <Badge>{f.due}</Badge>
                  <h3>{f.form}</h3>
                  <p>{f.owner}</p>
                  <p>{f.scope}</p>
                </article>
              ))}
            </div>
          </div>
        </>
      ) : tab === 'next year' ? (
        <>
          <div className="notice">
            <Link2 size={17} />
            <p>
              Carry the review forward with its history. Unknown basis remains unknown; the exported
              handoff includes source revision, assets, supplied carryovers and planning records.
            </p>
            <a href={`/api/export?id=${data.id}&kind=carryforward`} className="button">
              <Download size={13} />
              Export handoff
            </a>
          </div>
          <div className="split-forms">
            {!readOnly && (
              <Form
                title="Leave the next preparer a clear path"
                busy={busy}
                fields={[
                  { name: 'title', label: 'Planning item / notice response' },
                  { name: 'body', label: 'Detail, references and next step', type: 'textarea' },
                  { name: 'due', label: 'Deadline', type: 'date', optional: true },
                ]}
                onSubmit={(d) => command({ type: 'plan', ...d })}
              />
            )}
            <div>
              {state.plans.map((p: Row) => (
                <article className="panel task" key={p.id}>
                  <h3>{p.title}</h3>
                  <p>{p.body}</p>
                  <Badge>{p.due || 'Next engagement'}</Badge>
                </article>
              ))}
            </div>
          </div>
          <details className="panel">
            <summary>Supplied planning references</summary>
            <RecordTree value={packet.planning_reference_2026} />
          </details>
        </>
      ) : tab === 'firm standards' ? (
        <>
          <div className="panel">
            <h2>Firm-wide review standards</h2>
            <ol className="standards-list">
              {state.standards.map((x: string, i: number) => (
                <li key={i}>{x}</li>
              ))}
            </ol>
          </div>
          {!readOnly && (
            <Form
              title="Add a standard"
              detail="Saved firm standards are editable only by the firm administrator persona."
              busy={busy}
              fields={[{ name: 'body', label: 'Standard', type: 'textarea' }]}
              onSubmit={(d) => command({ type: 'standard', ...d })}
            />
          )}
        </>
      ) : tab === 'time & budget' ? (
        <>
          <div className="budget-grid">
            {Object.entries(packet.firm?.budget_hours || {}).map(([a, h]) => {
              const used = state.times
                .filter((t: Row) => t.area === a)
                .reduce((s: number, t: Row) => s + t.hours, 0);
              return (
                <article className="panel" key={a}>
                  <h3>{human(a)}</h3>
                  <div className="budget-number">
                    {used}
                    <small> / {String(h)} hrs</small>
                  </div>
                  <div className="metric-progress">
                    <i style={{ width: `${Math.min(100, (used / Number(h)) * 100)}%` }} />
                  </div>
                </article>
              );
            })}
          </div>
          {!readOnly && (
            <Form
              title="Record time"
              busy={busy}
              fields={[
                {
                  name: 'area',
                  label: 'Area',
                  options: Object.keys(packet.firm?.budget_hours || {}).map((a) => ({
                    value: a,
                    label: human(a),
                  })),
                },
                { name: 'hours', label: 'Hours', type: 'number' },
                { name: 'reason', label: 'Work performed', type: 'textarea' },
              ]}
              onSubmit={(d) => command({ type: 'time', ...d, hours: Number(d.hours) })}
            />
          )}
        </>
      ) : (
        <Activity />
      )}
    </>
  );
}
export function Activity() {
  const { state, data } = useWork();
  return (
    <>
      {state.audit.length ? (
        state.audit
          .slice()
          .reverse()
          .map((a: Row) => (
            <div className="audit-item" key={a.id}>
              <span className="audit-dot" />
              <div>
                <div className="flex-between">
                  <strong>{human(a.type)}</strong>
                  <Badge>r{a.revision}</Badge>
                </div>
                <p>{a.detail}</p>
                <small>
                  {a.name} · {new Date(a.at).toLocaleString()} · Cycle {a.cycle + 1}
                </small>
              </div>
            </div>
          ))
      ) : (
        <Empty
          title="Your review starts with a clean record"
          detail="Every change will retain who, what, when, and why."
        />
      )}
    </>
  );
}
export function RecordTree({ value, depth = 0 }: { value: any; depth?: number }) {
  if (value === null || value === undefined)
    return <span className="unknown">Unknown / not supplied</span>;
  if (typeof value !== 'object')
    return <span className={typeof value === 'number' ? 'mono' : ''}>{String(value)}</span>;
  return (
    <div className="record-tree">
      {Object.entries(value).map(([k, v]) => (
        <div key={k}>
          {v && typeof v === 'object' ? (
            <details open={depth < 1}>
              <summary>
                {human(k)} <span>{Array.isArray(v) ? `${v.length} records` : ''}</span>
              </summary>
              <RecordTree value={v} depth={depth + 1} />
            </details>
          ) : (
            <div className="record-pair">
              <strong>{human(k)}</strong>
              <RecordTree value={v} depth={depth + 1} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
function Pagination({
  page,
  pages,
  setPage,
  total,
}: {
  page: number;
  pages: number;
  setPage: (p: number) => void;
  total: number;
}) {
  return (
    <div className="pagination">
      <span>
        {total} matching records · Page {page} of {Math.max(1, pages)}
      </span>
      <div>
        <button className="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>
          Previous
        </button>
        <button className="button" disabled={page >= pages} onClick={() => setPage(page + 1)}>
          Next
          <ChevronRight size={12} />
        </button>
      </div>
    </div>
  );
}
