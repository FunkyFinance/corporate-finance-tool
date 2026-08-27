/* ============================================================================
   CAPM — Cost of equity, interactive solver. (Cost of Capital tab)
       r_E = r_f + β × (E(r_m) − r_f) = r_f + β × Market Risk Premium
   Uses the MARKET RISK PREMIUM directly (= E(r_m) − r_f), so every variable
   solves in closed form. Solve for: r_E, r_f, β, or the market risk premium.
   ========================================================================== */
'use strict';

// Defaults match the classic CAPM exam setup (β 0.56, r_f 6.82%, MRP 5.46% → 9.88%).
const CAPM = { solveFor: 'rE', rf: 6.82, beta: 0.56, mrp: 5.46, rE: 9.88 }; // percents except beta
const CAPM_OPTS = [
  ['rE', 'Expected return / cost of equity (r_E)'],
  ['rf', 'Risk-free rate (r_f)'],
  ['beta', 'Beta (β)'],
  ['mrp', 'Market risk premium'],
];
const capmFmt = (x) => (x === null || x === undefined || isNaN(x)) ? '—' : x.toFixed(2) + '%';

function capmCardHTML() {
  return `<section class="card" id="capm-card">
    <h3 class="ctitle">CAPM — Cost of Equity (interactive)</h3>
    ${formulaBlock('r_E = r_f + β × Market risk premium', 'r_E = r_f + β × (E(r_m) − r_f);  where Market risk premium = E(r_m) − r_f')}
    <details class="learn"><summary>📘 Learn — inputs, method, meaning &amp; application</summary>
      <div class="learnbody">
        <p><b>What it is.</b> The Capital Asset Pricing Model: the return investors require for bearing a stock's
        market (systematic) risk — i.e., its cost of equity. Both course formula sheets use this same equation
        (Gormley writes it r_i = r_f + β_i(r_m − r_f)).</p>
        <p><b>Inputs.</b></p>
        <ul>
          <li><b>Risk-free rate (r_f)</b> — return on a safe asset, e.g., a Treasury yield.</li>
          <li><b>Beta (β)</b> — how much the stock moves with the market. β = 1 moves with the market; β &gt; 1 is
          more volatile; β &lt; 1 is defensive.</li>
          <li><b>Market risk premium (MRP)</b> — the <i>extra</i> return the market offers over the risk-free rate,
          i.e. <b>MRP = E(r_m) − r_f</b>. ⚠️ This is <b>not</b> the same as the expected market return E(r_m).
          If your problem gives the <b>premium</b> (very common), enter it here directly. If it gives the
          <b>expected market return</b>, subtract the risk-free rate first (MRP = E(r_m) − r_f).</li>
        </ul>
        <p><b>How it's calculated.</b> Add a risk premium — beta times the market risk premium — to the risk-free
        rate: r_E = r_f + β·MRP. Only systematic risk is rewarded; diversifiable risk is not. Because the
        relationship is exact, you can solve it for any single variable.</p>
        <p><b>What the answer means.</b> The minimum return the stock must offer to compensate for its market
        risk — its cost of equity.</p>
        <p><b>How to apply it.</b> Feeds the cost of equity (r_e) into WACC, and gives the discount rate for
        equity cash flows. Higher beta ⇒ higher required return ⇒ lower value, all else equal.</p>
      </div>
    </details>
    <div id="capm-controls"></div>
    <div class="output" id="capm_out"></div>
  </section>`;
}

function capmControlsHTML() {
  const opts = CAPM_OPTS.map(([k, l]) => `<option value="${k}" ${CAPM.solveFor === k ? 'selected' : ''}>${l.replace(/_/g, '')}</option>`).join('');
  const fld = (key, label, pct) => CAPM.solveFor === key ? '' :
    `<label class="field"><span class="flabel">${label}</span>
      <span class="inwrap"><input type="text" inputmode="decimal" class="capm-in" data-key="${key}" value="${CAPM[key]}">${pct ? '<span class="suffix">%</span>' : ''}</span></label>`;
  const solveLabel = CAPM_OPTS.find(o => o[0] === CAPM.solveFor)[1];
  return `<label class="field wide"><span class="flabel">Solve for</span>
      <select class="capm-solve">${opts}</select></label>
    <p class="solve-hint">Solving for <b>${solveLabel}</b> — enter the rest.</p>
    <div class="fields">
      ${fld('rf', 'Risk-free rate (r_f)', true)}
      ${fld('beta', 'Beta (β)', false)}
      ${fld('mrp', 'Market risk premium', true)}
      ${fld('rE', 'Expected return (r_E)', true)}
    </div>`;
}

function capmCompute() {
  const out = document.getElementById('capm_out'); if (!out) return;
  let { rf, beta, mrp, rE } = CAPM;
  let primaryLabel, primaryVal;
  if (CAPM.solveFor === 'rE') {
    rE = rf + beta * mrp; CAPM.rE = rE;
    primaryLabel = 'Expected return (cost of equity, r_E)'; primaryVal = capmFmt(rE);
  } else if (CAPM.solveFor === 'rf') {
    rf = rE - beta * mrp; CAPM.rf = rf;
    primaryLabel = 'Risk-free rate (r_f)'; primaryVal = capmFmt(rf);
  } else if (CAPM.solveFor === 'beta') {
    if (mrp === 0) { out.innerHTML = '<p class="note">Market risk premium can\'t be 0 when solving for beta.</p>'; return; }
    beta = (rE - rf) / mrp; CAPM.beta = beta;
    primaryLabel = 'Beta (β)'; primaryVal = beta.toFixed(3);
  } else {
    if (beta === 0) { out.innerHTML = '<p class="note">Beta can\'t be 0 when solving for the market risk premium.</p>'; return; }
    mrp = (rE - rf) / beta; CAPM.mrp = mrp;
    primaryLabel = 'Market risk premium'; primaryVal = capmFmt(mrp);
  }
  const stockPrem = beta * mrp;
  const erm = rf + mrp;
  const costEq = rf + beta * mrp;
  out.innerHTML = `<div class="primary"><span class="plabel">${primaryLabel}</span><span class="pvalue">${primaryVal}</span></div>
    <div class="rrow"><span>Risk-free rate (r_f)</span><b>${capmFmt(rf)}</b></div>
    <div class="rrow"><span>Beta (β)</span><b>${beta.toFixed(3)}</b></div>
    <div class="rrow"><span>Market risk premium (MRP)</span><b>${capmFmt(mrp)}</b></div>
    <div class="rrow"><span>Stock's risk premium (β × MRP)</span><b>${capmFmt(stockPrem)}</b></div>
    <div class="rrow"><span>Expected market return E(r_m) = r_f + MRP</span><b>${capmFmt(erm)}</b></div>
    <div class="rrow"><span>Cost of equity (r_E)</span><b>${capmFmt(costEq)}</b></div>`;
}

function capmRenderControls() {
  const host = document.getElementById('capm-controls'); if (!host) return;
  host.innerHTML = capmControlsHTML();
  host.querySelector('.capm-solve').addEventListener('change', (e) => { CAPM.solveFor = e.target.value; capmRenderControls(); capmCompute(); });
  host.querySelectorAll('.capm-in').forEach(el => el.addEventListener('input', () => {
    let v = parseFloat(el.value.replace(/[, $]/g, '')); if (isNaN(v)) v = 0;
    CAPM[el.dataset.key] = v; capmCompute();
  }));
}

// called by renderGroup() after the Cost of Capital cards are in the DOM
function wireCapm() { capmRenderControls(); capmCompute(); }
