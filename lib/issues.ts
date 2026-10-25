import type { Issue, TaxEffect } from './contracts';

const estimate = (federal: number, california: number, detail: string): TaxEffect => ({
  federal: Math.round(federal * 100) / 100, california: Math.round(california * 100) / 100,
  method: `Estimate using supplied v3 sensitivity rates; not an engine recomputation. ${detail}`,
});
const unknown = (method: string): TaxEffect => ({ federal: null, california: null, method });

/** Curated, source-backed review queue. Seed issues are never rewritten by a decision. */
export const issues: Issue[] = [
  {
    id: 'duplicate-interest', title: 'The same $1,840 interest appears twice', area: 'Investments', severity: 'high', kind: 'adjustment',
    description: 'Northlake’s consolidated statement and bank 1099-INT describe the same bank sweep, recipient and amount. v3 includes both. Remove the second reporting instance; retain both documents as evidence.',
    original: 1840, proposed: 0, unit: 'USD interest duplicate', sourceRefs: ['ev-0492', 'ev-0538', 'doc:D28#page1', 'doc:D29#page1'],
    lineKeys: ['SchB.1.2', 'F1040.2b'], taxEffect: estimate(-1840 * .348, -1840 * .069, 'Remove $1,840 interest once.'),
  },
  {
    id: 'receipts-overlap', title: '1099-K adds receipts already in the books', area: 'Business', severity: 'high', kind: 'adjustment',
    description: 'D15 identifies all $12,400 of Paywell card receipts as part of Atlas’s $41,200, already recorded in sales. v3 adds that 1099-K again. The proposed $151,300 removes only this demonstrated overlap; print/licensing versus small-client classifications still require ledger reconciliation.',
    original: 163700, proposed: 151300, unit: 'USD gross receipts', sourceRefs: ['ev-0103', 'ev-0109', 'ev-0110', 'ev-0127', 'doc:D15#page3'],
    lineKeys: ['SchC.1', 'SchC.31'], taxEffect: estimate(-12400 * .355, -12400 * .031, 'Remove overlapping card receipts; business/QBI interactions may change the combined result.'),
  },
  {
    id: 'duplicate-mileage', title: 'A second scan adds 3,700 business miles', area: 'Business', severity: 'high', kind: 'adjustment',
    description: 'Mileage log page 3 explicitly repeats page 2. Unique page totals are 2,600 + 3,700 + 1,800 = 8,100 miles; v3 sums 11,800. Odometer movement is 17,740 miles. Retain the duplicate page with a reason unused.',
    original: 11800, proposed: 8100, unit: 'business miles', sourceRefs: ['ev-0226', 'ev-0315', 'ev-0404', 'ev-0477', 'doc:D23#page3'],
    lineKeys: ['SchC.44a', 'SchC.9', 'SchC.31'], taxEffect: estimate(2590 * .355, 2590 * .031, '3,700 fewer miles × supplied $0.70 rate increases modeled profit $2,590.'),
  },
  {
    id: 'federal-payments', title: 'Federal estimates exceed the transcript by $1,000', area: 'Payments', severity: 'high', kind: 'adjustment',
    description: 'The client recalled a $4,000 January payment. Both IRS transcript snapshots instead show four $3,000 estimates: $12,000 total, with the last on January 15. This changes payments and balance due, not tax liability.',
    original: 13000, proposed: 12000, unit: 'USD federal payments', sourceRefs: ['qa-41', 'agency:/irs_account_transcript_2025/0', 'doc:D67#page1'],
    lineKeys: ['F1040.26', 'F1040.33', 'F1040.37'], taxEffect: { federal: 0, california: 0, method: 'Payment reconciliation: federal tax unchanged; federal balance due increases $1,000 exactly before penalties/interest.' },
  },
  {
    id: 'california-payments', title: 'A $3,500 payment is assigned to 2024', area: 'Payments', severity: 'high', kind: 'adjustment',
    description: 'September 15’s California payment was designated 2024 and remains a 2024 credit in the agency account. Only $10,500 is posted to 2025. A transfer requires separate resolution; do not assume it has happened.',
    original: 14000, proposed: 10500, unit: 'USD California payments', sourceRefs: ['ev-1075', 'ev-1076', 'agency:/ftb_account', 'doc:D68#page1'],
    lineKeys: ['F540NR.72', 'F540NR.78'], taxEffect: { federal: 0, california: 0, method: 'Payment attribution: tax unchanged; California overpayment decreases $3,500 exactly before any agency transfer.' },
  },
  {
    id: 'mortgage-payoff', title: 'Payoff interest is included in the lender’s 1098', area: 'Deductions', severity: 'high', kind: 'adjustment',
    description: 'D55’s $13,900 mortgage interest expressly includes the November payoff interest. D56 repeats that $2,150 and v3 adds it again. This proposal removes that duplicate; purchase and refinance points remain separately reviewable.',
    original: 21847, proposed: 19697, unit: 'USD mortgage interest and purchase points', sourceRefs: ['ev-1029', 'ev-1032', 'doc:D55#page1', 'doc:D56#page1'],
    lineKeys: ['SchA.8a', 'SchA.8e', 'SchA.17'], taxEffect: estimate(2150 * .26, 2150 * .048, 'Deduction decreases $2,150.'),
  },
  {
    id: 'donated-car', title: 'The charity sold the car for $2,900', area: 'Deductions', severity: 'high', kind: 'adjustment',
    description: 'The engine uses the client’s $6,000 value estimate. Form 1098-C records an arm’s-length sale and $2,900 proceeds. Use the supplied acknowledgment and packet rule for the reviewed deduction, preserving the original estimate.',
    original: 6000, proposed: 2900, unit: 'USD car gift deduction', sourceRefs: ['qa-39', 'ev-1054', 'doc:D66#page1', 'call-01'],
    lineKeys: ['SchA.12', 'SchA.14'], taxEffect: estimate(3100 * .26, 3100 * .048, 'Deduction decreases $3,100; other noncash stock gift is separate.'),
  },
  {
    id: 'ca-wage-allocation', title: 'Payroll continued California withholding after the move', area: 'California', severity: 'high', kind: 'judgment',
    description: 'v3 uses $218,400 total W-2 California wages. D73 shows Halvorsen pre-move taxable wages of $22,469, versus box 16 of $111,300. A working allocation of Corvane $107,100 plus Halvorsen $22,469 is $129,569, subject to move-date, source and benefit review. Withholding does not itself establish California-source wages.',
    original: 218400, proposed: 129569, unit: 'USD California wage allocation', sourceRefs: ['ev-0030', 'ev-0047', 'ev-1081', 'qa-45', 'doc:D73#page1'],
    lineKeys: ['SchCA540NR.1.E', 'F540NR.35'], taxEffect: estimate(0, -88831 * .064, 'Source-allocation sensitivity only; not a verified final wage allocation or California AMT computation.'),
  },
  {
    id: 'swedish-fx', title: 'Swedish interest uses last year’s exchange rate', area: 'Foreign', severity: 'medium', kind: 'adjustment',
    description: 'v3 converts SEK 18,450 at the supplied 2024 average of 10.56. The packet’s 2025 average is 9.86, yielding approximately $1,871 instead of $1,747. Foreign-account reporting is a separate review.',
    original: 1747, proposed: 1871, unit: 'USD taxable interest, rounded', sourceRefs: ['ev-0960', 'ref:fx.SEK.2025_average', 'doc:D36#page1'],
    lineKeys: ['SchB.1.6', 'F1040.2b'], taxEffect: estimate(124 * .348, 124 * .069, 'Uses rounded $124 income change and supplied FX; not an independently sourced exchange rate.'),
  },
  {
    id: 'provider-identifier', title: 'A 99% confidence read transposes the provider’s ID', area: 'Credits', severity: 'medium', kind: 'check',
    description: 'Little Sprouts’ printed EIN and ev-1045 differ by transposed digits, despite confidence 0.99. The same incorrect identifier reaches Form 2441. Compare the masked source and extraction; record a source-backed correction without exposing the full identifier.',
    original: null, proposed: null, unit: 'identifier verification', sourceRefs: ['ev-1045', 'doc:D62#page1'],
    lineKeys: ['F2441.1b'], taxEffect: { federal: 0, california: 0, method: 'Identity correction; no modeled tax effect. Full identifiers remain masked.' },
  },
  {
    id: 'hvac-classification', title: 'A whole HVAC system was booked as a repair', area: 'Rentals', severity: 'high', kind: 'judgment',
    description: 'The manager’s $13,300 repairs already include the $11,000 heat pump replacement. D47 and the client call describe replacement of the entire furnace/AC system. The supplied capitalization alternative removes $11,000 expense and adds $150 depreciation; classification needs a documented decision and authority.',
    original: 13300, proposed: 2300, unit: 'USD immediate repairs before depreciation', sourceRefs: ['ev-1000', 'ev-1001', 'ev-1004', 'doc:D47#page1', 'call-01'],
    lineKeys: ['SchE.14A', 'SchE.18A'], taxEffect: { federal: 3633, california: 896, method: 'Exact supplied what_if HVAC alternative relative to uncorrected v3 only; not additive to other alternatives or a final combined recomputation.' },
  },
  {
    id: 'crypto-basis', title: 'Transferred Bitcoin has no substantiated basis', area: 'Digital assets', severity: 'high', kind: 'judgment',
    description: 'C6 sold for $5,325 but its transfer-in record has null acquisition date and cost. The engine assumes zero basis. A later scripted client message recalls a March 2021 purchase for about $3,050 and a bank debit; the trade record is missing. Preserve uncertainty and assess substantiation before adopting the recollection.',
    original: 0, proposed: null, unit: 'USD cost basis, unresolved', sourceRefs: ['ev-0918', 'ev-0919', 'doc:D35#page1', 'msg-07'],
    lineKeys: ['F8949.H.C6', 'SchD.7', 'SchD.15'], taxEffect: unknown('Not quantified: basis and holding period require an evidence-backed judgment; the approximately $3,050 client recollection is not an accepted source amount.'),
  },
  {
    id: 'health-premiums', title: 'Employer family coverage was available', area: 'Retirement & health', severity: 'high', kind: 'judgment',
    description: 'v3 deducts $14,400 self-employed health insurance. The organizer says both of Ngozi’s employers offered family coverage and Erik chose an individual plan. Review the packet’s eligibility rule and covered periods before retaining the deduction; this is distinct from the business book expense.',
    original: 14400, proposed: 0, unit: 'USD self-employed health deduction', sourceRefs: ['qa-25', 'ev-0484', 'doc:D25#page1'],
    lineKeys: ['Sch1.17', 'F1040.10'], taxEffect: unknown('Not quantified as a final combined effect: removing the deduction also changes business-linked QBI and can cross thresholds.'),
  },
  {
    id: 'parish-substantiation', title: 'A low-confidence gift amount has later corroboration', area: 'Deductions', severity: 'medium', kind: 'check',
    description: 'The handwritten receipt’s first digit is ambiguous and the $1,500 extraction has confidence 0.41. A later scripted message confirms $1,500 by phone and references a bank check. The receipt lacks a goods/services statement, and the cited bank statement is not separately included. Amount confirmation and substantiation sufficiency are separate questions.',
    original: 1500, proposed: null, unit: 'USD cash gift evidence', sourceRefs: ['ev-1049', 'doc:D64#page1', 'msg-08'],
    lineKeys: ['SchA.11'], taxEffect: unknown('No automatic change: review amount evidence and required acknowledgment before recording a decision.'),
  },
  {
    id: 'rsu-basis', title: 'Blank broker basis hides $47,620 of RSU cost', area: 'Stock compensation', severity: 'high', kind: 'adjustment',
    description: 'The broker reports no basis for RSU lots N1, N3 and N4; the pipeline normalizes those blank fields to zero at 0.98 confidence. D11 gives adjusted bases $19,100, $19,100 and $9,420. Add the $47,620 supported basis once; it was already reflected in wage compensation. The separate ESPP lot needs its own $675 basis adjustment.',
    original: 0, proposed: 47620, unit: 'USD combined basis for three RSU lots', sourceRefs: ['ev-0498', 'ev-0516', 'ev-0525', 'ev-0066', 'ev-0068', 'ev-0070', 'doc:D11#page2'],
    lineKeys: ['F8949.B.N1', 'F8949.B.N3', 'F8949.E.N4'], taxEffect: estimate(-38200 * .348 - 9420 * .238, -47620 * .034, 'Mixed short-/long-term basis correction; category rates are approximate, and California sourcing/threshold interactions need review.'),
  },
  {
    id: 'missing-brokerage-page', title: 'An unread final page explains the $250 proceeds gap', area: 'Investments', severity: 'medium', kind: 'adjustment',
    description: 'Corrected Meridian summary proceeds are $71,965, while extracted lots total $71,715. Page 32 was not extracted: lot M18 has $250 proceeds and $310 basis, producing a $60 short-term noncovered loss. The source is present even though no extracted field or engine lot exists.',
    original: 0, proposed: -60, unit: 'USD additional short-term gain/(loss)', sourceRefs: ['ev-0703', 'doc:D31#page32', 'doc:D31#page10'],
    lineKeys: ['SchD.7', 'SchD.16'], taxEffect: estimate(-60 * .348, -60 * .034, 'Add omitted $250 proceeds and $310 basis; proposed amount is the resulting $60 loss, not proceeds.'),
  },
];

export const getIssue = (id: string): Issue => {
  const issue = issues.find(item => item.id === id);
  if (!issue) throw new Error('That review issue does not exist.');
  return issue;
};
