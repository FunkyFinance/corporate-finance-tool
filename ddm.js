/* ============================================================================
   DIVIDEND DISCOUNT MODEL — finite horizon, interactive solver. (Valuation tab)
   Value = PV of N dividends (growing at g) + PV of a terminal sale price P_N.
       P0 = Σ_{t=1..N} Div1·(1+g)^(t-1)/(1+r)^t  +  P_N/(1+r)^N
   Solve interactively for: P0, required return r, growth g, Div1, or P_N.
   Reuses frac() and fmtMoney() from app.js.
   ========================================================================== */
'use strict';

const DDM = { solveFor: 'P0', div1: 2.50, g: 4, r: 9, N: 5, Pn: 60, P0: 50 }; // g,r in %
const DDM_OPTS = [
  ['P0', 'Price (P₀)'], ['r', 'Required return (r)'], ['g', 'Growth (g)'],
  ['div1', 'Dividend (Div₁)'], ['Pn', 'Sale price (P_N)'],
];

// growing-annuity PV factor for the first N dividends (first dividend Div1 at t=1)
function ddmAnnFactor(r, g, N) {
  return Math.abs(r - g) < 1e-9 ? N / (1 + r) : (1 / (r - g)) * (1 - Math.pow((1 + g) / (1 + r), N));
}
function ddmPrice(div1, g, r, N, Pn) {
  return div1 * ddmAnnFactor(r, g, N) + Pn / Math.pow(1 + r, N);
}
// generic bisection on a monotonic function f over [lo,hi] with f(x)=0
function ddmBisect(f, lo, hi) {
  let flo = f(lo), fhi = f(hi);
  if (isNaN(flo) || isNaN(fhi) || flo * fhi > 0) return null;
  for (let i = 0; i < 240; i++) {
    const m = (lo + hi) / 2, fm = f(m);
    if (Math.abs(fm) < 1e-10) return m;
    if (flo * fm < 0) { hi = m; fhi = fm; } else { lo = m; flo = fm; }
  }
  return (lo + hi) / 2;
}

function ddmCardHTML() {
  return `<section class="card" id="ddm-card">
    <h3 class="ctitle">Dividend Discount Model — Finite Horizon</h3>
    ${formulaBlock(
      `P_0 = Σ ${frac('Div_t', '(1+r)^t')} + ${frac('P_N', '(1+r)^N')}`,
      `P_0 = ${frac('Div_1', '(1+r)')} + ${frac('Div_2', '(1+r)²')} + ⋯ + ${frac('Div_N', '(1+r)^N')} + ${frac('P_N', '(1+r)^N')}`)}
    <details class="learn"><summary>📘 Learn — inputs, method, meaning &amp; application</summary>
      <div class="learnbody">
        <p><b>What it is.</b> Values a stock you plan to hold for a <b>specific number of periods</b>: the present
        value of the dividends you collect over N periods (each growing at rate g) plus the present value of the
        price you expect to sell at, P_N. Unlike the constant-growth (Gordon) model, this does <b>not</b> assume
        dividends continue forever.</p>
        <p><b>Inputs.</b></p>
        <ul>
          <li><b>Div₁</b> — the dividend expected one period from now; later dividends grow at g.</li>
          <li><b>Growth (g)</b> — the per-period growth rate of dividends.</li>
          <li><b>Required return (r)</b> — the discount rate / cost of equity.</li>
          <li><b>Periods (N)</b> — how many periods you hold the stock.</li>
          <li><b>Sale price (P_N)</b> — the expected price when you sell at the end of period N.</li>
          <li><b>Price (P₀)</b> — today's price/value (an input when you solve for something else).</li>
        </ul>
        <p><b>How it's calculated.</b> Each dividend Div_t = Div₁·(1+g)^(t−1) is discounted to today; the N
        dividends collapse to a growing-annuity term, and the sale price is discounted over N periods. Because
        the relationship is exact, you can rearrange it to solve for any single variable — price, dividend, or
        sale price in closed form, and required return or growth by a numerical search.</p>
        <p><b>What the answer means.</b> The intrinsic value today of a finite holding period. If P₀ comes out
        above the market price, the stock looks cheap for your horizon and assumptions.</p>
        <p><b>How to apply it.</b> Value a stock you'll hold for a set number of years; back out the return a
        given price implies; or find the dividend growth or exit price the current price is assuming.</p>
      </div>
    </details>
    <div id="ddm-controls"></div>
    <div class="output" id="ddm_out"></div>
  </section>`;
}

function ddmControlsHTML() {
  const opts = DDM_OPTS.map(([k, l]) => `<option value="${k}" ${DDM.solveFor === k ? 'selected' : ''}>${l.replace(/_/g, '')}</option>`).join('');
  const fld = (key, label, money) => DDM.solveFor === key ? '' :
    `<label class="field"><span class="flabel">${label}</span>
      <span class="inwrap"><input type="text" inputmode="decimal" class="ddm-in" data-key="${key}" value="${DDM[key]}">${money ? '' : '<span class="suffix">%</span>'}</span></label>`;
  const solveLabel = DDM_OPTS.find(o => o[0] === DDM.solveFor)[1];
  return `<label class="field wide"><span class="flabel">Solve for</span>
      <select class="ddm-solve">${opts}</select></label>
    <p class="solve-hint">Solving for <b>${solveLabel}</b> — enter the rest.</p>
    <div class="fields">
      ${fld('div1', 'First dividend (Div₁)', true)}
      ${fld('g', 'Dividend growth (g)', false)}
      ${fld('r', 'Required return (r)', false)}
      <label class="field"><span class="flabel">Periods held (N)</span>
        <span class="inwrap"><input type="text" inputmode="decimal" class="ddm-in" data-key="N" value="${DDM.N}"></span></label>
      ${fld('Pn', 'Sale price (P_N)', true)}
      ${fld('P0', 'Current price (P₀)', true)}
    </div>`;
}

function ddmCompute() {
  const out = document.getElementById('ddm_out'); if (!out) return;
  const N = Math.max(1, Math.round(DDM.N));
  let g = DDM.g / 100, r = DDM.r / 100, div1 = DDM.div1, Pn = DDM.Pn, P0 = DDM.P0;
  let primaryLabel, primaryVal, note = '';

  if (DDM.solveFor === 'P0') {
    P0 = ddmPrice(div1, g, r, N, Pn); DDM.P0 = P0;
    primaryLabel = 'Value today (P₀)'; primaryVal = fmtMoney(P0);
  } else if (DDM.solveFor === 'div1') {
    const A = ddmAnnFactor(r, g, N);
    div1 = (P0 - Pn / Math.pow(1 + r, N)) / A; DDM.div1 = div1;
    primaryLabel = 'Required first dividend (Div₁)'; primaryVal = fmtMoney(div1);
  } else if (DDM.solveFor === 'Pn') {
    const A = ddmAnnFactor(r, g, N);
    Pn = (P0 - div1 * A) * Math.pow(1 + r, N); DDM.Pn = Pn;
    primaryLabel = 'Implied sale price (P_N)'; primaryVal = fmtMoney(Pn);
  } else if (DDM.solveFor === 'r') {
    const sol = ddmBisect((rr) => ddmPrice(div1, g, rr, N, Pn) - P0, -0.5, 3);
    if (sol === null) { out.innerHTML = '<p class="note">No required return reproduces that price for these inputs — check the values (the price may be outside the achievable range).</p>'; return; }
    r = sol; DDM.r = r * 100; primaryLabel = 'Required return (r)'; primaryVal = (r * 100).toFixed(2) + '%';
  } else { // g
    const sol = ddmBisect((gg) => ddmPrice(div1, gg, r, N, Pn) - P0, -0.9, 3);
    if (sol === null) { out.innerHTML = '<p class="note">No growth rate reproduces that price for these inputs — check the values.</p>'; return; }
    g = sol; DDM.g = g * 100; primaryLabel = 'Implied dividend growth (g)'; primaryVal = (g * 100).toFixed(2) + '%';
  }

  const A = ddmAnnFactor(r, g, N);
  const pvDiv = div1 * A;
  const pvTerm = Pn / Math.pow(1 + r, N);
  const finalDiv = div1 * Math.pow(1 + g, N - 1);
  const price = (DDM.solveFor === 'P0') ? P0 : P0; // P0 is either solved or the given input
  out.innerHTML = `<div class="primary"><span class="plabel">${primaryLabel}</span><span class="pvalue">${primaryVal}</span></div>
    <div class="rrow"><span>PV of ${N} dividends</span><b>${fmtMoney(pvDiv)}</b></div>
    <div class="rrow"><span>PV of sale price (P_N)</span><b>${fmtMoney(pvTerm)}</b></div>
    <div class="rrow"><span>${DDM.solveFor === 'P0' ? 'Total value (P₀)' : 'Price used (P₀)'}</span><b>${fmtMoney(pvDiv + pvTerm)}</b></div>
    <div class="rrow"><span>Final dividend (Div₍ₙ₎)</span><b>${fmtMoney(finalDiv)}</b></div>
    ${note}`;
}

function ddmRenderControls() {
  const host = document.getElementById('ddm-controls'); if (!host) return;
  host.innerHTML = ddmControlsHTML();
  host.querySelector('.ddm-solve').addEventListener('change', (e) => { DDM.solveFor = e.target.value; ddmRenderControls(); ddmCompute(); });
  host.querySelectorAll('.ddm-in').forEach(el => el.addEventListener('input', () => {
    let v = parseFloat(el.value.replace(/[, $]/g, '')); if (isNaN(v)) v = 0;
    DDM[el.dataset.key] = v; ddmCompute();
  }));
}

// called by renderGroup() after the Valuation cards are in the DOM
function wireDDM() { ddmRenderControls(); ddmCompute(); }
