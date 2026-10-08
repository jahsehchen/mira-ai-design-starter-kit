# Router: investment banking (`investment-banking`)

| Intent | Leaf | Command | Inputs | Output |
|---|---|---|---|---|
| One-page company profile (strip) | `investment-banking:strip-profile` | `/one-pager` | company; the bank's PPT template if any | 1-4 slides |
| Populate an existing deck template from data | `investment-banking:pitch-deck` | none | template pptx + source data (Excel/CSV). Not for building from scratch | pptx |
| Data pack from CIMs, filings, OMs | `investment-banking:datapack-builder` | none | source documents | standardized xlsx |
| Strategic and financial buyer universe | `investment-banking:buyer-list` | `/buyer-list` | company or sector, deal rationale | list / xlsx |
| Anonymous one-page teaser | `investment-banking:teaser` | `/teaser` | company facts | 1 page |
| Confidential Information Memorandum | `investment-banking:cim-builder` | `/cim` | company information and financials | doc |
| Process letter, IOI or final bid instructions | `investment-banking:process-letter` | `/process-letter` | stage (IOI or final), timeline, terms | letter |
| Accretion/dilution analysis | `investment-banking:merger-model` | `/merger-model` | acquirer, target, deal terms, synergies | xlsx |
| Track live deals, milestones, actions | `investment-banking:deal-tracker` | `/deal-tracker` | deal list / updates | tracker |
| QC a deck | `financial-analysis:ib-check-deck` | none | pptx | issues |
| Refresh numbers in a deck | `financial-analysis:deck-refresh` | none | pptx + new data | pptx |
| First-draft pitch on a named company | **W** `pitch-agent` | none | target, one-line situation, PPT template | model + deck |

## Choosing

- "Pitch for X" with no deck yet -> **W** `pitch-agent`. A deck exists and needs data -> `pitch-deck`. A deck exists and numbers changed -> `deck-refresh`.
- Valuation inputs for any of these come from `financial-analysis` (`comps-analysis`, `dcf-model`, `lbo-model`). See `modeling-core.md`.
- Sell-side process: use the chain in `reference/pipelines.md` #2.

## Hand-offs

- `buyer-list`, `teaser` and `cim-builder` reuse the company profile and the peer set; build `strip-profile` and `comps-analysis` first and pass them forward.
- A deck produced anywhere in the flow gets `ib-check-deck` before it is called done.

## Gotchas

- The teaser must not identify the company: no names, locations or distinctive facts that point back. Re-read it for leaks before handing it over.
- Client and target names on live deals are confidential: no web searches on undisclosed names.
- Nothing is sent to a client or counterparty from here. Letters and memos are drafts for the banker.
