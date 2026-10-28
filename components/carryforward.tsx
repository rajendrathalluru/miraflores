'use client';
import { useEffect, useState } from 'react';
import { useWork } from './context';
import { Badge, Empty } from './ui';
import type { Row } from '@/lib/types';
export function CarryforwardPanel() {
  const { data, state } = useWork();
  const [archive, setArchive] = useState<File | null>(null),
    [packet, setPacket] = useState<File | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const cleared =
    data.actor.sensitive_data_clearance && !['client', 'examiner'].includes(data.actor.role);
  async function submit(mode: string) {
    if (!archive) return;
    setBusy(true);
    setError('');
    try {
      const handoff = JSON.parse(await archive.text());
      const next = mode === 'next_year' ? JSON.parse(await packet!.text()) : undefined;
      const r = await fetch(`/api/handoff?id=${encodeURIComponent(data.id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, actorId: data.actor.id, handoff, packet: next }),
      });
      if (!r.ok) {
        const text = await r.text();
        let message = text;
        try {
          message = JSON.parse(text).error;
        } catch {}
        throw Error(
          r.status === 413
            ? 'This platform rejected the archive size. Use a container deployment with the documented body limit.'
            : message,
        );
      }
      const result = await r.json();
      window.location.assign(
        `/?engagement=${encodeURIComponent(result.id)}&view=filing&version=working`,
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel handoff-panel">
      <h2>Complete review archive</h2>
      <p>
        Preserve the original packet, overlays, source corrections, approvals, notes, audit history
        and original evidence bytes. The archive contains sensitive source data; only cleared staff
        can export or restore it.
      </p>
      {cleared && (
        <a className="button" href={`/api/export?id=${data.id}&kind=carryforward`}>
          Download complete archive · r{state.revision}
        </a>
      )}
      {cleared && (
        <>
          <label>
            Complete prior review archive
            <input
              type="file"
              accept=".json,application/json"
              onChange={(e) => setArchive(e.target.files?.[0] || null)}
            />
          </label>
          <label>
            Next-year pipeline packet · optional for restore
            <input
              type="file"
              accept=".json,application/json"
              onChange={(e) => setPacket(e.target.files?.[0] || null)}
            />
          </label>
          <p className="micro">
            Restore makes a separate engagement and requires fresh approvals. Opening next year
            requires the same client ID and following tax year; current-year verification starts
            fresh while all prior evidence remains linked.
          </p>
          <div className="refs">
            <button
              className="button"
              disabled={busy || !archive}
              onClick={() => void submit('restore')}
            >
              Restore archived review
            </button>
            <button
              className="button primary"
              disabled={busy || !archive || !packet}
              onClick={() => void submit('next_year')}
            >
              Open next-year engagement
            </button>
          </div>
        </>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {state.inherited && <PriorReviewPanel />}
    </section>
  );
}
export function PriorReviewPanel() {
  const { data, state } = useWork();
  const [record, setRecord] = useState<Row | null>(null),
    [error, setError] = useState('');
  useEffect(() => {
    if (!state.inherited?.archiveId) return;
    const abort = new AbortController();
    setRecord(null);
    setError('');
    fetch(`/api/handoff?id=${encodeURIComponent(data.id)}&view=history`, { signal: abort.signal })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        setRecord(d);
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setError(e.message);
      });
    return () => abort.abort();
  }, [data.id, data.actor.id, state.inherited?.archiveId]);
  if (error) return <p className="error">{error}</p>;
  if (!record)
    return (
      <Empty
        title="Loading linked prior review"
        detail="The archived review remains separate from current-year decisions."
      />
    );
  return (
    <section className="inherited-review">
      <h3>Prior review · {record.metadata.sourceYear}</h3>
      <p>
        {record.metadata.sourceEngagement} · revision {record.metadata.sourceRevision}
      </p>
      <Badge>{record.files.length} original evidence files</Badge>
      <Badge>{record.state.audit.length} historical events</Badge>
      {data.actor.sensitive_data_clearance && (
        <a className="button" href={`/api/handoff?id=${data.id}`}>
          Download original prior archive · logged
        </a>
      )}
      <details>
        <summary>Prior adjustments and source corrections</summary>
        {record.state.adjustments.map((a: Row) => (
          <article className="panel" key={a.id}>
            <strong>{a.target}</strong>
            <p>
              {String(a.original)} → {String(a.value)}
            </p>
            <p>{a.reason}</p>
            <small>
              {a.actor} · {a.at}
            </small>
          </article>
        ))}
      </details>
      <details>
        <summary>Prior questions, judgments and evidence</summary>
        {[...record.state.threads, ...record.state.judgments, ...record.state.evidence].map(
          (r: Row) => (
            <article className="panel" key={r.id}>
              <strong>{r.title || r.kind || r.target}</strong>
              <p>{r.body || r.reason || r.name}</p>
              {r.messages?.map((m: Row, i: number) => (
                <p key={i}>{m.body}</p>
              ))}
            </article>
          ),
        )}
      </details>
      <details>
        <summary>Complete prior audit history</summary>
        {record.state.audit.map((a: Row) => (
          <article className="audit-item" key={a.id}>
            <div>
              <strong>
                {a.type} · r{a.revision}
              </strong>
              <p>{a.detail}</p>
              <small>
                {a.name} · {a.at}
              </small>
            </div>
          </article>
        ))}
      </details>
      <details>
        <summary>Evidence manifest</summary>
        {record.files.map((f: Row) => (
          <p key={f.id}>
            {f.name} · {f.mime} · {f.content_hash}
          </p>
        ))}
      </details>
    </section>
  );
}
