/* ============================================================================
   FIN 740 — Corporate Finance Toolkit
   Calculation engine, educational content, and UI renderer.
   All formulas mirror the FIN 740 Formula Sheet (Berk & DeMarzo conventions).
   ========================================================================== */

'use strict';

/* ----------------------------- Formatting -------------------------------- */
const fmtMoney = (x) => {
  if (x === null || x === undefined || isNaN(x)) return '—';
  const sign = x < 0 ? '-' : '';
  const a = Math.abs(x);
  return sign + '$' + a.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
};
const fmtMoney0 = (x) => {
  if (x === null || x === undefined || isNaN(x)) return '—';
  const sign = x < 0 ? '-' : '';
  return sign + '$' + Math.abs(x).toLocaleString('en-US', { maximumFractionDigits: 0 });
};
const fmtPct = (x, d = 2) => (x === null || x === undefined || isNaN(x)) ? '—' : (x * 100).toFixed(d) + '%';
const fmtNum = (x, d = 4) => (x === null || x === undefined || isNaN(x)) ? '—' : (+x).toLocaleString('en-US', { maximumFractionDigits: d });
const fmtYears = (x) => (x === null || x === undefined || isNaN(x) || !isFinite(x)) ? '—' : (+x).toFixed(2) + ' yrs';

/* ----------------------------- Math engine ------------------------------- */
function pvStream(rate, cfs) {            // cfs[0] is time 0
  let pv = 0;
  for (let t = 0; t < cfs.length; t++) pv += cfs[t] / Math.pow(1 + rate, t);
  return pv;
}
function pvAnnuity(C, r, N) {
  if (r === 0) return C * N;
  return C * (1 / r) * (1 - 1 / Math.pow(1 + r, N));
}
function annuityPayment(PV, r, N) {
  if (r === 0) return PV / N;
  return PV * r / (1 - Math.pow(1 + r, -N));
}
function pvGrowingAnnuity(C, r, g, N) {
  if (Math.abs(r - g) < 1e-12) return C * N / (1 + r);
  return C * (1 / (r - g)) * (1 - Math.pow((1 + g) / (1 + r), N));
}
function irr(cfs) {
  // Bisection on NPV(rate). Returns decimal or null if none found.
  const npv = (r) => pvStream(r, cfs);
  let lo = -0.9999, hi = 10.0;
  let flo = npv(lo), fhi = npv(hi);
  if (isNaN(flo) || isNaN(fhi)) return null;
  if (flo * fhi > 0) {
    // scan for a sign change
    let prev = lo, fprev = flo, found = false;
    for (let r = -0.99; r <= 10; r += 0.01) {
      const f = npv(r);
      if (fprev * f <= 0) { lo = prev; hi = r; flo = fprev; fhi = f; found = true; break; }
      prev = r; fprev = f;
    }
    if (!found) return null;
  }
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2, fm = npv(mid);
    if (Math.abs(fm) < 1e-9) return mid;
    if (flo * fm < 0) { hi = mid; fhi = fm; } else { lo = mid; flo = fm; }
  }
  return (lo + hi) / 2;
}
function paybackPeriod(cfs, discounted, rate) {
  let cum = 0;
  for (let t = 0; t < cfs.length; t++) {
    const flow = discounted ? cfs[t] / Math.pow(1 + rate, t) : cfs[t];
    const prev = cum; cum += flow;
    if (cum >= 0 && prev < 0) {
      const need = -prev;
      return (t - 1) + need / flow;   // fractional period within year t
    }
  }
  return Infinity;
}
function parseFlows(str) {
  if (!str) return [];
  return str.split(/[\s,;\n]+/).filter(s => s.length).map(Number).filter(n => !isNaN(n));
}

/* ----------------------------- UI helpers -------------------------------- */
const frac = (n, d) => `<span class="frac"><span class="top">${n}</span><span class="bot">${d}</span></span>`;
const sup = (b, e) => `${b}<sup>${e}</sup>`;

/* Load an .xlsx template: from an embedded base64 blob (single-file build) if
   present, otherwise by fetching the file (hosted/PWA build). */
async function appLoadTemplate(name) {
  if (window.__TEMPLATES && window.__TEMPLATES[name]) {
    const bin = atob(window.__TEMPLATES[name]);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return arr.buffer;
  }
  const r = await fetch('./' + name);
  if (!r.ok) throw new Error(name + ' not found');
  return r.arrayBuffer();
}

/* A formula block that can toggle between a compact and an expanded form. */
function formulaBlock(compact, expanded) {
  if (!expanded) return `<div class="formula">${compact}</div>`;
  return `<div class="formula-wrap">
    <div class="formula">${compact}</div>
    <div class="formula formula-exp" hidden>${expanded}</div>
    <button class="formula-toggle" type="button">Show expanded ⌄</button>
  </div>`;
}

/* Convert "X_Y" → subscript and "…^Y" → superscript in rendered text. */
const SUBSUP = /([A-Za-z]_[A-Za-z0-9]{1,4}|\^[A-Za-z0-9]{1,3})/;  // non-global: .test() must not carry lastIndex
function applySubscripts(root) {
  if (!root) return;
  const skip = { SCRIPT: 1, STYLE: 1, OPTION: 1, SELECT: 1, TEXTAREA: 1, INPUT: 1, SUB: 1, SUP: 1 };
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      if (!n.nodeValue || (n.nodeValue.indexOf('_') < 0 && n.nodeValue.indexOf('^') < 0)) return NodeFilter.FILTER_REJECT;
      if (n.parentNode && skip[n.parentNode.nodeName]) return NodeFilter.FILTER_REJECT;
      return SUBSUP.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  const targets = []; let n; while ((n = walker.nextNode())) targets.push(n);
  targets.forEach((node) => {
    const frag = document.createDocumentFragment();
    node.nodeValue.split(SUBSUP).forEach((part) => {
      const sub = part.match(/^([A-Za-z])_([A-Za-z0-9]{1,4})$/);
      const sup = part.match(/^\^([A-Za-z0-9]{1,3})$/);
      if (sub) { frag.appendChild(document.createTextNode(sub[1])); const e = document.createElement('sub'); e.textContent = sub[2]; frag.appendChild(e); }
      else if (sup) { const e = document.createElement('sup'); e.textContent = sup[1]; frag.appendChild(e); }
      else if (part) frag.appendChild(document.createTextNode(part));
    });
    node.parentNode.replaceChild(frag, node);
  });
}
let _subObserver;
function initSubscripts() {
  const main = document.getElementById('main'); if (!main) return;
  applySubscripts(main);
  _subObserver = new MutationObserver(() => { _subObserver.disconnect(); applySubscripts(main); _subObserver.observe(main, { childList: true, subtree: true }); });
  _subObserver.observe(main, { childList: true, subtree: true });
}

/* ===========================================================================
   CALCULATOR DEFINITIONS
   Each: { id, group, title, formula, learn{whatItIs, inputs[], how, meaning,
           application}, fields[], compute(v) -> {primary, rows[], note} }
   =========================================================================== */
const GROUPS = [
  { id: 'tvm',   label: 'Time Value' },
  { id: 'invest',label: 'Investing' },
  { id: 'fcf',   label: 'Free Cash Flow' },
  { id: 'coc',   label: 'Cost of Capital' },
  { id: 'val',   label: 'Valuation' },
  { id: 'stk',   label: 'Stocks' },
  { id: 'pf',    label: 'Pro Forma' },
  { id: 'fr',    label: 'Final Report' },
  { id: 'search',label: '🔎 Search' },
];

const CALCS = [];

/* ----------------------------- TIME VALUE -------------------------------- */
CALCS.push({
  id: 'pv-annuity', group: 'tvm', title: 'Present Value of an Annuity',
  formula: `PV = C × ${frac('1', 'r')} ( 1 − ${frac('1', sup('(1+r)', 'N'))} )`,
  learn: {
    whatItIs: 'The value today of a stream of equal cash flows (C) paid once per period for N periods — e.g., a fixed loan payment, lease, or level pension.',
    inputs: [
      ['Payment (C)', 'The equal cash flow received or paid each period. Must use the same period length as the rate (monthly payment ↔ monthly rate).'],
      ['Rate (r)', 'The discount rate / opportunity cost of capital per period, as a percent.'],
      ['Periods (N)', 'The number of equal payments.'],
    ],
    how: 'Each payment is discounted back to today and summed. The closed form replaces an N-term sum with one expression: the value of a perpetuity (C/r) minus the value of a perpetuity that starts after period N.',
    meaning: 'The single lump sum today that is financially equivalent to receiving C every period for N periods. If someone offered you this PV in cash instead of the payments, you should be indifferent.',
    application: 'Pricing loans and mortgages, valuing leases, retirement planning, and turning a series of equal future receipts into one comparable number you can put next to an upfront cost.',
  },
  fields: [
    { id: 'C', label: 'Payment per period (C)', def: 1000, money: true },
    { id: 'r', label: 'Rate per period (r)', def: 6, pct: true },
    { id: 'N', label: 'Number of periods (N)', def: 10 },
  ],
  compute: (v) => {
    const pv = pvAnnuity(v.C, v.r, v.N);
    return { primary: { label: 'Present Value', value: fmtMoney(pv) },
      rows: [
        ['Total of all payments', fmtMoney(v.C * v.N)],
        ['Total discount (interest)', fmtMoney(v.C * v.N - pv)],
      ],
      note: `Receiving ${fmtMoney(v.C)} for ${v.N} periods at ${fmtPct(v.r)} is worth ${fmtMoney(pv)} today.` };
  },
});

CALCS.push({
  id: 'annuity-payment', group: 'tvm', title: 'Loan / Annuity Payment',
  formula: `C = ${frac('PV × r', '1 − ' + sup('(1+r)', '−N'))}`,
  learn: {
    whatItIs: 'The level payment that pays off (amortizes) a present amount over N periods — the inverse of the annuity PV formula. This is how a mortgage or car-loan payment is found.',
    inputs: [
      ['Present value (PV)', 'The amount borrowed today (the loan principal) or the lump sum to be spread out.'],
      ['Rate (r)', 'The interest rate per payment period.'],
      ['Periods (N)', 'The number of payments.'],
    ],
    how: 'Solve the annuity PV equation for C. The payment is large enough that the discounted value of all N payments exactly equals the amount borrowed today.',
    meaning: 'The constant amount due each period so the loan is fully repaid (principal + interest) by the final payment.',
    application: 'Sizing loan, mortgage, and lease payments; building amortization schedules; checking whether a financing offer is affordable.',
  },
  fields: [
    { id: 'PV', label: 'Loan amount / present value', def: 250000, money: true },
    { id: 'r', label: 'Rate per period (r)', def: 0.5, pct: true },
    { id: 'N', label: 'Number of payments (N)', def: 360 },
  ],
  compute: (v) => {
    const C = annuityPayment(v.PV, v.r, v.N);
    return { primary: { label: 'Payment per period', value: fmtMoney(C) },
      rows: [
        ['Total paid over life', fmtMoney(C * v.N)],
        ['Total interest', fmtMoney(C * v.N - v.PV)],
      ],
      note: `A ${fmtMoney(v.PV)} loan at ${fmtPct(v.r)}/period over ${v.N} payments costs ${fmtMoney(C)} each period.` };
  },
});

CALCS.push({
  id: 'pv-growing-annuity', group: 'tvm', title: 'PV of a Growing Annuity',
  formula: `PV = C × ${frac('1', 'r − g')} ( 1 − ${sup('(' + frac('1+g', '1+r') + ')', 'N')} )`,
  learn: {
    whatItIs: 'The value today of N cash flows that grow at a constant rate g each period. The first cash flow C arrives one period from now.',
    inputs: [
      ['First cash flow (C)', 'The payment one period from today. Later payments grow by g each period.'],
      ['Rate (r)', 'The per-period discount rate.'],
      ['Growth (g)', 'The constant per-period growth rate of the cash flows (can be negative).'],
      ['Periods (N)', 'Number of payments.'],
    ],
    how: 'Like an annuity, but each term grows by (1+g). When r ≠ g the closed form applies; when r = g, PV = C·N/(1+r).',
    meaning: 'Today’s equivalent of a rising payment stream — useful when payments are indexed to inflation or expected to grow with a business.',
    application: 'Valuing salaries or rents that escalate, growing dividend streams over a finite horizon, and projects whose cash flows ramp at a steady rate.',
  },
  fields: [
    { id: 'C', label: 'First cash flow (C₁)', def: 1000, money: true },
    { id: 'r', label: 'Rate (r)', def: 8, pct: true },
    { id: 'g', label: 'Growth (g)', def: 3, pct: true },
    { id: 'N', label: 'Periods (N)', def: 20 },
  ],
  compute: (v) => {
    const pv = pvGrowingAnnuity(v.C, v.r, v.g, v.N);
    return { primary: { label: 'Present Value', value: fmtMoney(pv) },
      rows: [['Final (Nth) cash flow', fmtMoney(v.C * Math.pow(1 + v.g, v.N - 1))]],
      note: v.r <= v.g ? 'Note: with r ≤ g this finite stream still converges, but a growing perpetuity would not.' : '' };
  },
});

CALCS.push({
  id: 'perpetuity', group: 'tvm', title: 'Perpetuity & Growing Perpetuity',
  formula: `PV = ${frac('C', 'r')}  &nbsp;&nbsp;|&nbsp;&nbsp;  PV = ${frac('C', 'r − g')}`,
  learn: {
    whatItIs: 'A perpetuity pays a fixed cash flow C every period forever; a growing perpetuity pays C next period and grows it at g forever. Leave growth at 0 for a level perpetuity.',
    inputs: [
      ['Cash flow (C)', 'The payment one period from now (for a growing perpetuity, the first payment before growth).'],
      ['Rate (r)', 'The per-period discount rate. Must exceed g for a growing perpetuity to have a finite value.'],
      ['Growth (g)', 'Constant perpetual growth rate. Set to 0 for a level perpetuity.'],
    ],
    how: 'An infinite discounted sum collapses to a single ratio: C/r, or C/(r−g) when it grows. This is the engine behind terminal values and the dividend-growth model.',
    meaning: 'The price today of an endless income stream. Small changes in r or g move the value a lot, because the cash flows never stop.',
    application: 'Terminal values in DCF, valuing consols/preferred stock, the Gordon dividend model, and quick “rule-of-thumb” valuations of stable cash streams.',
  },
  fields: [
    { id: 'C', label: 'Cash flow (C)', def: 100, money: true },
    { id: 'r', label: 'Rate (r)', def: 8, pct: true },
    { id: 'g', label: 'Growth (g)', def: 0, pct: true },
  ],
  compute: (v) => {
    if (v.g >= v.r) return { primary: { label: 'Present Value', value: '— (needs r > g)' }, rows: [], note: 'A growing perpetuity only has a finite value when the discount rate exceeds the growth rate.' };
    const pv = v.C / (v.r - v.g);
    return { primary: { label: 'Present Value', value: fmtMoney(pv) },
      rows: [['Implied yield (C/PV)', fmtPct(v.C / pv)]],
      note: v.g === 0 ? 'Level perpetuity (no growth).' : `Growing forever at ${fmtPct(v.g)}.` };
  },
});

CALCS.push({
  id: 'fv', group: 'tvm', title: 'Future Value (Compounding)',
  formula: `FV = PV × ${sup('(1+r)', 'N')} &nbsp;(+ annuity)`,
  learn: {
    whatItIs: 'How much a lump sum today — plus optional equal contributions — grows to after N periods of compounding.',
    inputs: [
      ['Present value (PV)', 'The amount invested today.'],
      ['Rate (r)', 'The per-period return / interest rate.'],
      ['Periods (N)', 'Number of compounding periods.'],
      ['Contribution (C)', 'Optional equal amount added at the end of each period.'],
    ],
    how: 'The lump sum grows by (1+r) each period; the contributions form an ordinary annuity whose future value is C·[((1+r)^N − 1)/r].',
    meaning: 'The ending balance — what your money becomes once interest has compounded on interest.',
    application: 'Savings and retirement projections, comparing investment growth, and understanding the cost of waiting to invest.',
  },
  fields: [
    { id: 'PV', label: 'Present value (PV)', def: 10000, money: true },
    { id: 'r', label: 'Rate (r)', def: 7, pct: true },
    { id: 'N', label: 'Periods (N)', def: 30 },
    { id: 'C', label: 'Contribution per period (C)', def: 0, money: true },
  ],
  compute: (v) => {
    const fvLump = v.PV * Math.pow(1 + v.r, v.N);
    const fvAnn = v.r === 0 ? v.C * v.N : v.C * (Math.pow(1 + v.r, v.N) - 1) / v.r;
    const fv = fvLump + fvAnn;
    return { primary: { label: 'Future Value', value: fmtMoney(fv) },
      rows: [
        ['From lump sum', fmtMoney(fvLump)],
        ['From contributions', fmtMoney(fvAnn)],
        ['Total contributed', fmtMoney(v.PV + v.C * v.N)],
      ] };
  },
});

/* --------------------------- INVESTMENT RULES ---------------------------- */
CALCS.push({
  id: 'npv-irr', group: 'invest', title: 'NPV, IRR & Payback',
  formula: `NPV = Σ ${frac('C_t', '(1+r)^t')}`,
  expanded: `NPV = C_0 + ${frac('C_1', '(1+r)')} + ${frac('C_2', '(1+r)^2')} + ⋯ + ${frac('C_N', '(1+r)^N')};  IRR sets NPV = 0`,
  learn: {
    whatItIs: 'The core project-decision toolkit. Enter the full cash-flow stream (the time-0 flow is usually the negative initial investment) and a discount rate to get NPV, IRR, profitability index, and payback.',
    inputs: [
      ['Discount rate (r)', 'The project’s cost of capital — typically the WACC for a project of average risk.'],
      ['Cash flows', 'One number per period starting at time 0. The first is usually negative (the investment); separate with commas, spaces, or new lines.'],
    ],
    how: 'NPV discounts every cash flow to today and sums them. IRR is the rate that makes NPV exactly zero (found numerically). Profitability index = PV of inflows ÷ initial outlay. Payback counts the years until cumulative cash flow turns positive.',
    meaning: 'NPV is the dollar value the project adds to the firm today. IRR is the project’s built-in annualized return. PI is value created per dollar invested. Payback is how fast you get your money back (a liquidity, not value, measure).',
    application: 'Capital budgeting: accept a project when NPV > 0; rank mutually exclusive projects by NPV. Use IRR to communicate a return but defer to NPV when they conflict. Watch for multiple IRRs when cash flows change sign more than once.',
  },
  fields: [
    { id: 'r', label: 'Discount rate (r)', def: 10, pct: true },
    { id: 'cfs', label: 'Cash flows (C₀, C₁, …)', def: '-1000, 300, 400, 500, 600', text: true },
  ],
  compute: (v) => {
    const cfs = parseFlows(v.cfs);
    if (cfs.length < 2) return { primary: { label: 'NPV', value: '—' }, rows: [], note: 'Enter at least two cash flows (time 0 and beyond).' };
    const npv = pvStream(v.r, cfs);
    const rate = irr(cfs);
    const outlay = cfs[0] < 0 ? -cfs[0] : 0;
    const pvIn = pvStream(v.r, cfs.map((c, t) => t === 0 ? 0 : c));
    const pi = outlay ? pvIn / outlay : NaN;
    const pb = paybackPeriod(cfs, false, v.r);
    const dpb = paybackPeriod(cfs, true, v.r);
    return { primary: { label: 'NPV', value: fmtMoney(npv), good: npv >= 0 },
      rows: [
        ['IRR', rate === null ? '— (no sign change)' : fmtPct(rate)],
        ['Profitability index', isNaN(pi) ? '—' : fmtNum(pi, 3)],
        ['Payback period', fmtYears(pb)],
        ['Discounted payback', fmtYears(dpb)],
        ['Decision (NPV rule)', npv >= 0 ? '✅ Accept' : '❌ Reject'],
      ],
      note: rate !== null && Math.abs(rate - v.r) < 0.005 ? 'IRR ≈ discount rate, so NPV is near zero — a marginal project.' : '' };
  },
});

/* ----------------------------- FREE CASH FLOW ---------------------------- */
CALCS.push({
  id: 'unlevered-ni', group: 'fcf', title: 'Unlevered Net Income & EBIT',
  formula: `EBIT = Rev − Costs − Dep &nbsp;•&nbsp; UNI = EBIT × (1 − T)`,
  learn: {
    whatItIs: 'Earnings as if the project were financed entirely with equity (no interest). “Unlevered” strips out financing so the project is judged on its operating merits.',
    inputs: [
      ['Revenues', 'Incremental sales the project generates.'],
      ['Operating costs', 'Incremental cash operating expenses (COGS, SG&A) — exclude depreciation and interest.'],
      ['Depreciation', 'The non-cash expense from writing down capital assets; it lowers taxable income.'],
      ['Tax rate (T)', 'The marginal corporate tax rate.'],
    ],
    how: 'EBIT = Revenues − operating costs − depreciation. Unlevered net income = EBIT × (1 − T). Interest is deliberately excluded so the financing decision doesn’t contaminate the investment decision.',
    meaning: 'The after-tax operating profit attributable to the project itself, before adding back non-cash charges and investment in assets/working capital.',
    application: 'The first line of a free-cash-flow build. Keeping it unlevered lets you discount at the WACC, which already accounts for the financing mix.',
  },
  fields: [
    { id: 'rev', label: 'Incremental revenues', def: 10000000, money: true },
    { id: 'costs', label: 'Operating costs (ex-dep)', def: 6000000, money: true },
    { id: 'dep', label: 'Depreciation', def: 1500000, money: true },
    { id: 'T', label: 'Tax rate (T)', def: 25, pct: true },
  ],
  compute: (v) => {
    const ebit = v.rev - v.costs - v.dep;
    const uni = ebit * (1 - v.T);
    return { primary: { label: 'Unlevered Net Income', value: fmtMoney(uni) },
      rows: [
        ['EBIT', fmtMoney(ebit)],
        ['Taxes on EBIT', fmtMoney(ebit * v.T)],
      ] };
  },
});

CALCS.push({
  id: 'fcf', group: 'fcf', title: 'Free Cash Flow',
  formula: `FCF = UNI + Dep − CapEx − ΔNWC`,
  learn: {
    whatItIs: 'The actual cash a project throws off in a period, available to all investors. It converts accounting profit into cash by adding back non-cash charges and subtracting real investment.',
    inputs: [
      ['EBIT', 'Operating profit before interest and tax (Revenues − costs − depreciation).'],
      ['Tax rate (T)', 'Marginal tax rate, applied to EBIT to get unlevered net income.'],
      ['Depreciation', 'Added back because it reduced taxable income but isn’t a cash outflow.'],
      ['CapEx', 'Cash spent on long-term assets this period — a real outflow.'],
      ['ΔNWC', 'The increase in net working capital (inventory + receivables − payables). Growth ties up cash.'],
    ],
    how: 'Start from EBIT, tax it to get unlevered net income, add back depreciation (non-cash), then subtract capital expenditures and the change in net working capital.',
    meaning: 'The cash genuinely freed up (or consumed) by the project this period — the quantity you discount in a DCF.',
    application: 'Each year’s FCF is discounted at the WACC to value a project or firm. Positive early FCF improves NPV; heavy CapEx or working-capital build delays it.',
  },
  fields: [
    { id: 'ebit', label: 'EBIT', def: 2500000, money: true },
    { id: 'T', label: 'Tax rate (T)', def: 25, pct: true },
    { id: 'dep', label: 'Depreciation', def: 1500000, money: true },
    { id: 'capex', label: 'Capital expenditures', def: 1000000, money: true },
    { id: 'dnwc', label: 'Change in NWC (ΔNWC)', def: 200000, money: true },
  ],
  compute: (v) => {
    const uni = v.ebit * (1 - v.T);
    const fcf = uni + v.dep - v.capex - v.dnwc;
    return { primary: { label: 'Free Cash Flow', value: fmtMoney(fcf), good: fcf >= 0 },
      rows: [
        ['Unlevered net income', fmtMoney(uni)],
        ['+ Depreciation', fmtMoney(v.dep)],
        ['− CapEx', fmtMoney(-v.capex)],
        ['− ΔNWC', fmtMoney(-v.dnwc)],
      ] };
  },
});

CALCS.push({
  id: 'salvage', group: 'fcf', title: 'After-Tax Salvage Value',
  formula: `After-tax CF = Sale Price − T × (Sale Price − Book Value)`,
  learn: {
    whatItIs: 'The cash you keep after selling an asset, once taxes on any gain (or savings from a loss) are settled.',
    inputs: [
      ['Sale price', 'What the asset is sold for at the end of the project.'],
      ['Book value', 'The remaining undepreciated value on the books. If fully depreciated, book value is 0.'],
      ['Tax rate (T)', 'The marginal tax rate applied to the gain.'],
    ],
    how: 'Capital gain = Sale price − book value. Tax = T × gain. After-tax cash flow = sale price − tax. A sale above book triggers tax; a sale below book generates a tax shield (the formula handles both via a negative gain).',
    meaning: 'The true terminal cash inflow from disposing of an asset — what actually lands in the bank after the tax authority takes its share.',
    application: 'The final-year FCF in capital budgeting often includes after-tax salvage. Forgetting the tax on the gain overstates NPV.',
  },
  fields: [
    { id: 'sale', label: 'Sale price', def: 1800000, money: true },
    { id: 'book', label: 'Book value', def: 0, money: true },
    { id: 'T', label: 'Tax rate (T)', def: 25, pct: true },
  ],
  compute: (v) => {
    const gain = v.sale - v.book;
    const tax = gain * v.T;
    const atcf = v.sale - tax;
    return { primary: { label: 'After-Tax Salvage', value: fmtMoney(atcf) },
      rows: [
        ['Capital gain / (loss)', fmtMoney(gain)],
        ['Tax on gain', fmtMoney(tax)],
      ],
      note: gain < 0 ? 'Sale below book value creates a tax saving, so you keep more than the sale price.' : '' };
  },
});

CALCS.push({
  id: 'nwc', group: 'fcf', title: 'Net Working Capital',
  formula: `NWC = Cash + Inventory + Receivables − Payables`,
  learn: {
    whatItIs: 'The short-term capital tied up in operations — current assets minus current liabilities. Growth in NWC consumes cash even when profits are healthy.',
    inputs: [
      ['Cash', 'Operating cash required to run the business.'],
      ['Inventory', 'Value of goods held for sale.'],
      ['Receivables', 'Money owed by customers (sales made, not yet collected).'],
      ['Payables', 'Money owed to suppliers (purchases made, not yet paid) — a source of financing, so it’s subtracted.'],
      ['Prior NWC', 'Last period’s NWC, used to compute the change (ΔNWC) that hits free cash flow.'],
    ],
    how: 'NWC = current assets (cash + inventory + receivables) − current liabilities (payables). ΔNWC = this period’s NWC − last period’s.',
    meaning: 'How much cash is locked inside day-to-day operations. A rising NWC is an investment; a falling NWC releases cash.',
    application: 'The ΔNWC line in free cash flow. Fast-growing firms often have strong profits but weak cash flow because NWC keeps rising.',
  },
  fields: [
    { id: 'cash', label: 'Cash', def: 500000, money: true },
    { id: 'inv', label: 'Inventory', def: 1500000, money: true },
    { id: 'ar', label: 'Accounts receivable', def: 1000000, money: true },
    { id: 'ap', label: 'Accounts payable', def: 800000, money: true },
    { id: 'prior', label: 'Prior-period NWC', def: 1800000, money: true },
  ],
  compute: (v) => {
    const nwc = v.cash + v.inv + v.ar - v.ap;
    const d = nwc - v.prior;
    return { primary: { label: 'Net Working Capital', value: fmtMoney(nwc) },
      rows: [
        ['Current assets', fmtMoney(v.cash + v.inv + v.ar)],
        ['Current liabilities', fmtMoney(v.ap)],
        ['Change in NWC (ΔNWC)', fmtMoney(d)],
      ],
      note: d > 0 ? 'Rising NWC uses cash (a negative on free cash flow this period).' : d < 0 ? 'Falling NWC releases cash (a positive on free cash flow).' : '' };
  },
});

/* ---------------------------- COST OF CAPITAL ---------------------------- */
/* CAPM lives in capm.js as an interactive solver (appended to this group). */
CALCS.push({
  id: 'wacc', group: 'coc', title: 'Weighted Average Cost of Capital',
  formula: `r_WACC = ${frac('E', 'D+E')} r_e + ${frac('D', 'D+E')} r_d (1 − T)`,
  learn: {
    whatItIs: 'The blended cost of all the firm’s financing — equity and debt — weighted by their market values. It’s the discount rate for an average-risk project’s free cash flows.',
    inputs: [
      ['Equity value (E)', 'Market value of equity (share price × shares outstanding).'],
      ['Debt value (D)', 'Market value of interest-bearing debt.'],
      ['Cost of equity (r_e)', 'Return required by shareholders — often from CAPM.'],
      ['Cost of debt (r_d)', 'The interest rate on the firm’s debt (its yield).'],
      ['Tax rate (T)', 'Marginal tax rate. Interest is tax-deductible, so debt’s after-tax cost is r_d(1−T).'],
    ],
    how: 'Weight each financing source by its share of total capital, multiply by its cost, and sum. Debt is multiplied by (1−T) to capture the interest tax shield.',
    meaning: 'The firm’s overall opportunity cost of capital — the minimum return new investments must earn to create value.',
    application: 'The discount rate in firm/project DCF valuations and the hurdle rate for capital budgeting. Lowering WACC (e.g., via the tax shield on debt) raises valuations.',
  },
  fields: [
    { id: 'E', label: 'Equity value (E)', def: 60000000, money: true },
    { id: 'D', label: 'Debt value (D)', def: 40000000, money: true },
    { id: 're', label: 'Cost of equity (r_e)', def: 12, pct: true },
    { id: 'rd', label: 'Cost of debt (r_d)', def: 6, pct: true },
    { id: 'T', label: 'Tax rate (T)', def: 25, pct: true },
  ],
  compute: (v) => {
    const tot = v.E + v.D;
    if (tot <= 0) return { primary: { label: 'WACC', value: '—' }, rows: [], note: 'Enter positive capital values.' };
    const we = v.E / tot, wd = v.D / tot;
    const wacc = we * v.re + wd * v.rd * (1 - v.T);
    return { primary: { label: 'WACC', value: fmtPct(wacc) },
      rows: [
        ['Weight of equity', fmtPct(we)],
        ['Weight of debt', fmtPct(wd)],
        ['After-tax cost of debt', fmtPct(v.rd * (1 - v.T))],
      ] };
  },
});

/* ------------------------------- VALUATION ------------------------------- */
CALCS.push({
  id: 'firm-value', group: 'val', title: 'DCF: Firm, Equity & Share Price',
  formula: `V = Cash_0 + Σ ${frac('FCF_t', '(1+r_w)^t')} + PV(Terminal)`,
  expanded: `V = Cash_0 + ${frac('FCF_1', '(1+r_w)')} + ${frac('FCF_2', '(1+r_w)^2')} + ⋯ + ${frac('FCF_N + V_N', '(1+r_w)^N')};  Equity = V − Debt;  Price = Equity / Shares`,
  learn: {
    whatItIs: 'A full discounted-cash-flow valuation: discount the forecast free cash flows plus a terminal value at the WACC, then bridge from firm value to equity value and a per-share price. Notation: Gormley’s sheet writes the same formula as Firm value = cash₀ + Σ FCF_t/(1+WACC)^t + TV_N/(1+WACC)^N.',
    inputs: [
      ['WACC (r_w)', 'The discount rate for free cash flows.'],
      ['Forecast FCFs', 'Free cash flow for each forecast year (FCF₁, FCF₂, …), comma/space separated.'],
      ['Terminal growth (g)', 'The perpetual growth rate of FCF after the forecast horizon. Must be below WACC.'],
      ['Cash', 'Excess cash on the balance sheet today, added to get firm value.'],
      ['Debt', 'Total debt, subtracted to get equity value.'],
      ['Shares', 'Shares outstanding, to convert equity value into a price.'],
    ],
    how: 'Each forecast FCF is discounted to today. A terminal value V_N = FCF_N(1+g)/(r_w−g) captures all cash flows beyond the horizon and is discounted back. Firm value = cash + PV(FCFs) + PV(terminal). Equity = firm value − debt; price = equity ÷ shares.',
    meaning: 'An intrinsic estimate of what the whole business — and a single share — is worth based on the cash it will generate.',
    application: 'Equity research, M&A, and corporate planning. The terminal value usually dominates, so test the sensitivity of price to g and WACC.',
  },
  fields: [
    { id: 'rw', label: 'WACC (r_w)', def: 9, pct: true },
    { id: 'fcfs', label: 'Forecast FCFs (FCF₁ …)', def: '5000000, 6000000, 7000000, 8000000, 9000000', text: true },
    { id: 'g', label: 'Terminal growth (g)', def: 3, pct: true },
    { id: 'cash', label: 'Cash today', def: 2000000, money: true },
    { id: 'debt', label: 'Debt', def: 20000000, money: true },
    { id: 'shares', label: 'Shares outstanding', def: 5000000 },
  ],
  compute: (v) => {
    const fcfs = parseFlows(v.fcfs);
    if (!fcfs.length) return { primary: { label: 'Firm Value', value: '—' }, rows: [], note: 'Enter at least one forecast FCF.' };
    const N = fcfs.length;
    let pvFcf = 0;
    for (let t = 1; t <= N; t++) pvFcf += fcfs[t - 1] / Math.pow(1 + v.rw, t);
    let tv = 0, pvTv = 0;
    if (v.rw > v.g) { tv = fcfs[N - 1] * (1 + v.g) / (v.rw - v.g); pvTv = tv / Math.pow(1 + v.rw, N); }
    const firm = v.cash + pvFcf + pvTv;
    const equity = firm - v.debt;
    const ev = firm - v.cash;
    const price = v.shares > 0 ? equity / v.shares : NaN;
    return { primary: { label: 'Implied Share Price', value: fmtMoney(price) },
      rows: [
        ['Firm value', fmtMoney(firm)],
        ['Enterprise value (firm − cash)', fmtMoney(ev)],
        ['Equity value (firm − debt)', fmtMoney(equity)],
        ['PV of forecast FCFs', fmtMoney(pvFcf)],
        ['Terminal value (at year ' + N + ')', fmtMoney(tv)],
        ['PV of terminal value', fmtMoney(pvTv)],
        ['Terminal value as % of firm', firm ? fmtPct(pvTv / firm) : '—'],
      ],
      note: v.rw <= v.g ? 'WACC must exceed terminal growth for a finite terminal value — terminal value was set to 0.' : '' };
  },
});

CALCS.push({
  id: 'terminal-value', group: 'val', title: 'Terminal Value',
  formula: `V_N = ${frac('FCF_{N+1}', 'r_w − g')} = ${frac('(1+g)', 'r_w − g')} × FCF_N`,
  learn: {
    whatItIs: 'The value, as of the end of the forecast horizon, of all free cash flows that come after it — modeled as a growing perpetuity.',
    inputs: [
      ['Final-year FCF (FCF_N)', 'The last explicitly forecast free cash flow.'],
      ['WACC (r_w)', 'The discount rate.'],
      ['Growth (g)', 'The assumed constant growth rate of FCF forever after year N. Must be below WACC and usually ≤ long-run GDP growth.'],
      ['Years to year N', 'Optional: discount the terminal value back to today.'],
    ],
    how: 'Grow the final FCF one period and capitalize it as a growing perpetuity: V_N = FCF_N(1+g)/(r_w−g). Discounting V_N by (1+r_w)^N brings it to present value.',
    meaning: 'A single number standing in for the indefinite future. In most DCFs it is the largest component of value.',
    application: 'The tail of every multi-stage DCF. Because it’s so sensitive to g and WACC, always sanity-check it against an exit-multiple estimate.',
  },
  fields: [
    { id: 'fcfN', label: 'Final-year FCF (FCF_N)', def: 9000000, money: true },
    { id: 'rw', label: 'WACC (r_w)', def: 9, pct: true },
    { id: 'g', label: 'Perpetual growth (g)', def: 3, pct: true },
    { id: 'N', label: 'Years to year N (for PV)', def: 5 },
  ],
  compute: (v) => {
    if (v.rw <= v.g) return { primary: { label: 'Terminal Value', value: '— (needs r > g)' }, rows: [], note: 'The discount rate must exceed the perpetual growth rate.' };
    const tv = v.fcfN * (1 + v.g) / (v.rw - v.g);
    const pv = tv / Math.pow(1 + v.rw, v.N);
    return { primary: { label: 'Terminal Value (at year ' + v.N + ')', value: fmtMoney(tv) },
      rows: [
        ['FCF in year N+1', fmtMoney(v.fcfN * (1 + v.g))],
        ['PV of terminal value today', fmtMoney(pv)],
      ] };
  },
});

CALCS.push({
  id: 'bond', group: 'val', title: 'Bond Valuation',
  formula: `P = ${frac('C', 'r')} ( 1 − ${frac('1', sup('(1+r)', 't'))} ) + ${frac('F', sup('(1+r)', 't'))}`,
  learn: {
    whatItIs: 'The price of a bond: the present value of its coupon payments (an annuity) plus the present value of its face value repaid at maturity.',
    inputs: [
      ['Face value (F)', 'The principal repaid at maturity (par), usually $1,000.'],
      ['Coupon rate', 'Annual coupon as a percent of face value. The dollar coupon is split across payments per year.'],
      ['Years to maturity', 'Time until the bond matures.'],
      ['Yield (YTM)', 'The market’s required annual return on the bond — the discount rate.'],
      ['Payments per year', 'Coupon frequency (1 = annual, 2 = semiannual).'],
    ],
    how: 'Convert to per-period terms: period coupon C = face × coupon rate ÷ frequency, period rate r = yield ÷ frequency, periods t = years × frequency. Price = annuity PV of coupons + PV of face value.',
    meaning: 'What the bond is worth today. Price above face = premium (coupon > yield); below = discount (coupon < yield); equal = par.',
    application: 'Pricing and trading bonds, measuring interest-rate risk (prices fall when yields rise), and finding a firm’s cost of debt from its bond yields.',
  },
  fields: [
    { id: 'F', label: 'Face value (F)', def: 1000, money: true },
    { id: 'cpn', label: 'Coupon rate (annual)', def: 5, pct: true },
    { id: 'years', label: 'Years to maturity', def: 10 },
    { id: 'ytm', label: 'Yield to maturity (annual)', def: 6, pct: true },
    { id: 'freq', label: 'Payments per year', def: 2 },
  ],
  compute: (v) => {
    const f = Math.max(1, Math.round(v.freq));
    const C = v.F * v.cpn / f;
    const r = v.ytm / f;
    const t = Math.round(v.years * f);
    const price = pvAnnuity(C, r, t) + v.F / Math.pow(1 + r, t);
    const status = price > v.F * 1.0001 ? 'Premium (coupon > yield)' : price < v.F * 0.9999 ? 'Discount (coupon < yield)' : 'At par';
    return { primary: { label: 'Bond Price', value: fmtMoney(price) },
      rows: [
        ['Coupon per period', fmtMoney(C)],
        ['Number of periods', t.toString()],
        ['Premium / discount', status],
      ] };
  },
});

CALCS.push({
  id: 'equity-bridge', group: 'val', title: 'Firm → Equity → Share Price',
  formula: `Equity = Firm − Debt &nbsp;•&nbsp; Price = Equity / Shares &nbsp;•&nbsp; EV = Firm − Cash`,
  learn: {
    whatItIs: 'The bridge that turns a firm (asset) value into equity value, share price, and enterprise value.',
    inputs: [
      ['Firm value', 'Total value of the business’s assets (e.g., from a DCF).'],
      ['Debt', 'Total interest-bearing debt — a claim ahead of equity, so it’s subtracted.'],
      ['Cash', 'Excess cash, removed to get enterprise value (the value of operations only).'],
      ['Shares', 'Shares outstanding, to compute price per share.'],
    ],
    how: 'Equity value = firm value − debt. Share price = equity value ÷ shares. Enterprise value = firm value − cash (the cost to buy the operating business net of its cash).',
    meaning: 'Separates what the whole business is worth from what belongs to shareholders, and isolates the operating business (EV) from financing and cash.',
    application: 'Converting DCF firm values into a target price; comparing companies on EV-based multiples that are independent of capital structure.',
  },
  fields: [
    { id: 'firm', label: 'Firm value', def: 100000000, money: true },
    { id: 'debt', label: 'Debt', def: 30000000, money: true },
    { id: 'cash', label: 'Cash', def: 10000000, money: true },
    { id: 'shares', label: 'Shares outstanding', def: 8000000 },
  ],
  compute: (v) => {
    const equity = v.firm - v.debt;
    const ev = v.firm - v.cash;
    const price = v.shares > 0 ? equity / v.shares : NaN;
    return { primary: { label: 'Share Price', value: fmtMoney(price) },
      rows: [
        ['Equity value', fmtMoney(equity)],
        ['Enterprise value', fmtMoney(ev)],
      ] };
  },
});

/* ===========================================================================
   RENDERER
   =========================================================================== */
const state = { group: 'tvm' };

function fieldHTML(c, f) {
  const id = `${c.id}__${f.id}`;
  const suffix = f.pct ? '<span class="suffix">%</span>' : '';
  if (f.text) {
    return `<label class="field wide" for="${id}"><span class="flabel">${f.label}</span>
      <textarea id="${id}" rows="2" data-c="${c.id}" data-f="${f.id}">${f.def}</textarea></label>`;
  }
  return `<label class="field" for="${id}"><span class="flabel">${f.label}</span>
    <span class="inwrap"><input id="${id}" type="text" inputmode="decimal" value="${f.def}" data-c="${c.id}" data-f="${f.id}">${suffix}</span></label>`;
}

function readValues(c) {
  const v = {};
  c.fields.forEach(f => {
    const el = document.getElementById(`${c.id}__${f.id}`);
    if (!el) { v[f.id] = f.def; return; }
    if (f.text) { v[f.id] = el.value; return; }
    let n = parseFloat(el.value.replace(/[, $]/g, ''));
    if (isNaN(n)) n = 0;
    if (f.pct) n = n / 100;
    v[f.id] = n;
  });
  return v;
}

function runCalc(c) {
  const v = readValues(c);
  let res;
  try { res = c.compute(v); } catch (e) { res = { primary: { label: 'Result', value: '—' }, rows: [], note: 'Check your inputs.' }; }
  const out = document.getElementById(`out__${c.id}`);
  if (!out) return;
  const rows = (res.rows || []).map(r => `<div class="rrow"><span>${r[0]}</span><b>${r[1]}</b></div>`).join('');
  out.innerHTML = `
    <div class="primary ${res.primary.good === true ? 'good' : res.primary.good === false ? 'bad' : ''}">
      <span class="plabel">${res.primary.label}</span>
      <span class="pvalue">${res.primary.value}</span>
    </div>
    ${rows}
    ${res.note ? `<p class="note">${res.note}</p>` : ''}`;
}

function calcCardHTML(c) {
  const inputs = c.fields.map(f => fieldHTML(c, f)).join('');
  const learn = c.learn;
  const inputDocs = learn.inputs.map(i => `<li><b>${i[0]}</b> — ${i[1]}</li>`).join('');
  return `<section class="card" id="card__${c.id}">
    <h3 class="ctitle">${c.title}</h3>
    ${formulaBlock(c.formula, c.expanded)}
    <details class="learn">
      <summary>📘 Learn — inputs, method, meaning &amp; application</summary>
      <div class="learnbody">
        <p><b>What it is.</b> ${learn.whatItIs}</p>
        <p><b>Inputs.</b></p><ul>${inputDocs}</ul>
        <p><b>How it’s calculated.</b> ${learn.how}</p>
        <p><b>What the answer means.</b> ${learn.meaning}</p>
        <p><b>How to apply it.</b> ${learn.application}</p>
      </div>
    </details>
    <div class="fields">${inputs}</div>
    <div class="output" id="out__${c.id}"></div>
  </section>`;
}

function renderGroup() {
  const main = document.getElementById('main');
  if (state.group === 'pf') { renderProForma(); return; }
  if (state.group === 'fr') { renderFinalReport(); return; }
  if (state.group === 'stk') { renderStocks(); return; }
  if (state.group === 'search') { renderSearch(); return; }
  const g = state.group;
  const list = CALCS.filter(c => c.group === g);
  const eqs = (typeof ISOLVER_EQS !== 'undefined') ? ISOLVER_EQS.filter(e => e.group === g) : [];
  let html = '';
  if (g === 'coc' && typeof capmCardHTML === 'function') html += capmCardHTML();   // CAPM first
  html += eqs.map(eqCardHTML).join('');
  html += list.map(calcCardHTML).join('');
  if (g === 'val' && typeof ddmCardHTML === 'function') html += ddmCardHTML();
  if (g === 'val' && typeof compsCardHTML === 'function') html += compsCardHTML();
  main.innerHTML = html;
  list.forEach(runCalc);
  main.querySelectorAll('input,textarea').forEach(el => {
    el.addEventListener('input', () => {
      const c = CALCS.find(x => x.id === el.dataset.c);
      if (c) runCalc(c);
    });
  });
  eqs.forEach(eqInit);
  if (g === 'val' && typeof wireDDM === 'function') wireDDM();
  if (g === 'val' && typeof wireComps === 'function') wireComps();
  if (g === 'coc' && typeof wireCapm === 'function') wireCapm();
  main.scrollTop = 0;
}

function renderTabs() {
  const tabs = document.getElementById('tabs');
  tabs.innerHTML = GROUPS.map(g =>
    `<button class="tab ${g.id === state.group ? 'active' : ''}" data-g="${g.id}">${g.label}</button>`).join('');
  tabs.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => {
    state.group = b.dataset.g;
    renderTabs(); renderGroup();
  }));
}

/* ===========================================================================
   PRO FORMA BUILDER + EXCEL EXPORT  (defined in proforma.js)
   =========================================================================== */
/* The simple algebraic calculators are replaced by interactive solvers in
   isolver.js — remove their generic versions so they don't render twice. */
['pv-annuity', 'annuity-payment', 'pv-growing-annuity', 'perpetuity', 'fv',
  'unlevered-ni', 'fcf', 'salvage', 'nwc', 'capm', 'wacc', 'terminal-value',
  'bond', 'ddm', 'equity-bridge'].forEach(id => {
    const i = CALCS.findIndex(c => c.id === id); if (i >= 0) CALCS.splice(i, 1);
  });

window.addEventListener('DOMContentLoaded', () => {
  renderTabs();
  renderGroup();
  initSubscripts();
  // expand/collapse formula toggle (event delegation across all cards)
  document.getElementById('main').addEventListener('click', (e) => {
    const btn = e.target.closest('.formula-toggle'); if (!btn) return;
    const wrap = btn.closest('.formula-wrap'); if (!wrap) return;
    const compact = wrap.querySelector('.formula:not(.formula-exp)');
    const exp = wrap.querySelector('.formula-exp');
    const showExpanded = exp.hidden;
    exp.hidden = !showExpanded; compact.hidden = showExpanded;
    btn.textContent = showExpanded ? 'Show compact ⌃' : 'Show expanded ⌄';
  });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
});
