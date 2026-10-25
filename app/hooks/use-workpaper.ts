"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RecordData } from "../components/workpaper-ui";

export type SaveState = "idle" | "saving" | "saved" | "failed" | "uncertain";
type PendingRequest = { requestId: string; expectedRevision: number; command: RecordData; actorId: string };

/** Browser interaction state is separate from the server's durable review record. */
export function useWorkpaper() {
  const [data, setData] = useState<RecordData | null>(null);
  const current = useRef<RecordData | null>(null);
  const generation = useRef(0);
  const pending = useRef<PendingRequest | null>(null);
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [freshnessError, setFreshnessError] = useState("");
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null);
  const [conflict, setConflict] = useState<RecordData | null>(null);
  const [toast, setToast] = useState("");
  const [retryReady, setRetryReady] = useState(false);

  const apply = useCallback((out: RecordData) => {
    const prior = current.current;
    // A slow poll must not replace a newer committed revision.
    if (prior?.actor?.id === out.actor?.id && prior?.workspace?.revision > out.workspace?.revision) return;
    if (prior?.actor?.id && prior.actor.id !== out.actor?.id) window.dispatchEvent(new Event("workpaper:access-change"));
    if (prior && (prior.workspace?.workpaper?.cycle ?? 0) !== (out.workspace?.workpaper?.cycle ?? 0)) window.dispatchEvent(new Event("workpaper:cycle-change"));
    current.current = out;
    setData(out);
    setLastRefreshed(new Date().toISOString());
    setFreshnessError("");
  }, []);

  const refresh = useCallback(async () => {
    const epoch = generation.current;
    try {
      const response = await fetch("/api/bootstrap", { cache: "no-store" });
      const out: RecordData = await response.json();
      if (!response.ok) throw new Error(out.error || "The workpaper could not be loaded.");
      if (epoch === generation.current) apply(out);
      return out;
    } catch (cause) {
      if (epoch === generation.current) setFreshnessError(cause instanceof Error ? cause.message : "Refresh unavailable.");
      throw cause;
    }
  }, [apply]);

  useEffect(() => {
    refresh().catch(cause => setError(cause instanceof Error ? cause.message : "Unable to open the workpaper."));
    const check = () => { if (document.visibilityState === "visible") void refresh().catch(() => undefined); };
    const timer = setInterval(check, 10_000);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => { clearInterval(timer); window.removeEventListener("focus", check); document.removeEventListener("visibilitychange", check); };
  }, [refresh]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const committed = () => {
      if (!pending.current) setSaveState("saved");
      void refresh().catch(() => undefined);
    };
    window.addEventListener("workpaper:committed", committed);
    return () => window.removeEventListener("workpaper:committed", committed);
  }, [refresh]);

  async function send(request: PendingRequest): Promise<boolean> {
    if (lock.current) return false;
    if (request.actorId !== current.current?.actor?.id) {
      setError("Return to the original demo role before retrying its unconfirmed request.");
      return false;
    }
    lock.current = true; setBusy(true); setError(""); setConflict(null); setSaveState("saving"); setRetryReady(false);
    pending.current = request;
    try {
      const response = await fetch("/api/commands", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actorId: request.actorId, requestId: request.requestId, expectedRevision: request.expectedRevision, command: request.command }) });
      const out: RecordData = await response.json();
      if (!response.ok) {
        if (response.status >= 500) throw new Error(out.error || "The save response was interrupted.");
        pending.current = null; setSaveState("failed");
        if (response.status === 409) {
          setConflict(out.conflict || { currentRevision: current.current?.workspace?.revision });
          void refresh().catch(() => undefined);
        }
        setError(out.error || "This action was not saved. Your draft is retained.");
        return false;
      }
      if (request.actorId !== current.current?.actor?.id) {
        setSaveState("uncertain");
        setError("The demo role changed while this request completed. Return to its original role to reconcile the saved result.");
        return false;
      }
      pending.current = null;
      apply(out); setSaveState("saved");
      setToast(`Saved at revision ${out.request?.revision ?? out.workspace?.revision}. Original evidence and history preserved.`);
      // An idempotent replay returns its original result; refresh to any later state.
      void refresh().catch(() => undefined);
      return true;
    } catch {
      setSaveState("uncertain");
      setError("The save outcome is unconfirmed. Check its status before retrying; your draft remains here.");
      return false;
    } finally { lock.current = false; setBusy(false); }
  }

  async function command(command: RecordData): Promise<boolean> {
    if (pending.current || lock.current) {
      setError("Resolve the unconfirmed save before starting another action.");
      return false;
    }
    const expectedRevision = typeof command.expectedRevision === "number" ? command.expectedRevision : current.current?.workspace?.revision;
    return send({ requestId: crypto.randomUUID(), expectedRevision, command, actorId: current.current?.actor?.id });
  }

  async function reconcile() {
    const request = pending.current;
    if (!request || lock.current) return;
    if (request.actorId !== current.current?.actor?.id) { setError("Return to the original demo role to check its unconfirmed request."); return; }
    setBusy(true); lock.current = true;
    try {
      const response = await fetch(`/api/commands?requestId=${encodeURIComponent(request.requestId)}&actorId=${encodeURIComponent(request.actorId)}`, { cache: "no-store" });
      const out: RecordData = await response.json();
      if (!response.ok) throw new Error(out.error || "Request status unavailable.");
      if (out.status === "committed") {
        pending.current = null; setSaveState("saved"); setError("");
        setToast(`The request committed at revision ${out.revision}. Compare the saved decision with your retained draft.`);
        await refresh();
      } else {
        setRetryReady(true);
        setError("No committed result is recorded yet. Check again or deliberately retry the same request safely.");
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Request status unavailable."); }
    finally { setBusy(false); lock.current = false; }
  }

  async function retryPending() {
    if (!retryReady) { setError("Check the request status before deliberately retrying it."); return false; }
    if (pending.current) return send(pending.current);
    return false;
  }

  async function switchActor(actorId: string) {
    if (lock.current || (pending.current && pending.current.actorId !== actorId)) { setError("Resolve the unconfirmed save before switching to another role."); return false; }
    window.dispatchEvent(new Event("workpaper:access-change"));
    generation.current += 1; setBusy(true); lock.current = true; setError("");
    try {
      const response = await fetch("/api/persona", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actorId }) });
      const out: RecordData = await response.json();
      if (!response.ok) throw new Error(out.error || "Unable to switch demo role.");
      await refresh(); setSaveState(pending.current ? "uncertain" : "idle"); setConflict(null); setToast("Demo role changed. Role actions are enforced by the server.");
      return true;
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to switch role."); return false; }
    finally { setBusy(false); lock.current = false; }
  }

  return { data, busy, error, setError, saveState, freshnessError, lastRefreshed, conflict, toast, setToast,
    refresh, command, reconcile, retryPending, retryReady, switchActor, pendingActorId: pending.current?.actorId, saveUnconfirmed: saveState === "uncertain" };
}
