"use client";

import { AlertCircle, ArrowUpRight, Check, CheckCheck, ChevronRight, FileText, Loader2, LockKeyhole, Search, X } from "lucide-react";
import { useEffect, type ReactNode } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Adapter for heterogeneous packet records; mutations are validated by the API.
export type RecordData = Record<string, any>;
export const errorMessage = (error:unknown) => error instanceof Error ? error.message : "An unexpected error occurred.";
export const money = (value: unknown, digits = 0) => typeof value === "number" ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: digits }).format(value) : value == null ? "—" : String(value);
export const date = (value: unknown) => value ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Chicago" }).format(new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? `${String(value)}T12:00:00Z` : String(value))) : "—";
export const shortRole = (role: string = "") => role.replaceAll("_", " ");
export const initials = (name: string = "") => name.split(" ").map(x => x[0]).slice(0, 2).join("");
export function activeAdjustments(workspace: RecordData = {}) { return (workspace.adjustments || []).filter((a: RecordData) => !a.reversedAt && !a.undoneAt && !a.undone && !["undone", "reversed"].includes(a.status)); }
export function reviewed(issue: RecordData, workspace: RecordData = {}) { return !!accepted(issue,workspace) || (issue.kind !== "adjustment" && [...(workspace.investigations || [])].reverse().find((i:RecordData)=>i.issueId===issue.id)?.result === "resolved"); }
export function accepted(issue: RecordData, workspace: RecordData = {}) { return activeAdjustments(workspace).find((a: RecordData) => a.issueId === issue.id || a.issue_id === issue.id); }
export function IconButton({ children, label, onClick, className = "" }: { children: ReactNode; label: string; onClick: () => void; className?: string }) { return <button className={`icon-button ${className}`} title={label} aria-label={label} onClick={onClick}>{children}</button>; }
export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: string }) { return <span className={`badge badge-${tone}`}>{children}</span>; }
export function Empty({ title, detail }: { title: string; detail?: string }) { return <div className="empty-state"><CheckCheck size={30} strokeWidth={1.4}/><strong>{title}</strong>{detail && <p>{detail}</p>}</div>; }
export function SearchBox({ value, onChange, placeholder = "Search…" }: { value: string; onChange: (value: string) => void; placeholder?: string }) { return <label className="search-box"><Search size={16}/><input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder}/>{value && <button aria-label="Clear search" onClick={() => onChange("")}><X size={13}/></button>}</label>; }
export function Dialog({ title, children, onClose, wide = false, label }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean; label?: string }) {
  useEffect(() => { const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; document.addEventListener("keydown", handler); const prev = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { document.removeEventListener("keydown", handler); document.body.style.overflow = prev; }; }, [onClose]);
  return <div className="modal-backdrop" onClick={onClose}><section role="dialog" aria-modal="true" aria-label={title} className={`modal ${wide ? "modal-wide" : ""}`} onClick={e => e.stopPropagation()}><header className="modal-header"><div>{label && <div className="eyebrow">{label}</div>}<h2>{title}</h2></div><IconButton label="Close dialog" onClick={onClose}><X size={20}/></IconButton></header>{children}</section></div>;
}
export function SourceChips({ refs = [], onOpen }: { refs: string[]; onOpen: (ref: string) => void }) { return <div className="source-chips">{refs.map((ref, i) => <button key={`${ref}-${i}`} onClick={() => onOpen(ref)}><FileText size={12}/>{ref}<ArrowUpRight size={11}/></button>)}</div>; }
export function IssueRow({ issue, workspace, onClick }: { issue: RecordData; workspace: RecordData; onClick: () => void }) { const resolved = reviewed(issue, workspace); return <button className="issue-row" onClick={onClick}><span className={`issue-symbol ${resolved ? "resolved" : issue.severity}`} >{resolved ? <Check size={17}/> : <AlertCircle size={18}/>}</span><span className="issue-copy"><span className="issue-title">{issue.title}</span><span className="issue-meta">{issue.area}<span>·</span>{issue.kind === "judgment" ? "Professional judgment" : "Evidence check"}</span></span>{resolved ? <Badge tone="sage">{issue.kind === "adjustment" ? "Adjusted" : "Reviewed"}</Badge> : <Badge tone={issue.severity === "high" ? "coral" : "sand"}>{issue.severity === "high" ? "Priority" : "Review"}</Badge>}<ChevronRight size={17} className="muted"/></button>; }
export function Loading({ text = "Loading workpaper…" }: { text?: string }) { return <div className="loading-state"><Loader2 size={22} className="spin"/><span>{text}</span></div>; }
export function PrivateNote() { return <span className="private-note"><LockKeyhole size={12}/> Private engagement workspace</span>; }
