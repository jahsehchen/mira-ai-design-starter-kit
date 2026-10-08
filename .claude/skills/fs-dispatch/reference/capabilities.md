# Capabilities and preflight

What the plugins assume versus what exists in this environment. Verified 2026-10-08 in the cloud sandbox; re-check at runtime, because it depends on the environment.

## Data connectors

The 12 connectors in `financial-analysis/.mcp.json` (Daloopa, Morningstar, S&P Global `sp-global`, FactSet, Moody's, MT Newswires, Aiera, LSEG, PitchBook, Chronograph, Egnyte, Box) load but currently report **failed**. The sandbox network policy answers `403` to the CONNECT for these hosts. Even once reachable, most also need the user's own subscription or key.

**Runtime check:** search for the tools, for example ToolSearch with "daloopa factset sp-global". If nothing comes back, treat the connector as down and use the fallback order below.

## Names the playbooks use that nothing here provides

| Referenced | Used by | Status | Do this instead |
|---|---|---|---|
| `mcp__capiq__*` | pitch-agent, market-researcher, model-builder, meeting-prep-agent | not provided | closest live source: `sp-global` (S&P data), `factset`, `daloopa`. If none is live, use the fallback order. State which source replaced it. |
| `mcp__office__excel_*`, `__powerpoint_*` | most modeling and deck skills | needs an Office add-in, absent | `financial-analysis:xlsx-author` / `:pptx-author` (openpyxl and python-pptx are installed) -> `./out/` |
| `mcp__internal-gl__*`, `mcp__subledger__*` | gl-reconciler, month-end-closer | firm-internal, absent | user exports: trial balance, GL and subledger extracts (CSV/XLSX) |
| `mcp__nav__*` | statement-auditor | firm-internal, absent | user supplies the NAV pack and LP statements |
| `mcp__portfolio__*` | valuation-reviewer | firm-internal, absent | user supplies the GP valuation packages |
| `mcp__crm__*` | meeting-prep-agent | firm-internal, absent | user supplies client notes, holdings, history |
| `mcp__screening__*` | kyc-screener | firm-internal, absent | **no substitute.** Sanctions, PEP and adverse-media screening cannot be done here. Say "screening NOT performed". |

## Fallback order when a number is needed

1. A file the user provides (model, filing, export, data pack).
2. Public filings and releases through web fetch or search (SEC EDGAR, company IR), if the network allows and the subject is not confidential. Cite the URL.
3. A labelled placeholder: `[ASSUMPTION]` for a choice, `[UNSOURCED]` for a figure you could not source. Keep going so the structure is useful, but never present placeholders as fact.

If none of these works and the job is only meaningful with real data (reconciliation, tie-out, KYC), stop and ask for the file.

## Where things go

- Deliverables: `out/<job-slug>-<artifact>.<ext>` (for example `out/acme-pitch-model.xlsx`). `out/` is gitignored. The author skills write to `./out/` by contract.
- Inputs: wherever the user points. Never `git add` them.
- Dates: use the real current date, and check "latest" data against it (earnings, filings) before using it.
