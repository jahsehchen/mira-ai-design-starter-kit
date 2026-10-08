# Pipelines

Chains of leaves for the common multi-step jobs. Leaves are `plugin:skill`, abbreviated here: `fa` = `financial-analysis`, `ib` = `investment-banking`, `er` = `equity-research`, `pe` = `private-equity`, `fund` = `fund-admin`, `ops` = `operations`. **Expand to the full plugin name when calling the Skill tool** (`ib:teaser` -> `investment-banking:teaser`).

Run each step, write its artifact to `out/`, pass the path to the next. Stops are mandatory.

| # | Job | Chain | Stops / notes |
|---|---|---|---|
| 1 | Pitch from nothing | playbook `pitch-agent` (sector-overview, comps, LBO, DCF, audit, deck, deck QC) | After the model; after the deck |
| 2 | Sell-side launch | `ib:strip-profile` -> `fa:comps-analysis` -> `ib:buyer-list` -> `ib:teaser` -> `ib:cim-builder` -> `ib:process-letter`; track with `ib:deal-tracker`; `fa:ib-check-deck` on any deck | Teaser must stay anonymous. After buyer list; before process letter |
| 3 | Valuation triangulation | `fa:comps-analysis` -> `fa:dcf-model` (terminal multiple from comps) -> `fa:lbo-model` if a sponsor view is wanted -> `fa:audit-xls` | Stop after build and after audit |
| 4 | Earnings cycle | before: `er:earnings-preview`; after: playbook `earnings-reviewer` (earnings-analysis, model-update, audit-xls, morning-note) | Verify the print is the latest before starting. Never publish |
| 5 | Theme to coverage | playbook `market-researcher` -> pick a name -> `er:initiating-coverage` (5 tasks, in order) -> `er:thesis-tracker`, `er:catalyst-calendar` | After comps spread and after the note |
| 6 | PE deal funnel | `pe:deal-sourcing` -> `pe:deal-screening` -> `pe:dd-checklist` -> `pe:dd-meeting-prep` -> `pe:unit-economics` -> `pe:returns-analysis` (or `fa:lbo-model` for a full model) -> `pe:ic-memo` | Stop at screening for a go/no-go; the memo is a draft for IC |
| 7 | Portfolio quarter | `pe:portfolio-monitoring` -> playbook `valuation-reviewer` -> `pe:value-creation-plan` for names off plan -> `pe:ai-readiness` across the book | LP pack staged for IR |
| 8 | Daily recon | playbook `gl-reconciler` (`fund:gl-recon` -> `fund:break-trace`) | Exception report for the controller |
| 9 | Month-end close | resolve breaks (8) first -> playbook `month-end-closer` (`fund:accrual-schedule`, `fund:roll-forward`, `fund:variance-commentary`) -> `fa:audit-xls` | Close package for sign-off. JE drafts only |
| 10 | LP statement run | `fund:nav-tieout` per statement via playbook `statement-auditor` | Pass/hold recommendation; humans release |
| 11 | Onboarding | `ops:kyc-doc-parse` -> `ops:kyc-rules`; screening is outside this environment | State "screening NOT performed". Compliance rates and decides |
| 12 | Client meeting | playbook `meeting-prep-agent` (`meeting-prep-agent:client-review`, `:client-report`) | Draft for the advisor; nothing client-facing is sent |

## Cross-domain hand-offs

- `er:sector-overview` / `fa:competitive-analysis` output feeds `ib` pitch narrative and `pe` thesis work.
- `fa:comps-analysis` is the shared peer-set artifact: reuse it for DCF terminal multiples, `ib:merger-model`, and `er` notes rather than rebuilding.
- `pe:returns-analysis` is a quick IRR/MOIC table. A full model is `fa:lbo-model`. Choose by how much precision the decision needs.
- `fund:*` outputs are workbooks: always finish with `fa:audit-xls`.
- Anything that turns into slides: build with `fa:pptx-author` (or populate a template with `ib:pitch-deck`), then `fa:ib-check-deck`.
