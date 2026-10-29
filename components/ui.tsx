'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { X, ArrowUpRight, Check, FileText } from 'lucide-react';
export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: string }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function Empty({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="empty">
      <FileText size={22} />
      <strong>{title}</strong>
      <p>{detail}</p>
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    el?.showModal();
    const handler = (e: Event) => {
      e.preventDefault();
      if (!el?.querySelector('[data-dirty="true"]') || confirm('Discard unsaved entries?'))
        onClose();
    };
    el?.addEventListener('cancel', handler);
    return () => {
      el?.removeEventListener('cancel', handler);
      el?.close();
    };
  }, [onClose]);
  return (
    <dialog ref={ref} className={`dialog ${wide ? 'wide' : ''}`} aria-label={title}>
      <div className="dialog-head">
        <div>
          <span className="eyebrow">MIRAFLORES WORKSPACE</span>
          <h2>{title}</h2>
        </div>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={() => {
            if (
              !ref.current?.querySelector('[data-dirty="true"]') ||
              confirm('Discard unsaved entries?')
            )
              onClose();
          }}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Form({
  title,
  fields,
  onSubmit,
  busy,
  submit = 'Save record',
  detail,
}: {
  title: string;
  fields: {
    name: string;
    label: string;
    type?: string;
    options?: { value: string; label: string }[];
    value?: string;
    optional?: boolean;
  }[];
  onSubmit: (d: Record<string, any>) => Promise<boolean>;
  busy: boolean;
  submit?: string;
  detail?: string;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const revision = useRef<number | null>(null);
  const [, setAcknowledgment] = useState(0);
  return (
    <form
      ref={ref}
      className="record-form"
      onChange={() => {
        if (revision.current === null) revision.current = Number(document.body.dataset.revision);
        ref.current?.setAttribute('data-dirty', 'true');
      }}
      onSubmit={async (e) => {
        e.preventDefault();
        const el = e.currentTarget;
        const data = Object.fromEntries(new FormData(el));
        if (
          await onSubmit({
            ...data,
            expectedRevision: revision.current ?? Number(document.body.dataset.revision),
          })
        ) {
          revision.current = null;
          el.reset();
          el.setAttribute('data-dirty', 'false');
        }
      }}
    >
      <h3>{title}</h3>
      {detail && <p>{detail}</p>}
      {fields.map((f) => (
        <label key={f.name}>
          {f.label}
          {f.options ? (
            <select name={f.name} defaultValue={f.value} required={!f.optional} disabled={busy}>
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : f.type === 'textarea' ? (
            <textarea
              name={f.name}
              rows={3}
              required={!f.optional}
              defaultValue={f.value}
              disabled={busy}
            />
          ) : (
            <input
              name={f.name}
              type={f.type || 'text'}
              step={f.type === 'number' ? 'any' : undefined}
              required={!f.optional}
              defaultValue={f.value}
              disabled={busy}
            />
          )}
        </label>
      ))}
      <>
        {revision.current !== null &&
          revision.current !== Number(document.body.dataset.revision) && (
            <div className="draft-conflict">
              <p>
                The workspace changed after you began this draft. Review the current evidence before
                saving.
              </p>
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  revision.current = Number(document.body.dataset.revision);
                  setAcknowledgment((n) => n + 1);
                }}
              >
                I reviewed revision {document.body.dataset.revision}; keep my draft
              </button>
            </div>
          )}
        <button className="button primary" disabled={busy}>
          <Check size={15} />
          {busy ? 'Saving…' : submit}
        </button>
      </>
    </form>
  );
}
export function SectionTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-title">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
export function RefButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button className="ref-button" onClick={onClick}>
      {children}
      <ArrowUpRight size={12} />
    </button>
  );
}

export function EvidenceRecord({ value, depth = 0 }: { value: unknown; depth?: number }) {
  if (value == null) return <span className="unknown">Not supplied</span>;
  if (typeof value !== 'object')
    return <span>{typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}</span>;
  return (
    <div className="record-tree">
      {Object.entries(value).map(([key, item]) =>
        typeof item === 'object' && item !== null ? (
          <details key={key} open={depth === 0}>
            <summary>
              {key.replace(/_/g, ' ')}
              {Array.isArray(item) ? ` · ${item.length} items` : ''}
            </summary>
            <EvidenceRecord value={item} depth={depth + 1} />
          </details>
        ) : (
          <div className="record-pair" key={key}>
            <strong>{key.replace(/_/g, ' ')}</strong>
            <EvidenceRecord value={item} depth={depth + 1} />
          </div>
        ),
      )}
    </div>
  );
}
