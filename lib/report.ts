import { money, estimatedTotals, type Packet, type WorkState, type Row } from './types';
export const escapeHTML = (v: any) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
export function reviewReport(
  packet: Packet,
  state: WorkState,
  options: {
    kind: string;
    engagement: string;
    files?: Row[];
    notice?: Row;
    packetHash: string;
    clientLines?: Row[];
  },
) {
  const e = escapeHTML,
    v = packet.return_versions.at(-1)!,
    delta = estimatedTotals(v, state),
    client = options.kind === 'client';
  const names = packet.household.people
    .filter((p: Row) => ['taxpayer', 'spouse'].includes(p.role))
    .map((p: Row) => p.name)
    .join(' & ');
  const table = (headers: string[], rows: any[][]) =>
    `<div class="table"><table><thead><tr>${headers.map((h) => `<th>${e(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((c) => `<td>${e(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  const section = (title: string, body: string) => `<section><h2>${e(title)}</h2>${body}</section>`;
  let body = section(
    'Your reviewed result',
    table(
      ['Jurisdiction', 'Supplied engine balance', 'Reviewed balance estimate'],
      [
        [
          'Federal',
          money(v.summary.federal.balance_due),
          money(v.summary.federal.balance_due + delta.federal),
        ],
        [
          'California',
          money(v.summary.california.balance_due),
          money(v.summary.california.balance_due + delta.california),
        ],
      ],
    ),
  );
  body += `<p class="note">Positive balances are amounts due; negative balances are overpayments. Estimates use supplied rates and direct payment/credit effects. This is a prototype review record, not a tax return or confirmation of agency filing.</p>`;
  body += section(
    'Review status',
    table(
      ['Record', 'Value'],
      [
        ['Engagement', options.engagement],
        ['Tax year', packet.household.tax_year],
        ['Captured revision', state.revision],
        ['Filing status', state.filing.status],
        ['Packet integrity hash', options.packetHash],
      ],
    ),
  );
  if (client) {
    body += section(
      'Your return detail',
      '<p class="note">Supplied engine amounts with explicit reviewed overlays. Downstream engine values are preserved; this is not a newly computed official return.</p>' +
        table(
          ['Line', 'Description', 'Reviewed / supplied amount'],
          (options.clientLines || []).map((l) => [l.key, l.label, l.value]),
        ),
    );
    body += section(
      'Your approvals',
      table(
        ['Client', 'Recorded at', 'Content fingerprint', 'Authorization'],
        state.signoffs
          .filter((s) => s.level === 'client')
          .map((s) => [
            s.actor,
            s.at,
            s.hash,
            s.signature ? 'Simulated e-file authorization' : 'Approval',
          ]),
      ),
    );
    body += section(
      'Questions and responses',
      state.threads
        .map(
          (t) =>
            `<article><h3>${e(t.title || t.target)}</h3><p>${e(t.body)}</p>${(t.messages || []).map((m: Row) => `<p>${e(m.body)}</p>`).join('')}</article>`,
        )
        .join('') || '<p>No client-visible conversations recorded.</p>',
    );
  } else {
    body += section(
      'Return computation and source references',
      table(
        ['Line', 'Description', 'Engine', 'Reviewed', 'Rule and inputs', 'Source references'],
        v.lines.map((l: Row) => [
          l.key,
          l.label,
          l.value,
          state.adjustments.findLast(
            (a) => a.active && a.target === l.key && a.cycle === state.cycle,
          )?.value ?? l.value,
          `${packet.engine_reference?.rules?.[l.rule] || l.rule}; ${(l.inputs || []).join(', ')}`,
          (l.sources || []).join(', '),
        ]),
      ),
    );
    body += section(
      'Source field index',
      `<details><summary>${packet.extracted_values.length} extracted readings with exact document/page identifiers</summary>${table(
        ['Reference', 'Document / page', 'Field', 'Pipeline reading', 'Confidence'],
        packet.extracted_values.map((e) => [
          e.id,
          `${e.document_id} / page ${e.page}`,
          e.label,
          e.value,
          e.confidence,
        ]),
      )}</details>`,
    );
    if (options.notice)
      body += section(
        'Notice response context',
        `<p><strong>${e(options.notice.agency)} · ${e(options.notice.type || options.notice.id)} · notice tax year ${e(options.notice.tax_year)}</strong></p><p>${e(options.notice.summary || JSON.stringify(options.notice.items_under_examination || []))}</p><p>Response due: ${e(options.notice.response_due || 'See original notice')}</p>`,
      );
    body += section(
      'Supported adjustments',
      table(
        ['Target', 'Original', 'Reviewed', 'Reason', 'Author / date'],
        state.adjustments.map((a) => [
          a.target,
          a.original,
          a.value,
          a.reason,
          `${a.actor} · ${a.at}${a.active ? ' · active' : ' · reversed'}`,
        ]),
      ),
    );
    body += section(
      'Verification record',
      table(
        ['Reference', 'Method', 'Evidence and conclusion', 'Author'],
        Object.entries(state.verifications).map(([k, r]) => [k, r.method, r.reason, r.actor]),
      ),
    );
    body += section(
      'Professional conclusions and notice responses',
      state.judgments
        .filter((j) => j.kind !== 'internal')
        .map(
          (j) =>
            `<article><h3>${e(j.kind)} · ${e(j.target)}</h3><p>${e(j.reason)}</p><blockquote>${e(j.authority)}</blockquote></article>`,
        )
        .join('') || '<p>No professional conclusions recorded.</p>',
    );
    body += section(
      'Document dispositions',
      table(
        ['Document', 'Disposition', 'Reason'],
        packet.documents.map((d) => [
          `${d.id} · ${d.title}`,
          state.triage[d.id]?.status || 'Unreviewed',
          state.triage[d.id]?.reason || '',
        ]),
      ),
    );
    body += section(
      'Frozen records',
      table(
        ['Cycle', 'Captured at', 'Packet hash', 'Content hash'],
        state.freezes.map((f) => [f.cycle + 1, f.at, f.packetHash, f.contentHash]),
      ),
    );
    body += section(
      'Source documents · simulated printed content',
      packet.documents
        .map(
          (d) =>
            `<details><summary>${e(d.id)} · ${e(d.title)}</summary>${d.pages.map((p: Row) => `<article class="source"><h3>Page ${e(p.page)}</h3><pre>${e(p.printed_content)}</pre></article>`).join('')}</details>`,
        )
        .join(''),
    );
    body += section(
      'Original evidence files',
      `<p>Embedded downloads are the preserved original bytes, not newly generated source images.</p><ul>${(options.files || []).map((f) => `<li><a download="${e(f.name)}" href="data:application/octet-stream;base64,${e(f.data_base64)}">${e(f.name)}</a><small>SHA-256 of encoded bytes: ${e(f.content_hash)}</small></li>`).join('')}</ul>`,
    );
    body += section(
      'Captured review history',
      table(
        ['Revision', 'Author / date', 'Action', 'Record'],
        state.audit.map((a) => [a.revision, `${a.name} · ${a.at}`, a.type, a.detail]),
      ),
    );
  }
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Miraflores · ${client ? 'Client copy' : 'Notice and defense record'} · ${e(packet.household.tax_year)}</title><style>
 *{box-sizing:border-box}body{margin:0;background:#f2f5f7;color:#172d3b;font:15px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}main{max-width:1080px;margin:32px auto;background:white;padding:48px;border:1px solid #d9e3e7;border-radius:12px}header{border-bottom:3px solid #087f79;padding-bottom:24px;margin-bottom:28px}.brand{font-weight:750;font-size:23px;color:#087f79}h1{font-size:30px;letter-spacing:-1px;line-height:1.25}h2{font-size:21px;margin:0 0 14px}h3{font-size:16px}section{margin:32px 0}p{margin:10px 0}.note,small{color:#4b6272}small{display:block;overflow-wrap:anywhere}table{width:100%;border-collapse:collapse;font-size:13px}th,td{text-align:left;vertical-align:top;padding:12px;border:1px solid #dce4e8;overflow-wrap:anywhere}th{background:#edf4f2}details{padding:14px;border:1px solid #dce4e8;margin:10px 0}summary{cursor:pointer;font-weight:600}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:13px/1.7 ui-monospace,monospace}article{padding:12px 0}a{color:#06675e}.table{overflow:auto}@page{size:A4;margin:16mm}@media print{body{background:white}main{margin:0;border:0;padding:0;max-width:none}.table{overflow:visible}thead{display:table-header-group}tr{break-inside:avoid}h2,h3{break-after:avoid}a{color:inherit}details{break-inside:auto}}@media(max-width:600px){main{margin:0;padding:24px 16px;border:0}h1{font-size:26px}}
 </style></head><body><main><header><div class="brand">miraflores</div><p>${client ? 'Client review copy' : 'Self-contained notice and defense record'}</p><h1>${e(names)}</h1><p>Tax year ${e(packet.household.tax_year)} · captured revision ${e(state.revision)}</p><small>Generated ${e(new Date().toISOString())}. Save this HTML to retain the complete embedded record; use your browser’s Print / Save as PDF for a printable copy.</small></header>${body}<footer><p class="note">Original pipeline output is preserved. Every review action is attributable. Agency actions and signatures shown here are simulations.</p></footer></main></body></html>`;
}
