"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowRight, ChevronLeft, ChevronRight, FileText, Link2 } from "lucide-react";
import { Badge, Dialog, Loading, RecordData, money } from "./workpaper-ui";

type Excerpt = { range: [number, number] | null; message: string };
type Verify = (ref: string, method: string, note: string) => Promise<boolean>;
const verificationMethods = ["agreed_to_source_document", "recalculated", "confirmed_with_client", "agreed_to_prior_year", "agreed_to_third_party_record"];

/** The page is reflowed source text, not an original page image. Never select the
 * first occurrence of a repeated amount and imply that its location is verified. */
function sourceExcerpt(text: string, chosen?: RecordData): Excerpt {
  if (!chosen) return { range: null, message: "" };
  if (["ssn", "ein", "account_number"].includes(chosen.value_type) || String(chosen.value).includes("[masked")) {
    return { range: null, message: "Identifier values remain masked. Use the field reference below; this view does not reveal or independently verify the identifier." };
  }
  const lot = String(chosen.field).match(/^([A-Z]\d+)_/);
  if (lot) {
    const matches = [...text.matchAll(new RegExp(`\\b${lot[1]}\\b`, "g"))];
    if (matches.length === 1) {
      const start = matches[0].index ?? 0;
      const end = text.indexOf(";", start);
      return { range: [start, end < 0 ? Math.min(text.length, start + 300) : end], message: `Approximate excerpt for lot ${lot[1]}. Compare the specific field within that lot; the excerpt is not a verified field boundary.` };
    }
  }
  const candidates = [chosen.text_as_read, chosen.value_type === "date" ? String(chosen.value) : null,
    typeof chosen.value === "number" ? Number(chosen.value).toLocaleString("en-US", { minimumFractionDigits: chosen.value_type === "money" ? 2 : 0 }) : null]
    .filter((value): value is string => typeof value === "string" && value.length > 1 && !value.includes("[masked"));
  for (const value of [...new Set(candidates)]) {
    const start = text.indexOf(value);
    if (start < 0) continue;
    if (text.indexOf(value, start + 1) >= 0) return { range: null, message: "This reading appears more than once on the simulated page. No text occurrence is highlighted; identify the field using its label, reference, and supplied locator." };
    return { range: [start, start + value.length], message: "Approximate matching excerpt. The page is reflowed text; compare the field label and printed content before recording verification." };
  }
  return { range: null, message: "The pipeline reading has no unique text match on this simulated page. It may differ from the printed source. Inspect the full page and keep any discrepancy open." };
}

function Printed({ content, range }: { content: unknown; range?: [number, number] | null }) {
  if (content == null) return <p>No printed content available.</p>;
  if (typeof content === "string") return <div className="printed-text">{range ? <>{content.slice(0, range[0])}<mark>{content.slice(range[0], range[1])}</mark>{content.slice(range[1])}</> : content}</div>;
  if (Array.isArray(content)) return <div className="printed-section">{content.map((item, index) => <Printed key={index} content={item}/>)}</div>;
  return <div className="printed-fields">{Object.entries(content as RecordData).map(([key, value]) => <div className="printed-item" key={key}><div className="printed-label">{key.replaceAll("_", " ")}</div>{typeof value === "object" && value !== null ? <Printed content={value}/> : <div className="printed-value">{String(value ?? "—")}</div>}</div>)}</div>;
}

function SensitiveField({ field, revision, canCorrect, actorId }: { field: RecordData; revision: number; canCorrect: boolean; actorId?: string }) {
  const [revealed, setRevealed] = useState<RecordData | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [currentRevision, setCurrentRevision] = useState(revision);
  const controller = useRef<AbortController | null>(null);
  const hide = useCallback(() => {
    controller.current?.abort(); setRevealed(null); setValue(""); setReason(""); setBusy(false);
  }, []);
  useEffect(() => {
    const clear = () => { if (document.visibilityState === "hidden") hide(); };
    document.addEventListener("visibilitychange", clear);
    window.addEventListener("pagehide", hide);
    window.addEventListener("workpaper:access-change", hide);
    return () => { document.removeEventListener("visibilitychange", clear); window.removeEventListener("pagehide", hide); window.removeEventListener("workpaper:access-change", hide); controller.current?.abort(); };
  }, [hide]);
  useEffect(() => {
    if (!revealed) return;
    const timer = setTimeout(hide, 60000);
    return () => clearTimeout(timer);
  }, [revealed, hide]);
  useEffect(() => {
    if (!value && !reason) return;
    const timer = setTimeout(hide, 60000);
    return () => clearTimeout(timer);
  }, [value, reason, hide]);
  async function reveal() {
    controller.current?.abort(); const request = new AbortController(); controller.current = request;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/sensitive-source?ref=${encodeURIComponent(field.id)}`, { cache: "no-store", signal: request.signal });
      const result: RecordData = await response.json();
      if (!response.ok) throw new Error(result.error || "The sensitive source could not be revealed.");
      if (!request.signal.aborted) setRevealed(result);
    } catch { if (!request.signal.aborted) { setRevealed(null); setValue(""); setReason(""); setMessage("The sensitive source could not be revealed. Reopen it with an authorized role."); } }
    finally { if (!request.signal.aborted) setBusy(false); }
  }
  async function correct() {
    controller.current?.abort(); const request = new AbortController(); controller.current = request;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/identifier-corrections", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedRevision: currentRevision, actorId, ref: field.id, value, reason }), signal: request.signal });
      const result: RecordData = await response.json();
      if (!response.ok) {
        setRevealed(null); setValue(""); setReason("");
        setMessage(response.status === 409 ? "The workspace changed. Protected fields were cleared. Close and reopen this source, review current facts, then re-enter the correction." : "The protected correction was not confirmed. Fields were cleared; reopen the source and check its current correction before trying again.");
        return;
      }
      if (!request.signal.aborted) {
        setCurrentRevision(result.revision); setRevealed(null); setValue(""); setReason("");
        setMessage("Encrypted correction saved. The source packet is unchanged and prior approvals reopen. Use Reveal to inspect the protected value.");
        window.dispatchEvent(new Event("workpaper:committed"));
      }
    } catch { if (!request.signal.aborted) { setRevealed(null); setValue(""); setReason(""); setMessage("The correction outcome is unconfirmed. Protected fields were cleared. Reopen the source to inspect its current correction before trying again."); } }
    finally { if (!request.signal.aborted) setBusy(false); }
  }
  return <div className="decision-form" data-dirty={!!value || !!reason || undefined}><div className="flex-inline"><Badge tone="sand">Cleared staff · Logged access</Badge><button className="button button-secondary button-small" disabled={busy} onClick={() => revealed ? hide() : void reveal()}>{revealed ? "Hide sensitive source" : "Reveal sensitive source"}</button></div>
    {revealed && <div className="settings-info"><strong>Sensitive view · Automatically hidden after 60 seconds</strong><p>Pipeline reading: {String(revealed.field?.value ?? "Not provided")}</p>{revealed.correction && <p>Latest protected correction: {String(revealed.correction.value)}</p>}<pre className="evidence-reference-text">{String(revealed.printedContent || "")}</pre><button className="text-button" onClick={hide}>Hide now</button></div>}
    {canCorrect && <><label className="form-label">Corrected identifier<input type="password" autoComplete="off" spellCheck={false} value={value} onChange={event => setValue(event.target.value)} placeholder="Enter the source-supported correction"/></label><label className="form-label">Correction reason and evidence<textarea rows={2} value={reason} onChange={event => setReason(event.target.value)} placeholder="Explain the source-backed correction without copying the identifier."/></label><button className="button button-secondary button-small" disabled={busy || !value.trim() || !reason.trim() || !Number.isSafeInteger(currentRevision)} onClick={() => void correct()}>Save encrypted correction</button><p className="small muted">Protected drafts clear on conflict, role change, dismissal or 60 seconds of inactivity. The original remains unchanged; only metadata enters the workpaper.</p></>}
    {message && <p className="small" role="status">{message}</p>}
  </div>;
}

function SourceLocation({ field, docId, onVerify, canReveal, revision, accessKey, actorId }: { field: RecordData; docId: string; onVerify?: Verify; canReveal: boolean; revision: number; accessKey?: string; actorId?: string }) {
  const [method, setMethod] = useState(verificationMethods[0]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const coordinate = (key: string) => typeof field.position?.[key] === "number" ? field.position[key].toFixed(4) : "not supplied";
  async function verify() {
    if (!onVerify || !note.trim()) return;
    setSaving(true); setMessage("");
    try {
      if (await onVerify(field.id, method, note.trim())) { setNote(""); setMessage("Verification saved to the workpaper history."); }
      else setMessage("Verification was not saved. Review the workpaper error and try again.");
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Verification could not be saved."); }
    finally { setSaving(false); }
  }
  return <div className="source-focus" data-dirty={!!note.trim() || undefined}>
    <span className="source-focus-label"><FileText size={13}/> Selected source field</span>
    <strong>{field.label || field.field}</strong>
    <small>{docId} · Page {field.page} · {field.id} · Field: {field.field}</small>
    <span>Pipeline reading: {field.value_type === "money" ? money(field.value, 2) : String(field.value ?? "Not provided")}</span>
    <small>Extraction confidence: {Math.round((field.confidence || 0) * 100)}% · Human verification is separate.</small>
    <small>Supplied synthetic locator (normalized 0–1): x0 {coordinate("x0")}, y0 {coordinate("y0")}, x1 {coordinate("x1")}, y1 {coordinate("y1")}.</small>
    <small>The packet provides synthetic coordinates, not original page images. Document/page/field references identify the record; coordinates do not prove the reading is correct.</small>
    {canReveal && (["ssn", "ein", "account_number"].includes(field.value_type) || field.field === "ip_pin") && <SensitiveField key={`${field.id}:${accessKey || actorId || "local"}`} field={field} revision={revision} canCorrect={Boolean(onVerify)} actorId={actorId}/>}
    {onVerify && <div className="decision-form"><label className="form-label">Verification method<select className="outcome-select" value={method} onChange={event => setMethod(event.target.value)}>{verificationMethods.map(value => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></label><label className="form-label">Evidence reviewed and conclusion<textarea rows={2} value={note} onChange={event => setNote(event.target.value)} placeholder="Explain how you verified this field or documented a discrepancy."/></label><button className="button button-secondary button-small" disabled={saving || !note.trim()} onClick={() => void verify()}>{saving ? "Saving…" : "Record verification"}</button>{message && <p className="small" role="status">{message}</p>}</div>}
  </div>;
}

export default function SourceViewer({ docId, sourceRef, onClose, onVerify, accessKey, actorId }: {
  docId: string; sourceRef?: string; onClose: () => void; onVerify?: Verify; accessKey?: string; actorId?: string;
}) {
  const [data, setData] = useState<RecordData | null>(null);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(sourceRef || "");
  const [showOriginal, setShowOriginal] = useState(false);
  const body = useRef<HTMLDivElement>(null);
  function changeSourceSelection(change: () => void) {
    if (body.current?.querySelector('[data-dirty="true"]') && !window.confirm('Discard unsaved source entries and change the selected page or field?')) return;
    change();
  }
  useEffect(() => {
    let alive = true;
    fetch(`/api/documents/${encodeURIComponent(docId)}`).then(async response => {
      const result: RecordData = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to open source document");
      return result;
    }).then(result => {
      if (!alive) return;
      setData(result);
      const value = (result.values || []).find((item: RecordData) => item.id === sourceRef);
      setPage(value?.page || Number(sourceRef?.match(/#page(\d+)/)?.[1]) || 1);
      setSelected(sourceRef || "");
    }).catch(cause => { if (alive) setError(cause.message); });
    return () => { alive = false; };
  }, [docId, sourceRef]);
  const doc = data?.document;
  const pages = doc?.pages || [];
  const values = (data?.values || []).filter((value: RecordData) => value.page === page);
  const chosen = (data?.values || []).find((value: RecordData) => value.id === selected);
  const visibleChosen = chosen?.page === page ? chosen : undefined;
  const pageData = pages.find((item: RecordData) => item.page === page) || pages[page - 1];
  const excerpt = typeof pageData?.printed_content === "string" ? sourceExcerpt(pageData.printed_content, visibleChosen) : { range: null, message: "" };
  const identifierDiscrepancy = visibleChosen?.field === "ein" && doc?.issueIds?.includes("provider-identifier");
  const original = data?.original;
  const originalId = typeof original?.attachmentId === "string" ? original.attachmentId : "";
  const originalUrl = originalId ? `/api/attachments/${encodeURIComponent(originalId)}` : "";
  const canPreview = ["application/pdf", "image/png", "image/jpeg"].includes(original?.contentType);
  return <Dialog title={doc?.title || `Source document ${docId}`} label={`Evidence / ${docId}`} wide onClose={onClose}>
    {error ? <div className="inline-error"><AlertCircle size={18}/>{error}</div> : !data ? <Loading text="Opening source evidence…"/> : <>
      <div className="document-toolbar"><div className="flex-inline"><Badge tone="sage">{showOriginal && originalUrl && canPreview ? "Private original" : "Simulated source"}</Badge><span className="muted small">{showOriginal && originalUrl && canPreview ? "Uploaded source · Stable field references" : "Original printed content · Reflowed layout"}</span></div><div className="pagination"><button disabled={page <= 1} aria-label="Previous page" onClick={() => changeSourceSelection(() => setPage(value => value - 1))}><ChevronLeft size={17}/></button><span>Page {page} of {pages.length || doc.pageCount}</span><button disabled={page >= pages.length} aria-label="Next page" onClick={() => changeSourceSelection(() => setPage(value => value + 1))}><ChevronRight size={17}/></button></div></div>
      {originalUrl && <div className="document-toolbar"><div><Badge tone="sand">Bound private original</Badge> <span className="small">{String(original.name || "Source attachment")}</span></div><div className="flex-inline">{canPreview && <button className="button button-secondary button-small" onClick={() => setShowOriginal(value => !value)}>{showOriginal ? "Show simulated page" : "View private original"}</button>}<a className="button button-secondary button-small" href={originalUrl} target="_blank" rel="noreferrer">Download original</a></div></div>}
      <div ref={body} className="document-body"><div className="document-paper"><div className="paper-header"><span>MIRAFLORES / SOURCE RECORD</span><span>{docId} · {page}</span></div><h3>{doc.title}</h3><div className="paper-rule"/>
        {visibleChosen && <SourceLocation key={visibleChosen.id} field={visibleChosen} docId={docId} onVerify={onVerify} canReveal={data.canRevealIdentifiers === true} revision={data.revision} accessKey={accessKey} actorId={actorId}/>}
        {identifierDiscrepancy && <p className="settings-info" role="note">The case review flags a difference between this pipeline ID and the printed provider ID. Both remain masked here. Preserve the discrepancy and use an approved secure correction process.</p>}
        {excerpt.message && !showOriginal && <p className="settings-info" role="note">{excerpt.message}</p>}
        {showOriginal && originalUrl && canPreview ? <><p className="settings-info">Private original view. Access is clearance checked and logged. Stable document/page/field references are preserved, but the synthetic locator above does not identify a verified position on this uploaded file. Confirm the actual field and page when recording verification.</p><iframe key={`${originalId}-${page}`} title={`Private original for ${docId}, requested page ${page}`} src={`${originalUrl}?preview=1${original.contentType === "application/pdf" ? `#page=${page}` : ""}`} sandbox="" referrerPolicy="no-referrer" style={{ width: "100%", height: 650, border: "1px solid #dfe5d7", borderRadius: 4 }}/><a className="text-button" href={`${originalUrl}?preview=1${original.contentType === "application/pdf" ? `#page=${page}` : ""}`} target="_blank" rel="noreferrer">Open private original in a separate view</a></> : <Printed content={pageData?.printed_content} range={excerpt.range}/>}
        <div className="paper-footer">{showOriginal && originalUrl && canPreview ? `Bound private original · ${original.name || "Source attachment"}` : `Simulated document · Original source content preserved · ${doc.fileName}`}</div>
      </div><aside className="field-panel"><div className="field-panel-heading"><FileText size={15}/><h3>Fields on this page</h3><Badge>{values.length}</Badge></div><p className="small muted">Select a field for its stable reference and supplied locator. Pipeline readings can disagree with printed content.</p>
        {values.length ? <div className="field-list">{values.map((value: RecordData) => <button key={value.id} className={`field-item ${selected === value.id ? "selected" : ""}`} onClick={() => { if (selected !== value.id) changeSourceSelection(() => setSelected(value.id)); }}><span>{value.label || value.field}</span><strong>{value.value_type === "money" ? money(value.value, 2) : String(value.value ?? "Not provided")}</strong><small>{value.id} <span>{Math.round((value.confidence || 0) * 100)}% extraction confidence</span></small></button>)}</div> : <div className="field-empty">No extracted fields. Review the printed content directly.</div>}
        <div className="document-uses"><div className="field-panel-heading"><Link2 size={14}/><h3>Return destinations</h3></div>{(data.uses || []).length ? (data.uses || []).map((use: string | RecordData, index: number) => <div key={index} className="use-item"><ArrowRight size={12}/>{typeof use === "string" ? use : `${use.version ? `${use.version.toUpperCase()} · ` : ""}${use.key || use.lineKey || use.label || "Return line"}`}</div>) : <p className="small muted">No direct return-line destination recorded. Record this document&apos;s disposition in completeness review; its supporting use must be considered separately.</p>}</div>
      </aside></div>
    </>}
  </Dialog>;
}
