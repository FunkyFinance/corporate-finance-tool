# FIN 740 — Corporate Finance Toolkit 📱

An installable iPhone web app (PWA) that **solves every formula on the FIN 740 formula sheet**,
**teaches the concepts** behind each one, and **exports a populated Pro Forma** into your Excel
workbook (`FCF, NPV and ProForma tool.xlsx`).

Built for WashU Olin · Berk & DeMarzo conventions.

---

## What it does

**5 calculator modules + a Pro Forma builder**, each with an expandable **📘 Learn** panel covering
*what the inputs mean · how it's calculated · what the answer means · how to apply it.*

| Module | Calculators |
|---|---|
| **Time Value** | PV of an annuity · Loan/annuity payment · PV of a growing annuity · Perpetuity & growing perpetuity · Future value |
| **Investing** | NPV · IRR · Profitability index · Payback & discounted payback |
| **Free Cash Flow** | Unlevered net income & EBIT · Free cash flow · After-tax salvage · Net working capital |
| **Cost of Capital** | CAPM (required return) · WACC |
| **Valuation** | DCF firm/equity/share price · Terminal value · Bond valuation · Firm→equity→EV bridge · **Dividend Discount Model (finite-horizon, interactive solver)** |
| **Stocks** | How to value a stock · interchangeable total-return solver (dividend yield ⇄ capital gain ⇄ total return) · returns from prices · interchangeable constant-growth (Gordon) valuation |
| **Pro Forma** | Multi-year FCF schedule → live NPV → **Export to Excel** |
| **Final Report** | Full forecasted model (income statement, FCF, NPV, IRR, ratios) → **Export to Excel or PDF** |
| **🔎 Search** | Find any term, formula, or calculator across the app and jump straight to it |

**Interactive equations.** Calculators in Time Value, Free Cash Flow, Cost of Capital, Valuation and Stocks
are *solve-for-any-variable*: pick the unknown from the “Solve for” menu and enter the rest. Every formula has
a **Show expanded / compact** toggle, and all symbols render with proper sub/superscripts (e.g. r_E, (1+r)^N).

### Pro Forma → Excel export
The export writes your assumptions into the **Assumptions** tab of your real template and flags the
workbook to **recalculate on open**, so the ProForma, FPV, Sensitivity, and Solution sheets all update.
The in-app NPV reproduces the template's model **exactly** (incl. straight-line depreciation, NWC recovery
in the chosen year, and after-tax salvage).

### Final Report → Excel **or** PDF
A complete forecasted financial model in the style of the course's *Example Financial Model*: operating
drivers → income statement → free-cash-flow schedule → NPV, IRR, and reasonableness ratios.
- **Excel** populates the example-model template (all five linked sheets recalc on open).
- **PDF** renders a polished one-page report (header, NPV/IRR summary, statements, ratios, disclaimer).
The in-app figures reproduce the example model **exactly** (NPV $126.4, IRR 16.2% on the default inputs).
Year 0 is the actual base year; Years 1–4 are the forecast.

---

## Run it on your Mac
1. Double-click **`serve.command`** (it starts a local server and opens your browser).
2. Or in Terminal: `cd` into this folder and run `python3 -m http.server 8000`, then open
   <http://localhost:8000>.

## Use it on your iPhone
**Same Wi-Fi as your Mac (quick):**
1. Run `serve.command` on the Mac.
2. Find your Mac's IP: System Settings → Wi-Fi → Details → IP Address (e.g. `192.168.1.42`).
3. On iPhone Safari, go to `http://192.168.1.42:8000`.
4. Tap **Share → Add to Home Screen** to get an app icon.

**Anywhere (full PWA install + offline):** host the folder on any static HTTPS host
(GitHub Pages, Netlify drop, Vercel). Over HTTPS the service worker enables offline use and a true
standalone app window. Then Safari → **Add to Home Screen**.

> Exported `.xlsx` files: on iPhone, choose **Save to Files** or open directly in the Excel app from the
> share sheet.

---

## Files
- `index.html` · `styles.css` — shell & styling (light/dark, safe-area aware)
- `app.js` — calculation engine, educational content, UI renderer
- `proforma.js` — Pro Forma builder + Excel populate/export (mirrors the template's formulas)
- `finalreport.js` — Final Report model + Excel populate and PDF generation
- `template.xlsx` · `finalreport_template.xlsx` — your workbooks, embedded for export
- `vendor/jszip.min.js` — reads/writes the .xlsx (works offline)
- `vendor/jspdf.umd.min.js` · `vendor/jspdf.plugin.autotable.min.js` — PDF generation (works offline)
- `manifest.webmanifest` · `sw.js` · `icons/` — PWA install + offline support

*For learning use. Always double-check figures before relying on them for graded work.*
