'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  LayoutDashboard,
  PanelsTopLeft,
  Files,
  Layers3,
  MessagesSquare,
  ShieldCheck,
  ChevronsUpDown,
  ChevronDown,
  ChevronRight,
  Search,
  Plus,
  ArrowUpRight,
  Command,
  Check,
  Clock,
  History,
  GitBranch,
  RefreshCw,
  Upload,
  Download,
  Menu,
  X,
  Bell,
  PanelRightClose,
  ArrowRight,
  LockKeyhole,
  FileText,
  UserRound,
  Settings2,
  FolderOpen,
  Paperclip,
  ExternalLink,
  LoaderCircle,
} from 'lucide-react';
import { WorkContext } from './context';
import {
  Dashboard,
  ReturnView,
  DocumentsView,
  AssetsView,
  PeopleView,
  FilingView,
  Activity,
  RecordTree,
} from './views';
import Inspector from './inspector';
import { Badge, Modal, Form, SectionTitle, Empty } from './ui';
import { money, human, estimatedTotals, type Row } from '@/lib/types';
const destinations = [
  { id: 'dashboard', label: 'Command center', icon: LayoutDashboard },
  { id: 'return', label: 'Return & areas', icon: PanelsTopLeft },
  { id: 'documents', label: 'Document index', icon: Files },
  { id: 'assets', label: 'Assets & basis', icon: Layers3 },
  { id: 'people', label: 'People & Q&A', icon: MessagesSquare },
  { id: 'filing', label: 'Filing & firm', icon: ShieldCheck },
];
export default function Workspace() {
  const [data, setData] = useState<Row | null>(null),
    [error, setError] = useState(''),
    [freshness, setFreshness] = useState(''),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState('Saved to workspace'),
    [view, setViewState] = useState('dashboard'),
    [versionKey, setVersionKey] = useState('working'),
    [selection, setSelection] = useState<Row | null>(null),
    [modal, setModal] = useState(''),
    [search, setSearch] = useState(''),
    [menu, setMenu] = useState(false),
    [replay, setReplay] = useState(''),
    [timelineIndex, setTimelineIndex] = useState(-1),
    [dirty, setDirty] = useState(false),
    [pending, setPending] = useState<Row | null>(null),
    [lastRefresh, setLastRefresh] = useState(''),
    [compact, setCompact] = useState(false),
    [smallScreen, setSmallScreen] = useState(false);
  const dataRef = useRef<Row | null>(null),
    loadEpoch = useRef(0),
    busyRef = useRef(false),
    initialSelection = useRef(false);
  const closeModal = useCallback(() => {
    setModal('');
    setSearch('');
  }, []);
  const contentRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const refresh = useCallback(async (id?: string) => {
    const epoch = loadEpoch.current;
    const target =
      id || dataRef.current?.id || new URLSearchParams(location.search).get('engagement');
    const r = await fetch(`/api/workspace${target ? `?id=${encodeURIComponent(target)}` : ''}`, {
      cache: 'no-store',
    });
    const d = await r.json();
    if (!r.ok) throw Error(d.error);
    if (epoch !== loadEpoch.current) return;
    const old = dataRef.current;
    if (old && old.id === d.id && old.state.revision > d.state.revision) return;
    if (old && (old.actor.id !== d.actor.id || old.state.cycle !== d.state.cycle)) {
      setModal('');
      setSelection(null);
      setMenu(false);
      setDirty(false);
    }
    dataRef.current = d;
    setData(d);
    document.body.dataset.revision = String(d.state.revision);
    document.body.dataset.actor = d.actor.id;
    setFreshness('');
    setLastRefresh(new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }));
    if (
      !initialSelection.current &&
      d.actor.role !== 'client' &&
      window.matchMedia('(min-width:1101px)').matches
    ) {
      initialSelection.current = true;
      const params = new URLSearchParams(location.search),
        ref = params.get('ref');
      const f = d.findings.find((f: Row) => f.id.startsWith('duplicate-page'));
      if (ref) setSelection({ ref, finding: d.findings.find((f: Row) => f.target === ref) });
      else if (f) setSelection({ ref: f.target, finding: f });
    }
    return d;
  }, []);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (destinations.some((x) => x.id === params.get('view'))) setViewState(params.get('view')!);
    if (params.get('version')) setVersionKey(params.get('version')!);
    refresh().catch((e) => setError(e.message));
    const timer = setInterval(() => {
      if (!busyRef.current && !document.hidden) refresh().catch((e) => setFreshness(e.message));
    }, 10000);
    const focus = () => {
      if (!busyRef.current) refresh().catch((e) => setFreshness(e.message));
    };
    window.addEventListener('focus', focus);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', focus);
    };
  }, [refresh]);
  useEffect(() => {
    const update = () => setDirty(!!document.querySelector('[data-dirty="true"]'));
    const ob = new MutationObserver(update);
    ob.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ['data-dirty'],
      childList: true,
    });
    const unload = (e: BeforeUnloadEvent) => {
      if (document.querySelector('[data-dirty="true"]') || busyRef.current) e.preventDefault();
    };
    const keys = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setModal('search');
      }
    };
    const back = () => {
      if (
        document.querySelector('[data-dirty="true"]') &&
        !confirm('Discard unsaved entries and restore the previous workspace view?')
      ) {
        history.go(1);
        return;
      }
      const p = new URLSearchParams(location.search);
      setViewState(p.get('view') || 'dashboard');
      setVersionKey(p.get('version') || 'working');
      setSelection(p.get('ref') ? { ref: p.get('ref') } : null);
    };
    window.addEventListener('beforeunload', unload);
    window.addEventListener('keydown', keys);
    window.addEventListener('popstate', back);
    return () => {
      ob.disconnect();
      window.removeEventListener('beforeunload', unload);
      window.removeEventListener('keydown', keys);
      window.removeEventListener('popstate', back);
    };
  }, []);
  useEffect(() => {
    const media = window.matchMedia('(max-width:1100px)'),
      mobile = window.matchMedia('(max-width:800px)');
    const update = () => {
      setCompact(media.matches);
      setSmallScreen(mobile.matches);
    };
    update();
    media.addEventListener('change', update);
    mobile.addEventListener('change', update);
    return () => {
      media.removeEventListener('change', update);
      mobile.removeEventListener('change', update);
    };
  }, []);
  useEffect(() => {
    if (!menu || !smallScreen) return;
    const el = sidebarRef.current;
    const opener = document.activeElement as HTMLElement;
    el?.querySelector<HTMLElement>('[aria-current="page"]')?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setMenu(false);
      }
      if (e.key !== 'Tab' || !el) return;
      const stops = [
        ...el.querySelectorAll<HTMLElement>(
          'button:not([disabled]),a[href],select:not([disabled])',
        ),
      ].filter((e) => e.getClientRects().length);
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
      opener?.focus();
    };
  }, [menu, smallScreen]);
  const confirmLeave = () =>
    !document.querySelector('[data-dirty="true"]') ||
    confirm('Discard unsaved form entries and change context?');
  const updateUrl = (
    nextView = view,
    nextVersion = versionKey,
    ref = selection?.ref,
    id = dataRef.current?.id,
  ) => {
    const u = new URL(location.href);
    u.searchParams.set('view', nextView);
    u.searchParams.set('version', nextVersion);
    if (ref) u.searchParams.set('ref', ref);
    else u.searchParams.delete('ref');
    if (id) u.searchParams.set('engagement', id);
    history.pushState({}, '', u);
  };
  const setView = (next: string) => {
    if (!confirmLeave()) return;
    setViewState(next);
    setMenu(false);
    updateUrl(next);
    contentRef.current?.scrollTo({ top: 0 });
  };
  const select = (ref: string, finding?: Row, sourceVersion?: string) => {
    if (selection?.ref !== ref && !confirmLeave()) return;
    if (sourceVersion) setVersionKey(sourceVersion);
    setSelection({ ref, finding });
    updateUrl(view, sourceVersion || versionKey, ref);
  };
  const changeVersion = (next: string) => {
    if (!confirmLeave()) return;
    setVersionKey(next);
    updateUrl(view, next);
    setSelection((s) => (s ? { ref: s.ref } : null));
  };
  const command = async (cmd: Row): Promise<boolean> => {
    const d = dataRef.current;
    if (!d || busyRef.current || pending) return false;
    if (replay) {
      setError('Return to the current workspace before saving.');
      return false;
    }
    setBusy(true);
    busyRef.current = true;
    setError('');
    setSaved('Saving…');
    const body = {
      engagementId: d.id,
      actorId: d.actor.id,
      expectedRevision: cmd.expectedRevision ?? d.state.revision,
      requestId: crypto.randomUUID(),
      command: {
        ...cmd,
        version: versionKey === 'working' ? d.packet.return_versions.at(-1).version : versionKey,
      },
    };
    let sent = false;
    try {
      sent = true;
      const r = await fetch('/api/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await r.json();
      if (!r.ok) {
        sent = false;
        throw Error(result.error);
      }
      setSaved(`Saved · revision ${result.revision}`);
      await refresh();
      return true;
    } catch (e: any) {
      if (sent) {
        setPending(body);
        setSaved('Save unconfirmed');
        setError(
          'The response was interrupted. Check the request status before retrying; your draft is retained.',
        );
      } else {
        setSaved('Not saved');
        setError(e.message);
        await refresh().catch(() => {});
      }
      return false;
    } finally {
      setBusy(false);
      busyRef.current = false;
    }
  };
  const reconcile = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      const r = await fetch(
        `/api/command?id=${pending.engagementId}&requestId=${pending.requestId}`,
      );
      const result = await r.json();
      if (!r.ok) throw Error(result.error);
      if (result.status === 'committed') {
        setPending(null);
        setError('');
        setSaved(`Committed · revision ${result.revision}`);
        await refresh();
      } else setPending({ ...pending, statusChecked: true });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const retry = async () => {
    if (!pending?.statusChecked) return;
    setBusy(true);
    try {
      const r = await fetch('/api/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pending),
      });
      const result = await r.json();
      if (!r.ok) throw Error(result.error);
      setPending(null);
      setError('');
      setSaved(`Saved · revision ${result.revision}`);
      await refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const switchRole = async (actorId: string) => {
    if (!data || !confirmLeave()) return;
    setSelection(null);
    setModal('');
    setBusy(true);
    busyRef.current = true;
    loadEpoch.current++;
    try {
      const r = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ engagementId: data.id, actorId }),
      });
      if (!r.ok) throw Error((await r.json()).error);
      await refresh();
      setSaved('Role changed · server rules apply');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
      busyRef.current = false;
    }
  };
  const changeEngagement = async (id: string) => {
    if (!confirmLeave()) return;
    loadEpoch.current++;
    initialSelection.current = false;
    setSelection(null);
    setModal('');
    setReplay('');
    setVersionKey('working');
    setViewState('dashboard');
    setBusy(true);
    try {
      const session = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ engagementId: id }),
      });
      if (!session.ok) throw Error((await session.json()).error);
      await refresh(id);
      updateUrl('dashboard', 'working', null, id);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  if (!data)
    return (
      <div className="boot">
        <div className="brand">
          <Logo />
          miraflores<span>workpaper</span>
        </div>
        {error ? (
          <>
            <h1>We couldn’t open the workspace.</h1>
            <p className="error">{error}</p>
            <button
              className="button primary"
              onClick={() => refresh().catch((e) => setError(e.message))}
            >
              Try again
            </button>
          </>
        ) : (
          <>
            <LoaderCircle className="spin" size={24} />
            <p>Connecting the numbers to their evidence…</p>
          </>
        )}
      </div>
    );
  const p = data.packet,
    s = data.state,
    latest = p.return_versions.at(-1),
    version = p.return_versions.find((v: Row) => v.version === versionKey) || latest,
    isClient = data.actor.role === 'client',
    examiner = data.actor.role === 'examiner',
    readOnly = versionKey !== 'working' || !!replay || examiner || isClient;
  const totals = isClient
    ? data.reviewedEstimate || { federal: 0, california: 0 }
    : estimatedTotals(version, s);
  const initials = data.actor.name
    .split(' ')
    .map((n: string) => n[0])
    .slice(0, 2)
    .join('');
  const name = p.household.people
    .filter((x: Row) => ['taxpayer', 'spouse'].includes(x.role))
    .map((x: Row) => x.name.split(' ').at(-1))
    .join('–');
  const effectiveData = {
    ...data,
    findings: data.findingsByVersion?.[version.version] || data.findings,
  };
  const openFindings = effectiveData.findings.filter((f: Row) => !s.findings?.[f.id]);
  const context = {
    data: effectiveData,
    packet: replay
      ? { ...p, documents: p.documents.filter((d: Row) => d.received_at <= replay) }
      : p,
    state: s,
    version,
    working: versionKey === 'working',
    readOnly,
    busy: busy || !!pending,
    replay,
    select,
    command,
    open: setModal,
    setView,
  };
  const timeline = p.timeline || [];
  const preEngine = !!replay && p.return_versions.every((v: Row) => v.computed_at > replay);
  return (
    <WorkContext.Provider value={context}>
      <div className={`app-shell ${selection && !isClient ? 'has-inspector' : ''}`}>
        <a className="skip" href="#workspace-main">
          Skip to workspace
        </a>
        {menu && (
          <button
            className="nav-scrim"
            tabIndex={-1}
            aria-label="Close navigation"
            onClick={() => setMenu(false)}
          />
        )}
        <aside
          ref={sidebarRef}
          role={menu && smallScreen ? 'dialog' : undefined}
          aria-modal={menu && smallScreen ? true : undefined}
          className={`sidebar ${menu ? 'show' : ''}`}
          aria-label="Workspace navigation"
          inert={(!!selection && compact) || (smallScreen && !menu)}
        >
          <a className="brand" href="/" aria-label="Miraflores home">
            <Logo />
            <span>
              miraflores<small>WORKPAPER IDE</small>
            </span>
          </a>
          <div className="engagement-switch">
            <div className="engagement-icon">{name.slice(0, 1)}</div>
            <div>
              <strong>{name}</strong>
              <span>
                {p.household.tax_year} ·{' '}
                {['MFJ', 'married_filing_jointly'].includes(p.household.filing_status)
                  ? 'Joint return'
                  : human(p.household.filing_status || 'Return')}
              </span>
            </div>
            <ChevronsUpDown size={13} />
            <select
              aria-label="Engagement"
              value={data.id}
              onChange={(e) => void changeEngagement(e.target.value)}
              disabled={busy || !!pending}
            >
              {data.engagements.map((e: Row) => (
                <option value={e.id} key={e.id}>
                  {e.name} · {e.tax_year}
                </option>
              ))}
            </select>
          </div>
          <div className="nav-section-label">WORKSPACE</div>
          <nav aria-label="Main navigation">
            {destinations
              .filter((d) => !isClient || d.id === 'people' || d.id === 'dashboard')
              .map((d, i) => (
                <button
                  key={d.id}
                  className={`nav-item ${view === d.id ? 'active' : ''}`}
                  aria-current={view === d.id ? 'page' : undefined}
                  onClick={() => setView(d.id)}
                >
                  <d.icon size={17} />
                  <span>{isClient && d.id === 'dashboard' ? 'Your return' : d.label}</span>
                  {d.id === 'dashboard' && !isClient && (
                    <span className="nav-badge">{openFindings.length}</span>
                  )}
                  {d.id === 'people' &&
                    s.threads.filter((t: Row) => t.status === 'open').length > 0 && (
                      <span className="nav-badge">
                        {s.threads.filter((t: Row) => t.status === 'open').length}
                      </span>
                    )}
                </button>
              ))}
          </nav>
          {!isClient && (
            <>
              <div className="nav-section-label">ENGAGEMENT TOOLS</div>
              <button className="nav-item" onClick={() => setModal('scenario')}>
                <GitBranch size={16} />
                <span>What-if sandbox</span>
                <ArrowUpRight size={12} />
              </button>
              <button className="nav-item" onClick={() => setModal('compare')}>
                <History size={16} />
                <span>Version history</span>
              </button>
              <button className="nav-item" onClick={() => setModal('import')} disabled={examiner}>
                <Upload size={16} />
                <span>Import a packet</span>
                <Plus size={13} />
              </button>
            </>
          )}
          <div className="sidebar-bottom">
            <div className="workspace-health">
              <span className={`dot ${dirty || pending ? 'amber' : 'green'}`} />
              <div>
                <strong>{dirty ? 'Unsaved draft' : saved}</strong>
                <span>
                  r{s.revision} · {lastRefresh ? 'Refreshed ' + lastRefresh : 'Connected'}
                </span>
              </div>
              <button
                className="icon-button"
                aria-label="Refresh workspace"
                onClick={() => refresh().catch((e) => setError(e.message))}
              >
                <RefreshCw size={13} />
              </button>
            </div>
            <div className="sandbox-label">
              <LockKeyhole size={12} />
              Local evaluator sandbox
            </div>
            <button className="profile" onClick={() => setModal('about')}>
              <div className="avatar firm">M</div>
              <div>
                <strong>Miraflores</strong>
                <span>Private tax workspace</span>
              </div>
              <Settings2 size={15} />
            </button>
          </div>
        </aside>
        <div className="main-shell" inert={smallScreen && menu}>
          <header className="topbar" inert={!!selection && compact}>
            <div className="topbar-context">
              <button
                className="icon-button mobile-nav"
                aria-label="Open navigation"
                onClick={() => setMenu(!menu)}
              >
                <Menu size={19} />
              </button>
              <span className="breadcrumb">{p.household.tax_year} returns</span>
              <ChevronRight size={13} />
              <strong>{name}</strong>
              <span className="topbar-divider" />
              <label className="version-picker">
                <span className="dot green" />
                <select
                  aria-label="Return version"
                  value={versionKey}
                  onChange={(e) => changeVersion(e.target.value)}
                >
                  <option value="working">Working · {latest.version}</option>
                  {p.return_versions.map((v: Row) => (
                    <option value={v.version} key={v.version}>
                      Engine {v.version}
                    </option>
                  ))}
                </select>
                <ChevronDown size={12} />
              </label>
            </div>
            <div className="topbar-actions">
              <button
                className="search-trigger"
                onClick={() => setModal('search')}
                aria-label="Search workpaper"
              >
                <Search size={16} />
                <span>Search anything</span>
                <kbd>⌘ K</kbd>
              </button>
              <button
                className="icon-button notification"
                aria-label="View notifications"
                onClick={() => setModal('notifications')}
              >
                <Bell size={17} />
                {s.notifications?.length > 0 && <i />}
              </button>
              <div className="topbar-divider" />
              <div className="actor-select">
                <div className="avatar">{initials}</div>
                <div>
                  <strong>{data.actor.name}</strong>
                  <span>{human(data.actor.role)} · Demo</span>
                </div>
                <ChevronDown size={13} />
                <select
                  aria-label="Switch role"
                  value={data.actor.id}
                  onChange={(e) => void switchRole(e.target.value)}
                  disabled={busy || !!pending}
                >
                  {data.actors.map((a: Row) => (
                    <option key={a.id} value={a.id}>
                      {a.name} · {human(a.role)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </header>
          <div className="context-ribbon" inert={!!selection && compact}>
            <div>
              <span className="dot green" />
              <strong>
                {replay
                  ? 'Historical replay'
                  : versionKey === 'working'
                    ? 'Working review'
                    : 'Immutable engine output'}
              </strong>
              <span>{p.packet.client_id}</span>
              <span>Cycle {s.cycle + 1}</span>
              <span>Revision {s.revision}</span>
            </div>
            <div>
              {!isClient && (
                <>
                  <span>
                    FED{' '}
                    <strong>{money(version.summary.federal.balance_due + totals.federal)}</strong>
                  </span>
                  <span>
                    CA{' '}
                    <strong>
                      {money(version.summary.california.balance_due + totals.california)}
                    </strong>
                  </span>
                  <span className="est-label">
                    {versionKey === 'working' ? 'est. balances' : 'supplied balances'}
                  </span>
                </>
              )}
              {replay && (
                <button
                  className="text-button"
                  onClick={() => {
                    setReplay('');
                    setTimelineIndex(-1);
                    setVersionKey('working');
                  }}
                >
                  Return to current
                  <ArrowRight size={13} />
                </button>
              )}
            </div>
          </div>
          <div className="workspace-body">
            <main
              ref={contentRef}
              className="canvas"
              id="workspace-main"
              tabIndex={-1}
              inert={!!selection && compact}
            >
              {error && (
                <div className="error-banner" role="alert">
                  <div>
                    <strong>
                      {pending ? 'Save outcome unconfirmed' : 'Action needs attention'}
                    </strong>
                    <p>{error}</p>
                    {pending && (
                      <div className="flex">
                        <button className="button" disabled={busy} onClick={() => void reconcile()}>
                          Check request status
                        </button>
                        <button
                          className="button"
                          disabled={busy || !pending.statusChecked}
                          onClick={() => void retry()}
                        >
                          Retry same request
                        </button>
                      </div>
                    )}
                  </div>
                  {!pending && (
                    <button
                      className="icon-button"
                      aria-label="Dismiss error"
                      onClick={() => setError('')}
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              )}
              {freshness && (
                <div className="notice">
                  <Clock size={14} />
                  Refresh unavailable: {freshness}. Displayed revision may be stale.
                </div>
              )}
              {isClient ? (
                <ClientPortal
                  key={`${data.actor.id}-${s.cycle}`}
                  command={command}
                  busy={busy}
                  data={data}
                />
              ) : (
                <div key={`${data.id}-${data.actor.id}-${s.cycle}-${view}`}>
                  {preEngine ? (
                    <Empty
                      title="No engine output yet"
                      detail="Move the season timeline forward to a computed version, or return to the current review."
                    />
                  ) : view === 'dashboard' ? (
                    <Dashboard />
                  ) : view === 'return' ? (
                    <ReturnView />
                  ) : view === 'documents' ? (
                    <DocumentsView />
                  ) : view === 'assets' ? (
                    <AssetsView />
                  ) : view === 'people' ? (
                    <PeopleView />
                  ) : (
                    <FilingView />
                  )}
                </div>
              )}
              <footer className="canvas-footer">
                <span>
                  <Logo small />
                  MIRAFLORES
                </span>
                <p>Human judgment. Connected evidence.</p>
                <span>
                  {isClient
                    ? 'Client portal'
                    : examiner
                      ? 'Read-only examiner record'
                      : `${version.lines.length} return lines · ${p.documents.length} sources`}
                </span>
              </footer>
            </main>
            {selection && !isClient && (
              <Inspector
                key={`${data.actor.id}-${s.cycle}-${selection.ref}-${versionKey}`}
                workspace={data}
                version={versionKey}
                selection={selection}
                onSelect={(r, v) => select(r, undefined, v)}
                onClose={() => {
                  if (confirmLeave()) setSelection(null);
                }}
                command={command}
                busy={busy || !!pending}
                replay={replay}
              />
            )}
          </div>
          {!isClient && (
            <div className="season-bar" inert={!!selection && compact}>
              <button className="season-title" onClick={() => setModal('timeline')}>
                <History size={14} />
                <strong>Season timeline</strong>
                <ChevronRight size={12} />
              </button>
              <div className="season-track">
                <input
                  aria-label="Replay season timeline"
                  type="range"
                  min={0}
                  max={timeline.length}
                  value={timelineIndex < 0 ? timeline.length : timelineIndex}
                  onChange={(e) => {
                    if (!confirmLeave()) return;
                    const i = Number(e.target.value);
                    if (i === timeline.length) {
                      setReplay('');
                      setVersionKey('working');
                      setTimelineIndex(-1);
                      return;
                    }
                    const event = timeline[i];
                    setReplay(event.at);
                    setTimelineIndex(i);
                    const v =
                      p.return_versions.filter((v: Row) => v.computed_at <= event.at).at(-1) ||
                      p.return_versions[0];
                    setVersionKey(v.version);
                  }}
                />
                <div>
                  <span>{timeline[0]?.at?.slice(0, 10) || 'Start'}</span>
                  {p.return_versions.map((v: Row) => (
                    <span key={v.version}>
                      {v.version} ·{' '}
                      {new Date(v.computed_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  ))}
                  <span>Current</span>
                </div>
              </div>
              <span className="season-date">
                {timelineIndex >= 0 ? timeline[timelineIndex]?.at.slice(0, 10) : 'Current review'}
                <span className="dot green" />
              </span>
            </div>
          )}
        </div>
      </div>
      {modal && (
        <Modal
          title={modalTitle(modal)}
          onClose={closeModal}
          wide={['compare', 'timeline', 'scenario', 'search'].includes(modal)}
        >
          {modal === 'search' ? (
            <div className="global-search">
              <div className="search-input">
                <Search size={18} />
                <input
                  autoFocus
                  aria-label="Search every source and number"
                  placeholder="A number, a document, a decision…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <kbd>ESC</kbd>
              </div>
              <div className="search-results">
                {search.length < 2 ? (
                  <Empty
                    title="Follow any thread"
                    detail="Search return lines, source documents, extracted fields, or saved decisions. Try “mileage”, “basis”, or “SchC.9”."
                  />
                ) : (
                  [
                    ...version.lines.map((l: Row) => ({
                      ref: l.key,
                      title: l.label,
                      detail: l.key + ' · ' + money(l.value),
                    })),
                    ...(p.documents || []).map((d: Row) => ({
                      ref: d.id,
                      title: d.title,
                      detail: d.id + ' · Source document',
                    })),
                    ...(p.extracted_values || []).map((e: Row) => ({
                      ref: e.id,
                      title: e.label,
                      detail: e.document_id + ' · ' + e.id + ' · ' + String(e.value),
                    })),
                    ...(s.audit || []).map((a: Row) => ({
                      ref: a.target,
                      title: a.detail,
                      detail: 'Audit · r' + a.revision,
                    })),
                  ]
                    .filter((x) =>
                      `${x.title} ${x.detail}`.toLowerCase().includes(search.toLowerCase()),
                    )
                    .slice(0, 60)
                    .map((x, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          closeModal();
                          select(x.ref);
                        }}
                      >
                        <FileText size={16} />
                        <div>
                          <strong>{x.title}</strong>
                          <span>{x.detail}</span>
                        </div>
                        <ArrowUpRight size={14} />
                      </button>
                    ))
                )}
              </div>
            </div>
          ) : modal === 'question' ? (
            <Form
              title="Make the next step clear"
              busy={busy}
              submit="Save question as evidence"
              fields={[
                { name: 'title', label: 'Subject' },
                {
                  name: 'recipient',
                  label: 'Recipient',
                  options: data.actors
                    .filter((a: Row) => a.role !== 'examiner')
                    .map((a: Row) => ({ value: a.id, label: a.name + ' · ' + human(a.role) })),
                },
                {
                  name: 'target',
                  label: 'Related line, document, year or return',
                  value: selection?.ref || 'all',
                },
                {
                  name: 'blocks',
                  label: 'Filing impact',
                  options: [
                    { value: 'false', label: 'Question · does not block filing' },
                    { value: 'true', label: 'Blocking review note' },
                  ],
                },
                { name: 'body', label: 'Question and context', type: 'textarea' },
              ]}
              onSubmit={async (d) => {
                const ok = await command({ type: 'thread', ...d, blocks: d.blocks === 'true' });
                if (ok) closeModal();
                return ok;
              }}
            />
          ) : modal === 'evidence' ? (
            <EvidenceUpload
              data={data}
              busy={busy}
              setBusy={setBusy}
              refresh={refresh}
              setError={setError}
              command={command}
              target={selection?.ref || 'all'}
            />
          ) : modal === 'import' ? (
            <ImportPacket
              data={data}
              setError={setError}
              onImported={async (id) => {
                closeModal();
                await changeEngagement(id);
              }}
            />
          ) : modal === 'scenario' ? (
            <div className="scenario-grid">
              <div className="notice">
                <GitBranch size={17} />
                <p>
                  Supplied engine alternatives are isolated comparisons against their stated base
                  version. They do not combine with working overlays or change the return.
                </p>
              </div>
              {(p.what_if?.alternatives || []).map((a: Row) => (
                <article className="panel scenario" key={a.id}>
                  <Badge>{a.base_version} baseline</Badge>
                  <h3>{a.description}</h3>
                  <div className="scenario-deltas">
                    <div>
                      <span>Federal tax change</span>
                      <strong>{money(a.federal?.total_tax_change)}</strong>
                    </div>
                    <div>
                      <span>California tax change</span>
                      <strong>{money(a.california?.total_tax_change)}</strong>
                    </div>
                  </div>
                  <details>
                    <summary>Compare computed alternative</summary>
                    <RecordTree value={a} />
                  </details>
                </article>
              ))}
            </div>
          ) : modal === 'compare' ? (
            <VersionComparison
              data={data}
              select={(r) => {
                closeModal();
                select(r);
              }}
            />
          ) : modal === 'timeline' ? (
            <div className="timeline-list">
              {timeline.map((e: Row) => (
                <article className="audit-item" key={e.id}>
                  <span className="audit-dot" />
                  <div>
                    <small>{e.at.slice(0, 10)}</small>
                    <h3>{human(e.event)}</h3>
                    <p>{e.detail}</p>
                    <div className="refs">
                      {(e.refs || []).map((r: string) => (
                        <button
                          className="ref-button"
                          key={r}
                          onClick={() => {
                            closeModal();
                            select(r);
                          }}
                        >
                          {r}
                          <ArrowUpRight size={12} />
                        </button>
                      ))}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : modal === 'notifications' ? (
            <div className="dialog-content">
              {s.notifications?.filter((n: Row) => n.actor === data.actor.id).length ? (
                s.notifications
                  .filter((n: Row) => n.actor === data.actor.id)
                  .map((n: Row) => (
                    <article className="panel task" key={n.id}>
                      <Badge tone="blue">Action requested</Badge>
                      <h3>{n.title}</h3>
                      <small>{new Date(n.at).toLocaleString()}</small>
                    </article>
                  ))
              ) : (
                <Empty
                  title="You’re up to date"
                  detail="Questions and assignments for your role will appear here."
                />
              )}
              <button className="button" onClick={() => void command({ type: 'seen' })}>
                <Check size={14} />
                Mark current activity seen
              </button>
            </div>
          ) : modal === 'activity' ? (
            <div className="dialog-content">
              <Activity />
            </div>
          ) : (
            <div className="dialog-content">
              <p>
                A verification IDE built around immutable pipeline output, connected source
                evidence, and attributable professional judgment.
              </p>
              <div className="notice">
                <LockKeyhole size={18} />
                <p>
                  This is a local evaluator sandbox with a fictional role switcher. Server action
                  gates and masked views are implemented; real staff authentication is required
                  before shared hosting.
                </p>
              </div>
              <p>
                Uploads accept compatible pipeline JSON packets and evidence files. OCR and a tax
                computation engine are outside this prototype. Tax effects are packet-rate
                estimates.
              </p>
              <p>
                Stack: Next.js, React, TypeScript, embedded Postgres (PGlite); Supabase/Postgres
                connection via a server-side DATABASE_URL. No external AI key is required.
              </p>
            </div>
          )}
        </Modal>
      )}
    </WorkContext.Provider>
  );
}
function Logo({ small = false }: { small?: boolean }) {
  return (
    <span className={`logo-mark ${small ? 'small' : ''}`} aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}
function modalTitle(key: string) {
  return (
    (
      {
        search: 'Everything, connected.',
        import: 'Bring another return into focus.',
        scenario: 'Decide with a clear comparison.',
        compare: 'The story between versions.',
        question: 'Start a review conversation.',
        evidence: 'Attach the evidence.',
        timeline: 'A season, replayable.',
        notifications: 'Your next steps.',
        activity: 'What changed, and why.',
        about: 'A clearer kind of workpaper.',
      } as Row
    )[key] || key
  );
}
function VersionComparison({ data, select }: { data: Row; select: (r: string) => void }) {
  const versions = data.packet.return_versions;
  const [left, setLeft] = useState(versions[0].version),
    [right, setRight] = useState(versions.at(-1).version);
  const a = versions.find((v: Row) => v.version === left),
    b = versions.find((v: Row) => v.version === right);
  const keys = [...new Set([...a.lines, ...b.lines].map((l: Row) => l.key))];
  const differences = keys
    .map((key) => ({
      key,
      a: a.lines.find((l: Row) => l.key === key),
      b: b.lines.find((l: Row) => l.key === key),
    }))
    .filter(
      (x) =>
        JSON.stringify(x.a?.value) !== JSON.stringify(x.b?.value) ||
        JSON.stringify(x.a?.sources) !== JSON.stringify(x.b?.sources),
    );
  return (
    <div className="dialog-content">
      <div className="compare-controls">
        <label>
          From
          <select value={left} onChange={(e) => setLeft(e.target.value)}>
            {versions.map((v: Row) => (
              <option key={v.version}>{v.version}</option>
            ))}
          </select>
        </label>
        <ArrowRight size={18} />
        <label>
          To
          <select value={right} onChange={(e) => setRight(e.target.value)}>
            {versions.map((v: Row) => (
              <option key={v.version}>{v.version}</option>
            ))}
          </select>
        </label>
        <Badge>{differences.length} changes</Badge>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Line / source change</th>
              <th>{left}</th>
              <th>{right}</th>
            </tr>
          </thead>
          <tbody>
            {differences.map((x) => (
              <tr key={x.key}>
                <td>
                  <button className="line-description" onClick={() => select(x.key)}>
                    <code>{x.key}</code>
                    <strong>{x.b?.label || x.a?.label}</strong>
                    {x.a?.value === x.b?.value && (
                      <small>Source links changed; amount unchanged</small>
                    )}
                  </button>
                </td>
                <td className="mono">{money(x.a?.value)}</td>
                <td className="mono changed">{money(x.b?.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
function ImportPacket({
  data,
  onImported,
  setError,
}: {
  data: Row;
  onImported: (id: string) => void;
  setError: (s: string) => void;
}) {
  const [working, setWorking] = useState(false),
    [message, setMessage] = useState('');
  return (
    <div className="dialog-content">
      <div className="upload-zone">
        <div className="upload-symbol">
          <FolderOpen size={28} />
        </div>
        <h3>A new client. The same connected review.</h3>
        <p>
          Upload a pipeline JSON packet with household, documents, extracted values and computed
          return versions.
        </p>
        <label className="button primary">
          <Upload size={15} />
          {working ? 'Validating packet…' : 'Choose JSON packet'}
          <input
            aria-label="Import pipeline JSON"
            type="file"
            accept=".json,application/json"
            disabled={working}
            hidden
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setWorking(true);
              setMessage('');
              try {
                if (file.size > 12 * 1024 * 1024) throw Error('Packet limit is 12 MB.');
                const r = await fetch(`/api/import?id=${data.id}`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: await file.text(),
                });
                const d = await r.json();
                if (!r.ok) throw Error(d.error);
                await onImported(d.id);
              } catch (e: any) {
                setMessage(e.message);
              } finally {
                setWorking(false);
              }
            }}
          />
        </label>
        <small>12 MB maximum · Version counts and clients are read dynamically</small>
      </div>
      {message && (
        <p className="error" role="alert">
          {message}
        </p>
      )}
      <div className="notice">
        <ShieldCheck size={17} />
        <p>
          Each distinct packet becomes an immutable engagement baseline. Reimporting identical
          content reopens its saved review. New pipeline versions do not overwrite an earlier
          review.
        </p>
      </div>
    </div>
  );
}
function EvidenceUpload({
  data,
  busy,
  setBusy,
  refresh,
  setError,
  command,
  target,
}: {
  data: Row;
  busy: boolean;
  setBusy: (b: boolean) => void;
  refresh: () => Promise<any>;
  setError: (e: string) => void;
  command: (c: Row) => Promise<boolean>;
  target: string;
}) {
  const [message, setMessage] = useState(''),
    [linkTarget, setLinkTarget] = useState(target),
    [visibility, setVisibility] = useState('internal');
  return (
    <div className="dialog-content">
      <label className="file-target">
        Linked document or return line
        <input
          aria-label="Evidence target reference"
          value={linkTarget}
          onChange={(e) => setLinkTarget(e.target.value)}
        />
      </label>
      <label className="file-target">
        Access in exported defense record
        <select
          aria-label="Evidence record visibility"
          value={visibility}
          onChange={(e) => setVisibility(e.target.value)}
        >
          <option value="internal">Internal workpaper only</option>
          <option value="examiner">Include in examiner defense record</option>
        </select>
      </label>
      <label className="upload-zone">
        <Paperclip size={25} />
        <h3>Add an original file</h3>
        <p>Private evidence, linked to {target}. Up to 8 MB.</p>
        <input
          aria-label="Evidence file"
          type="file"
          disabled={busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setBusy(true);
            setMessage('');
            try {
              const form = new FormData();
              form.set('file', file);
              form.set('engagementId', data.id);
              form.set('actorId', data.actor.id);
              form.set('revision', String(data.state.revision));
              form.set('target', linkTarget);
              form.set('visibility', visibility);
              const r = await fetch('/api/attachments', { method: 'POST', body: form });
              const result = await r.json();
              if (!r.ok) throw Error(result.error);
              setMessage('File saved with its content hash.');
              await refresh();
            } catch (e: any) {
              setMessage('Upload outcome needs review: ' + e.message);
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
      {message && <p role="status">{message}</p>}
      <Form
        title="Or attach a message / note"
        busy={busy}
        fields={[
          { name: 'title', label: 'Evidence title' },
          { name: 'body', label: 'Message, note, or related-year reference', type: 'textarea' },
          { name: 'target', label: 'Linked reference', value: target },
        ]}
        onSubmit={(d) =>
          command({ type: 'attach', record: { ...d, name: d.title, visibility: 'internal' } })
        }
      />
    </div>
  );
}
function ClientPortal({
  data,
  command,
  busy,
}: {
  data: Row;
  command: (c: Row) => Promise<boolean>;
  busy: boolean;
}) {
  const v = data.packet.return_versions.at(-1);
  return (
    <>
      <SectionTitle
        eyebrow="YOUR CLIENT PORTAL"
        title="A clearer view of your return."
        description="Ask a question, review the supplied result, and record your approval."
      />
      <div className="metrics-grid client-metrics">
        <div className="metric navy">
          <span>Federal balance due · reviewed estimate</span>
          <strong>
            {money(v.summary.federal.balance_due + (data.reviewedEstimate?.federal || 0))}
          </strong>
        </div>
        <div className="metric">
          <span>California balance · reviewed estimate</span>
          <strong>
            {money(v.summary.california.balance_due + (data.reviewedEstimate?.california || 0))}
          </strong>
        </div>
      </div>
      <div className="notice">
        <ShieldCheck size={20} />
        <p>
          These are reviewed balance estimates based on the supplied engine and recorded overlays.
          Your preparer must confirm the final return. This prototype records approval and signature
          authorization as a simulation.
        </p>
      </div>
      <div className="panel client-approval">
        <h2>Your approval is tied to this review.</h2>
        <p>
          Revision {data.state.revision} · Content {data.contentHash?.slice(0, 18)}
        </p>
        <label className="checkbox-label">
          <input
            id="client-consent"
            type="checkbox"
            onChange={(e) => {
              e.currentTarget
                .closest('.client-approval')
                ?.setAttribute('data-dirty', e.currentTarget.checked ? 'true' : 'false');
              e.currentTarget.dataset.consentHash = e.currentTarget.checked ? data.contentHash : '';
              e.currentTarget.dataset.consentRevision = String(data.state.revision);
            }}
          />
          I reviewed the current result and authorize this simulated e-file signature.
        </label>
        <button
          className="button primary"
          disabled={busy}
          onClick={() => {
            const yes = (document.getElementById('client-consent') as HTMLInputElement).checked;
            if (!yes) {
              alert('Please explicitly authorize the simulated signature first.');
              return;
            }
            const input = document.getElementById('client-consent') as HTMLInputElement;
            void command({
              type: 'client_approval',
              signature: true,
              contentHash: input.dataset.consentHash,
              expectedRevision: Number(input.dataset.consentRevision),
            });
          }}
        >
          <Check size={15} />
          Approve this content
        </button>
        <a className="button" href={`/api/export?id=${data.id}`}>
          <Download size={14} />
          Download your copy
        </a>
      </div>
      <div className="split-forms">
        <Form
          title="Ask your preparer"
          busy={busy}
          fields={[
            { name: 'title', label: 'Subject' },
            { name: 'body', label: 'Your question', type: 'textarea' },
          ]}
          onSubmit={(d) =>
            command({ type: 'thread', ...d, recipient: data.packet.firm.staff[0].id })
          }
        />
        <div>
          {data.state.threads.map((t: Row) => (
            <article className="panel thread" key={t.id}>
              <Badge>{human(t.status)}</Badge>
              <h3>{t.title}</h3>
              <p>{t.body}</p>
              {t.messages.map((m: Row) => (
                <blockquote key={m.id}>{m.body}</blockquote>
              ))}
              <button
                className="button"
                onClick={() => {
                  const body = prompt('Your answer and supporting detail:');
                  if (body) void command({ type: 'reply', id: t.id, body });
                }}
              >
                Reply
              </button>
            </article>
          ))}
        </div>
      </div>
    </>
  );
}
