/* ============================================================================
   PRO FORMA builder + Excel export.
   Mirrors the FIN 740 "FCF, NPV and ProForma tool.xlsx" (Assumptions sheet).
   Populates the real template and lets Excel recalculate the linked sheets.
   ========================================================================== */
'use strict';

const COLS = ['B', 'C', 'D', 'E', 'F', 'G', 'H']; // year index 0..6 in the template
const NYEARS = 6; // the template has a fixed 6-year forecast layout (columns B..H = years 0..6)

const PF = {
  tax: 0.40, wacc: 0.08, cogs: 0.75, sga: 0.05, nwcPct: 0.10,
  depPeriod: 6, salvage: 1800000, salvageYear: 6,
  baseYear: 2026, n: 6,
  rev:     [0, 4000000, 10000000, 10000000, 10000000, 10000000, 10000000],
  savings: [0, 2000000, 3500000, 3500000, 3500000, 3500000, 3500000],
  capex:   [16000000, 2000000, 0, 0, 0, 0, 0],
};

function pfComputeSchedule() {
  const base = PF.capex.slice(0, NYEARS + 1).reduce((a, b) => a + (b || 0), 0); // depreciable base = Σ capex (template B11)
  const depAnnual = PF.depPeriod > 0 ? base / PF.depPeriod : 0;
  const rows = [];
  let prevNWC = 0;
  for (let t = 0; t <= NYEARS; t++) {
    const rev = PF.rev[t] || 0;
    const sav = PF.savings[t] || 0;
    const capex = PF.capex[t] || 0;
    const cogs = PF.cogs * rev;
    const other = PF.sga * rev;
    const dep = (t >= 1 && t <= PF.depPeriod) ? depAnnual : 0;
    const ebit = rev + sav - cogs - other - dep;
    const tax = ebit * PF.tax;
    const uni = ebit - tax;
    // Net working capital drops to 0 in the recovery year (template r25: IF(year=B18, 0, NWC%·rev)).
    const nwc = (t === PF.n) ? 0 : PF.nwcPct * rev;
    const dnwc = nwc - prevNWC; prevNWC = nwc;
    // After-tax salvage assumes the asset is fully depreciated (book value 0), matching template r17.
    const salv = (t === PF.salvageYear) ? PF.salvage * (1 - PF.tax) : 0;
    const fcf = uni + dep - capex - dnwc + salv;
    rows.push({ t, rev, sav, cogs, other, dep, ebit, tax, uni, nwc, dnwc, capex, salv, fcf });
  }
  let npv = 0;
  rows.forEach(r => { npv += r.fcf / Math.pow(1 + PF.wacc, r.t); });
  return { rows, npv, base, depAnnual };
}

function money0(x) { return (x < 0 ? '-$' : '$') + Math.abs(Math.round(x)).toLocaleString('en-US'); }

function renderProForma() {
  const main = document.getElementById('main');
  const yearHdr = (label, key) => {
    let cells = '';
    for (let t = 0; t <= NYEARS; t++) {
      cells += `<td><input type="text" inputmode="decimal" class="pfy" data-key="${key}" data-t="${t}" value="${PF[key][t] || 0}"></td>`;
    }
    return `<tr><th>${label}</th>${cells}</tr>`;
  };
  let yearCols = '<th>Line / Year</th>';
  for (let t = 0; t <= NYEARS; t++) yearCols += `<th>${PF.baseYear + t}<br><span class="muted">yr ${t}</span></th>`;

  main.innerHTML = `
  <section class="card" id="pf-card">
    <h3 class="ctitle">Pro Forma — FCF &amp; NPV</h3>
    <p class="lead">Build a multi-year free-cash-flow forecast, see the NPV instantly, then export to your Excel
    workbook. The export writes these assumptions into the <b>Assumptions</b> tab of your template and lets Excel
    recalculate the ProForma, FPV, Sensitivity and Solution sheets.</p>

    <details class="learn"><summary>📘 Learn — how this pro forma works</summary>
      <div class="learnbody">
        <p><b>What it builds.</b> A year-by-year free cash flow: EBIT = revenues + cost savings − COGS − SG&amp;A −
        depreciation; unlevered net income = EBIT×(1−T); FCF = unlevered NI + depreciation − CapEx − ΔNWC, plus
        after-tax salvage in the disposal year.</p>
        <p><b>Key assumptions.</b> COGS, SG&amp;A and net working capital are entered as a % of revenue. Depreciation
        is straight-line over the chosen period on the total capital invested. The discount rate is the WACC.</p>
        <p><b>What NPV tells you.</b> The value the project adds today. Accept if NPV &gt; 0. Use the exported
        Sensitivity tab (Goal Seek / data tables) to find breakevens.</p>
      </div>
    </details>

    <h4 class="sub">Operating assumptions</h4>
    <div class="fields">
      ${pfField('Tax rate', 'tax', true)}
      ${pfField('Discount rate (WACC)', 'wacc', true)}
      ${pfField('COGS (% of revenue)', 'cogs', true)}
      ${pfField('SG&A (% of revenue)', 'sga', true)}
      ${pfField('Net working capital (% of revenue)', 'nwcPct', true)}
    </div>
    <h4 class="sub">Capital &amp; depreciation</h4>
    <div class="fields">
      ${pfField('Depreciation period (years)', 'depPeriod', false)}
      ${pfField('Salvage value (pre-tax)', 'salvage', false)}
      ${pfField('Salvage received in year', 'salvageYear', false)}
    </div>
    <h4 class="sub">Timing</h4>
    <div class="fields">
      ${pfField('Base year', 'baseYear', false)}
      ${pfField('NWC recovered in year (1–6)', 'n', false)}
    </div>

    <h4 class="sub">Annual inputs by year</h4>
    <div class="tablewrap">
      <table class="pftable">
        <thead><tr>${yearCols}</tr></thead>
        <tbody>
          ${yearHdr('Incremental revenues', 'rev')}
          ${yearHdr('Cost savings', 'savings')}
          ${yearHdr('Capital expenditure', 'capex')}
        </tbody>
      </table>
    </div>

    <div class="output" id="pfout"></div>

    <h4 class="sub">Free cash flow schedule</h4>
    <div class="tablewrap"><div id="pfschedule"></div></div>

    <button id="exportBtn" class="export">⬇︎ Export Pro Forma to Excel</button>
    <p class="export-status" id="exportStatus"></p>
  </section>`;

  // wire scalar fields
  main.querySelectorAll('.pfs').forEach(el => el.addEventListener('input', () => {
    const k = el.dataset.key; let val = parseFloat(el.value.replace(/[, $]/g, ''));
    if (isNaN(val)) val = 0;
    if (el.dataset.pct) val = val / 100;
    if (k === 'n') val = Math.max(1, Math.min(NYEARS, Math.round(val)));
    if (k === 'depPeriod' || k === 'salvageYear' || k === 'baseYear') val = Math.round(val);
    PF[k] = val;
    if (k === 'baseYear') renderProForma(); else pfUpdate(); // baseYear changes the year-column headers
  }));
  // wire year-grid fields
  main.querySelectorAll('.pfy').forEach(el => el.addEventListener('input', () => {
    let val = parseFloat(el.value.replace(/[, $]/g, '')); if (isNaN(val)) val = 0;
    PF[el.dataset.key][+el.dataset.t] = val; pfUpdate();
  }));
  document.getElementById('exportBtn').addEventListener('click', exportProForma);
  pfUpdate();
}

function pfField(label, key, pct) {
  const val = pct ? (PF[key] * 100) : PF[key];
  const suffix = pct ? '<span class="suffix">%</span>' : '';
  return `<label class="field"><span class="flabel">${label}</span>
    <span class="inwrap"><input type="text" inputmode="decimal" class="pfs" data-key="${key}" ${pct ? 'data-pct="1"' : ''} value="${val}">${suffix}</span></label>`;
}

function pfUpdate() {
  const { rows, npv } = pfComputeSchedule();
  const out = document.getElementById('pfout');
  out.innerHTML = `<div class="primary ${npv >= 0 ? 'good' : 'bad'}">
    <span class="plabel">Net Present Value</span>
    <span class="pvalue">${money0(npv)}</span></div>
    <div class="rrow"><span>Decision (NPV rule)</span><b>${npv >= 0 ? '✅ Accept' : '❌ Reject'}</b></div>
    <div class="rrow"><span>Initial outlay (year 0)</span><b>${money0(-(PF.capex[0] || 0))}</b></div>`;

  const lines = [
    ['Incremental revenues', r => r.rev],
    ['+ Cost savings', r => r.sav],
    ['− COGS', r => -r.cogs],
    ['− SG&A / other', r => -r.other],
    ['− Depreciation', r => -r.dep],
    ['EBIT', r => r.ebit, true],
    ['− Taxes', r => -r.tax],
    ['Unlevered net income', r => r.uni, true],
    ['+ Depreciation', r => r.dep],
    ['− CapEx', r => -r.capex],
    ['− ΔNWC', r => -r.dnwc],
    ['+ After-tax salvage', r => r.salv],
    ['Free cash flow', r => r.fcf, true],
  ];
  let head = '<th>Line</th>';
  rows.forEach(r => head += `<th>${PF.baseYear + r.t}</th>`);
  let body = '';
  lines.forEach(([label, fn, strong]) => {
    let tds = '';
    rows.forEach(r => { const v = fn(r); tds += `<td>${v ? money0(v) : '–'}</td>`; });
    body += `<tr class="${strong ? 'strong' : ''}"><th>${label}</th>${tds}</tr>`;
  });
  document.getElementById('pfschedule').innerHTML =
    `<table class="pftable sched"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

/* ----------------------------- EXCEL EXPORT ------------------------------ */
function setCell(xml, ref, val) {
  const re = new RegExp('<c r="' + ref + '"([^>]*)>.*?<\\/c>');
  if (re.test(xml)) return xml.replace(re, `<c r="${ref}"$1><v>${val}</v></c>`);
  return xml; // all target cells exist in the template
}

async function exportProForma() {
  const status = document.getElementById('exportStatus');
  status.textContent = 'Building workbook…';
  try {
    const buf = await appLoadTemplate('template.xlsx');
    const zip = await JSZip.loadAsync(buf);

    let sheet = await zip.file('xl/worksheets/sheet1.xml').async('string');
    // operating + capital + timing assumptions
    sheet = setCell(sheet, 'B4', PF.tax);
    sheet = setCell(sheet, 'B5', PF.wacc);
    sheet = setCell(sheet, 'B6', PF.cogs);
    sheet = setCell(sheet, 'B7', PF.sga);
    sheet = setCell(sheet, 'B8', PF.nwcPct);
    sheet = setCell(sheet, 'B12', PF.depPeriod);
    sheet = setCell(sheet, 'B13', PF.salvage);
    sheet = setCell(sheet, 'B14', PF.salvageYear);
    sheet = setCell(sheet, 'B17', PF.baseYear);
    sheet = setCell(sheet, 'B18', PF.n); // NWC recovery year (template B18)
    // annual inputs by year (columns B..H = year 0..6)
    for (let t = 0; t <= NYEARS; t++) {
      const col = COLS[t];
      sheet = setCell(sheet, col + '23', PF.rev[t] || 0);
      sheet = setCell(sheet, col + '24', PF.savings[t] || 0);
      sheet = setCell(sheet, col + '25', PF.capex[t] || 0);
    }
    zip.file('xl/worksheets/sheet1.xml', sheet);

    // force Excel to recalc all linked sheets on open
    let wb = await zip.file('xl/workbook.xml').async('string');
    wb = wb.replace(/<calcPr([^/]*)\/>/, '<calcPr$1 fullCalcOnLoad="1"/>');
    zip.file('xl/workbook.xml', wb);

    const blob = await zip.generateAsync({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      compression: 'DEFLATE',
    });
    const name = `ProForma ${PF.baseYear}.xlsx`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    status.innerHTML = `✅ Exported <b>${name}</b>. Open it in Excel — the ProForma & NPV sheets recalculate from your inputs. ` +
      `On iPhone, choose “Save to Files” or open directly in Excel from the share sheet.`;
  } catch (e) {
    status.innerHTML = `⚠️ Export failed: ${e.message}. Make sure the app is opened from a server (not a file:// path).`;
  }
}
