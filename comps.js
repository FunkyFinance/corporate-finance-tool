/* ============================================================================
   COMPARABLES VALUATION WORKSPACE (Valuation tab)
   Multiples valuation per the Valuation & Growth course (Topic #5):
     1) compute each comparable's multiple = value ÷ scaling factor
     2) average them (equal- or value-weighted)
     3) apply the average to the target's projected metric
     4) if using firm-value multiples, bridge: − debt − preferred → ÷ shares
   Defaults reproduce the course's Delta Airlines sales-multiple example.
   ========================================================================== */
'use strict';

const COMPS = {
  mode: 'firm',            // 'firm' = total-value multiples (EV/Sales, EV/EBITDA); 'equity' = price multiples (PE)
  avg: 'equal',            // 'equal' | 'weighted' (value-weighted, slides p.18)
  metricLabel: 'Sales',
  comps: [
    { name: 'United', value: 1000, metric: 1500 },
    { name: 'American', value: 2000, metric: 1250 },
  ],
  target: { name: 'Delta', metric: 2000, debt: 0, pref: 0, shares: 100 },
};

const cmpN = (x, d = 2) => (x === null || x === undefined || isNaN(x) || !isFinite(x)) ? '—'
  : (+x).toLocaleString('en-US', { maximumFractionDigits: d });
const cmpMoney = (x) => (x === null || x === undefined || isNaN(x) || !isFinite(x)) ? '—'
  : (x < 0 ? '-$' : '$') + Math.abs(x).toLocaleString('en-US', { maximumFractionDigits: 2 });

function compsCalc() {
  const rows = COMPS.comps.map(c => ({ ...c, mult: (c.metric > 0) ? c.value / c.metric : NaN }))
    .filter(c => c.name || c.value || c.metric);
  const valid = rows.filter(c => isFinite(c.mult));
  let avg = NaN;
  if (valid.length) {
    if (COMPS.avg === 'equal') avg = valid.reduce((a, c) => a + c.mult, 0) / valid.length;
    else {
      const tot = valid.reduce((a, c) => a + c.value, 0);
      avg = tot > 0 ? valid.reduce((a, c) => a + (c.value / tot) * c.mult, 0) : NaN;
    }
  }
  const t = COMPS.target;
  const implied = avg * t.metric;                       // firm value (firm mode) or equity value (equity mode)
  const equity = COMPS.mode === 'firm' ? implied - t.debt - t.pref : implied;
  const perShare = t.shares > 0 ? equity / t.shares : NaN;
  return { rows, valid, avg, implied, equity, perShare };
}

function compsCardHTML() {
  return `<section class="card" id="comps-card">
    <h3 class="ctitle">Comparables Valuation Workspace</h3>
    ${formulaBlock(
      `Multiple = ${frac('Value', 'Scaling factor')};  Target value = Avg multiple × Target metric`,
      `Each comp: m_i = Value_i / Metric_i;  equal-weighted avg = mean(m_i);  value-weighted avg = Σ w_i·m_i with w_i = Value_i/ΣValue;  Equity = Implied value − Debt − Preferred;  Per share = Equity / Shares`)}
    <details class="learn"><summary>📘 Learn — valuing with multiples</summary>
      <div class="learnbody">
        <p><b>What it is.</b> An alternative to DCF (from the Valuation &amp; Growth course): rather than forecast
        cash flows, value a company at the same <i>multiple</i> of a scaling factor (sales, EBITDA, earnings)
        that comparable firms trade at.</p>
        <p><b>Inputs.</b></p>
        <ul>
          <li><b>Multiple type</b> — <i>firm-value</i> multiples put total value (debt + equity) in the numerator
          (EV/Sales, EV/EBITDA) and value the whole firm; <i>equity</i> multiples put the stock price in the
          numerator (the PE ratio) and value just the equity.</li>
          <li><b>Comparables</b> — each comp's value and its scaling-factor metric; the workspace computes each
          comp's multiple.</li>
          <li><b>Averaging</b> — <i>equal-weighted</i> is the simple mean; <i>value-weighted</i> gives larger
          firms more weight (sensible when big comps are more representative).</li>
          <li><b>Target</b> — its projected metric, plus (for firm-value multiples) its debt, preferred equity,
          and shares to get from total value down to a per-share price.</li>
        </ul>
        <p><b>How it's calculated.</b> Average the comps' multiples, multiply by the target's metric. With a
        firm-value multiple, subtract the target's debt (and preferred) to get equity, then divide by shares.
        With an equity multiple, the implied value is already the equity value.</p>
        <p><b>What the answer means.</b> What the target would be worth if the market priced it like its peers.
        The course's Delta example: United at $1b/$1.5b sales (0.67×) and American at $2b/$1.25b (1.6×) average
        to 1.13×; applied to Delta's $2b projected sales → ≈ $2.26b.</p>
        <p><b>How to apply it.</b> A sanity check and complement to DCF — especially when forecasting cash flows
        is hard (startups, IPOs, VC). Try different scaling factors and comparables: the answer varies widely,
        which is exactly why the course calls valuation "part science, part art."</p>
      </div>
    </details>

    <div class="fields">
      <label class="field"><span class="flabel">Multiple type</span>
        <select id="comps-mode">
          <option value="firm" ${COMPS.mode === 'firm' ? 'selected' : ''}>Firm-value multiple (EV/Sales, EV/EBITDA)</option>
          <option value="equity" ${COMPS.mode === 'equity' ? 'selected' : ''}>Equity multiple (PE, price-based)</option>
        </select></label>
      <label class="field"><span class="flabel">Scaling factor label</span>
        <span class="inwrap"><input type="text" id="comps-metric" value="${COMPS.metricLabel}"></span></label>
    </div>
    <div class="seg" id="comps-avg">
      <button data-v="equal" class="${COMPS.avg === 'equal' ? 'active' : ''}">Equal-weighted</button>
      <button data-v="weighted" class="${COMPS.avg === 'weighted' ? 'active' : ''}">Value-weighted</button>
    </div>

    <h4 class="sub">Comparable firms</h4>
    <div class="tablewrap">
      <table class="pftable" id="comps-table">
        <thead><tr><th>Comp</th><th>${COMPS.mode === 'firm' ? 'Total value' : 'Price'}</th><th>${COMPS.metricLabel}</th><th>Multiple</th><th></th></tr></thead>
        <tbody id="comps-rows"></tbody>
      </table>
    </div>
    <button class="formula-toggle" id="comps-add">＋ Add comparable</button>

    <h4 class="sub">Target</h4>
    <div class="fields" id="comps-target">
      <label class="field"><span class="flabel">Target name</span>
        <span class="inwrap"><input type="text" class="comps-t" data-key="name" data-txt="1" value="${COMPS.target.name}"></span></label>
      <label class="field"><span class="flabel">Projected ${COMPS.metricLabel}</span>
        <span class="inwrap"><input type="text" inputmode="decimal" class="comps-t" data-key="metric" value="${COMPS.target.metric}"></span></label>
      ${COMPS.mode === 'firm' ? `
      <label class="field"><span class="flabel">Target debt</span>
        <span class="inwrap"><input type="text" inputmode="decimal" class="comps-t" data-key="debt" value="${COMPS.target.debt}"></span></label>
      <label class="field"><span class="flabel">Target preferred equity</span>
        <span class="inwrap"><input type="text" inputmode="decimal" class="comps-t" data-key="pref" value="${COMPS.target.pref}"></span></label>` : ''}
      <label class="field"><span class="flabel">Shares outstanding</span>
        <span class="inwrap"><input type="text" inputmode="decimal" class="comps-t" data-key="shares" value="${COMPS.target.shares}"></span></label>
    </div>

    <div class="output" id="comps-out"></div>
    <p class="note">Enter values in consistent units (e.g., all $ millions). The Delta example ships as the default —
    replace it with your own comps.</p>
  </section>`;
}

function compsRowsHTML() {
  return COMPS.comps.map((c, i) => {
    const mult = c.metric > 0 ? c.value / c.metric : NaN;
    return `<tr>
      <td><input type="text" class="comps-c" data-i="${i}" data-key="name" data-txt="1" value="${c.name}"></td>
      <td><input type="text" inputmode="decimal" class="comps-c" data-i="${i}" data-key="value" value="${c.value}"></td>
      <td><input type="text" inputmode="decimal" class="comps-c" data-i="${i}" data-key="metric" value="${c.metric}"></td>
      <td><b>${cmpN(mult)}×</b></td>
      <td><button class="comps-del" data-i="${i}" title="Remove">✕</button></td>
    </tr>`;
  }).join('');
}

function compsUpdate(rebuildRows) {
  if (rebuildRows) {
    const tb = document.getElementById('comps-rows');
    if (tb) { tb.innerHTML = compsRowsHTML(); compsWireRows(); }
  } else {
    // refresh just the computed multiple cells
    const { rows } = compsCalc();
    document.querySelectorAll('#comps-rows tr').forEach((tr, i) => {
      const c = COMPS.comps[i]; if (!c) return;
      const mult = c.metric > 0 ? c.value / c.metric : NaN;
      tr.children[3].innerHTML = `<b>${cmpN(mult)}×</b>`;
    });
  }
  const { valid, avg, implied, equity, perShare } = compsCalc();
  const out = document.getElementById('comps-out'); if (!out) return;
  const t = COMPS.target;
  const label = COMPS.mode === 'firm' ? 'Implied firm value' : 'Implied equity value';
  out.innerHTML = `<div class="primary"><span class="plabel">${label} — ${t.name || 'Target'}</span>
      <span class="pvalue">${cmpMoney(implied)}</span></div>
    <div class="rrow"><span>Average multiple (${COMPS.avg === 'equal' ? 'equal' : 'value'}-weighted, ${valid.length} comp${valid.length === 1 ? '' : 's'})</span><b>${cmpN(avg)}× ${COMPS.metricLabel}</b></div>
    ${COMPS.mode === 'firm' ? `<div class="rrow"><span>− Debt − Preferred</span><b>${cmpMoney(-(t.debt + t.pref))}</b></div>
    <div class="rrow"><span>Equity value</span><b>${cmpMoney(equity)}</b></div>` : ''}
    <div class="rrow"><span>Value per share</span><b>${cmpMoney(perShare)}</b></div>`;
}

function compsWireRows() {
  document.querySelectorAll('.comps-c').forEach(el => el.addEventListener('input', () => {
    const c = COMPS.comps[+el.dataset.i]; if (!c) return;
    if (el.dataset.txt) c[el.dataset.key] = el.value;
    else { let v = parseFloat(el.value.replace(/[, $]/g, '')); c[el.dataset.key] = isNaN(v) ? 0 : v; }
    compsUpdate(false);
  }));
  document.querySelectorAll('.comps-del').forEach(el => el.addEventListener('click', () => {
    COMPS.comps.splice(+el.dataset.i, 1);
    if (!COMPS.comps.length) COMPS.comps.push({ name: '', value: 0, metric: 0 });
    compsUpdate(true);
  }));
}

function wireComps() {
  const card = document.getElementById('comps-card'); if (!card) return;
  document.getElementById('comps-mode').addEventListener('change', (e) => { COMPS.mode = e.target.value; rerenderCompsCard(); });
  document.getElementById('comps-metric').addEventListener('input', (e) => {
    COMPS.metricLabel = e.target.value || 'Metric';
    // live-update the header + target label without a full rebuild
    const ths = card.querySelectorAll('#comps-table thead th');
    if (ths[2]) ths[2].textContent = COMPS.metricLabel;
    const lab = card.querySelector('.comps-t[data-key="metric"]')?.closest('.field')?.querySelector('.flabel');
    if (lab) lab.textContent = 'Projected ' + COMPS.metricLabel;
    compsUpdate(false);
  });
  document.querySelectorAll('#comps-avg button').forEach(b => b.addEventListener('click', () => {
    COMPS.avg = b.dataset.v;
    document.querySelectorAll('#comps-avg button').forEach(x => x.classList.toggle('active', x === b));
    compsUpdate(false);
  }));
  document.getElementById('comps-add').addEventListener('click', () => {
    COMPS.comps.push({ name: '', value: 0, metric: 0 });
    compsUpdate(true);
  });
  document.querySelectorAll('.comps-t').forEach(el => el.addEventListener('input', () => {
    if (el.dataset.txt) COMPS.target[el.dataset.key] = el.value;
    else { let v = parseFloat(el.value.replace(/[, $]/g, '')); COMPS.target[el.dataset.key] = isNaN(v) ? 0 : v; }
    compsUpdate(false);
  }));
  compsUpdate(true);
}

function rerenderCompsCard() {
  const card = document.getElementById('comps-card'); if (!card) return;
  card.outerHTML = compsCardHTML();
  wireComps();
}
