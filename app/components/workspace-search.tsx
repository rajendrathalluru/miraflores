"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Search } from "lucide-react";
import { Badge, Dialog, Empty, Loading, SearchBox, type RecordData } from "./workpaper-ui";

export default function WorkspaceSearch({ onClose, onOpenSource }: { onClose: () => void; onOpenSource: (ref: string) => void }) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<RecordData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true); setError("");
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`, { cache: "no-store", signal: controller.signal });
        const out: RecordData = await response.json();
        if (!response.ok) throw new Error(out.error || "Search unavailable.");
        if (!controller.signal.aborted) setResult(out);
      } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Search unavailable."); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }, 200);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [query]);
  return <Dialog title="Search the workpaper" label="Evidence · calculations · saved decisions" onClose={onClose}>
    <div className="modal-content workspace-search">
      <SearchBox value={query} onChange={setQuery} placeholder="Search a source, amount, decision or reference…"/>
      {error && <p role="alert" className="inline-error">{error}</p>}
      {query.trim().length < 2 ? <Empty title="Find the evidence behind a question" detail="Enter at least two characters. Sensitive identifiers remain masked."/> : loading ? <Loading text="Searching evidence and saved work…"/> : <>
        <p className="small muted">{result?.total ?? 0} matches · Showing up to {result?.limit ?? 75}</p>
        <div className="workspace-search-results">{(result?.results || []).map((row: RecordData) => <article key={row.id}>
          <Badge>{String(row.category).replaceAll("_", " ")}</Badge><h3>{row.title}</h3><p>{row.snippet}</p>
          <div>{(row.sourceRefs || []).map((ref: string) => <button className="text-button" key={ref} onClick={() => onOpenSource(ref)}><Search size={12}/>{ref}<ArrowUpRight size={12}/></button>)}</div>
        </article>)}</div>
      </>}
    </div>
  </Dialog>;
}
