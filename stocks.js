/* ============================================================================
   STOCKS — how to value stocks + an interchangeable return solver.
   Core identity:  Total return  =  Dividend yield  +  Capital gain rate
                   r_E = Div1/P0 + (P1 - P0)/P0
   Reuses helpers from app.js: frac(), fmtMoney().
   ========================================================================== */
'use strict';

const STK = {
  ret:    { solveFor: 'total',  divYield: 3, capGain: 5, total: 8 },        // percents
  gordon: { solveFor: 'price',  div: 2.50, rE: 9, g: 4, price: 50 },        // div/price = $, rE/g = %
};
const pp = (x) => (x === null || x === undefined || isNaN(x) || !isFinite(x)) ? '—' : x.toFixed(2) + '%';

/* -------------------------------- overview ------------------------------- */
function stkOverviewCard() {
  return `<section class="card" id="stk-overview">
    <h3 class="ctitle">How to value a stock</h3>
    ${formulaBlock(
      `r_E = ${frac('Div_1', 'P_0')} + ${frac('P_1 − P_0', 'P_0')} = Dividend yield + Capital gain rate`,
      `r_E = ${frac('Div_1', 'P_0')} + ${frac('P_1 − P_0', 'P_0')};  Dividend yield = ${frac('Div_1', 'P_0')};  Capital gain rate = ${frac('P_1 − P_0', 'P_0')}`)}
    <details class="learn" open><summary>📘 Learn — the logic of stock valuation</summary>
      <div class="learnbody">
        <p><b>The big idea.</b> A share is worth the present value of the cash it puts in your pocket: the
        dividends you collect while you hold it, plus the price you get when you sell. Value today is just those
        future cash flows discounted at the return investors require for the stock's risk (its cost of equity, r<sub>E</sub>).</p>
        <p><b>Total return splits in two.</b> Over one period your return is the dividend you receive plus the
        change in price, both as a percent of what you paid:</p>
        <ul>
          <li><b>Dividend yield</b> = Div₁ ÷ P₀ — income from cash paid out.</li>
          <li><b>Capital gain rate</b> = (P₁ − P₀) ÷ P₀ — return from the price rising.</li>
          <li><b>Total return</b> r<sub>E</sub> = dividend yield + capital gain rate.</li>
        </ul>
        <p><b>Three ways to value the cash flows.</b></p>
        <ul>
          <li><b>Constant-growth (Gordon) model:</b> P₀ = Div₁ ÷ (r<sub>E</sub> − g). Best for stable, steadily
          growing dividend payers. Here the <b>capital gain rate equals the dividend growth rate g</b>, so
          r<sub>E</sub> = dividend yield + g.</li>
          <li><b>Multi-stage dividend model:</b> forecast each dividend during a high-growth phase, then attach a
          Gordon "terminal" value once growth settles.</li>
          <li><b>Total-payout / free-cash-flow-to-equity:</b> value all cash returned to shareholders (dividends
          + buybacks), or the firm's cash flows, when dividends alone don't tell the story.</li>
        </ul>
        <p><b>Why it matters.</b> The same identity lets you flip the question around: knowing any two of
        {total return, dividend yield, capital gain} gives you the third — and rearranging the Gordon model lets
        you back out a fair price, an expected return, or the growth the market is pricing in. The calculators
        below are fully interchangeable for exactly this.</p>
      </div>
    </details>
  </section>`;
}

/* --------------------- interchangeable return solver --------------------- */
const RET_OPTS = [['divYield', 'Dividend yield'], ['capGain', 'Capital gain rate'], ['total', 'Total return']];

function stkReturnCard() {
  const s = STK.ret;
  const seg = RET_OPTS.map(([k, l]) => `<button data-seg="ret" data-v="${k}" class="${s.solveFor === k ? 'active' : ''}">${l}</button>`).join('');
  const inputs = RET_OPTS.filter(([k]) => k !== s.solveFor)
    .map(([k, l]) => `<label class="field"><span class="flabel">${l}</span>
      <span class="inwrap"><input type="text" inputmode="decimal" class="stk-in" data-grp="ret" data-key="${k}" value="${s[k]}"><span class="suffix">%</span></span></label>`).join('');
  return `<section class="card" id="stk-return">
    <h3 class="ctitle">Total Return Solver</h3>
    ${formulaBlock('Total return = Dividend yield + Capital gain rate', 'r_E = Dividend yield + Capital gain rate;  Dividend yield = total − capital gain;  Capital gain = total − dividend yield')}
    <details class="learn"><summary>📘 Learn — using the solver</summary>
      <div class="learnbody">
        <p><b>What it is.</b> The three pieces of a stock's return are linked by one equation, so any one can be
        found from the other two. Pick what you want to solve for; enter the rest.</p>
        <p><b>Inputs.</b> <b>Dividend yield</b> (Div₁/P₀), <b>capital gain rate</b> ((P₁−P₀)/P₀), and
        <b>total return</b> (the cost of equity, r<sub>E</sub>) — enter whichever two you know, as percents.</p>
        <p><b>How it's calculated.</b> Total return = dividend yield + capital gain rate; rearranged,
        dividend yield = total − capital gain, and capital gain = total − dividend yield.</p>
        <p><b>What it means &amp; how to apply it.</b> A stock priced for a 9% return might deliver it as 3% income
        + 6% growth, or 6% income + 3% growth — same total, very different profile. Use it to check whether a
        valuation's implied growth (capital gain) is realistic given the yield you can see today.</p>
      </div>
    </details>
    <div class="seg" data-segrp="ret">${seg}</div>
    <p class="solve-hint">Solving for <b>${RET_OPTS.find(o => o[0] === s.solveFor)[1]}</b></p>
    <div class="fields">${inputs}</div>
    <div class="output" id="ret_out"></div>
  </section>`;
}
function stkUpdateRet() {
  const s = STK.ret;
  if (s.solveFor === 'total') s.total = s.divYield + s.capGain;
  else if (s.solveFor === 'divYield') s.divYield = s.total - s.capGain;
  else s.capGain = s.total - s.divYield;
  const label = RET_OPTS.find(o => o[0] === s.solveFor)[1];
  const out = document.getElementById('ret_out'); if (!out) return;
  out.innerHTML = `<div class="primary"><span class="plabel">${label}</span><span class="pvalue">${pp(s[s.solveFor])}</span></div>
    <div class="rrow"><span>Dividend yield</span><b>${pp(s.divYield)}</b></div>
    <div class="rrow"><span>Capital gain rate</span><b>${pp(s.capGain)}</b></div>
    <div class="rrow"><span>Total return (r_E)</span><b>${pp(s.total)}</b></div>
    ${s.divYield < 0 || s.capGain < 0 ? '<p class="note">A negative component is possible (e.g., a falling price gives a negative capital gain), but check your inputs.</p>' : ''}`;
}

/* ----------------------- returns from market prices ---------------------- */
function stkPricesCard() {
  return `<section class="card" id="stk-prices">
    <h3 class="ctitle">Returns from Prices</h3>
    ${formulaBlock(
      `Dividend yield = ${frac('Div_1', 'P_0')} &nbsp;•&nbsp; Capital gain = ${frac('P_1 − P_0', 'P_0')}`,
      `Total return = ${frac('Div_1 + P_1 − P_0', 'P_0')} = ${frac('Div_1', 'P_0')} + ${frac('P_1 − P_0', 'P_0')}`)}
    <details class="learn"><summary>📘 Learn — where the components come from</summary>
      <div class="learnbody">
        <p><b>What it is.</b> Turns three observable numbers — today's price, the expected dividend, and the
        expected price in one year — into the dividend yield, capital gain rate, and total return.</p>
        <p><b>Inputs.</b> <b>P₀</b> current price you pay; <b>Div₁</b> dividend expected over the year;
        <b>P₁</b> expected price one year out.</p>
        <p><b>How it's calculated.</b> Dividend yield = Div₁/P₀, capital gain rate = (P₁−P₀)/P₀, and the total
        holding-period return is their sum, (Div₁ + P₁ − P₀)/P₀.</p>
        <p><b>What it means &amp; how to apply it.</b> This is the realized/expected return on a one-year hold —
        compare it to the return you require (from CAPM) to judge whether the stock is attractive.</p>
      </div>
    </details>
    <div class="fields">
      <label class="field"><span class="flabel">Current price (P₀)</span><span class="inwrap"><input type="text" inputmode="decimal" class="stk-in" data-grp="px" data-key="P0" value="50"></span></label>
      <label class="field"><span class="flabel">Expected dividend (Div₁)</span><span class="inwrap"><input type="text" inputmode="decimal" class="stk-in" data-grp="px" data-key="Div1" value="2.50"></span></label>
      <label class="field"><span class="flabel">Expected price in 1 yr (P₁)</span><span class="inwrap"><input type="text" inputmode="decimal" class="stk-in" data-grp="px" data-key="P1" value="53"></span></label>
    </div>
    <div class="output" id="px_out"></div>
  </section>`;
}
const PX = { P0: 50, Div1: 2.50, P1: 53 };
function stkUpdatePx() {
  const out = document.getElementById('px_out'); if (!out) return;
  if (!PX.P0) { out.innerHTML = '<p class="note">Enter a current price greater than zero.</p>'; return; }
  const dy = PX.Div1 / PX.P0, cg = (PX.P1 - PX.P0) / PX.P0, tot = dy + cg;
  out.innerHTML = `<div class="primary ${tot >= 0 ? 'good' : 'bad'}"><span class="plabel">Total return</span><span class="pvalue">${pp(tot * 100)}</span></div>
    <div class="rrow"><span>Dividend yield</span><b>${pp(dy * 100)}</b></div>
    <div class="rrow"><span>Capital gain rate</span><b>${pp(cg * 100)}</b></div>
    <div class="rrow"><span>Dollar gain (Div₁ + P₁ − P₀)</span><b>${fmtMoney(PX.Div1 + PX.P1 - PX.P0)}</b></div>`;
}

/* ----------------- interchangeable constant-growth (Gordon) -------------- */
const GOR_OPTS = [['price', 'Price (P₀)'], ['return', 'Required return (r_E)'], ['growth', 'Growth (g)']];
function stkGordonCard() {
  const s = STK.gordon;
  const seg = GOR_OPTS.map(([k, l]) => `<button data-seg="gor" data-v="${k}" class="${s.solveFor === k ? 'active' : ''}">${l.replace(/ \(.*/, '')}</button>`).join('');
  // editable inputs: always Div1, plus the two of {price, rE, g} that aren't being solved
  let fields = `<label class="field"><span class="flabel">Next dividend (Div₁)</span><span class="inwrap"><input type="text" inputmode="decimal" class="stk-in" data-grp="gor" data-key="div" value="${s.div}"></span></label>`;
  const add = (key, label, pct) => `<label class="field"><span class="flabel">${label}</span><span class="inwrap"><input type="text" inputmode="decimal" class="stk-in" data-grp="gor" data-key="${key}" value="${s[key]}">${pct ? '<span class="suffix">%</span>' : ''}</span></label>`;
  if (s.solveFor !== 'price') fields += add('price', 'Current price (P₀)', false);
  if (s.solveFor !== 'return') fields += add('rE', 'Required return (r_E)', true);
  if (s.solveFor !== 'growth') fields += add('g', 'Dividend growth (g)', true);
  return `<section class="card" id="stk-gordon">
    <h3 class="ctitle">Constant-Growth Valuation (Gordon)</h3>
    ${formulaBlock(
      `P_0 = ${frac('Div_1', 'r_E − g')}`,
      `P_0 = ${frac('Div_1', 'r_E − g')} &nbsp;⇔&nbsp; r_E = ${frac('Div_1', 'P_0')} + g &nbsp;⇔&nbsp; g = r_E − ${frac('Div_1', 'P_0')}`)}
    <details class="learn"><summary>📘 Learn — the dividend-growth model</summary>
      <div class="learnbody">
        <p><b>What it is.</b> Values a stock whose dividends grow at a constant rate g forever. Rearrange it to
        solve for the fair <b>price</b>, the <b>required return</b> the price implies, or the <b>growth</b> the
        market is pricing in.</p>
        <p><b>Inputs.</b> <b>Div₁</b> next year's dividend; and two of: <b>P₀</b> price, <b>r_E</b> required
        return (cost of equity), <b>g</b> perpetual dividend growth. Requires r_E &gt; g.</p>
        <p><b>How it's calculated.</b> Price P₀ = Div₁/(r_E − g). Solving for return: r_E = Div₁/P₀ + g.
        Solving for growth: g = r_E − Div₁/P₀.</p>
        <p><b>The key link.</b> In this model the <b>capital gain rate equals g</b> and the <b>dividend yield is
        Div₁/P₀</b>, so total return r_E is exactly dividend yield + capital gain — the same identity as the
        solver above.</p>
        <p><b>How to apply it.</b> Get a target price for a stable dividend payer, estimate a stock's expected
        return from its price, or sanity-check the growth assumption baked into today's price.</p>
      </div>
    </details>
    <div class="seg" data-segrp="gor">${seg}</div>
    <p class="solve-hint">Solving for <b>${GOR_OPTS.find(o => o[0] === s.solveFor)[1]}</b></p>
    <div class="fields">${fields}</div>
    <div class="output" id="gor_out"></div>
  </section>`;
}
function stkUpdateGor() {
  const s = STK.gordon;
  const out = document.getElementById('gor_out'); if (!out) return;
  let primaryLabel, primaryVal, warn = '';
  const rE = s.rE / 100, g = s.g / 100;
  if (s.solveFor === 'price') {
    if (rE <= g) { out.innerHTML = '<p class="note">Required return must exceed growth (r_E &gt; g) for a finite price.</p>'; return; }
    s.price = s.div / (rE - g); primaryLabel = 'Fair price (P₀)'; primaryVal = fmtMoney(s.price);
  } else if (s.solveFor === 'return') {
    if (!s.price) { out.innerHTML = '<p class="note">Enter a price greater than zero.</p>'; return; }
    s.rE = (s.div / s.price + g) * 100; primaryLabel = 'Required return (r_E)'; primaryVal = pp(s.rE);
  } else {
    if (!s.price) { out.innerHTML = '<p class="note">Enter a price greater than zero.</p>'; return; }
    s.g = (rE - s.div / s.price) * 100; primaryLabel = 'Implied growth (g)'; primaryVal = pp(s.g);
  }
  const dy = s.price ? s.div / s.price * 100 : NaN;
  out.innerHTML = `<div class="primary"><span class="plabel">${primaryLabel}</span><span class="pvalue">${primaryVal}</span></div>
    <div class="rrow"><span>Dividend yield (Div₁/P₀)</span><b>${pp(dy)}</b></div>
    <div class="rrow"><span>Capital gain rate (= g)</span><b>${pp(s.g)}</b></div>
    <div class="rrow"><span>Total return (r_E)</span><b>${pp(s.rE)}</b></div>${warn}`;
}

/* --------------------------------- wiring -------------------------------- */
function renderStocks() {
  const main = document.getElementById('main');
  // Generic calculators assigned to the Stocks group (e.g., the Dividend Discount Model).
  const genCalcs = (typeof CALCS !== 'undefined') ? CALCS.filter(c => c.group === 'stk') : [];
  const genHTML = genCalcs.map(calcCardHTML).join('');
  main.innerHTML = stkOverviewCard() + stkReturnCard() + stkPricesCard() + genHTML + stkGordonCard();
  // segmented controls → switch what we solve for, then rebuild
  main.querySelectorAll('.seg button').forEach(b => b.addEventListener('click', () => {
    const grp = b.dataset.seg, v = b.dataset.v;
    if (grp === 'ret') STK.ret.solveFor = v; else STK.gordon.solveFor = v;
    renderStocks();
  }));
  // numeric inputs → update the owning group's state + result
  main.querySelectorAll('.stk-in').forEach(el => el.addEventListener('input', () => {
    let v = parseFloat(el.value.replace(/[, $]/g, '')); if (isNaN(v)) v = 0;
    const grp = el.dataset.grp, key = el.dataset.key;
    if (grp === 'ret') { STK.ret[key] = v; stkUpdateRet(); }
    else if (grp === 'px') { PX[key] = v; stkUpdatePx(); }
    else { STK.gordon[key] = v; stkUpdateGor(); }
  }));
  // wire the generic calculator cards (live compute on input)
  genCalcs.forEach(c => {
    runCalc(c);
    const card = document.getElementById('card__' + c.id);
    if (card) card.querySelectorAll('input,textarea').forEach(el => el.addEventListener('input', () => runCalc(c)));
  });
  stkUpdateRet(); stkUpdatePx(); stkUpdateGor();
  main.scrollTop = 0;
}
