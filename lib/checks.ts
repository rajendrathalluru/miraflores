/** SERVER ONLY. Independent arithmetic over printed source text and agency records.
 * These are case-specific reconciliation checks, not a tax-law or extraction engine. */
import packetJson from '../data/packet.json';
import { getActor, masked } from './packet';
import type { ReturnLine, Workspace } from './contracts';

export interface SourceCheck {
  id: string; title: string; area: string; status: 'mismatch' | 'agrees' | 'review';
  engineValue: number | null; independentValue: number | null; delta: number | null;
  unit: 'USD' | 'miles'; method: string; detail: string; sourceRefs: string[];
  lineKeys: string[]; components?: { label: string; value: number }[];
}
interface CheckPacket {
  documents: { id: string; pages: { page: number; printed_content: string }[] }[];
  extracted_values: { id: string; document_id: string; field: string; value: unknown }[];
  return_versions: { version: string; lines: ReturnLine[] }[];
  tax_agency_records: {
    irs_account_transcript_2025: { as_of: string; transactions: { description: string; amount: number | string }[] }[];
    ftb_account: { tax_year_2025_payments: { amount: number }[] };
  };
  engine_reference: { parameters: { mileage_rate: number } };
}
const packet = packetJson as unknown as CheckPacket;
const current = packet.return_versions.find(version => version.version === 'v3')!;
const lineIndex = new Map(current.lines.map(line => [line.key, line]));
const amount = (value: string) => Number(value.replaceAll(',', ''));
const rounded = (value: number) => Math.round(value * 100) / 100;
const sum = (values: number[]) => rounded(values.reduce((total, value) => total + value, 0));
function printed(id: string, page: number): string {
  return packet.documents.find(document => document.id === id)?.pages.find(item => item.page === page)?.printed_content || '';
}
function read(text: string, expression: RegExp): number | null {
  const match = expression.exec(text);
  return match ? amount(match[1]) : null;
}
function engine(key: string): number | null {
  const value = lineIndex.get(key)?.value;
  return typeof value === 'number' ? value : null;
}
function compare(check: Omit<SourceCheck, 'status' | 'delta'> & { status?: SourceCheck['status'] }): SourceCheck {
  const delta = check.engineValue === null || check.independentValue === null ? null : rounded(check.engineValue - check.independentValue);
  return { ...check, delta, status: check.status || (delta === null ? 'review' : Math.abs(delta) < .01 ? 'agrees' : 'mismatch') };
}
function nullableSum(values: (number | null)[]): number | null {
  return values.some(value => value === null) ? null : sum(values as number[]);
}

export function getChecks(actorId: string, state: Workspace) {
  getActor(actorId);
  const checks: SourceCheck[] = [];
  const mileage = packet.documents.find(document => document.id === 'D23')!;
  const seenSheets = new Set<string>();
  const pageMiles = mileage.pages.map(page => {
    const canonical = page.printed_content.slice(page.printed_content.indexOf('Mileage log'));
    const duplicate = seenSheets.has(canonical);
    seenSheets.add(canonical);
    const trips = [...page.printed_content.matchAll(/\b(\d[\d,]*)\s+mi\b/g)].map(match => amount(match[1]));
    return { page: page.page, duplicate, trips: sum(trips), stated: read(page.printed_content, /Page total ([\d,]+) miles\./) };
  });
  const uniqueMiles = sum(pageMiles.filter(page => !page.duplicate).map(page => page.trips));
  checks.push(compare({ id: 'mileage-page-arithmetic', title: 'Mileage page totals versus individual trips', area: 'Business',
    engineValue: nullableSum(pageMiles.map(page => page.stated)), independentValue: sum(pageMiles.map(page => page.trips)), unit: 'miles',
    method: 'Parse and sum every printed trip mileage, then compare with the sum of the printed page totals, including the duplicate scan.',
    detail: 'An agreement here proves only page arithmetic; it does not establish that every scanned page is unique.',
    sourceRefs: mileage.pages.map(page => `doc:D23#page${page.page}`), lineKeys: ['SchC.44a'],
    components: pageMiles.map(page => ({ label: `Page ${page.page} trip sum${page.duplicate ? ' (duplicate sheet)' : ''}`, value: page.trips })) }));
  checks.push(compare({ id: 'unique-mileage', title: 'Business miles after duplicate-sheet detection', area: 'Business',
    engineValue: engine('SchC.44a'), independentValue: uniqueMiles, unit: 'miles',
    method: 'Canonicalize each printed mileage sheet from its Mileage log heading; count identical sheets once, independently summing the retained individual trips.',
    detail: `Pages ${pageMiles.filter(page => page.duplicate).map(page => page.page).join(', ')} repeat another sheet. This is a source-population check, not a recalculated tax return.`,
    sourceRefs: mileage.pages.map(page => `doc:D23#page${page.page}`), lineKeys: ['SchC.44a', 'SchC.9'],
    components: pageMiles.filter(page => !page.duplicate).map(page => ({ label: `Unique page ${page.page}`, value: page.trips })) }));
  checks.push(compare({ id: 'mileage-deduction', title: 'Mileage deduction from unique source trips', area: 'Business',
    engineValue: engine('SchC.9'), independentValue: rounded(uniqueMiles * packet.engine_reference.parameters.mileage_rate), unit: 'USD',
    method: 'Multiply independent unique-trip mileage by the packet-supplied mileage rate.',
    detail: 'The deduction comparison uses the given rate and makes no new eligibility or tax-liability determination.',
    sourceRefs: ['doc:D23#page1', 'doc:D23#page2', 'doc:D23#page3', 'doc:D23#page4', 'ref:param.mileage_rate'], lineKeys: ['SchC.9'] }));

  const compositeText = printed('D28', 1), bankText = printed('D29', 1);
  const compositeInterest = read(compositeText, /box 1 interest ([\d,]+\.\d{2})/i);
  const bankInterest = read(bankText, /box 1 interest income ([\d,]+\.\d{2})/i);
  const compositeSuffix = compositeText.match(/account ending (\d+)/)?.[1];
  const bankSuffix = bankText.match(/account ending (\d+)/)?.[1];
  const recipient = bankText.match(/Recipient ([^.]+)\./)?.[1];
  const sameSweep = Boolean(compositeSuffix && bankSuffix && recipient && compositeText.includes(recipient)) &&
    /Northlake Bank/i.test(compositeText) && /Northlake Bank/i.test(bankText) &&
    /bank sweep program/i.test(compositeText) && /bank sweep program/i.test(bankText) &&
    compositeSuffix === bankSuffix && compositeInterest !== null && compositeInterest === bankInterest;
  checks.push(compare({ id: 'sweep-interest', title: 'Same sweep interest reported on two documents', area: 'Investments',
    engineValue: nullableSum([engine('SchB.1.1'), engine('SchB.1.2')]), independentValue: sameSweep ? compositeInterest : null, unit: 'USD',
    method: 'Read the printed interest amounts and compare payer, bank-sweep description and account suffix before counting one reporting instance.',
    detail: sameSweep ? 'Both documents describe the same bank sweep for the household. Matching documents are retained; only the reported income instance is deduplicated for this comparison.' : 'The source documents could not be confidently grouped; manual review is required.',
    sourceRefs: ['doc:D28#page1', 'doc:D29#page1'], lineKeys: ['SchB.1.1', 'SchB.1.2', 'F1040.2b'] }));

  const meridian = packet.documents.find(document => document.id === 'D31')!;
  const lots = meridian.pages.flatMap(page => [...page.printed_content.matchAll(/\b(M\d+)\b[^;]*?proceeds ([\d,]+\.\d{2}) basis ([\d,]+\.\d{2})([^;]*)/g)]
    .map(match => ({ id: match[1], page: page.page, proceeds: amount(match[2]), basis: amount(match[3]), wash: read(match[4], /wash sale loss disallowed ([\d,]+\.\d{2})/) || 0 })));
  const uniqueLots = [...new Map(lots.map(lot => [lot.id, lot])).values()];
  const sourceProceeds = sum(uniqueLots.map(lot => lot.proceeds));
  const sourceGain = sum(uniqueLots.map(lot => lot.proceeds - lot.basis + lot.wash));
  const meridianLines = current.lines.filter(line => line.form === 'F8949' && /\.M\d+$/.test(line.key));
  const representedProceeds = meridianLines.flatMap(line => line.sources).map(ref => packet.extracted_values.find(value => value.id === ref))
    .filter(value => value?.document_id === 'D31' && /_proceeds$/.test(value.field)).map(value => Number(value!.value));
  const summaryProceeds = read(printed('D31', 1), /total proceeds ([\d,]+\.\d{2})/);
  checks.push(compare({ id: 'meridian-proceeds', title: 'Meridian engine lots versus all printed sale lots', area: 'Investments',
    engineValue: sum(representedProceeds), independentValue: sourceProceeds, unit: 'USD',
    method: 'Sum proceeds referenced by actual v3 Meridian sale lines, then independently parse every printed M-lot, including unextracted pages, counting each lot ID once.',
    detail: `Printed detail contains ${uniqueLots.length} lots versus ${meridianLines.length} engine lots. The printed summary is ${summaryProceeds}; lot M18 appears on page 32.`,
    sourceRefs: ['doc:D31#page1', 'doc:D31#page10', 'doc:D31#page32'], lineKeys: meridianLines.map(line => line.key),
    components: [{ label: 'Printed summary proceeds', value: summaryProceeds || 0 }, { label: 'All printed lot proceeds', value: sourceProceeds }, { label: 'Unextracted M18 proceeds', value: uniqueLots.find(lot => lot.id === 'M18')?.proceeds || 0 }] }));
  checks.push(compare({ id: 'meridian-gain', title: 'Meridian gain from full printed detail', area: 'Investments',
    engineValue: sum(meridianLines.map(line => typeof line.value === 'number' ? line.value : 0)), independentValue: sourceGain, unit: 'USD',
    method: 'For each printed M-lot compute proceeds minus basis plus reported wash-sale disallowance, then sum all unique lots.',
    detail: 'Uses only supplied printed lot amounts and explicit wash-sale disallowances. The omitted lot contributes a $60 loss; no broader basis/holding-period judgment is inferred.',
    sourceRefs: meridian.pages.filter(page => uniqueLots.some(lot => lot.page === page.page)).map(page => `doc:D31#page${page.page}`), lineKeys: ['SchD.7', 'SchD.16'],
    components: [{ label: 'Printed proceeds', value: sourceProceeds }, { label: 'Printed basis', value: sum(uniqueLots.map(lot => lot.basis)) }, { label: 'Printed wash-sale disallowances', value: sum(uniqueLots.map(lot => lot.wash)) }] }));

  const irs = packet.tax_agency_records.irs_account_transcript_2025;
  const estimateTotals = irs.map(snapshot => sum(snapshot.transactions.filter(item => item.description === 'Estimated tax payment' && typeof item.amount === 'number').map(item => Number(item.amount))));
  checks.push(compare({ id: 'irs-estimates', title: 'Federal estimates versus IRS transcript', area: 'Payments',
    engineValue: engine('F1040.26'), independentValue: estimateTotals[0] ?? null, unit: 'USD',
    method: 'Sum numeric transactions explicitly described as Estimated tax payment in each supplied IRS snapshot; exclude the extension payment and narrative assessed-return placeholders.',
    detail: estimateTotals.every(value => value === estimateTotals[0]) ? 'Both snapshots agree. Repeated snapshots are compared, never added to one another.' : 'Transcript snapshots disagree; resolve the as-of difference before recording treatment.',
    status: estimateTotals.every(value => value === estimateTotals[0]) ? undefined : 'review',
    sourceRefs: irs.map((_, index) => `agency:/irs_account_transcript_2025/${index}`), lineKeys: ['F1040.26', 'F1040.33'],
    components: estimateTotals.map((value, index) => ({ label: `IRS snapshot ${irs[index].as_of}`, value })) }));
  const ftbTotal = sum(packet.tax_agency_records.ftb_account.tax_year_2025_payments.map(payment => payment.amount));
  const ftbPrinted = [...printed('D68', 1).matchAll(/\d{4}-\d{2}-\d{2} ([\d,]+\.\d{2}) tax year (\d{4})/g)];
  const ftbPrinted2025 = sum(ftbPrinted.filter(match => match[2] === '2025').map(match => amount(match[1])));
  checks.push(compare({ id: 'ftb-estimates', title: 'California estimates assigned to tax year 2025', area: 'Payments',
    engineValue: engine('F540NR.72'), independentValue: ftbTotal, unit: 'USD',
    method: 'Sum only FTB tax_year_2025_payments, and independently parse each Web Pay confirmation by designated tax year.',
    detail: ftbPrinted2025 === ftbTotal ? 'Agency and printed 2025 designations agree. A September payment designated 2024 is excluded; no transfer is assumed.' : 'Printed confirmations and FTB 2025 ledger do not agree; manual reconciliation is required.',
    status: ftbPrinted2025 === ftbTotal ? undefined : 'review', sourceRefs: ['agency:/ftb_account', 'doc:D68#page1'], lineKeys: ['F540NR.72', 'F540NR.78'],
    components: [{ label: 'Printed confirmations designated 2025', value: ftbPrinted2025 }, { label: 'Agency 2025 payments', value: ftbTotal }] }));

  const pl = printed('D14', 1);
  const plIncome = read(pl, /Total income ([\d,]+\.\d{2})/);
  const plExpenses = read(pl, /Total expenses ([\d,]+\.\d{2})/);
  const plNet = read(pl, /Net income ([\d,]+\.\d{2})/);
  const expenseSection = pl.slice(pl.indexOf('Advertising'), pl.indexOf('Total income'));
  const expenseSum = sum([...expenseSection.matchAll(/ ([\d,]+\.\d{2})[;.]/g)].map(match => amount(match[1])));
  checks.push(compare({ id: 'books-expense-arithmetic', title: 'Book expense details versus stated expense total', area: 'Business',
    engineValue: plExpenses, independentValue: expenseSum, unit: 'USD',
    method: 'Independently sum every printed expense line in the P&L, rather than trusting the stated total.',
    detail: 'The comparison amount is the source-stated book total, not an engine tax total. Arithmetic agreement does not determine deductibility.',
    sourceRefs: ['doc:D14#page1'], lineKeys: ['SchC.28'] }));
  checks.push(compare({ id: 'books-net-arithmetic', title: 'Book net income from printed revenue and expenses', area: 'Business',
    engineValue: plNet, independentValue: plIncome !== null && plExpenses !== null ? rounded(plIncome - plExpenses) : null, unit: 'USD',
    method: 'Subtract printed P&L expenses from printed P&L income and compare with its stated net.',
    detail: 'The comparison amount is the source-stated book net. This verifies book arithmetic, not tax treatment.', sourceRefs: ['doc:D14#page1'], lineKeys: ['SchC.31'] }));
  const overlap = read(printed('D15', 3), /of which ([\d,]+\.\d{2}) arrived through Paywell/);
  checks.push(compare({ id: 'books-gross-reconciliation', title: 'Schedule C receipts versus books and deposit detail', area: 'Business',
    engineValue: engine('SchC.1'), independentValue: plIncome, unit: 'USD',
    method: 'Compare v3 gross receipts with printed P&L income; parse the card amount expressly included in the Atlas deposit in D15.',
    detail: `The deposit detail identifies ${overlap} of card receipts as already included. This explains the demonstrated overlap, while other client/print/licensing classifications still need reconciliation.`,
    sourceRefs: ['doc:D14#page1', 'doc:D15#page3', 'ev-0127'], lineKeys: ['SchC.1', 'SchC.31'], components: overlap === null ? [] : [{ label: 'Card receipts already within Atlas deposits', value: overlap }] }));
  const bookHealth = read(pl, /Insurance - health \(Erik\) ([\d,]+\.\d{2})/);
  const bookFuel = read(pl, /Car and truck - fuel ([\d,]+\.\d{2})/);
  const bookDep = read(pl, /Depreciation ([\d,]+\.\d{2})/);
  const bookMeals = read(pl, /Meals ([\d,]+\.\d{2})/);
  const gross = engine('SchC.1'), taxCar = engine('SchC.9'), taxDep = engine('SchC.13'), taxMeals = engine('SchC.24b'), office = engine('SchC.30');
  const bridgeParts = [plNet, gross, plIncome, bookHealth, bookFuel, taxCar, bookDep, taxDep, bookMeals, taxMeals, office];
  const bridge = bridgeParts.some(value => value === null) ? null : rounded(plNet! + gross! - plIncome! + bookHealth! + bookFuel! - taxCar! + bookDep! - taxDep! + bookMeals! - taxMeals! - office!);
  checks.push(compare({ id: 'books-to-tax-bridge', title: 'Book net to engine Schedule C net bridge', area: 'Business',
    engineValue: engine('SchC.31'), independentValue: bridge, unit: 'USD',
    method: 'Start with printed book net; bridge gross receipts, remove book health/fuel/depreciation/meals, substitute the supplied tax lines, and subtract home office.',
    detail: 'This is an independently recomputed bridge to the engine’s own treatments. Agreement does not validate its receipt overlap, mileage, personal-use allocations, or health eligibility. Source-corrected tax cannot be concluded from this bridge.',
    sourceRefs: ['doc:D14#page1', 'doc:D15#page3', 'doc:D23#page3', 'doc:D25#page1'], lineKeys: ['SchC.1', 'SchC.9', 'SchC.13', 'SchC.24b', 'SchC.30', 'SchC.31'],
    components: bridge === null ? [] : [{ label: 'Book net', value: plNet! }, { label: 'Engine gross less book revenue', value: gross! - plIncome! }, { label: 'Remove book health expense', value: bookHealth! }, { label: 'Fuel replaced with engine mileage', value: bookFuel! - taxCar! }, { label: 'Book depreciation replaced with engine depreciation', value: bookDep! - taxDep! }, { label: 'Book meals less engine deduction', value: bookMeals! - taxMeals! }, { label: 'Home-office deduction', value: -office! }] }));

  const corvaneCA = read(printed('D08', 1), /Box 16 ([\d,]+\.\d{2})/);
  const halvorsenW2CA = read(printed('D09', 1), /Box 16 ([\d,]+\.\d{2})/);
  const halvorsenPreMove = read(printed('D73', 1), /CA taxable wages ([\d,]+\.\d{2})/);
  checks.push(compare({ id: 'ca-w2-total', title: 'California wages versus W-2 box 16 totals', area: 'California',
    engineValue: engine('SchCA540NR.1.E'), independentValue: nullableSum([corvaneCA, halvorsenW2CA]), unit: 'USD',
    method: 'Sum box 16 as printed on both W-2s and compare with the engine allocation.',
    detail: 'Agreement only confirms the engine used payroll-state totals. D09 says payroll retained California after the move, so this is not proof of California-source income.',
    sourceRefs: ['doc:D08#page1', 'doc:D09#page1'], lineKeys: ['SchCA540NR.1.E'] }));
  checks.push(compare({ id: 'ca-pre-move-allocation', title: 'California source-allocation working comparison', area: 'California', status: 'review',
    engineValue: engine('SchCA540NR.1.E'), independentValue: nullableSum([corvaneCA, halvorsenPreMove]), unit: 'USD',
    method: 'Compare engine California wages with Corvane printed box 16 plus Halvorsen printed pre-move YTD California taxable wages.',
    detail: 'This is a working allocation requiring residency, service dates, benefits and sourcing judgment. The numerical delta is not an accepted correction or California AMT calculation.',
    sourceRefs: ['doc:D08#page1', 'doc:D09#page1', 'doc:D73#page1', 'qa-45'], lineKeys: ['SchCA540NR.1.E', 'F540NR.35'],
    components: corvaneCA === null || halvorsenPreMove === null ? [] : [{ label: 'Corvane printed CA wages', value: corvaneCA }, { label: 'Halvorsen pre-move YTD CA wages', value: halvorsenPreMove }] }));

  return masked({ version: 'v3', revision: state.revision,
    disclaimer: 'Read-only, case-specific source arithmetic against the immutable v3 baseline. Delta = comparison amount minus independent amount. Agreements verify only the named check; estimates, judgments and final tax are not recomputed. Book-total checks label their source comparison in the detail.',
    checks, summary: { agrees: checks.filter(check => check.status === 'agrees').length, mismatch: checks.filter(check => check.status === 'mismatch').length, review: checks.filter(check => check.status === 'review').length } });
}
