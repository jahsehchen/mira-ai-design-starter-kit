# Capabilities and preflight

What the plugins assume versus what exists in this environment. Verified 2026-10-08 in the cloud sandbox; re-check at runtime, because it depends on the environment.

## Data sources

**No data connectors are configured.** The user has no data subscriptions, so the 12 connectors the upstream `financial-analysis/.mcp.json` shipped (Daloopa, Morningstar, S&P Global, FactSet, Moody's, MT Newswires, Aiera, LSEG, PitchBook, Chronograph, Egnyte, Box) were removed from the vendored copy (see `vendor/financial-services/VENDORED.md`). Every number comes from **files the user provides**. Do not go looking for connector tools, and do not suggest installing one unless the user asks.

The sandbox also blocks outbound web access to most sites (for example `www.sec.gov` answers 403 to the CONNECT), so do not count on pulling filings yourself either.

## Names the playbooks use that nothing here provides

| Referenced | Used by | Status | Do this instead |
|---|---|---|---|
| `mcp__capiq__*`, `mcp__factset__*`, `mcp__daloopa__*` | pitch-agent, market-researcher, model-builder, earnings-reviewer, meeting-prep-agent | not configured | user-supplied files (financials, comps and precedent data, filings, transcripts, consensus). State which file each input came from. |
| `mcp__office__excel_*`, `__powerpoint_*` | most modeling and deck skills | needs an Office add-in, absent | `financial-analysis:xlsx-author` / `:pptx-author` (openpyxl and python-pptx are installed) -> `./out/` |
| `mcp__internal-gl__*`, `mcp__subledger__*` | gl-reconciler, month-end-closer | firm-internal, absent | user exports: trial balance, GL and subledger extracts (CSV/XLSX) |
| `mcp__nav__*` | statement-auditor | firm-internal, absent | user supplies the NAV pack and LP statements |
| `mcp__portfolio__*` | valuation-reviewer | firm-internal, absent | user supplies the GP valuation packages |
| `mcp__crm__*` | meeting-prep-agent | firm-internal, absent | user supplies client notes, holdings, history |
| `mcp__screening__*` | kyc-screener | firm-internal, absent | **no substitute.** Sanctions, PEP and adverse-media screening cannot be done here. Say "screening NOT performed". |

## Fallback order when a number is needed

1. A file the user provides (model, filing, export, data pack). This is the normal case.
2. A public page you can actually reach by web fetch, only if the host responds and the subject is not confidential. Cite the URL. Expect most hosts to be blocked.
3. A labelled placeholder: `[ASSUMPTION]` for a choice, `[UNSOURCED]` for a figure you could not source. Keep going so the structure is useful, but never present placeholders as fact.

If none of these works and the job is only meaningful with real data (reconciliation, tie-out, KYC), stop and ask for the file.

## Recalculate Excel output

`xlsx-author` writes with openpyxl, which stores formulas but **no computed values**. Excel and Google Sheets calculate on open, but previews, mobile viewers and scripts show blanks, and nothing has actually proven the formulas evaluate. After writing a workbook, recalculate it with LibreOffice and replace the file (tested: formulas, blue inputs, comments, number formats and column widths survive):

```bash
mkdir -p out/.recalc && soffice --headless --convert-to xlsx:"Calc MS Excel 2007 XML" --outdir out/.recalc out/<file>.xlsx && mv out/.recalc/<file>.xlsx out/<file>.xlsx && rmdir out/.recalc
```

Then read it back with `openpyxl.load_workbook(path, data_only=True)` and confirm: no cell value starts with `#` (`#DIV/0!`, `#REF!`, `#NAME?`), and the Checks tab is all TRUE. Report any failure; do not hand over a workbook you have not recalculated. If `soffice` is missing, say so in the close-out.

## Where things go

- Deliverables: `out/<job-slug>-<artifact>.<ext>` (for example `out/acme-pitch-model.xlsx`). `out/` is gitignored. The author skills write to `./out/` by contract.
- Inputs: wherever the user points; suggest `inputs/` (gitignored) for anything confidential. Never `git add` them. Ask once which file is which if the names are not obvious, and note in the close-out which file each input came from.
- Dates: use the real current date, and check "latest" data against it (earnings, filings) before using it.
