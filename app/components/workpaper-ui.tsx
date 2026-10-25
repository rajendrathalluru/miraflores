"use client";

import { AlertCircle, ArrowUpRight, Check, CheckCheck, ChevronRight, FileText, Loader2, LockKeyhole, Search, X } from "lucide-react";
import { useCallback, useEffect, useRef, type ReactNode } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Adapter for heterogeneous packet records; mutations are validated by the API.
export type RecordData = Record<string, any>;
export const errorMessage = (error:unknown) => error instanceof Error ? error.message : "An unexpected error occurred.";
export const money = (value: unknown, digits = 0) => typeof value === "number" ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: digits }).format(value) : value == null ? "—" : String(value);
export const date = (value: unknown) => value ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Chicago" }).format(new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? `${String(value)}T12:00:00Z` : String(value))) : "—";
export const shortRole = (role: string = "") => role.replaceAll("_", " ");
export const initials = (name: string = "") => name.split(" ").map(x => x[0]).slice(0, 2).join("");
export function activeAdjustments(workspace: RecordData = {}) { return (workspace.adjustments || []).filter((a: RecordData) => !a.reversedAt && !a.undoneAt && !a.undone && !["undone", "reversed"].includes(a.status)); }
export function reviewed(issue: RecordData, workspace: RecordData = {}) { const latest = [...(workspace.investigations || [])].reverse().find((i:RecordData)=>i.issueId===issue.id); return !!accepted(issue,workspace) || (issue.kind !== "adjustment" && latest?.result === "resolved" && !!latest.authority?.trim()); }
export function accepted(issue: RecordData, workspace: RecordData = {}) { return activeAdjustments(workspace).find((a: RecordData) => a.issueId === issue.id || a.issue_id === issue.id); }
export function IconButton({ children, label, onClick, className = "" }: { children: ReactNode; label: string; onClick: () => void; className?: string }) { return <button type="button" className={`icon-button ${className}`} title={label} aria-label={label} onClick={onClick}>{children}</button>; }
export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: string }) { return <span className={`badge badge-${tone}`}>{children}</span>; }
export function Empty({ title, detail }: { title: string; detail?: string }) { return <div className="empty-state"><CheckCheck size={30} strokeWidth={1.4}/><strong>{title}</strong>{detail && <p>{detail}</p>}</div>; }
export function SearchBox({ value, onChange, placeholder = "Search…" }: { value: string; onChange: (value: string) => void; placeholder?: string }) { return <label className="search-box"><Search size={16}/><input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder}/>{value && <button aria-label="Clear search" onClick={() => onChange("")}><X size={13}/></button>}</label>; }
type DialogLayer = { backdrop: HTMLElement; panel: HTMLElement; heading: HTMLElement; opener: HTMLElement | null; originalZIndex: string; close: () => void };
const dialogLayers: DialogLayer[] = [];
const originalInert = new Map<HTMLElement, boolean>();
let originalBodyOverflow = "";
function topDialog() { return dialogLayers.at(-1); }
function synchronizeDialogLayers() {
  for (const [element, wasInert] of originalInert) element.inert = wasInert;
  originalInert.clear();
  dialogLayers.forEach((layer, index) => { layer.backdrop.style.zIndex = String(1000 + index); });
  const top = topDialog();
  if (!top) return;
  // Dialogs stay in the React tree. Inert every sibling along the active layer's
  // ancestry, rather than marking an ancestor (which would inert the dialog too).
  let active: HTMLElement = top.backdrop;
  while (active.parentElement) {
    const parent = active.parentElement;
    for (const sibling of parent.children) if (sibling instanceof HTMLElement && sibling !== active) {
      originalInert.set(sibling, sibling.inert);
      sibling.inert = true;
    }
    if (parent === document.body) break;
    active = parent;
  }
}
function dialogStops(panel: HTMLElement): HTMLElement[] {
  return [...panel.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"]),[contenteditable="true"]')]
    .filter(element => element.tabIndex >= 0 && !element.closest('[inert]') && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden');
}
export function Dialog({ title, children, onClose, wide = false, label, guardUnsaved = true }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean; label?: string; guardUnsaved?: boolean }) {
  const backdrop = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const close = useRef(onClose);
  const guard = useRef(guardUnsaved);
  useEffect(() => { close.current = onClose; guard.current = guardUnsaved; }, [onClose, guardUnsaved]);
  const requestClose = useCallback(() => {
    const current = panel.current;
    if (!current || topDialog()?.panel !== current) return;
    const dirty = [...current.querySelectorAll<HTMLElement>('[data-dirty="true"]')]
      .some(element => element.closest('[role="dialog"]') === current);
    if (guard.current && dirty && !window.confirm('Discard unsaved entries and close this dialog?')) return;
    close.current();
  }, []);
  useEffect(() => {
    if (!backdrop.current || !panel.current || !heading.current) return;
    const layer: DialogLayer = { backdrop: backdrop.current, panel: panel.current, heading: heading.current,
      opener: document.activeElement instanceof HTMLElement ? document.activeElement : null,
      originalZIndex: backdrop.current.style.zIndex, close: requestClose };
    if (!dialogLayers.length) { originalBodyOverflow = document.body.style.overflow; document.body.style.overflow = "hidden"; }
    dialogLayers.push(layer);
    synchronizeDialogLayers();
    layer.heading.focus();
    const keydown = (event: KeyboardEvent) => {
      if (topDialog() !== layer) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); layer.close(); return; }
      if (event.key !== 'Tab') return;
      const stops = dialogStops(layer.panel);
      if (!stops.length) { event.preventDefault(); layer.heading.focus(); return; }
      const current = stops.indexOf(document.activeElement as HTMLElement);
      if (current < 0 || (!event.shiftKey && current === stops.length - 1) || (event.shiftKey && current === 0)) {
        event.preventDefault(); (event.shiftKey ? stops.at(-1)! : stops[0]).focus();
      }
    };
    const focusin = (event: FocusEvent) => { if (topDialog() === layer && !layer.panel.contains(event.target as Node)) layer.heading.focus(); };
    document.addEventListener('keydown', keydown, true);
    document.addEventListener('focusin', focusin);
    return () => {
      document.removeEventListener('keydown', keydown, true);
      document.removeEventListener('focusin', focusin);
      const wasTop = topDialog() === layer;
      const index = dialogLayers.indexOf(layer);
      if (index >= 0) dialogLayers.splice(index, 1);
      layer.backdrop.style.zIndex = layer.originalZIndex;
      synchronizeDialogLayers();
      if (!dialogLayers.length) document.body.style.overflow = originalBodyOverflow;
      if (wasTop) {
        const next = topDialog();
        if (layer.opener?.isConnected && !layer.opener.closest('[inert]') && (!next || next.panel.contains(layer.opener))) layer.opener.focus();
        else next?.heading.focus();
      }
    };
  }, [requestClose]);
  return <div ref={backdrop} className="modal-backdrop" onClick={event => { if (event.target === event.currentTarget && topDialog()?.backdrop === event.currentTarget) { event.stopPropagation(); requestClose(); } }}><section ref={panel} role="dialog" aria-modal="true" aria-label={title} className={`modal ${wide ? "modal-wide" : ""}`}><header className="modal-header"><div>{label && <div className="eyebrow">{label}</div>}<h2 ref={heading} tabIndex={-1}>{title}</h2></div><IconButton label="Close dialog" onClick={requestClose}><X size={20}/></IconButton></header>{children}</section></div>;
}
export function SourceChips({ refs = [], onOpen }: { refs: string[]; onOpen: (ref: string) => void }) { return <div className="source-chips">{refs.map((ref, i) => <button type="button" key={`${ref}-${i}`} onClick={() => onOpen(ref)}><FileText size={12}/>{ref}<ArrowUpRight size={11}/></button>)}</div>; }
export function IssueRow({ issue, workspace, onClick }: { issue: RecordData; workspace: RecordData; onClick: () => void }) { const resolved = reviewed(issue, workspace); return <button className="issue-row" onClick={onClick}><span className={`issue-symbol ${resolved ? "resolved" : issue.severity}`} >{resolved ? <Check size={17}/> : <AlertCircle size={18}/>}</span><span className="issue-copy"><span className="issue-title">{issue.title}</span><span className="issue-meta">{issue.area}<span>·</span>{issue.kind === "judgment" ? "Professional judgment" : "Evidence check"}</span></span>{resolved ? <Badge tone="sage">{issue.kind === "adjustment" ? "Adjusted" : "Reviewed"}</Badge> : <Badge tone={issue.severity === "high" ? "coral" : "sand"}>{issue.severity === "high" ? "Priority" : "Review"}</Badge>}<ChevronRight size={17} className="muted"/></button>; }
export function Loading({ text = "Loading workpaper…" }: { text?: string }) { return <div className="loading-state"><Loader2 size={22} className="spin"/><span>{text}</span></div>; }
export function PrivateNote() { return <span className="private-note"><LockKeyhole size={12}/> Private engagement workspace</span>; }
