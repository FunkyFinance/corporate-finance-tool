/* ============================================================================
   SEARCH TAB — find any term, equation, or calculator and jump to it.
   Indexes the interactive equations, the stream calculators, and the custom
   solvers (CAPM, DDM, Stocks, Pro Forma, Final Report).
   ========================================================================== */
'use strict';

let SEARCH_Q = '';
const stripTags = (s) => String(s || '').replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();

function buildSearchIndex() {
  const groupLabel = {};
  (typeof GROUPS !== 'undefined' ? GROUPS : []).forEach(g => groupLabel[g.id] = g.label);
  const idx = [];

  // interactive equations
  (typeof ISOLVER_EQS !== 'undefined' ? ISOLVER_EQS : []).forEach(eq => idx.push({
    title: eq.title, group: eq.group, anchor: 'eq__' + eq.id, formula: eq.formula,
    terms: [eq.title, stripTags(eq.formula), eq.vars.map(v => v.label).join(' '), eq.learn && eq.learn.whatItIs, eq.learn && eq.learn.application].join(' '),
  }));

  // stream calculators that stay multi-input
  (typeof CALCS !== 'undefined' ? CALCS : []).forEach(c => idx.push({
    title: c.title, group: c.group, anchor: 'card__' + c.id, formula: c.formula,
    terms: [c.title, stripTags(c.formula), (c.learn && c.learn.whatItIs) || ''].join(' '),
  }));

  // custom solver cards
  const custom = [
    { title: 'CAPM — Cost of Equity', group: 'coc', anchor: 'capm-card', formula: 'r_E = r_f + β × (E(r_m) − r_f)', kw: 'capm beta risk free market risk premium cost of equity required return' },
    { title: 'Dividend Discount Model — Finite Horizon', group: 'val', anchor: 'ddm-card', formula: 'P_0 = Σ Div_t/(1+r)^t + P_N/(1+r)^N', kw: 'dividend discount ddm finite horizon stock value sale price' },
    { title: 'Comparables Valuation Workspace', group: 'val', anchor: 'comps-card', formula: 'Target value = Avg multiple × Target metric', kw: 'comparables comps multiples valuation ev sales ebitda pe ratio peer equal weighted value weighted delta relative valuation' },
    { title: 'How to value a stock', group: 'stk', anchor: 'stk-overview', formula: 'r_E = Div_1/P_0 + (P_1 − P_0)/P_0', kw: 'stock valuation dividend yield capital gain total return overview' },
    { title: 'Total Return Solver', group: 'stk', anchor: 'stk-return', formula: 'Total return = Dividend yield + Capital gain rate', kw: 'dividend yield capital gain total return solve' },
    { title: 'Returns from Prices', group: 'stk', anchor: 'stk-prices', formula: 'Dividend yield = Div_1/P_0 ; Capital gain = (P_1 − P_0)/P_0', kw: 'price dividend yield capital gain holding period return' },
    { title: 'Constant-Growth (Gordon) Valuation', group: 'stk', anchor: 'stk-gordon', formula: 'P_0 = Div_1/(r_E − g)', kw: 'gordon constant growth dividend valuation required return' },
    { title: 'Import a Financial Report', group: 'imp', anchor: 'imp-card', formula: 'photo → OCR → review → apply to calculators', kw: 'import photo camera scan upload ocr 10-k 10k income statement balance sheet cash flow p&l profit loss pro forma read document' },
    { title: 'Pro Forma — FCF & NPV', group: 'pf', anchor: 'pf-card', formula: 'NPV = Σ FCF_t/(1+r)^t', kw: 'pro forma proforma npv free cash flow capital budgeting export excel' },
    { title: 'Final Report — Forecasted Model', group: 'fr', anchor: 'fr-card', formula: 'IS · FCF · NPV · IRR · ratios', kw: 'final report financial statements income statement npv irr ratios export pdf excel' },
  ];
  custom.forEach(c => idx.push({ title: c.title, group: c.group, anchor: c.anchor, formula: c.formula, terms: [c.title, stripTags(c.formula), c.kw].join(' ') }));

  idx.forEach(e => { e.groupLabel = groupLabel[e.group] || e.group; e.terms = e.terms.toLowerCase(); });
  return idx;
}

function searchGoTo(group, anchor) {
  state.group = group;
  renderTabs(); renderGroup();
  requestAnimationFrame(() => {
    const el = document.getElementById(anchor);
    if (el) { el.scrollIntoView({ block: 'start' }); window.scrollBy(0, -70); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1600); }
  });
}

function renderSearch() {
  const main = document.getElementById('main');
  main.innerHTML = `<section class="card">
    <h3 class="ctitle">Search</h3>
    <p class="lead">Find any formula, term, or calculator across the whole app and jump straight to it.</p>
    <label class="field wide"><span class="flabel">Search formulas &amp; terms</span>
      <span class="inwrap"><input type="text" id="search-box" placeholder="e.g. WACC, dividend yield, NPV, salvage, beta…" value="${SEARCH_Q.replace(/"/g, '&quot;')}"></span></label>
    <div id="search-results"></div>
  </section>`;
  const box = document.getElementById('search-box');
  box.addEventListener('input', () => { SEARCH_Q = box.value; searchRender(); });
  box.focus();
  searchRender();
}

function searchRender() {
  const wrap = document.getElementById('search-results'); if (!wrap) return;
  const idx = buildSearchIndex();
  const q = SEARCH_Q.trim().toLowerCase();
  const tokens = q.split(/\s+/).filter(Boolean);
  const hits = tokens.length === 0 ? idx : idx.filter(e => tokens.every(t => e.terms.includes(t)));
  if (!hits.length) { wrap.innerHTML = `<p class="note">No matches for “${SEARCH_Q}”. Try a shorter term like “rate”, “bond”, or “cash flow”.</p>`; return; }
  wrap.innerHTML = `<p class="solve-hint">${hits.length} result${hits.length === 1 ? '' : 's'}${q ? '' : ' — everything'}</p>` +
    hits.map(e => `<button class="search-hit" data-group="${e.group}" data-anchor="${e.anchor}">
      <span class="sh-top"><b>${e.title}</b><span class="sh-tag">${e.groupLabel}</span></span>
      <span class="sh-formula formula">${e.formula}</span>
    </button>`).join('');
  wrap.querySelectorAll('.search-hit').forEach(b => b.addEventListener('click', () => searchGoTo(b.dataset.group, b.dataset.anchor)));
}
