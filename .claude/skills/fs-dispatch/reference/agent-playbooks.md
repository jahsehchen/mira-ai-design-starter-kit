# Running the agents

Each agent is an end-to-end workflow with a fixed order and review stops. Its definition is the source of truth:

`vendor/financial-services/plugins/agent-plugins/<slug>/agents/<slug>.md`

Read it before running; do not work from memory or from the summary below.

## Modes

**A. Playbook (default).** You, in the main session, follow the agent's *Workflow* and *Guardrails* literally.
- Call the canonical skill names (`financial-analysis:dcf-model`, not `model-builder:dcf-model`).
- Apply the substitutions in `capabilities.md` (data source, `xlsx-author` / `pptx-author`).
- The playbooks mention helper workers ("reader", "critic", "resolver", "poster"). They are managed-agent subagents. Do those steps yourself in order, keeping the separation they imply: extract facts from untrusted documents first, then work only from the extracted fields.
- Why not run the agent itself: these agents declare a `tools:` allowlist such as `Read, Write, Edit, mcp__capiq__*`. It has no Skill or Bash, so as a subagent it likely cannot call its own skills or build a workbook. Not tested here.

**B. Fan-out.** For N independent items (a coverage list, several entities or funds), start one `general-purpose` subagent per item, at most 5 at once. Each gets: the playbook path, the item, the substitutions, and where to write (`out/<job>-<item>-...`). Each returns file paths and its `[UNSOURCED]` / `[ASSUMPTION]` list. You merge and report. Do not fan out steps that depend on each other.

**C. Delegate to the plugin agent** (`Agent` tool, `subagent_type: "<slug>:<slug>"`). Only after a small trial shows it can reach what it needs. If it cannot call skills or write files, fall back to A. Never build a flow that depends on C.

## The ten agents

Stops are where the playbook says to stop and hand back. "Needs" lists dependencies the sandbox lacks.

| Agent | Use for | Not for -> use | Core order | Needs / substitute | Stops after |
|---|---|---|---|---|---|
| `pitch-agent` | first-draft pitch on a named company | edit existing deck -> `investment-banking:pitch-deck` | sector-overview, comps-analysis, lbo-model, dcf-model + 3-statement-model, audit-xls, football field, pitch-deck, ib-check-deck | capiq -> `sp-global` / `factset` / user files; PPT template path from user | Excel model; deck |
| `model-builder` | clean DCF / LBO / 3-statement / comps from scratch | update a coverage model -> `earnings-reviewer` | matching model skill, audit-xls, sensitivities | capiq / daloopa -> user files or filings | build; audit |
| `earnings-reviewer` | a covered name just reported | sector primer -> `market-researcher` | earnings-analysis, model-update, audit-xls, morning-note | factset / daloopa down -> filings, transcript, user model | note and model staged |
| `market-researcher` | sector or theme primer with peer comps and ideas | single-name update -> `earnings-reviewer` | sector-overview, competitive-analysis, comps-analysis, idea-generation | capiq / factset -> user peer data or filings | comps spread; note |
| `meeting-prep-agent` | briefing pack before a client meeting | | client-review, client-report | crm, capiq absent -> user notes and holdings | pack staged for advisor |
| `valuation-reviewer` | quarter-end review of GP valuation packages | deal underwriting -> `model-builder` | returns-analysis, portfolio-monitoring, waterfall, LP pack | portfolio absent -> user GP packages (untrusted) | LP pack staged for IR |
| `gl-reconciler` | daily or month-end GL vs subledger | posting entries -> `month-end-closer` | gl-recon, break-trace, independent re-verify, exception report | internal-gl, subledger absent -> user extracts | exception report |
| `month-end-closer` | period-end close for an entity | daily recon -> `gl-reconciler` | accrual-schedule, roll-forward, variance-commentary, package | internal-gl absent -> user trial balance | close package |
| `statement-auditor` | last check on LP statements before they go out | | nav-tieout per statement, exception list, sign-off sheet | nav absent -> user NAV pack and statements | sign-off sheet |
| `kyc-screener` | onboarding or periodic refresh | transaction monitoring | kyc-doc-parse, kyc-rules, **screening**, escalation packet | screening absent -> **cannot screen** | escalation packet |

## Rules for all of them

- Honor every stop. Do not roll through a checkpoint because the next step looks easy.
- A missing dependency is reported in the close-out as not done. It is never silently replaced by guessed data.
- Staged output is a draft. Distribution, posting, approval and rating decisions stay with humans.
