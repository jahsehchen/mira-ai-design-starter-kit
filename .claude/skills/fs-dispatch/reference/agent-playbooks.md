# Running the agents

Each agent is an end-to-end workflow with a fixed order and review stops. Its definition is the source of truth:

`vendor/financial-services/plugins/agent-plugins/<slug>/agents/<slug>.md`

Read it before running; do not work from memory or from the summary below.

**Plugin state.** Nine of the ten agent plugins are **disabled** in `.claude/settings.json` (they only add duplicate copies of skills that the vertical plugins already provide). Playbook mode reads the file from `vendor/`, so it works regardless. Only `meeting-prep-agent` is enabled, because it carries skills that exist nowhere else. To bring one back: `claude plugin enable <slug>@financial-services-local --scope project`, then restart the session.

## Modes

**A. Playbook (default).** The agent's *Workflow* and *Guardrails* are followed literally. Normally a **desk sub-agent** does this (the dispatcher delegates a brief, see `SKILL.md` "Inline or delegate"); the dispatcher runs it inline only when no desk is needed.
- Call the canonical skill names (`financial-analysis:dcf-model`, not `model-builder:dcf-model`).
- Apply the substitutions in `capabilities.md` (data source, `xlsx-author` / `pptx-author`).
- The playbooks mention helper workers ("reader", "critic", "resolver", "poster"). They are managed-agent subagents and sub-agents cannot start sub-agents here. Do those steps yourself in order, keeping the separation they imply: extract facts from untrusted documents first, then work only from the extracted fields. The independent check the "critic" provides is done by `fs-reviewer`.
- Why the plugin agents themselves are not run: they declare a `tools:` allowlist such as `Read, Write, Edit, mcp__capiq__*`, with no Skill or Bash, so as a sub-agent they likely cannot call their own skills or build a workbook. The `fs-*` desks have the tools they need.

**B. Fan-out.** For N independent items (a coverage list, several entities or funds), the dispatcher starts **one desk sub-agent per item** (for example `fs-research` per ticker), at most 4 at once, in a single message. Each brief carries the playbook path, the item, and where to write (`out/<job>-<item>-...`). Each returns the desk return contract. The dispatcher merges and reports. Do not fan out steps that depend on each other.

**C. Plugin agent as a sub-agent** (`subagent_type: "<slug>:<slug>"`). Only for `meeting-prep-agent` (the others are disabled; see Plugin state). Not used by the dispatcher; prefer `fs-banking`.

## The ten agents

Stops are where the playbook says to stop and hand back. "Needs" lists dependencies the sandbox lacks.

| Agent | Use for | Not for -> use | Core order | Needs / substitute | Stops after |
|---|---|---|---|---|---|
| `pitch-agent` | first-draft pitch on a named company | edit existing deck -> `investment-banking:pitch-deck` | sector-overview, comps-analysis, lbo-model, dcf-model + 3-statement-model, audit-xls, football field, pitch-deck, ib-check-deck | capiq absent -> user files; PPT template path from user | Excel model; deck |
| `model-builder` | clean DCF / LBO / 3-statement / comps from scratch | update a coverage model -> `earnings-reviewer` | matching model skill, audit-xls, sensitivities | capiq / daloopa absent -> user files | build; audit |
| `earnings-reviewer` | a covered name just reported | sector primer -> `market-researcher` | earnings-analysis, model-update, audit-xls, morning-note | factset / daloopa absent -> user-supplied filings, transcript, model | note and model staged |
| `market-researcher` | sector or theme primer with peer comps and ideas | single-name update -> `earnings-reviewer` | sector-overview, competitive-analysis, comps-analysis, idea-generation | capiq / factset absent -> user peer data | comps spread; note |
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
