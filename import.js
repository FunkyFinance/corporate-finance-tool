/* ============================================================================
   📷 IMPORT — snap or upload a financial report and pull numbers into the app.
   Pipeline: photo → on-device OCR (Tesseract.js, nothing leaves the phone) →
   line-item parser (10-K / P&L / balance sheet / cash-flow synonyms) →
   review-and-edit grid → one-tap apply into the relevant calculators.
   ========================================================================== */
'use strict';

const IMP = { busy: false, ocrText: '', scaleNote: '', fields: {} };

/* Fields we try to detect. synonyms are matched longest-first, per line. */
const IMP_FIELDS = [
  { key: 'revenue',  label: 'Revenue / Net sales', not: ['cost of'], syn: ['total net revenues', 'total net revenue', 'total net sales', 'total revenues', 'total revenue', 'net revenues', 'net revenue', 'net sales', 'revenues', 'revenue', 'sales'] },
  { key: 'cogs',     label: 'Cost of goods sold', syn: ['cost of goods sold', 'cost of revenues', 'cost of revenue', 'cost of sales', 'cogs'] },
  { key: 'opex',     label: 'Operating expenses / SG&A', syn: ['total operating expenses', 'selling, general and administrative', 'selling general and administrative', 'operating expenses', 'sg&a'] },
  { key: 'dep',      label: 'Depreciation & amortization', syn: ['depreciation and amortization', 'depreciation & amortization', 'depreciation, depletion and amortization', 'depreciation'] },
  { key: 'ebit',     label: 'EBIT / Operating income', syn: ['income from operations', 'operating income', 'operating profit', 'ebit'] },
  { key: 'interest', label: 'Interest expense', syn: ['interest expense'] },
  { key: 'pretax',   label: 'Pre-tax income', syn: ['income before income taxes', 'income before taxes', 'earnings before income taxes', 'earnings before taxes', 'pre-tax income', 'pretax income'] },
  { key: 'tax',      label: 'Income tax expense', not: ['before', 'deferred'], syn: ['provision for income taxes', 'income tax expense', 'income tax provision', 'income taxes'] },
  { key: 'ni',       label: 'Net income', syn: ['net income attributable', 'net earnings', 'net income', 'net loss'] },
  { key: 'capex',    label: 'Capital expenditures', syn: ['purchases of property and equipment', 'payments for property and equipment', 'additions to property and equipment', 'purchases of property, plant and equipment', 'capital expenditures', 'capex'] },
  { key: 'cash',     label: 'Cash & equivalents', not: ['restricted'], syn: ['cash and cash equivalents', 'cash and equivalents', 'cash & cash equivalents'] },
  { key: 'ar',       label: 'Accounts receivable', syn: ['accounts receivable', 'trade receivables', 'receivables'] },
  { key: 'inv',      label: 'Inventory', syn: ['inventories', 'inventory'] },
  { key: 'ap',       label: 'Accounts payable', syn: ['accounts payable'] },
  { key: 'ca',       label: 'Total current assets', syn: ['total current assets'] },
  { key: 'cl',       label: 'Total current liabilities', syn: ['total current liabilities'] },
  { key: 'debt',     label: 'Total / long-term debt', syn: ['total long-term debt', 'long-term debt', 'long term debt', 'total debt', 'notes payable'] },
  { key: 'equity',   label: "Shareholders' equity", syn: ["total stockholders' equity", "total shareholders' equity", "total stockholders equity", "total shareholders equity", "stockholders' equity", "shareholders' equity"] },
  { key: 'shares',   label: 'Shares outstanding', syn: ['weighted average shares outstanding', 'weighted-average shares', 'diluted shares outstanding', 'shares outstanding'] },
  { key: 'div',      label: 'Dividends paid', syn: ['dividends paid', 'payment of dividends', 'cash dividends'] },
];

/* ------------------------------ number parsing --------------------------- */
function impNumbersIn(line) {
  // capture money-ish tokens: $1,234.5  (1,234)  1234.5  — skip years & percents
  const out = [];
  const re = /\(?\$?\s?(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)\)?(%?)/g;
  let m;
  while ((m = re.exec(line))) {
    if (m[2] === '%') continue;
    const raw = m[1].replace(/,/g, '');
    let v = parseFloat(raw);
    if (isNaN(v)) continue;
    // skip bare 4-digit years 1980-2099 with no commas/decimals
    if (/^(19[89]\d|20\d\d)$/.test(raw) && m[0].indexOf(',') < 0 && raw.indexOf('.') < 0) continue;
    const neg = m[0].trim().startsWith('(');
    out.push(neg ? -v : v);
  }
  return out;
}

function impParse(text) {
  const lines = text.split(/\n+/).map(l => l.trim()).filter(Boolean);
  const lower = lines.map(l => l.toLowerCase());
  const fields = {};
  IMP_FIELDS.forEach(f => {
    for (let i = 0; i < lines.length; i++) {
      const hit = f.syn.find(s => lower[i].includes(s));
      if (!hit) continue;
      if ((f.not || []).some(x => lower[i].includes(x))) continue;
      const nums = impNumbersIn(lines[i]);
      if (!nums.length) continue;
      fields[f.key] = { label: f.label, value: nums[0], line: lines[i], use: true };
      break; // first matching line wins (most recent column first in filings)
    }
  });
  // units note
  let scaleNote = '';
  const all = text.toLowerCase();
  if (all.includes('in millions')) scaleNote = 'Statement appears to be “in millions” — values are in $ millions.';
  else if (all.includes('in thousands')) scaleNote = 'Statement appears to be “in thousands” — values are in $ thousands.';
  return { fields, scaleNote };
}

/* ------------------------------ OCR pipeline ----------------------------- */
function impLoadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = () => rej(new Error('load failed: ' + src));
    document.head.appendChild(s);
  });
}

let impWorker = null;
async function impEnsureWorker(onProgress) {
  if (impWorker) return impWorker;
  const local = './vendor/tesseract/';
  const cdnJs = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/';
  const cdnCore = 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/';
  const cdnLang = 'https://tessdata.projectnaptha.com/4.0.0_fast/';
  let useLocal = true;
  try { const h = await fetch(local + 'tesseract.min.js', { method: 'HEAD' }); if (!h.ok) useLocal = false; }
  catch (_) { useLocal = false; }
  if (typeof Tesseract === 'undefined') {
    await impLoadScript(useLocal ? local + 'tesseract.min.js' : cdnJs + 'tesseract.min.js');
  }
  impWorker = await Tesseract.createWorker('eng', 1, {
    workerPath: useLocal ? local + 'worker.min.js' : cdnJs + 'worker.min.js',
    corePath: useLocal ? local + 'tesseract-core-simd-lstm.wasm.js' : cdnCore + 'tesseract-core-simd-lstm.wasm.js',
    langPath: useLocal ? local + 'lang' : cdnLang,
    gzip: true,
    logger: (m) => { if (m.status === 'recognizing text' && onProgress) onProgress(m.progress); },
  });
  return impWorker;
}

function impDownscale(file) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const MAX = 1800;
      let { width: w, height: h } = img;
      const k = Math.min(1, MAX / Math.max(w, h));
      const cv = document.createElement('canvas');
      cv.width = Math.round(w * k); cv.height = Math.round(h * k);
      const cx = cv.getContext('2d');
      cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height);
      cx.drawImage(img, 0, 0, cv.width, cv.height);
      res(cv);
    };
    img.onerror = () => rej(new Error('could not read that image'));
    img.src = URL.createObjectURL(file);
  });
}

async function impRun(file) {
  if (IMP.busy) return;
  IMP.busy = true;
  const st = document.getElementById('imp-status');
  const bar = document.getElementById('imp-bar');
  const setBar = (p) => { if (bar) bar.style.width = Math.round(p * 100) + '%'; };
  try {
    st.textContent = 'Preparing image…'; setBar(0.02);
    const canvas = await impDownscale(file);
    const prev = document.getElementById('imp-preview');
    prev.innerHTML = ''; prev.appendChild(canvas); canvas.className = 'imp-thumb';
    st.textContent = 'Loading OCR engine (first time only — ~6 MB)…'; setBar(0.06);
    const worker = await impEnsureWorker((p) => { setBar(0.1 + p * 0.85); st.textContent = 'Reading the document… ' + Math.round(p * 100) + '%'; });
    const { data } = await worker.recognize(canvas);
    IMP.ocrText = data.text || '';
    const { fields, scaleNote } = impParse(IMP.ocrText);
    IMP.fields = fields; IMP.scaleNote = scaleNote;
    setBar(1);
    const n = Object.keys(fields).length;
    st.textContent = n ? `Done — detected ${n} line item${n === 1 ? '' : 's'}. Review below, fix anything, then apply.`
      : 'Done, but no familiar line items found. Try a tighter, straighter, well-lit photo of one statement.';
    impRenderReview();
  } catch (e) {
    st.textContent = '⚠️ ' + (e.message || 'Import failed.') + (location.protocol === 'file:' ? ' (The importer needs the hosted app, not the single-file version.)' : '');
  } finally { IMP.busy = false; }
}

/* ------------------------------ review + apply --------------------------- */
function impRenderReview() {
  const host = document.getElementById('imp-review'); if (!host) return;
  const keys = Object.keys(IMP.fields);
  if (!keys.length) { host.innerHTML = ''; return; }
  const rows = keys.map(k => {
    const f = IMP.fields[k];
    return `<tr>
      <td><input type="checkbox" class="imp-use" data-k="${k}" ${f.use ? 'checked' : ''}></td>
      <th>${f.label}</th>
      <td><input type="text" inputmode="decimal" class="imp-val" data-k="${k}" value="${f.value}"></td>
    </tr>`;
  }).join('');
  host.innerHTML = `
    ${IMP.scaleNote ? `<p class="note">${IMP.scaleNote} Keep units consistent when you apply.</p>` : ''}
    <div class="tablewrap"><table class="pftable">
      <thead><tr><th>Use</th><th>Detected line item</th><th>Value</th></tr></thead>
      <tbody>${rows}</tbody></table></div>
    <h4 class="sub">Apply to calculators</h4>
    <div class="imp-apply">
      <button class="export imp-go" data-t="fcf">→ Free Cash Flow tab</button>
      <button class="export imp-go" data-t="coc">→ Cost of Capital (WACC)</button>
      <button class="export imp-go" data-t="val">→ Valuation (equity bridge)</button>
      <button class="export imp-go" data-t="fr">→ Final Report drivers</button>
    </div>
    <p class="note">Applying fills the matching inputs and jumps to that tab. OCR makes mistakes — always verify
    against the original document.</p>`;
  host.querySelectorAll('.imp-val').forEach(el => el.addEventListener('input', () => {
    let v = parseFloat(el.value.replace(/[, $()]/g, '')); if (isNaN(v)) v = 0;
    IMP.fields[el.dataset.k].value = v;
  }));
  host.querySelectorAll('.imp-use').forEach(el => el.addEventListener('change', () => {
    IMP.fields[el.dataset.k].use = el.checked;
  }));
  host.querySelectorAll('.imp-go').forEach(b => b.addEventListener('click', () => impApply(b.dataset.t)));
}

function impVal(k) { const f = IMP.fields[k]; return (f && f.use) ? f.value : null; }
function impTaxRatePct() {
  const t = impVal('tax'), p = impVal('pretax');
  if (t !== null && p) return Math.round(Math.abs(t / p) * 10000) / 100;
  return null;
}
function impSetEq(id, assign) {
  const eq = (typeof ISOLVER_EQS !== 'undefined') && ISOLVER_EQS.find(e => e.id === id);
  if (!eq) return;
  const st = eqState(eq);
  Object.entries(assign).forEach(([k, v]) => { if (v !== null && v !== undefined) st.values[k] = v; });
}

function impApply(target) {
  const rate = impTaxRatePct();
  const pos = (x) => x === null ? null : Math.abs(x);
  const rev = impVal('revenue'), cogs = pos(impVal('cogs')), opex = pos(impVal('opex')), dep = pos(impVal('dep'));
  const ebit = impVal('ebit'), capex = pos(impVal('capex'));
  const cash = impVal('cash'), ar = impVal('ar'), inv = impVal('inv'), ap = impVal('ap');
  const debt = impVal('debt'), equity = impVal('equity'), shares = impVal('shares');

  if (target === 'fcf') {
    impSetEq('fcfe', { EBIT: ebit, Dep: dep, CapEx: capex, T: rate, dNWC: 0 }); // ΔNWC needs two periods — start at 0, user fills
    impSetEq('uni', { Rev: rev, Costs: (cogs !== null || opex !== null) ? (cogs || 0) + (opex || 0) : null, Dep: dep, T: rate });
    impSetEq('nwc', { Cash: cash, Inv: inv, AR: ar, AP: ap });
    state.group = 'fcf';
  } else if (target === 'coc') {
    impSetEq('wacc', { E: equity, D: debt, T: rate });
    state.group = 'coc';
  } else if (target === 'val') {
    impSetEq('equity', { Debt: debt, Shares: shares });
    state.group = 'val';
  } else if (target === 'fr') {
    if (typeof FR !== 'undefined') {
      if (rev !== null) FR.rev0 = rev;
      if (rev && cogs !== null) FR.cogsPct = Math.round(cogs / rev * 1000) / 1000;
      if (rate !== null) FR.tax = rate / 100;
      if (capex !== null) FR.capex[0] = capex;
    }
    state.group = 'fr';
  }
  renderTabs(); renderGroup();
  window.scrollTo(0, 0);
}

/* --------------------------------- render -------------------------------- */
function renderImport() {
  const main = document.getElementById('main');
  main.innerHTML = `<section class="card" id="imp-card">
    <h3 class="ctitle">Import a Financial Report</h3>
    <p class="lead">Snap a photo or upload an image of a <b>10-K income statement, P&amp;L, balance sheet,
    cash-flow statement, or pro forma</b>. The app reads it <b>on your device</b> (nothing is uploaded
    anywhere), detects the common line items, and fills the calculators for you.</p>
    <details class="learn"><summary>📘 Learn — what it reads &amp; how to get good scans</summary>
      <div class="learnbody">
        <p><b>What it detects.</b> Revenue/net sales, COGS, operating expenses/SG&amp;A, D&amp;A, EBIT/operating
        income, interest, pre-tax income, income taxes (and from those, the effective tax rate), net income,
        capital expenditures, cash, receivables, inventory, payables, current assets/liabilities, debt,
        shareholders' equity, shares outstanding, and dividends.</p>
        <p><b>Where the numbers go.</b> After you review, one tap sends them to the matching tabs:
        Free Cash Flow (EBIT, D&amp;A, CapEx, tax rate, NWC pieces), Cost of Capital (E, D, tax for WACC),
        Valuation (debt &amp; shares for the equity bridge), or the Final Report drivers (revenue, COGS%, tax,
        CapEx).</p>
        <p><b>Photo tips.</b> One statement per photo · fill the frame, hold the phone square to the page ·
        good light, no glare · the first (left-most) number column is the one it grabs — that's the most recent
        year in standard filings. Parentheses are read as negative numbers.</p>
        <p><b>Privacy.</b> OCR runs entirely in your browser (Tesseract). Your documents never leave the phone.</p>
        <p><b>Always verify.</b> OCR on photos is imperfect — the review grid exists so you can fix anything
        before applying. Check totals against the original.</p>
      </div>
    </details>
    <div class="export-row">
      <label class="export imp-btn">📷 Take photo
        <input type="file" accept="image/*" capture="environment" id="imp-cam" hidden></label>
      <label class="export pdf imp-btn">🖼 Upload image
        <input type="file" accept="image/*" id="imp-file" hidden></label>
    </div>
    <p class="note">PDF report? Screenshot the page you need and upload the screenshot.</p>
    <div class="imp-progress"><div id="imp-bar"></div></div>
    <p class="export-status" id="imp-status"></p>
    <div id="imp-preview"></div>
    <div id="imp-review"></div>
  </section>`;
  const wire = (id) => document.getElementById(id).addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) impRun(e.target.files[0]);
    e.target.value = '';
  });
  wire('imp-cam'); wire('imp-file');
  impRenderReview(); // keep results if user navigates away and back
  if (IMP.ocrText && !Object.keys(IMP.fields).length) document.getElementById('imp-status').textContent = '';
}
