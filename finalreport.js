/* ============================================================================
   FINAL REPORT — full forecasted financial model + NPV/IRR + ratios.
   Mirrors "Example Financial Model.xlsx" (5 linked sheets). Exports either:
     • Excel  — populates the example model template; Excel recalcs all sheets
     • PDF    — a formatted executive report rendered from the same math
   ========================================================================== */
'use strict';

const FR = {
  name: 'Sample Company', baseYear: 2026,
  rev0: 1000,
  growth: [0.40, 0.30, 0.20, 0.10],   // Year 1..4 revenue growth
  cogsPct: 0.50,
  depLife: 10,
  tax: 0.30,
  arPct: 0.20,
  cashPct: 0.10,
  capex: [670, 700, 610, 360, 200],   // Year 0..4
  costDebt: 0.10,                      // discount rate for NPV
};
// Year-0 historical actuals (fixed; the model's "Actual" base year)
const FR_ACTUALS = { cogs0: 600, dep0: 167, begGross0: 1667, dAR0: 20, dCash0: 50 };
const FR_N = 4; // forecast years (columns are Year 0..4)

function frComputeModel() {
  const a = FR_ACTUALS;
  const rev = [FR.rev0], cogs = [a.cogs0], dep = [a.dep0], begGross = [a.begGross0];
  for (let t = 1; t <= FR_N; t++) {
    rev[t] = rev[t - 1] * (1 + (FR.growth[t - 1] || 0));
    cogs[t] = rev[t] * FR.cogsPct;
    begGross[t] = begGross[t - 1] + (FR.capex[t - 1] || 0);
    dep[t] = FR.depLife > 0 ? begGross[t] / FR.depLife : 0;
  }
  const rows = [];
  let prevAR = null, prevCash = null;
  for (let t = 0; t <= FR_N; t++) {
    const ebit = rev[t] - cogs[t] - dep[t];
    const ebt = ebit;                       // no debt → interest = 0
    const taxExp = ebt * FR.tax;
    const ni = ebt - taxExp;
    const ebitAT = ebit * (1 - FR.tax);
    const ocf = ebitAT + dep[t];
    const ar = FR.arPct * rev[t];
    const cash = FR.cashPct * rev[t];
    const dAR = t === 0 ? a.dAR0 : ar - prevAR;
    const dCash = t === 0 ? a.dCash0 : cash - prevCash;
    prevAR = ar; prevCash = cash;
    const dNWC = dAR + dCash;
    const capex = FR.capex[t] || 0;
    const fcf = ocf - capex - dNWC;
    rows.push({ t, rev: rev[t], cogs: cogs[t], dep: dep[t], ebit, taxExp, ni, ebitAT, ocf, ar, cash, dAR, dCash, dNWC, capex, fcf });
  }
  // NPV = FCF0 + Σ FCFt/(1+r)^t  (Excel NPV(rate, Y1:Y4)+Y0)
  let npv = rows[0].fcf;
  for (let t = 1; t <= FR_N; t++) npv += rows[t].fcf / Math.pow(1 + FR.costDebt, t);
  const rate = (typeof irr === 'function') ? irr(rows.map(r => r.fcf)) : null;
  return { rows, npv, irr: rate };
}

/* ------------------------------- formatting ------------------------------ */
const frN = (x) => (x === null || x === undefined || isNaN(x)) ? '—'
  : (x < 0 ? '-' : '') + Math.abs(x).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const frPct = (x, d = 1) => (x === null || x === undefined || isNaN(x) || !isFinite(x)) ? '—' : (x * 100).toFixed(d) + '%';

/* --------------------------------- UI ------------------------------------ */
function frField(label, key, opts = {}) {
  const val = opts.pct ? (FR[key] * 100) : FR[key];
  const suffix = opts.pct ? '<span class="suffix">%</span>' : '';
  const type = opts.text ? 'text' : 'text';
  return `<label class="field"><span class="flabel">${label}</span>
    <span class="inwrap"><input type="${type}" ${opts.text ? '' : 'inputmode="decimal"'} class="frs" data-key="${key}" ${opts.pct ? 'data-pct="1"' : ''} ${opts.txt ? 'data-txt="1"' : ''} value="${val}">${suffix}</span></label>`;
}

function renderFinalReport() {
  const main = document.getElementById('main');
  const yc = (t) => t === 0 ? `${FR.baseYear} <span class="muted">(actual)</span>` : `${FR.baseYear + t}`;
  let yearGrowth = '<tr><th>Revenue growth</th><td class="na">—</td>';
  for (let t = 1; t <= FR_N; t++) yearGrowth += `<td><input class="fry" data-key="growth" data-i="${t - 1}" inputmode="decimal" value="${(FR.growth[t - 1] * 100)}">%</td>`;
  yearGrowth += '</tr>';
  let yearCapex = '<tr><th>Capital expenditure</th>';
  for (let t = 0; t <= FR_N; t++) yearCapex += `<td><input class="fry" data-key="capex" data-i="${t}" inputmode="decimal" value="${FR.capex[t]}"></td>`;
  yearCapex += '</tr>';
  let yhead = '<th>Driver / Year</th>';
  for (let t = 0; t <= FR_N; t++) yhead += `<th>${yc(t)}</th>`;

  main.innerHTML = `
  <section class="card" id="fr-card">
    <h3 class="ctitle">Final Report — Forecasted Financial Model</h3>
    <p class="lead">A complete 5-year financial forecast in the style of the course's example model:
    income statement, free-cash-flow schedule, NPV, IRR and reasonableness ratios. Export it as a fully-linked
    <b>Excel</b> workbook or a polished <b>PDF</b> report.</p>

    <details class="learn"><summary>📘 Learn — what this report contains</summary>
      <div class="learnbody">
        <p><b>Operating drivers.</b> Revenue grows at the rates you set; COGS, accounts receivable and cash are
        percentages of revenue; depreciation is straight-line on gross plant (beginning PP&amp;E ÷ useful life);
        capital expenditure and the discount rate (cost of debt) are entered directly.</p>
        <p><b>Income statement.</b> Revenue − COGS − depreciation = EBIT; after tax that becomes net income.</p>
        <p><b>Free cash flow.</b> EBIT×(1−T) + depreciation − capital spending − change in net working capital
        (Δ accounts receivable + Δ cash).</p>
        <p><b>Valuation.</b> NPV discounts the free cash flows at the cost of debt; IRR is the rate that sets NPV to
        zero. <b>Reasonableness checks</b> (profit margin, capex/revenue, FCF growth) sanity-test the forecast.</p>
        <p><b>Year 0 is the actual base year</b> (historical figures); Years 1–4 are the forecast.</p>
      </div>
    </details>

    <h4 class="sub">Report header</h4>
    <div class="fields">
      ${frField('Company / project name', 'name', { text: true, txt: true })}
      ${frField('Base year', 'baseYear', {})}
    </div>

    <h4 class="sub">Operating assumptions</h4>
    <div class="fields">
      ${frField('Base-year revenue', 'rev0', {})}
      ${frField('COGS (% of revenue)', 'cogsPct', { pct: true })}
      ${frField('Accounts receivable (% of revenue)', 'arPct', { pct: true })}
      ${frField('Cash (% of revenue)', 'cashPct', { pct: true })}
      ${frField('Tax rate', 'tax', { pct: true })}
      ${frField('Depreciation life (years)', 'depLife', {})}
      ${frField('Cost of debt (discount rate)', 'costDebt', { pct: true })}
    </div>

    <h4 class="sub">Annual drivers</h4>
    <div class="tablewrap">
      <table class="pftable"><thead><tr>${yhead}</tr></thead>
        <tbody>${yearGrowth}${yearCapex}</tbody></table>
    </div>

    <div class="output" id="frout"></div>
    <h4 class="sub">Income statement</h4>
    <div class="tablewrap"><div id="fr_is"></div></div>
    <h4 class="sub">Free cash flow schedule</h4>
    <div class="tablewrap"><div id="fr_fcf"></div></div>
    <h4 class="sub">Reasonableness checks</h4>
    <div class="tablewrap"><div id="fr_ratios"></div></div>

    <div class="export-row">
      <button id="frExcel" class="export">⬇︎ Export as Excel</button>
      <button id="frPdf" class="export pdf">⬇︎ Export as PDF</button>
    </div>
    <p class="export-status" id="frStatus"></p>
  </section>`;

  main.querySelectorAll('.frs').forEach(el => el.addEventListener('input', () => {
    const k = el.dataset.key;
    if (el.dataset.txt) { FR[k] = el.value; frUpdate(false); return; }
    let v = parseFloat(el.value.replace(/[, $]/g, '')); if (isNaN(v)) v = 0;
    if (el.dataset.pct) v = v / 100;
    if (k === 'baseYear') { v = Math.round(v); FR[k] = v; renderFinalReport(); return; }
    FR[k] = v; frUpdate(false);
  }));
  main.querySelectorAll('.fry').forEach(el => el.addEventListener('input', () => {
    let v = parseFloat(el.value.replace(/[, $]/g, '')); if (isNaN(v)) v = 0;
    if (el.dataset.key === 'growth') FR.growth[+el.dataset.i] = v / 100;
    else FR.capex[+el.dataset.i] = v;
    frUpdate(false);
  }));
  document.getElementById('frExcel').addEventListener('click', frExportExcel);
  document.getElementById('frPdf').addEventListener('click', frExportPDF);
  frUpdate(false);
}

function frUpdate() {
  const { rows, npv, irr: rate } = frComputeModel();
  const out = document.getElementById('frout');
  out.innerHTML = `<div class="primary ${npv >= 0 ? 'good' : 'bad'}">
      <span class="plabel">Net Present Value</span><span class="pvalue">$${frN(npv)}</span></div>
    <div class="rrow"><span>Internal Rate of Return (IRR)</span><b>${frPct(rate)}</b></div>
    <div class="rrow"><span>Discount rate (cost of debt)</span><b>${frPct(FR.costDebt)}</b></div>
    <div class="rrow"><span>Decision (NPV rule)</span><b>${npv >= 0 ? '✅ Accept' : '❌ Reject'}</b></div>`;

  const yh = (extra) => { let h = '<th>' + extra + '</th>'; rows.forEach(r => h += `<th>${r.t === 0 ? FR.baseYear + ' (A)' : FR.baseYear + r.t}</th>`); return h; };
  const tbl = (id, head, lines) => {
    let body = '';
    lines.forEach(([label, fn, strong]) => {
      let tds = ''; rows.forEach(r => { const v = fn(r); tds += `<td>${typeof v === 'string' ? v : (v ? '$' + frN(v) : '–')}</td>`; });
      body += `<tr class="${strong ? 'strong' : ''}"><th>${label}</th>${tds}</tr>`;
    });
    document.getElementById(id).innerHTML = `<table class="pftable sched"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
  };
  tbl('fr_is', yh('Income statement'), [
    ['Revenue', r => r.rev], ['− COGS', r => -r.cogs], ['− Depreciation', r => -r.dep],
    ['EBIT', r => r.ebit, true], ['− Taxes', r => -r.taxExp], ['Net income', r => r.ni, true],
  ]);
  tbl('fr_fcf', yh('Free cash flow'), [
    ['EBIT × (1 − T)', r => r.ebitAT], ['+ Depreciation', r => r.dep], ['− CapEx', r => -r.capex],
    ['− ΔNWC', r => -r.dNWC], ['Free cash flow', r => r.fcf, true],
  ]);
  tbl('fr_ratios', yh('Ratio'), [
    ['Profit margin', r => frPct(r.ni / r.rev)], ['EBIT margin', r => frPct(r.ebit / r.rev)],
    ['CapEx / revenue', r => frPct(r.capex / r.rev)],
    ['FCF', r => r.fcf, true],
  ]);
}

/* ----------------------------- EXCEL EXPORT ------------------------------ */
function frSetCell(xml, ref, val) {
  const re = new RegExp('<c r="' + ref + '"([^>]*?)(?:\\s+t="[^"]*")?>.*?<\\/c>');
  if (re.test(xml)) return xml.replace(re, `<c r="${ref}"$1><v>${val}</v></c>`);
  return xml;
}

async function frExportExcel() {
  const status = document.getElementById('frStatus');
  status.textContent = 'Building Excel workbook…';
  try {
    const buf = await appLoadTemplate('finalreport_template.xlsx');
    const zip = await JSZip.loadAsync(buf);
    const C = ['B', 'C', 'D', 'E', 'F']; // Year 0..4

    // Forecast Drivers (sheet1)
    let d = await zip.file('xl/worksheets/sheet1.xml').async('string');
    ['C', 'D', 'E', 'F'].forEach((c, i) => { d = frSetCell(d, c + '4', FR.growth[i]); });   // growth Y1..4
    C.forEach(c => { d = frSetCell(d, c + '5', FR.cogsPct); d = frSetCell(d, c + '6', FR.depLife);
      d = frSetCell(d, c + '7', FR.tax); d = frSetCell(d, c + '8', FR.cashPct);
      d = frSetCell(d, c + '9', FR.arPct); d = frSetCell(d, c + '11', FR.costDebt); });
    C.forEach((c, i) => { d = frSetCell(d, c + '10', FR.capex[i]); });                         // capex Y0..4 (display)
    zip.file('xl/worksheets/sheet1.xml', d);

    // Forecasted Financial Statements (sheet2): base-year revenue
    let s2 = await zip.file('xl/worksheets/sheet2.xml').async('string');
    s2 = frSetCell(s2, 'B3', FR.rev0);
    zip.file('xl/worksheets/sheet2.xml', s2);

    // Plant & Equipment (sheet3): Year-0 capex drives the depreciation schedule
    let s3 = await zip.file('xl/worksheets/sheet3.xml').async('string');
    s3 = frSetCell(s3, 'B4', FR.capex[0]);
    zip.file('xl/worksheets/sheet3.xml', s3);

    // force recalculation of all linked sheets on open
    let wb = await zip.file('xl/workbook.xml').async('string');
    wb = /calcPr/.test(wb) ? wb.replace(/<calcPr([^/]*)\/>/, '<calcPr$1 fullCalcOnLoad="1"/>')
      : wb.replace('</workbook>', '<calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>');
    zip.file('xl/workbook.xml', wb);

    const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', compression: 'DEFLATE' });
    frDownload(blob, `Final Report ${FR.baseYear} - ${FR.name || 'Model'}.xlsx`);
    status.innerHTML = `✅ Excel exported. Open it — all five sheets (statements, PP&amp;E, FCF/NPV/IRR, ratios) recalculate from your inputs.`;
  } catch (e) { status.innerHTML = `⚠️ Excel export failed: ${e.message}. Open the app from a server (not a file:// path).`; }
}

/* ------------------------------- PDF EXPORT ------------------------------ */
function frExportPDF() {
  const status = document.getElementById('frStatus');
  status.textContent = 'Building PDF…';
  try {
    const { rows, npv, irr: rate } = frComputeModel();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
    const W = doc.internal.pageSize.getWidth();
    const navy = [11, 36, 71], green = [21, 122, 71], orange = [255, 157, 60], muted = [110, 120, 135];
    const yearCols = rows.map(r => r.t === 0 ? `${FR.baseYear}\n(actual)` : `${FR.baseYear + r.t}`);
    const num = (x) => (x < 0 ? '-' : '') + '$' + Math.abs(x).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

    // Header band
    doc.setFillColor(...navy); doc.rect(0, 0, W, 84, 'F');
    doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(20);
    doc.text('Final Report', 40, 38);
    doc.setFontSize(12); doc.setFont('helvetica', 'normal');
    doc.text(`${FR.name || 'Financial Model'} · Forecast ${FR.baseYear}–${FR.baseYear + FR_N}`, 40, 58);
    doc.setTextColor(...orange); doc.setFontSize(9);
    doc.text('Corporate Finance Tool — forecasted financial model', 40, 72);

    // NPV / IRR summary
    let y = 104;
    doc.setFillColor(...(npv >= 0 ? green : [150, 35, 30])); doc.roundedRect(40, y, W - 80, 52, 6, 6, 'F');
    doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(22);
    doc.text(num(npv), 56, y + 34);
    doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.text('Net Present Value', 56, y + 16);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
    doc.text(`IRR ${rate == null ? '—' : (rate * 100).toFixed(1) + '%'}`, W - 150, y + 30);
    y += 70;

    const head = [['', ...yearCols]];
    const body = (lines) => lines.map(([l, f]) => [l, ...rows.map(r => typeof f(r) === 'string' ? f(r) : num(f(r)))]);
    const opts = (title, startY, lines, totals = []) => ({
      head: [[{ content: title, colSpan: rows.length + 1, styles: { halign: 'left', fillColor: navy, textColor: 255 } }]], // section title
      body: body(lines), startY,
      theme: 'grid', styles: { fontSize: 8, cellPadding: 3, halign: 'right' },
      columnStyles: { 0: { halign: 'left', fontStyle: 'bold', cellWidth: 120 } },
      headStyles: { fillColor: navy },
      didParseCell: (data) => {
        if (data.section === 'body' && totals.includes(data.row.index)) { data.cell.styles.fontStyle = 'bold'; data.cell.styles.fillColor = [238, 242, 248]; }
      },
      margin: { left: 40, right: 40 },
    });

    // sub-header row (years) helper using a normal table head
    const withYearHead = (o) => { o.head.push(['', ...yearCols].map((c, i) => ({ content: c, styles: { fillColor: [232, 238, 247], textColor: navy, halign: i === 0 ? 'left' : 'right', fontStyle: 'bold' } }))); return o; };

    doc.autoTable(withYearHead(opts('Income Statement', y, [
      ['Revenue', r => r.rev], ['Cost of goods sold', r => -r.cogs], ['Depreciation', r => -r.dep],
      ['EBIT', r => r.ebit], ['Taxes', r => -r.taxExp], ['Net income', r => r.ni],
    ], [3, 5])));

    doc.autoTable(withYearHead(opts('Free Cash Flow Schedule', doc.lastAutoTable.finalY + 14, [
      ['EBIT x (1 - T)', r => r.ebitAT], ['+ Depreciation', r => r.dep], ['- Capital expenditure', r => -r.capex],
      ['- Change in NWC', r => -r.dNWC], ['Free cash flow', r => r.fcf],
    ], [4])));

    doc.autoTable(withYearHead({
      ...opts('Reasonableness Checks', doc.lastAutoTable.finalY + 14, []),
      body: [
        ['Profit margin', ...rows.map(r => (r.ni / r.rev * 100).toFixed(1) + '%')],
        ['EBIT margin', ...rows.map(r => (r.ebit / r.rev * 100).toFixed(1) + '%')],
        ['CapEx / revenue', ...rows.map(r => (r.capex / r.rev * 100).toFixed(1) + '%')],
      ],
    }));

    // Assumptions footnote + disclaimer
    let fy = doc.lastAutoTable.finalY + 18;
    doc.setTextColor(...muted); doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    doc.text(`Assumptions: COGS ${(FR.cogsPct * 100).toFixed(0)}% of revenue · AR ${(FR.arPct * 100).toFixed(0)}% · Cash ${(FR.cashPct * 100).toFixed(0)}% · ` +
      `Tax ${(FR.tax * 100).toFixed(0)}% · Depreciation ${FR.depLife}-yr straight-line · Discount rate ${(FR.costDebt * 100).toFixed(0)}%.`, 40, fy);
    doc.text('Year 0 = actual base year; Years 1–4 forecast. Figures in the model\'s currency units.', 40, fy + 12);
    doc.setTextColor(...navy); doc.setFont('helvetica', 'bold');
    doc.text('This is not financial advice. This is a learning tool and can contain errors. Verify all calculations.', 40, fy + 28);

    doc.save(`Final Report ${FR.baseYear} - ${FR.name || 'Model'}.pdf`);
    status.innerHTML = `✅ PDF exported. On iPhone, use “Save to Files” or share from the preview.`;
  } catch (e) { status.innerHTML = `⚠️ PDF export failed: ${e.message}.`; }
}

/* ------------------------------- download -------------------------------- */
function frDownload(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
