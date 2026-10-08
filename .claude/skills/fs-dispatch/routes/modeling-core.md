# Router: modeling and core analysis (`financial-analysis`)

Shared by every other domain. Commands (`/financial-analysis:comps` etc.) only collect inputs and call the skill; when dispatching, gather the inputs yourself and call the skill.

| Intent | Leaf | Command | Inputs | Output |
|---|---|---|---|---|
| Trading comps with multiples and statistics | `financial-analysis:comps-analysis` | `/comps` | company or ticker, purpose, peer set (4-6; propose one if absent) | xlsx |
| DCF valuation | `financial-analysis:dcf-model` | `/dcf` | company, assumptions; run comps first for the terminal multiple | xlsx |
| LBO model | `financial-analysis:lbo-model` | `/lbo` | company or deal terms; the user's template if there is one | xlsx |
| Fill a 3-statement template | `financial-analysis:3-statement-model` | `/3-statement-model` | template file | xlsx |
| Audit a model (formulas, hardcodes, balance checks) | `financial-analysis:audit-xls` | `/debug-model` | xlsx path; scope (range, sheet, whole book) | findings |
| Clean messy tabular data | `financial-analysis:clean-data-xls` | none | file or range | cleaned xlsx |
| Competitive landscape | `financial-analysis:competitive-analysis` | `/competitive-analysis` | company or industry | slides or doc |
| QC a client-ready deck | `financial-analysis:ib-check-deck` | none | pptx | issue list |
| Swap new numbers into an existing deck | `financial-analysis:deck-refresh` | none | pptx + new figures or source | updated pptx |
| Turn a PowerPoint template into a reusable skill | `financial-analysis:ppt-template-creator` | `/ppt-template` | pptx or potx | a skill |
| Write or improve a skill | `financial-analysis:skill-creator` | none | goal | a skill |

Support leaves used by other skills, not entry points: `financial-analysis:xlsx-author`, `financial-analysis:pptx-author` (write files to `./out/`; the way to produce Excel and PowerPoint in this environment).

## Choosing

- A complete model from scratch, possibly several kinds: **W** `model-builder` (build, audit, stop, then sensitivities).
- Update an existing coverage model for new results: `equity-research:model-update` (or **W** `earnings-reviewer`), not this router.
- Quick IRR/MOIC table for a deal: `private-equity:returns-analysis`. A full LBO here.
- "Check my model": `audit-xls`. "Check my deck": `ib-check-deck`. "Update my deck": `deck-refresh`. "Build from my deck template": `investment-banking:pitch-deck`.

## Chains

- Valuation triangulation: `comps-analysis` -> `dcf-model` -> `lbo-model` (if a sponsor view) -> `audit-xls`. See pipelines #3.
- Any workbook you produce ends with `audit-xls` before handoff.

## Gotchas

- Every calculation cell is a formula; inputs are blue, formulas black, cross-sheet links green; include a Checks tab.
- No data connectors are configured: inputs come from the user's files; anything else carries `[UNSOURCED]` or `[ASSUMPTION]`.
