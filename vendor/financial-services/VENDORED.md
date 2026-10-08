# Vendored copy

Copy of https://github.com/anthropics/financial-services (Apache-2.0, see `LICENSE`)
at commit `574ed3624aebd0418c7e96cd101262f30210ab26` (2026-09-21), without `.git`.

Used as the project plugin marketplace `financial-services-local`
(see `.claude/settings.json` at the repo root).

## Local changes vs. upstream

1. `plugins/vertical-plugins/financial-analysis/.mcp.json` — emptied to `{"mcpServers": {}}`
   (same as the other vertical plugins). Upstream shipped 12 data connectors in invalid JSON
   (missing comma after `egnyte`, unclosed `box` block). We have no subscriptions, so they are removed
   rather than repaired; data comes from user-provided files. To restore them, take the list from
   `anthropics/financial-services` and fix the JSON.
2. `.claude-plugin/marketplace.json` — marketplace renamed to `financial-services-local`
   (`claude-for-financial-services` is reserved for the official GitHub source), added a
   `description`, and removed the `claude-for-msft-365-install` entry (its name is reserved for
   official marketplaces). The directory itself is still here, just not listed.

## Known upstream issue, not changed

`scripts/check.py` reports that `plugins/agent-plugins/meeting-prep-agent/skills/{client-report,client-review,investment-proposal}`
have no source under `vertical-plugins/` (the source dir `claude-for-financial-advisors` was deleted upstream in #354).
The plugin itself validates and loads; the skills are bundled in the agent.
Do not run `scripts/check.py` from the repo root — it sets `core.hooksPath` on the current git repo.
