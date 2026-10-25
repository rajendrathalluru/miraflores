/** Server-side packet projection. Never import this module from a client component. */
import packetJson from '../data/packet.json';
import { getActor, masked } from './packet';
import { issues } from './issues';
import type { Workspace } from './contracts';

type Row = Record<string, unknown>;
const packet = packetJson as unknown as Row;
const versions = packet.return_versions as Row[];
const prior = packet.prior_years as Row;
const household = packet.household as Row;
const firm = packet.firm as Row;

export interface RecordGroup { id: string; title: string; description: string; records: Row[] }
function rows(value: unknown, path: string): Row[] {
  if (Array.isArray(value)) return value.map((item, i) => ({ ...(item && typeof item === 'object' ? item : { value: item }), recordRef: `packet:${path}/${i}` }));
  if (value && typeof value === 'object') return Object.entries(value).map(([name, item]) => ({ name, ...(item && typeof item === 'object' && !Array.isArray(item) ? item : { value: item }), recordRef: `packet:${path}/${name.replace(/~/g, '~0').replace(/\//g, '~1')}` }));
  return [{ value, recordRef: `packet:${path}` }];
}

export function getTaxRecords(actorId: string, version = 'v3', state?: Workspace) {
  getActor(actorId);
  const index = versions.findIndex(item => item.version === version);
  if (index < 0) throw new Error('Choose an available engine version.');
  const selected = versions[index];
  const lines = selected.lines as Row[];
  const choose = (forms: string[]) => lines.filter(line => forms.includes(String(line.form)));
  const priorReturn = prior.return_2024 as Row;
  const priorLines = priorReturn.lines as Record<string, unknown>;
  const priorLabels = priorReturn.line_labels as Record<string, string>;
  const priorSources = priorReturn.line_sources as Record<string, unknown>;
  const comparison = Object.entries(priorLines).map(([key, previous]) => {
    const current = lines.find(line => line.key === key);
    const currentValue = current?.value;
    return { key, label: priorLabels[key] || current?.label, prior: previous, current: currentValue ?? null,
      change: typeof previous === 'number' && typeof currentValue === 'number' ? currentValue - previous : null,
      priorSources: priorSources[key], sources: current?.sources,
      recordRef: `py:/return_2024/lines/${key}` };
  });
  const versionDiffs = versions.slice(1).map((current, pairIndex) => {
    const previous = versions[pairIndex];
    const previousLines = new Map((previous.lines as Row[]).map(line => [String(line.key), line]));
    const currentLines = new Map((current.lines as Row[]).map(line => [String(line.key), line]));
    const keys = new Set([...previousLines.keys(), ...currentLines.keys()]);
    const changes = [...keys].flatMap(key => {
      const before = previousLines.get(key); const after = currentLines.get(key);
      const valueChanged = JSON.stringify(before?.value) !== JSON.stringify(after?.value);
      const inputsChanged = JSON.stringify(before?.inputs) !== JSON.stringify(after?.inputs);
      const sourcesChanged = JSON.stringify(before?.sources) !== JSON.stringify(after?.sources);
      const ruleChanged = before?.rule !== after?.rule;
      const noteChanged = before?.note !== after?.note;
      if (!valueChanged && !inputsChanged && !sourcesChanged && !ruleChanged && !noteChanged) return [];
      return [{ key, label: after?.label || before?.label, change: before ? after ? 'changed' : 'removed' : 'added',
        old: before?.value ?? null, new: after?.value ?? null, valueChanged, inputsChanged, sourcesChanged, ruleChanged, noteChanged,
        oldInputs: before?.inputs || [], newInputs: after?.inputs || [], oldSources: before?.sources || [], newSources: after?.sources || [],
        oldRule: before?.rule || null, newRule: after?.rule || null, oldNote: before?.note || null, newNote: after?.note || null }];
    });
    return { from: previous.version, to: current.version, computedAt: current.computed_at, trigger: current.trigger, changes };
  });
  const groups: RecordGroup[] = [
    { id: 'assets', title: 'Assets & depreciation', description: 'Federal, California and AMT schedules; method, life, land, accumulated depreciation and disposal facts.', records: rows(selected.assets, `/return_versions/${index}/assets`) },
    { id: 'sales', title: 'Sales & capital gains', description: 'Every supplied Form 8949 sale and Schedule D total. Search individual lots; page through the entire population.', records: choose(['F8949', 'SchD']) },
    { id: 'business', title: 'Books to tax & business', description: 'Books mapping, expenses, vehicle and home office computations, self-employment adjustments and depreciation.', records: choose(['SchC', 'SchSE', 'F4562-C', 'Sch1']) },
    { id: 'rentals', title: 'Rentals, disposals & passive losses', description: 'Property-by-property rental lines, sale and recapture, suspended losses and passive limitations.', records: choose(['SchE', 'F4797', 'F8582', 'F4562-E']) },
    { id: 'basis', title: 'Pass-through & basis history', description: 'S corporation and partnership source history, unknown years, stock basis limitations and prior K-1 facts.', records: [...rows(prior.basis_records, '/prior_years/basis_records'), ...choose(['F7203']), ...rows({ K1_1120S: priorReturn.K1_1120S, K1_1065: priorReturn.K1_1065 }, '/prior_years/return_2024')] },
    { id: 'state', title: 'State allocation', description: 'Resident and nonresident facts, federal to California adjustments, California-source income, depreciation and other-state credit.', records: [...rows(household.residency, '/household/residency'), ...choose(['SchCA540NR', 'F540NR', 'FTB3885A', 'ScheduleS'])] },
    { id: 'retirement', title: 'Retirement & foreign reporting', description: 'IRA basis and conversion, HSA, interest, foreign accounts and specified foreign financial asset reporting.', records: choose(['F8606', 'F8889', 'F8938', 'SchB']) },
    { id: 'limits', title: 'Deductions, credits & limits', description: 'Itemized deductions, noncash gifts, QBI, AMT, credit phaseouts, dependent care, education and due diligence.', records: choose(['SchA', 'F8283', 'F8995', 'F6251', 'F8812', 'F8863', 'F2441', 'F8867', 'F8959', 'F8960', 'Sch2', 'Sch3']) },
    { id: 'payments', title: 'Payments & agency records', description: 'IRS transcript snapshots, payment-year assignment, FTB records, supplied penalty methods, notices and e-file history.', records: [...rows(packet.tax_agency_records, '/tax_agency_records'), ...choose(['F2210', 'FTB5805']), ...lines.filter(line => line.form === 'F1040' && /payment|withheld|penalty|balance|refund|extension|estimated/i.test(String(line.label)))] },
    { id: 'carryovers', title: 'Carryovers in & out', description: 'Prior federal and California carryovers and supplied current-version carryovers. Amounts remain linked to the source packet.', records: [...rows(prior.carryovers_into_2025, '/prior_years/carryovers_into_2025').map(row => ({ direction: 'Into 2025', ...row })), ...rows(selected.carryovers_out, `/return_versions/${index}/carryovers_out`).map(row => ({ direction: 'Out of 2025', ...row }))] },
    { id: 'prior', title: 'Prior-year comparison & preparer', description: 'As-filed 2024 amounts, differences to the selected engine version, preparer memo, open items and historical assets.', records: [...comparison, ...rows(prior.prior_preparer_workpaper, '/prior_years/prior_preparer_workpaper'), ...rows(prior.asset_records, '/prior_years/asset_records')] },
    { id: 'household', title: 'Household & related returns', description: 'Filing status, dependents, residency, related return ownership and prior-year e-signature AGI. Identifiers are masked.', records: [...rows(household.people, '/household/people'), ...rows(household.related_returns, '/household/related_returns'), ...rows({ filing_status: household.filing_status, prior_year_agi_for_esignature: household.prior_year_agi_for_esignature }, '/household')] },
    { id: 'communications', title: 'Client evidence', description: 'All questionnaire answers, received messages and call notes. Source evidence is distinct from new workspace questions.', records: [...rows((packet.client as Row).questionnaire, '/client/questionnaire'), ...rows((packet.client as Row).messages, '/client/messages'), ...rows((packet.client as Row).call_notes, '/client/call_notes')] },
    { id: 'reference', title: 'Rules & reference parameters', description: 'Exact simplified engine rules, thresholds, exchange rates and post-filing rates supplied with this case.', records: [...rows((packet.engine_reference as Row).rules, '/engine_reference/rules'), ...rows((packet.engine_reference as Row).parameters, '/engine_reference/parameters'), ...rows(packet.fx_rates, '/fx_rates'), ...rows(packet.post_filing_rates, '/post_filing_rates')] },
  ];
  return masked({ version, versions: versions.map(item => item.version), disclaimer: 'Supplied engine schedules and source records. This workspace does not recompute a tax return.', groups, versionDiffs,
    areaSummaries: areaSummaries(state), priorPreparerComparisons: priorPreparerComparisons(state),
    scenarios: (packet.what_if as Row).alternatives as Row[],
    extension: (packet.what_if as Row).extension,
    planning: packet.planning_reference_2026,
    timeline: packet.timeline as Row[],
    defaults: { deadlines: firm.deadlines, budgetHours: firm.budget_hours, standards: firm.starter_standards, assignment: firm.assignment_at_start },
  });
}

/** These definitions group actual supplied facts; they do not infer a new return calculation. */
const areaDefinitions = [
  { title: 'Intake and identity', keys: ['F1040.11'], docs: ['D01','D02','D03','D04','D05','D06','D07','D71'], issueAreas: [] },
  { title: 'Wages and stock compensation', keys: ['F1040.1a','F1040.25a','F8949.B.N1','F6251.2i'], docs: ['D08','D09','D10','D11','D12','D13','D73'], issueAreas: ['Stock compensation'] },
  { title: 'Investments and digital assets', keys: ['F1040.2b','F1040.3b','F1040.7','SchD.6','SchD.14'], docs: ['D28','D29','D30','D31','D32','D33','D34','D35','D74'], issueAreas: ['Investments','Digital assets'] },
  { title: 'Business and books to tax', keys: ['SchC.1','SchC.28','SchC.30','SchC.31','SchC.44a'], docs: ['D14','D15','D16','D17','D18','D19','D20','D21','D22','D23','D24','D27'], issueAreas: ['Business'] },
  { title: 'Rentals and property sale', keys: ['SchE.21A','SchE.21B','SchE.22A','SchE.22B','SchE.26'], docs: ['D46','D47','D48','D49','D50','D51','D52','D53'], issueAreas: ['Rentals'] },
  { title: 'K-1s and S corporation basis', keys: ['SchE.28A','SchE.28B','F7203.1','F7203.6','F7203.excess'], docs: ['D37','D38','D39','D40'], issueAreas: [] },
  { title: 'Retirement', keys: ['F8606.2','F8606.16','F8606.18','F8889.16'], docs: ['D25','D26','D41','D42','D43','D44','D45'], issueAreas: ['Retirement & health'] },
  { title: 'Foreign reporting', keys: ['F8938.1.max','F8938.1.ye','F8938.req'], docs: ['D36'], issueAreas: ['Foreign'] },
  { title: 'Deductions and credits', keys: ['F1040.12','F1040.13','F1040.19','SchA.8e','F8863.7'], docs: ['D54','D55','D56','D57','D58','D59','D60','D61','D62','D63','D64','D65','D66'], issueAreas: ['Deductions','Credits'] },
  { title: 'Payments and penalties', keys: ['F1040.26','F1040.33','F1040.37','F2210.19','F540NR.72'], docs: ['D67','D68','D69','D70','D72'], issueAreas: ['Payments'] },
  { title: 'California allocation', keys: ['F540NR.17','F540NR.32','F540NR.64','F540NR.97'], docs: ['D08','D09','D38','D68','D73'], issueAreas: ['California'] },
  { title: 'Carryovers and prior preparer', keys: ['SchD.6','SchD.14','F7203.1','F8606.2'], docs: ['D06','D07','D40','D42'], issueAreas: [] },
  { title: 'Outside filings', keys: ['SchC.I','SchC.J','F8938.req'], docs: ['D27','D36','D59','D60'], issueAreas: [] },
];
const latestLines = versions.at(-1)!.lines as Row[];
const rawValues = packet.extracted_values as Row[];
function suppliedLines(keys: string[]) { return keys.flatMap(key => { const line = latestLines.find(item => item.key === key); return line ? [{ key, label: line.label, value: line.value, sourceRefs: line.sources as string[], note: line.note }] : []; }); }
function reviewedIssue(id: string, state?: Workspace) {
  const issue = issues.find(item => item.id === id);
  const latest = [...(state?.investigations || [])].reverse().find(investigation => investigation.issueId === id);
  return !!state?.adjustments.some(adjustment => adjustment.issueId === id && adjustment.status === 'active') ||
    (issue?.kind !== 'adjustment' && latest?.result === 'resolved' && !!latest.authority?.trim());
}
function areaSummaries(state?: Workspace) {
  return areaDefinitions.map((area, index) => {
    const keyAmounts = suppliedLines(area.keys);
    const areaIssues = issues.filter(issue => (area.issueAreas as string[]).includes(issue.area));
    const sourceDocuments = keyAmounts.flatMap(line => line.sourceRefs).flatMap(ref => {
      const value = rawValues.find(item => item.id === ref);
      return value ? [String(value.document_id)] : /^doc:(D\d+)#/.exec(ref)?.slice(1, 2) || [];
    });
    const documentIds = [...new Set([...area.docs, ...sourceDocuments])];
    const dispositions = state?.workpaper?.documents || {};
    return { id: `area-${index}`, title: area.title, baselineVersion: 'v3', status: state?.workpaper?.areas[area.title]?.status || 'open',
      review: state?.workpaper?.areas[area.title] || null, keyAmounts,
      openFindings: areaIssues.filter(issue => !reviewedIssue(issue.id, state)), findingCount: areaIssues.length,
      documentIds, documentCoverage: { total: documentIds.length, reviewed: documentIds.filter(id => ['used','unused'].includes(String(dispositions[id]?.status))).length,
        pending: documentIds.filter(id => !['used','unused'].includes(String(dispositions[id]?.status))) },
      sourceRefs: documentIds.map(id => `doc:${id}#page1`),
      outsideFilings: area.title === 'Outside filings' ? state?.workpaper?.outsideFilings || [] : undefined };
  });
}
function priorPreparerComparisons(state?: Workspace) {
  const workpaper = prior.prior_preparer_workpaper as Row;
  const notes = workpaper.notes as string[];
  const openItems = workpaper.open_items_left_by_prior_preparer as string[];
  const comparisons = [
    { id: 'business-methods', title: 'Business mileage and home office', priorTreatment: workpaper.summary_memo, priorDetail: notes[4], priorRecords: null,
      currentKeys: ['SchC.44a','SchC.9','SchC.30'], issueIds: ['duplicate-mileage','receipts-overlap'], refs: ['doc:D07#page1','doc:D07#page2','doc:D24#page1'], limitation: 'A prior simplified-method choice does not verify current mileage or square footage. Current figures are supplied engine output.' },
    { id: 'scorp-basis', title: 'S corporation basis gaps and distributions', priorTreatment: notes[0], priorDetail: openItems[0], priorRecords: (prior.basis_records as Row).scorp_lindqvist_family_woodworks,
      currentKeys: ['F7203.1','F7203.3a','F7203.6','F7203.15','F7203.excess'], issueIds: [], refs: ['doc:D07#page5','doc:D40#page1','doc:D39#page1','py:/basis_records/scorp_lindqvist_family_woodworks'], limitation: 'Historical null basis amounts remain unknown records. Current engine treatment and later K-1 evidence are displayed separately; no complete historical basis reconstruction is implied.' },
    { id: 'ira-basis', title: 'IRA basis and Roth conversion', priorTreatment: notes[1], priorDetail: openItems[1], priorRecords: (prior.basis_records as Row).ira_nondeductible_basis_ngozi,
      currentKeys: ['F8606.1','F8606.2','F8606.16','F8606.18','F8606.14'], issueIds: [], refs: ['doc:D07#page2','doc:D42#page1','doc:D43#page1','py:/basis_records/ira_nondeductible_basis_ngozi'], limitation: 'Prior client-stated basis, obtained contribution forms and current pro-rata output require a documented tie-out.' },
    { id: 'foreign-reporting', title: 'Foreign account and reporting responsibility', priorTreatment: notes[2], priorDetail: openItems[3], priorRecords: null,
      currentKeys: ['F8938.1.max','F8938.1.ye','F8938.req'], issueIds: ['swedish-fx'], refs: ['doc:D07#page2','doc:D07#page3','doc:D36#page1','qa-07','qa-08'], limitation: 'The prior Form 3520 open item has no supplied resolution. The 2025 questionnaire answer is distinct from a 2023 filing conclusion; FBAR responsibility is recorded separately.' },
    { id: 'appliance-depreciation', title: 'Historical assets: federal, California and current methods', priorTreatment: notes[3], priorDetail: workpaper.depreciation_schedule,
      priorRecords: prior.asset_records, currentKeys: ['SchE.18A','SchE.18B','SchC.13','FTB3885A.SAC-APPL'], issueIds: ['hvac-classification'], refs: ['doc:D07#page4','py:/asset_records','asset:SAC-APPL'], limitation: 'Compare supplied federal, California and AMT asset schedules. A repair-versus-capital decision for new work remains a separate professional judgment.' },
    { id: 'passive-losses', title: 'Passive rental losses and current-year disposition', priorTreatment: workpaper.summary_memo, priorDetail: 'Prior suspended-loss records are carried in the supplied carryover worksheet.', priorRecords: prior.carryovers_into_2025,
      currentKeys: ['SchE.22A','SchE.22B','SchE.26','SchE.41'], issueIds: ['hvac-classification'], refs: ['doc:D07#page1','doc:D07#page6','py:/carryovers_into_2025','doc:D51#page1'], limitation: 'The engine’s current loss treatment is not an independent conclusion about grouping, participation, sale qualification or limitation ordering.' },
    { id: 'capital-carryovers', title: 'Capital loss carryovers', priorTreatment: 'Capital loss carryover is identified in the prior preparer summary and worksheet.', priorDetail: workpaper.summary_memo,
      priorRecords: { short: (prior.carryovers_into_2025 as Row).capital_loss_short, long: (prior.carryovers_into_2025 as Row).capital_loss_long }, currentKeys: ['SchD.6','SchD.14','F1040.7'], issueIds: [], refs: ['doc:D07#page6','py:/carryovers_into_2025/capital_loss_short','py:/carryovers_into_2025/capital_loss_long'], limitation: 'Showing matching carryover inputs does not certify the current sales population or recompute the capital gain worksheet.' },
    { id: 'stock-compensation', title: 'Stock compensation and broker basis', priorTreatment: 'Unknown: the supplied prior-preparer workpaper does not document an RSU/ESPP basis methodology.', priorDetail: null, priorRecords: null,
      currentKeys: ['F8949.B.N1','F8949.A.N2','F8949.B.N3','F8949.E.N4'], issueIds: ['rsu-basis'], refs: ['py:/prior_preparer_workpaper','doc:D11#page1','doc:D28#page1'], limitation: 'No prior method is invented. Current broker rows and compensation evidence are compared through the linked finding and reviewed overlays.' },
  ];
  return comparisons.map(comparison => {
    const curated = (state?.adjustments || []).filter(adjustment => (comparison.issueIds as string[]).includes(adjustment.issueId));
    const overlays = (state?.workpaper?.lineAdjustments || []).filter(adjustment => comparison.currentKeys.includes(String(adjustment.lineKey)));
    const revisions = new Set(curated.map(adjustment => adjustment.revision));
    const times = new Set(overlays.map(adjustment => adjustment.at));
    return { ...comparison, baselineVersion: 'v3', currentTreatment: suppliedLines(comparison.currentKeys),
      currentAssets: comparison.id === 'appliance-depreciation' ? (versions.at(-1)!.assets as Row[]).filter(asset => (prior.asset_records as Row[]).some(previous => previous.asset_id === asset.asset_id)) : [],
      assetPairs: comparison.id === 'appliance-depreciation' ? (prior.asset_records as Row[]).map(previous => ({ assetId: previous.asset_id, prior: previous, current: (versions.at(-1)!.assets as Row[]).find(asset => asset.asset_id === previous.asset_id) || null })) : [],
      relatedFindings: issues.filter(issue => (comparison.issueIds as string[]).includes(issue.id)),
      reviewedAdjustments: curated, lineOverlays: overlays,
      relatedAudit: (state?.audit || []).filter(event => revisions.has(event.revision) || times.has(event.at) || (comparison.issueIds as string[]).includes(event.issueId || '')),
      sourceRefs: comparison.refs };
  });
}
