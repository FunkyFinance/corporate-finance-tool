/* ============================================================================
   INTERACTIVE EQUATION ENGINE
   Every equation here is "solve for any variable." Each definition gives the
   variables, an optional closed-form solver per variable, and (where the
   relationship is transcendental) we fall back to a robust numeric root find.
   Rendered by renderGroup() in app.js via eqCardHTML()/eqInit().
   Relies on app.js globals: formulaBlock(), fmtMoney(), fmtNum(), frac().
   ========================================================================== */
'use strict';

/* monotonic 1-D root finder (used only for r/g/YTM, which are monotonic here) */
function isolveRoot(f, lo, hi) {
  let flo = f(lo), fhi = f(hi);
  if (isNaN(flo) || isNaN(fhi)) return NaN;
  if (flo === 0) return lo; if (fhi === 0) return hi;
  if (flo * fhi > 0) {
    let prev = lo, fprev = flo, found = false, d = (hi - lo) / 400;
    for (let i = 1; i <= 400; i++) { const x = lo + i * d, fx = f(x); if (!isNaN(fx) && fprev * fx <= 0) { lo = prev; hi = x; flo = fprev; fhi = fx; found = true; break; } prev = x; fprev = fx; }
    if (!found) return NaN;
  }
  for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2, fm = f(m); if (Math.abs(fm) < 1e-11) return m; if (flo * fm < 0) { hi = m; fhi = fm; } else { lo = m; flo = fm; } }
  return (lo + hi) / 2;
}
const eqDec = (unit, disp) => unit === 'pct' ? disp / 100 : disp;
const eqDisp = (unit, dec) => unit === 'pct' ? dec * 100 : dec;
const eqFmt = (unit, dec) => (dec === null || dec === undefined || isNaN(dec) || !isFinite(dec)) ? '—'
  : unit === 'pct' ? (dec * 100).toFixed(2) + '%' : unit === 'money' ? fmtMoney(dec) : (+dec).toLocaleString('en-US', { maximumFractionDigits: 4 });

/* annuity / growing-annuity factors */
const annF = (r, N) => r === 0 ? N : (1 - Math.pow(1 + r, -N)) / r;
const gannF = (r, g, N) => Math.abs(r - g) < 1e-9 ? N / (1 + r) : (1 / (r - g)) * (1 - Math.pow((1 + g) / (1 + r), N));

const ISOLVER_EQS = [];

/* ------------------------------ TIME VALUE ------------------------------- */
ISOLVER_EQS.push({
  id: 'annuity', group: 'tvm', title: 'Annuity — PV, Payment, Rate or Term',
  formula: `PV = C × ${frac('1', 'r')} ( 1 − ${frac('1', '(1+r)^N')} )`,
  expanded: `PV = ${frac('C', '(1+r)')} + ${frac('C', '(1+r)^2')} + ⋯ + ${frac('C', '(1+r)^N')}`,
  vars: [
    { key: 'PV', label: 'Present value (PV)', unit: 'money', def: 7360.09 },
    { key: 'C', label: 'Payment per period (C)', unit: 'money', def: 1000 },
    { key: 'r', label: 'Rate per period (r)', unit: 'pct', def: 6 },
    { key: 'N', label: 'Number of periods (N)', unit: 'num', def: 10 },
  ],
  defaultSolve: 'PV',
  resid: (v) => v.C * annF(v.r, v.N) - v.PV,
  solve: {
    PV: (v) => v.C * annF(v.r, v.N),
    C: (v) => v.PV / annF(v.r, v.N),
    N: (v) => -Math.log(1 - v.PV * v.r / v.C) / Math.log(1 + v.r),
  },
  derived: (v) => [['Total of all payments', eqFmt('money', v.C * v.N)], ['Total interest', eqFmt('money', v.C * v.N - v.PV)]],
  learn: {
    whatItIs: 'The relationship between a present value and a stream of equal payments. Solve for the value, the payment (e.g., a loan payment), the rate, or the number of periods. Notation: Gormley’s Valuation & Growth sheet writes this as PVA₀ = CF₁/r × [1 − 1/(1+r)ⁿ] — CF₁ is the same as C, n the same as N.',
    inputs: [['Present value (PV)', 'Lump sum today (e.g., loan principal).'], ['Payment (C)', 'Equal cash flow each period.'], ['Rate (r)', 'Discount/interest rate per period.'], ['Periods (N)', 'Number of payments.']],
    how: 'Each payment is discounted and summed; the closed form replaces the sum. Solving for the payment gives a loan/mortgage payment; solving for r gives the implied interest rate.',
    meaning: 'Equates a single sum today with a level stream over time.',
    application: 'Loans, mortgages, leases, retirement payouts — anywhere equal periodic cash flows trade against a lump sum.',
  },
});

ISOLVER_EQS.push({
  id: 'gannuity', group: 'tvm', title: 'Growing Annuity',
  formula: `PV = C × ${frac('1', 'r − g')} ( 1 − ${frac('(1+g)^N', '(1+r)^N')} )`,
  expanded: `PV = ${frac('C', '(1+r)')} + ${frac('C(1+g)', '(1+r)^2')} + ⋯ + ${frac('C(1+g)^(N−1)', '(1+r)^N')}`,
  vars: [
    { key: 'PV', label: 'Present value (PV)', unit: 'money', def: 12250.04 },
    { key: 'C', label: 'First cash flow (C_1)', unit: 'money', def: 1000 },
    { key: 'r', label: 'Rate (r)', unit: 'pct', def: 8 },
    { key: 'g', label: 'Growth (g)', unit: 'pct', def: 3 },
    { key: 'N', label: 'Periods (N)', unit: 'num', def: 20 },
  ],
  defaultSolve: 'PV',
  resid: (v) => v.C * gannF(v.r, v.g, v.N) - v.PV,
  solve: {
    PV: (v) => v.C * gannF(v.r, v.g, v.N),
    C: (v) => v.PV / gannF(v.r, v.g, v.N),
    N: (v) => Math.log(1 - v.PV * (v.r - v.g) / v.C) / Math.log((1 + v.g) / (1 + v.r)),
  },
  derived: (v) => [['Final (Nth) cash flow', eqFmt('money', v.C * Math.pow(1 + v.g, v.N - 1))]],
  learn: {
    whatItIs: 'Like an annuity, but the cash flows grow at a constant rate g each period. Notation: Gormley’s sheet writes PVA₀ = CF₁/(r−g) × [1 − ((1+g)/(1+r))ⁿ] — identical math, CF₁ = C.',
    inputs: [['Present value (PV)', 'Value today.'], ['First cash flow (C_1)', 'Payment one period out.'], ['Rate (r)', 'Discount rate per period.'], ['Growth (g)', 'Constant growth of the payments.'], ['Periods (N)', 'Number of payments.']],
    how: 'Each term grows by (1+g) and is discounted by (1+r); the closed form sums them. When r = g, PV = C·N/(1+r).',
    meaning: 'Today’s value of a finite, steadily rising payment stream.',
    application: 'Escalating salaries or rents, ramping project cash flows, finite growing dividend streams.',
  },
});

ISOLVER_EQS.push({
  id: 'perpetuity', group: 'tvm', title: 'Perpetuity & Growing Perpetuity',
  formula: `PV = ${frac('C', 'r − g')}`,
  expanded: `PV = ${frac('C', '(1+r)')} + ${frac('C(1+g)', '(1+r)^2')} + ${frac('C(1+g)^2', '(1+r)^3')} + ⋯  (forever)`,
  vars: [
    { key: 'PV', label: 'Present value (PV)', unit: 'money', def: 2000 },
    { key: 'C', label: 'Cash flow (C)', unit: 'money', def: 100 },
    { key: 'r', label: 'Rate (r)', unit: 'pct', def: 8 },
    { key: 'g', label: 'Growth (g)', unit: 'pct', def: 3 },
  ],
  defaultSolve: 'PV',
  resid: (v) => v.C / (v.r - v.g) - v.PV,
  solve: {
    PV: (v) => v.C / (v.r - v.g),
    C: (v) => v.PV * (v.r - v.g),
    r: (v) => v.g + v.C / v.PV,
    g: (v) => v.r - v.C / v.PV,
  },
  derived: (v) => [['Implied yield (C/PV)', eqFmt('pct', v.C / v.PV)], ['Set g = 0 for a level perpetuity', '']],
  learn: {
    whatItIs: 'A cash flow that lasts forever — level (g = 0) or growing at g. Solve for value, cash flow, rate, or growth. Notation: Gormley’s sheet writes PVP₀ = CF₁/r and CF₁/(r−g) — identical math, CF₁ = C.',
    inputs: [['Present value (PV)', 'Price today.'], ['Cash flow (C)', 'Payment one period out.'], ['Rate (r)', 'Discount rate; must exceed g.'], ['Growth (g)', 'Perpetual growth; 0 = level.']],
    how: 'An infinite discounted sum collapses to C/(r−g). Rearranged, r = g + C/PV and g = r − C/PV.',
    meaning: 'The price of an endless income stream; very sensitive to r and g.',
    application: 'Terminal values, preferred stock, the dividend-growth model, quick valuations of stable cash streams.',
  },
});

ISOLVER_EQS.push({
  id: 'fv', group: 'tvm', title: 'Future Value (Compounding)',
  formula: `FV = PV(1+r)^N + C × ${frac('(1+r)^N − 1', 'r')}`,
  expanded: `FV = PV(1+r)^N + C(1+r)^(N−1) + ⋯ + C(1+r) + C`,
  vars: [
    { key: 'FV', label: 'Future value (FV)', unit: 'money', def: 76122.55 },
    { key: 'PV', label: 'Present value (PV)', unit: 'money', def: 10000 },
    { key: 'r', label: 'Rate (r)', unit: 'pct', def: 7 },
    { key: 'N', label: 'Periods (N)', unit: 'num', def: 30 },
    { key: 'C', label: 'Contribution / period (C)', unit: 'money', def: 0 },
  ],
  defaultSolve: 'FV',
  resid: (v) => v.PV * Math.pow(1 + v.r, v.N) + v.C * (v.r === 0 ? v.N : (Math.pow(1 + v.r, v.N) - 1) / v.r) - v.FV,
  solve: {
    FV: (v) => v.PV * Math.pow(1 + v.r, v.N) + v.C * annF(v.r, v.N) * Math.pow(1 + v.r, v.N),
    PV: (v) => { const B = Math.pow(1 + v.r, v.N); return (v.FV - v.C * (v.r === 0 ? v.N : (B - 1) / v.r)) / B; },
    C: (v) => { const B = Math.pow(1 + v.r, v.N); return (v.FV - v.PV * B) / (v.r === 0 ? v.N : (B - 1) / v.r); },
    N: (v) => Math.log((v.FV + v.C / v.r) / (v.PV + v.C / v.r)) / Math.log(1 + v.r),
  },
  derived: (v) => [['From the lump sum', eqFmt('money', v.PV * Math.pow(1 + v.r, v.N))], ['Total contributed', eqFmt('money', v.PV + v.C * v.N)]],
  learn: {
    whatItIs: 'How a lump sum plus optional equal contributions grow with compounding. Solve for the ending balance, the starting amount, the rate, the term, or the contribution.',
    inputs: [['Future value (FV)', 'Ending balance.'], ['Present value (PV)', 'Amount invested today.'], ['Rate (r)', 'Return per period.'], ['Periods (N)', 'Compounding periods.'], ['Contribution (C)', 'Added each period (0 if none).']],
    how: 'The lump sum compounds at (1+r)^N; contributions form an annuity grown to the future. Solving for r/N inverts the compounding.',
    meaning: 'What your money becomes after interest compounds on interest.',
    application: 'Savings goals, retirement projections, comparing growth rates, the cost of waiting to invest.',
  },
});

/* ----------------------------- FREE CASH FLOW ---------------------------- */
ISOLVER_EQS.push({
  id: 'uni', group: 'fcf', title: 'Unlevered Net Income & EBIT',
  formula: `UNI = (Rev − Costs − Dep) × (1 − T)`,
  expanded: `EBIT = Revenues − Costs − Depreciation;  Unlevered NI = EBIT − EBIT × T`,
  vars: [
    { key: 'UNI', label: 'Unlevered net income (UNI)', unit: 'money', def: 1875000 },
    { key: 'Rev', label: 'Revenues', unit: 'money', def: 10000000 },
    { key: 'Costs', label: 'Operating costs (ex-dep)', unit: 'money', def: 6000000 },
    { key: 'Dep', label: 'Depreciation', unit: 'money', def: 1500000 },
    { key: 'T', label: 'Tax rate (T)', unit: 'pct', def: 25 },
  ],
  defaultSolve: 'UNI',
  resid: (v) => (v.Rev - v.Costs - v.Dep) * (1 - v.T) - v.UNI,
  solve: {
    UNI: (v) => (v.Rev - v.Costs - v.Dep) * (1 - v.T),
    Rev: (v) => v.UNI / (1 - v.T) + v.Costs + v.Dep,
    Costs: (v) => v.Rev - v.Dep - v.UNI / (1 - v.T),
    Dep: (v) => v.Rev - v.Costs - v.UNI / (1 - v.T),
    T: (v) => 1 - v.UNI / (v.Rev - v.Costs - v.Dep),
  },
  derived: (v) => [['EBIT', eqFmt('money', v.Rev - v.Costs - v.Dep)], ['Taxes on EBIT', eqFmt('money', (v.Rev - v.Costs - v.Dep) * v.T)]],
  learn: {
    whatItIs: 'Operating profit as if all-equity financed. EBIT = revenues − costs − depreciation; unlevered NI = EBIT×(1−T).',
    inputs: [['Unlevered NI', 'After-tax operating profit.'], ['Revenues', 'Incremental sales.'], ['Costs', 'Cash operating costs (exclude depreciation & interest).'], ['Depreciation', 'Non-cash charge that lowers taxes.'], ['Tax rate (T)', 'Marginal corporate rate.']],
    how: 'Strip out financing so the project is judged on operations, then tax the operating profit.',
    meaning: 'The after-tax operating profit attributable to the project itself.',
    application: 'The first line of a free-cash-flow build; lets you discount at the WACC.',
  },
});

ISOLVER_EQS.push({
  id: 'fcfe', group: 'fcf', title: 'Free Cash Flow',
  formula: `FCF = EBIT(1 − T) + Dep − CapEx − ΔNWC`,
  expanded: `Unlevered NI = EBIT × (1 − T);  FCF = Unlevered NI + Depreciation − CapEx − ΔNWC`,
  vars: [
    { key: 'FCF', label: 'Free cash flow (FCF)', unit: 'money', def: 2175000 },
    { key: 'EBIT', label: 'EBIT', unit: 'money', def: 2500000 },
    { key: 'T', label: 'Tax rate (T)', unit: 'pct', def: 25 },
    { key: 'Dep', label: 'Depreciation', unit: 'money', def: 1500000 },
    { key: 'CapEx', label: 'Capital expenditures', unit: 'money', def: 1000000 },
    { key: 'dNWC', label: 'Change in NWC (ΔNWC)', unit: 'money', def: 200000 },
  ],
  defaultSolve: 'FCF',
  resid: (v) => v.EBIT * (1 - v.T) + v.Dep - v.CapEx - v.dNWC - v.FCF,
  solve: {
    FCF: (v) => v.EBIT * (1 - v.T) + v.Dep - v.CapEx - v.dNWC,
    EBIT: (v) => (v.FCF - v.Dep + v.CapEx + v.dNWC) / (1 - v.T),
    Dep: (v) => v.FCF - v.EBIT * (1 - v.T) + v.CapEx + v.dNWC,
    CapEx: (v) => v.EBIT * (1 - v.T) + v.Dep - v.dNWC - v.FCF,
    dNWC: (v) => v.EBIT * (1 - v.T) + v.Dep - v.CapEx - v.FCF,
    T: (v) => 1 - (v.FCF - v.Dep + v.CapEx + v.dNWC) / v.EBIT,
  },
  derived: (v) => [['Unlevered net income', eqFmt('money', v.EBIT * (1 - v.T))]],
  learn: {
    whatItIs: 'The actual cash a project generates for all investors in a period. Solve for FCF or back out any single driver. Gormley’s sheet calls EBIT(1−T) + depreciation the operating cash flow (OCF), so FCF = OCF − CapEx − ΔNWC — the same formula.',
    inputs: [['FCF', 'Cash freed up this period.'], ['EBIT', 'Operating profit before interest/tax.'], ['Tax rate (T)', 'Marginal rate.'], ['Depreciation', 'Added back (non-cash).'], ['CapEx', 'Cash spent on long-term assets.'], ['ΔNWC', 'Increase in net working capital.']],
    how: 'Tax EBIT, add back depreciation, subtract investment in assets and working capital.',
    meaning: 'The cash quantity you discount in a DCF.',
    application: 'Project/firm valuation; each year’s FCF is discounted at the WACC.',
  },
});

ISOLVER_EQS.push({
  id: 'salvage', group: 'fcf', title: 'After-Tax Salvage Value',
  formula: `After-tax = Sale − T × (Sale − Book)`,
  expanded: `Gain = Sale − Book;  Tax = T × Gain;  After-tax cash = Sale − Tax`,
  vars: [
    { key: 'ATCF', label: 'After-tax salvage', unit: 'money', def: 1350000 },
    { key: 'Sale', label: 'Sale price', unit: 'money', def: 1800000 },
    { key: 'Book', label: 'Book value', unit: 'money', def: 0 },
    { key: 'T', label: 'Tax rate (T)', unit: 'pct', def: 25 },
  ],
  defaultSolve: 'ATCF',
  resid: (v) => v.Sale - v.T * (v.Sale - v.Book) - v.ATCF,
  solve: {
    ATCF: (v) => v.Sale - v.T * (v.Sale - v.Book),
    Sale: (v) => (v.ATCF - v.T * v.Book) / (1 - v.T),
    Book: (v) => (v.ATCF - v.Sale * (1 - v.T)) / v.T,
    T: (v) => (v.Sale - v.ATCF) / (v.Sale - v.Book),
  },
  derived: (v) => [['Capital gain / (loss)', eqFmt('money', v.Sale - v.Book)], ['Tax on gain', eqFmt('money', (v.Sale - v.Book) * v.T)]],
  learn: {
    whatItIs: 'The cash kept after selling an asset and paying tax on the gain.',
    inputs: [['After-tax salvage', 'Net cash received.'], ['Sale price', 'Disposal proceeds.'], ['Book value', 'Undepreciated value (0 if fully depreciated).'], ['Tax rate (T)', 'Rate on the gain.']],
    how: 'Gain = sale − book; tax = T×gain; after-tax = sale − tax (a loss creates a tax shield).',
    meaning: 'The true terminal cash inflow from disposing of an asset.',
    application: 'The final-year free cash flow in capital budgeting.',
  },
});

ISOLVER_EQS.push({
  id: 'nwc', group: 'fcf', title: 'Net Working Capital',
  formula: `NWC = Cash + Inventory + Receivables − Payables`,
  expanded: `NWC = (Cash + Inventory + Receivables) − Payables  =  Current assets − Current liabilities`,
  vars: [
    { key: 'NWC', label: 'Net working capital', unit: 'money', def: 2200000 },
    { key: 'Cash', label: 'Cash', unit: 'money', def: 500000 },
    { key: 'Inv', label: 'Inventory', unit: 'money', def: 1500000 },
    { key: 'AR', label: 'Accounts receivable', unit: 'money', def: 1000000 },
    { key: 'AP', label: 'Accounts payable', unit: 'money', def: 800000 },
  ],
  defaultSolve: 'NWC',
  resid: (v) => v.Cash + v.Inv + v.AR - v.AP - v.NWC,
  solve: {
    NWC: (v) => v.Cash + v.Inv + v.AR - v.AP,
    Cash: (v) => v.NWC - v.Inv - v.AR + v.AP,
    Inv: (v) => v.NWC - v.Cash - v.AR + v.AP,
    AR: (v) => v.NWC - v.Cash - v.Inv + v.AP,
    AP: (v) => v.Cash + v.Inv + v.AR - v.NWC,
  },
  derived: (v) => [['Current assets', eqFmt('money', v.Cash + v.Inv + v.AR)], ['Current liabilities', eqFmt('money', v.AP)]],
  learn: {
    whatItIs: 'Short-term capital tied up in operations: current assets minus current liabilities.',
    inputs: [['NWC', 'Net working capital.'], ['Cash', 'Operating cash.'], ['Inventory', 'Goods held.'], ['Receivables', 'Owed by customers.'], ['Payables', 'Owed to suppliers (subtracted).']],
    how: 'Add current assets, subtract payables. A rise in NWC consumes cash; a fall releases it.',
    meaning: 'How much cash is locked inside day-to-day operations.',
    application: 'The ΔNWC line in free cash flow; growth firms often have strong profit but weak cash from rising NWC.',
  },
});

ISOLVER_EQS.push({
  id: 'capex', group: 'fcf', title: 'Capital Expenditures (from the Balance Sheet)',
  formula: `CapEx = End NFA − Start NFA + Dep`,
  expanded: `Definition #1: CapEx = End gross fixed assets − Start gross fixed assets;  Definition #2: CapEx = End NFA − Start NFA + Depreciation`,
  vars: [
    { key: 'CapEx', label: 'Capital expenditures', unit: 'money', def: 700 },
    { key: 'EndNFA', label: 'Ending net fixed assets', unit: 'money', def: 2303.3 },
    { key: 'StartNFA', label: 'Starting net fixed assets', unit: 'money', def: 1837 },
    { key: 'Dep', label: 'Depreciation', unit: 'money', def: 233.7 },
  ],
  defaultSolve: 'CapEx',
  resid: (v) => v.EndNFA - v.StartNFA + v.Dep - v.CapEx,
  solve: {
    CapEx: (v) => v.EndNFA - v.StartNFA + v.Dep,
    EndNFA: (v) => v.CapEx + v.StartNFA - v.Dep,
    StartNFA: (v) => v.EndNFA + v.Dep - v.CapEx,
    Dep: (v) => v.CapEx - v.EndNFA + v.StartNFA,
  },
  derived: (v) => [['Change in net fixed assets', eqFmt('money', v.EndNFA - v.StartNFA)]],
  learn: {
    whatItIs: 'Backing capital spending out of the balance sheet when it isn’t reported directly (from Gormley’s formula sheet). Two equivalent definitions: the change in gross fixed assets, or the change in net fixed assets plus depreciation.',
    inputs: [['CapEx', 'Cash spent on long-term assets in the period.'], ['Ending / starting NFA', 'Net fixed assets (gross − accumulated depreciation) at the end and start of the period.'], ['Depreciation', 'The period’s depreciation expense — added back because it reduced NFA without being spending.']],
    how: 'Definition #1 uses gross fixed assets: CapEx = end gross − start gross (enter gross values as the NFA inputs with Dep = 0). Definition #2 uses net fixed assets: CapEx = ΔNFA + depreciation, since NFA fell by depreciation and rose by purchases.',
    meaning: 'The investment outflow that belongs in the free-cash-flow calculation.',
    application: 'Estimating FCF from financial statements when the cash-flow statement isn’t available — the CapEx line feeds directly into FCF = OCF − CapEx − ΔNWC.',
  },
});

/* ---------------------------- COST OF CAPITAL ---------------------------- */
ISOLVER_EQS.push({
  id: 'wacc', group: 'coc', title: 'Weighted Average Cost of Capital',
  formula: `r_WACC = ${frac('E', 'D+E')} r_E + ${frac('D', 'D+E')} r_D (1 − T)`,
  expanded: `w_E = ${frac('E', 'D+E')}, w_D = ${frac('D', 'D+E')};  r_WACC = w_E·r_E + w_D·r_D·(1 − T)`,
  vars: [
    { key: 'WACC', label: 'WACC (r_WACC)', unit: 'pct', def: 9 },
    { key: 'E', label: 'Equity value (E)', unit: 'money', def: 60000000 },
    { key: 'D', label: 'Debt value (D)', unit: 'money', def: 40000000 },
    { key: 're', label: 'Cost of equity (r_E)', unit: 'pct', def: 12 },
    { key: 'rd', label: 'Cost of debt (r_D)', unit: 'pct', def: 6 },
    { key: 'T', label: 'Tax rate (T)', unit: 'pct', def: 25 },
  ],
  defaultSolve: 'WACC',
  resid: (v) => (v.E / (v.E + v.D)) * v.re + (v.D / (v.E + v.D)) * v.rd * (1 - v.T) - v.WACC,
  solve: {
    WACC: (v) => (v.E / (v.E + v.D)) * v.re + (v.D / (v.E + v.D)) * v.rd * (1 - v.T),
    re: (v) => (v.WACC - (v.D / (v.E + v.D)) * v.rd * (1 - v.T)) * (v.E + v.D) / v.E,
    rd: (v) => (v.WACC - (v.E / (v.E + v.D)) * v.re) * (v.E + v.D) / (v.D * (1 - v.T)),
    T: (v) => 1 - (v.WACC - (v.E / (v.E + v.D)) * v.re) * (v.E + v.D) / (v.D * v.rd),
    E: (v) => v.D * (v.rd * (1 - v.T) - v.WACC) / (v.WACC - v.re),
    D: (v) => v.E * (v.re - v.WACC) / (v.WACC - v.rd * (1 - v.T)),
  },
  derived: (v) => [['Weight of equity', eqFmt('pct', v.E / (v.E + v.D))], ['Weight of debt', eqFmt('pct', v.D / (v.E + v.D))], ['After-tax cost of debt', eqFmt('pct', v.rd * (1 - v.T))]],
  learn: {
    whatItIs: 'The blended cost of all financing, weighted by market values. Solve for WACC or back out any input. Both course formula sheets use this same formula (Gormley writes the tax rate as T_C).',
    inputs: [['WACC', 'Overall cost of capital.'], ['Equity (E)', 'Market value of equity.'], ['Debt (D)', 'Market value of debt.'], ['Cost of equity (r_E)', 'From CAPM.'], ['Cost of debt (r_D)', 'Yield on debt.'], ['Tax rate (T)', 'Interest is deductible → r_D(1−T).']],
    how: 'Weight each source by its share of capital, multiply by its cost, sum; debt uses the after-tax rate.',
    meaning: 'The minimum return new investments must earn to create value.',
    application: 'Discount rate for firm/project DCF and the capital-budgeting hurdle rate.',
  },
});

/* ------------------------------- VALUATION ------------------------------- */
ISOLVER_EQS.push({
  id: 'tv', group: 'val', title: 'Terminal Value',
  formula: `V_N = ${frac('FCF_N(1+g)', 'r_wacc − g')}`,
  expanded: `V_N = ${frac('FCF_(N+1)', 'r_wacc − g')},  where FCF_(N+1) = FCF_N(1+g)`,
  vars: [
    { key: 'V', label: 'Terminal value (V_N)', unit: 'money', def: 154500000 },
    { key: 'FCF', label: 'Final-year FCF (FCF_N)', unit: 'money', def: 9000000 },
    { key: 'r', label: 'WACC (r_wacc)', unit: 'pct', def: 9 },
    { key: 'g', label: 'Perpetual growth (g)', unit: 'pct', def: 3 },
  ],
  defaultSolve: 'V',
  resid: (v) => v.FCF * (1 + v.g) / (v.r - v.g) - v.V,
  solve: {
    V: (v) => v.FCF * (1 + v.g) / (v.r - v.g),
    FCF: (v) => v.V * (v.r - v.g) / (1 + v.g),
    r: (v) => v.g + v.FCF * (1 + v.g) / v.V,
    g: (v) => (v.V * v.r - v.FCF) / (v.V + v.FCF),
  },
  derived: (v) => [['FCF in year N+1', eqFmt('money', v.FCF * (1 + v.g))]],
  learn: {
    whatItIs: 'The value at the end of the forecast of all later cash flows, as a growing perpetuity. Solve for value, the final FCF, the discount rate, or the implied growth.',
    inputs: [['Terminal value (V_N)', 'Value at year N.'], ['Final FCF (FCF_N)', 'Last forecast cash flow.'], ['WACC (r_wacc)', 'Discount rate; must exceed g.'], ['Growth (g)', 'Perpetual growth, ≤ long-run GDP.']],
    how: 'Grow the final FCF one period and capitalize it: V_N = FCF_N(1+g)/(r−g).',
    meaning: 'Usually the largest single piece of a DCF, so test its sensitivity.',
    application: 'The tail of every multi-stage DCF; cross-check against an exit multiple.',
  },
});

ISOLVER_EQS.push({
  id: 'bond', group: 'val', title: 'Bond Valuation (per period)',
  formula: `Price = ${frac('C', 'r')} ( 1 − ${frac('1', '(1+r)^t')} ) + ${frac('F', '(1+r)^t')}`,
  expanded: `Price = ${frac('C', '(1+r)')} + ${frac('C', '(1+r)^2')} + ⋯ + ${frac('C', '(1+r)^t')} + ${frac('F', '(1+r)^t')}`,
  vars: [
    { key: 'Price', label: 'Bond price', unit: 'money', def: 925.61 },
    { key: 'C', label: 'Coupon per period (C)', unit: 'money', def: 25 },
    { key: 'r', label: 'Yield per period (r)', unit: 'pct', def: 3 },
    { key: 't', label: 'Number of periods (t)', unit: 'num', def: 20, noSolve: true },
    { key: 'F', label: 'Face value (F)', unit: 'money', def: 1000 },
  ],
  defaultSolve: 'Price',
  resid: (v) => v.C * annF(v.r, v.t) + v.F / Math.pow(1 + v.r, v.t) - v.Price,
  solve: {
    Price: (v) => v.C * annF(v.r, v.t) + v.F / Math.pow(1 + v.r, v.t),
    C: (v) => (v.Price - v.F / Math.pow(1 + v.r, v.t)) / annF(v.r, v.t),
    F: (v) => (v.Price - v.C * annF(v.r, v.t)) * Math.pow(1 + v.r, v.t),
  },
  derived: (v) => [['Premium / discount', v.Price > v.F * 1.0001 ? 'Premium (coupon > yield)' : v.Price < v.F * 0.9999 ? 'Discount (coupon < yield)' : 'At par'], ['Coupon as % of face', eqFmt('pct', v.F ? v.C / v.F : NaN)]],
  learn: {
    whatItIs: 'A bond’s price is the PV of its coupons plus the PV of its face value. Enter values per coupon period; solve for price, coupon, face, or the per-period yield (YTM).',
    inputs: [['Price', 'PV of the bond.'], ['Coupon per period (C)', 'Face × annual coupon ÷ payments/yr.'], ['Yield per period (r)', 'YTM ÷ payments/yr.'], ['Periods (t)', 'Years × payments/yr.'], ['Face value (F)', 'Principal repaid at maturity.']],
    how: 'Coupons form an annuity; the face is a lump sum at maturity. For semiannual bonds, halve the coupon and yield and double the periods.',
    meaning: 'Price above face = premium (coupon > yield); below = discount.',
    application: 'Pricing/trading bonds, measuring rate risk, finding the cost of debt from bond yields.',
  },
});

ISOLVER_EQS.push({
  id: 'equity', group: 'val', title: 'Firm → Equity → Share Price',
  formula: `Price = ${frac('Firm value − Debt − Preferred', 'Shares')}`,
  expanded: `Equity value = Firm value − Debt − Preferred equity;  Price = Equity value / Shares outstanding`,
  vars: [
    { key: 'Price', label: 'Share price', unit: 'money', def: 8.75 },
    { key: 'Firm', label: 'Firm value', unit: 'money', def: 100000000 },
    { key: 'Debt', label: 'Debt', unit: 'money', def: 30000000 },
    { key: 'Pref', label: 'Preferred equity', unit: 'money', def: 0 },
    { key: 'Shares', label: 'Shares outstanding', unit: 'num', def: 8000000 },
  ],
  defaultSolve: 'Price',
  resid: (v) => (v.Firm - v.Debt - v.Pref) / v.Shares - v.Price,
  solve: {
    Price: (v) => (v.Firm - v.Debt - v.Pref) / v.Shares,
    Firm: (v) => v.Price * v.Shares + v.Debt + v.Pref,
    Debt: (v) => v.Firm - v.Pref - v.Price * v.Shares,
    Pref: (v) => v.Firm - v.Debt - v.Price * v.Shares,
    Shares: (v) => (v.Firm - v.Debt - v.Pref) / v.Price,
  },
  derived: (v) => [['Equity value (Firm − Debt − Preferred)', eqFmt('money', v.Firm - v.Debt - v.Pref)]],
  learn: {
    whatItIs: 'The bridge from a firm’s asset value to common-equity value and a per-share price. Solve for any of them. (FIN 740 writes Equity = Firm − Debt; Gormley’s sheet also subtracts preferred equity — leave Preferred at 0 to match the FIN 740 version.)',
    inputs: [['Share price', 'Equity ÷ shares.'], ['Firm value', 'Total business value (e.g., from a DCF or a multiples valuation).'], ['Debt', 'Total debt (a senior claim).'], ['Preferred equity', 'Preferred stock — paid before common shareholders; 0 if none.'], ['Shares', 'Common shares outstanding.']],
    how: 'Equity value = firm value − debt − preferred equity; price = equity ÷ shares.',
    meaning: 'Separates what the whole business is worth from what belongs to common shareholders.',
    application: 'Turning a DCF or multiples-based firm value into a target price — e.g., after valuing an acquisition target with comparables’ multiples, subtract its debt (and preferred) to get what its stock is worth.',
  },
});

ISOLVER_EQS.push({
  id: 'pe', group: 'val', title: 'Fundamental PE Ratio',
  formula: `PE_F = ${frac('b(1+g)', 'r − g')}`,
  expanded: `P_0 = ${frac('Div_1', 'r − g')} = ${frac('b × EPS_0 (1+g)', 'r − g')}  ⇒  ${frac('P_0', 'EPS_0')} = ${frac('b(1+g)', 'r − g')}`,
  vars: [
    { key: 'PE', label: 'Fundamental PE ratio (PE_F)', unit: 'num', def: 20.8 },
    { key: 'b', label: 'Payout ratio (b)', unit: 'pct', def: 100 },
    { key: 'g', label: 'Growth rate (g)', unit: 'pct', def: 4 },
    { key: 'r', label: 'Discount rate (r)', unit: 'pct', def: 9 },
  ],
  defaultSolve: 'PE',
  resid: (v) => v.b * (1 + v.g) / (v.r - v.g) - v.PE,
  solve: {
    PE: (v) => v.b * (1 + v.g) / (v.r - v.g),
    b: (v) => v.PE * (v.r - v.g) / (1 + v.g),
    r: (v) => v.g + v.b * (1 + v.g) / v.PE,
    g: (v) => (v.PE * v.r - v.b) / (v.PE + v.b),
  },
  derived: (v) => [['Implied earnings yield (1/PE)', eqFmt('pct', v.PE ? 1 / v.PE : NaN)]],
  learn: {
    whatItIs: 'The price-earnings ratio a stock *should* trade at based on fundamentals (from Gormley’s formula sheet): the payout ratio, expected growth, and the discount rate. Solve for the justified PE, or invert it to find the growth or return the market is pricing in.',
    inputs: [['Fundamental PE (PE_F)', 'Justified price per $1 of current earnings.'], ['Payout ratio (b)', 'The fraction of earnings per share paid out as dividends (100% = all earnings paid out).'], ['Growth (g)', 'Expected perpetual growth of earnings/dividends. Must be below r.'], ['Discount rate (r)', 'The stock’s cost of equity (e.g., from CAPM).']],
    how: 'Start from the growing perpetuity P₀ = Div₁/(r−g) with Div₁ = b×EPS₀×(1+g); dividing both sides by EPS₀ gives PE = b(1+g)/(r−g). Higher growth or a lower discount rate justifies a higher PE.',
    meaning: 'How much investors should rationally pay per dollar of current earnings. A market PE far above the fundamental PE implies the market expects more growth (or accepts a lower return) than your assumptions.',
    application: 'Multiples valuation: value a stock as PE × EPS using comparables’ ratios, and use the fundamental PE to sanity-check whether a comp’s multiple (and its implied growth) is reasonable. High-PE firms are “growth” stocks; low-PE firms are “value” stocks.',
  },
});

ISOLVER_EQS.push({
  id: 'ma', group: 'val', title: 'M&A — Value of a Combined Firm',
  formula: `PV_AB = PV_A + PV_B + Synergies`,
  expanded: `Value of merged firm = standalone value of A + standalone value of B + PV of synergies (cost savings, revenue gains, tax benefits)`,
  vars: [
    { key: 'PVAB', label: 'Combined value (PV_AB)', unit: 'money', def: 115000000 },
    { key: 'PVA', label: 'Acquirer standalone (PV_A)', unit: 'money', def: 60000000 },
    { key: 'PVB', label: 'Target standalone (PV_B)', unit: 'money', def: 40000000 },
    { key: 'S', label: 'Synergies', unit: 'money', def: 15000000 },
  ],
  defaultSolve: 'PVAB',
  resid: (v) => v.PVA + v.PVB + v.S - v.PVAB,
  solve: {
    PVAB: (v) => v.PVA + v.PVB + v.S,
    PVA: (v) => v.PVAB - v.PVB - v.S,
    PVB: (v) => v.PVAB - v.PVA - v.S,
    S: (v) => v.PVAB - v.PVA - v.PVB,
  },
  derived: (v) => [['Max sensible premium over PV_B', eqFmt('money', v.S)], ['Synergies as % of target', eqFmt('pct', v.PVB ? v.S / v.PVB : NaN)]],
  learn: {
    whatItIs: 'The value of two firms combined in a merger or acquisition (from Gormley’s formula sheet): each firm’s standalone value plus the present value of synergies created by combining them.',
    inputs: [['Combined value (PV_AB)', 'What the merged firm is worth.'], ['PV_A / PV_B', 'Each firm’s standalone (pre-deal) value — from a DCF or multiples.'], ['Synergies', 'The PV of extra cash flows the combination creates: cost savings, revenue gains, tax benefits. Can be negative if the deal destroys value.']],
    how: 'Simple value additivity plus synergies. Solve for synergies to back out what a deal price implies, or for PV_AB to value the merged entity.',
    meaning: 'Synergies are the only economic reason a combination is worth more than the sum of its parts — and they set the ceiling on the premium worth paying.',
    application: 'Deal analysis: if the acquirer pays a premium above PV_B larger than the synergies, the acquirer’s shareholders lose value. Back out the synergies implied by an announced price and ask whether they are believable.',
  },
});

/* =============================== RENDERING =============================== */
const eqStates = {};
function eqState(eq) {
  if (!eqStates[eq.id]) {
    const values = {}; eq.vars.forEach(v => values[v.key] = v.def);
    eqStates[eq.id] = { solveFor: eq.defaultSolve, values };
  }
  return eqStates[eq.id];
}

function eqCardHTML(eq) {
  const L = eq.learn;
  const inputDocs = L.inputs.map(i => `<li><b>${i[0]}</b> — ${i[1]}</li>`).join('');
  return `<section class="card" id="eq__${eq.id}">
    <h3 class="ctitle">${eq.title}</h3>
    ${formulaBlock(eq.formula, eq.expanded)}
    <details class="learn"><summary>📘 Learn — inputs, method, meaning &amp; application</summary>
      <div class="learnbody">
        <p><b>What it is.</b> ${L.whatItIs}</p>
        <p><b>Inputs.</b></p><ul>${inputDocs}</ul>
        <p><b>How it’s calculated.</b> ${L.how}</p>
        <p><b>What the answer means.</b> ${L.meaning}</p>
        <p><b>How to apply it.</b> ${L.application}</p>
      </div>
    </details>
    <div id="eqc__${eq.id}"></div>
    <div class="output" id="eqo__${eq.id}"></div>
  </section>`;
}

function eqControlsHTML(eq) {
  const st = eqState(eq);
  const opts = eq.vars.filter(v => !v.noSolve).map(v => `<option value="${v.key}" ${st.solveFor === v.key ? 'selected' : ''}>${v.label.replace(/_/g, '')}</option>`).join('');
  const fields = eq.vars.filter(v => v.key !== st.solveFor).map(v =>
    `<label class="field"><span class="flabel">${v.label}</span>
      <span class="inwrap"><input type="text" inputmode="decimal" class="eq-in" data-eq="${eq.id}" data-key="${v.key}" value="${st.values[v.key]}">${v.unit === 'pct' ? '<span class="suffix">%</span>' : ''}</span></label>`).join('');
  const solveLabel = eq.vars.find(v => v.key === st.solveFor).label;
  return `<label class="field wide"><span class="flabel">Solve for</span>
      <select class="eq-solve" data-eq="${eq.id}">${opts}</select></label>
    <p class="solve-hint">Solving for <b>${solveLabel}</b> — enter the rest.</p>
    <div class="fields">${fields}</div>`;
}

function eqCompute(eq) {
  const st = eqState(eq);
  const out = document.getElementById('eqo__' + eq.id); if (!out) return;
  const K = st.solveFor;
  const v = {};
  eq.vars.forEach(vd => { if (vd.key !== K) v[vd.key] = eqDec(vd.unit, parseFloat(String(st.values[vd.key]).replace(/[, $]/g, '')) || 0); });
  const kdef = eq.vars.find(vd => vd.key === K);
  let result;
  if (eq.solve && eq.solve[K]) result = eq.solve[K](v);
  if (result === undefined || isNaN(result) || !isFinite(result)) {
    const lo = kdef.unit === 'pct' ? -0.95 : kdef.unit === 'num' ? 1 : -1e9;
    const hi = kdef.unit === 'pct' ? 5 : kdef.unit === 'num' ? 1000 : 1e9;
    result = isolveRoot((x) => eq.resid({ ...v, [K]: x }), lo, hi);
  }
  if (isNaN(result) || !isFinite(result)) { out.innerHTML = '<p class="note">No valid solution for these inputs — check the values (e.g., a rate must exceed a growth rate).</p>'; return; }
  st.values[K] = Math.round(eqDisp(kdef.unit, result) * 1e6) / 1e6;
  v[K] = result;
  const rows = eq.vars.map(vd => `<div class="rrow"><span>${vd.label}</span><b>${eqFmt(vd.unit, v[vd.key])}</b></div>`).join('');
  const extra = (eq.derived ? eq.derived(v) : []).filter(d => d[1] !== '').map(d => `<div class="rrow"><span>${d[0]}</span><b>${d[1]}</b></div>`).join('');
  out.innerHTML = `<div class="primary"><span class="plabel">${kdef.label}</span><span class="pvalue">${eqFmt(kdef.unit, result)}</span></div>${rows}${extra}`;
}

function eqInit(eq) {
  const host = document.getElementById('eqc__' + eq.id); if (!host) return;
  host.innerHTML = eqControlsHTML(eq);
  host.querySelector('.eq-solve').addEventListener('change', (e) => { eqState(eq).solveFor = e.target.value; eqInit(eq); });
  host.querySelectorAll('.eq-in').forEach(el => el.addEventListener('input', () => {
    let val = parseFloat(el.value.replace(/[, $]/g, '')); if (isNaN(val)) val = 0;
    eqState(eq).values[el.dataset.key] = val; eqCompute(eq);
  }));
  eqCompute(eq);
}
