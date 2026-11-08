# Project record: formula-engine

## Objective

Zero-dependency spreadsheet formula engine in TypeScript with A1 reference parsing, incremental recalculation via dependency DAG, and cycle detection.

State the measurable outcome this utility must deliver and who it is for.

## Scope

In scope:

- The public API documented in the README.

Out of scope:

- List what this utility deliberately does not do.

## Timeline

| Date | Milestone |
|---|---|
| 2026 | Repository created from the factory utility template. |

## Effort metrics

Measured values only. Leave "pending measurement" until a real figure is recorded; never estimate here.

| Metric | Value | Source |
|---|---|---|
| Tokens (input / output) | 2652986 / 66253 | factory ledger |
| Hours (human) | pending measurement | time log |
| Cost (USD) | 0.5823 | factory ledger |

## Factory run formula-engine-parser (measured from API usage)

| Phase | Model | Batch | Input | Output | Cache write | Cache read | Cost (USD) |
|---|---|---|---|---|---|---|---|
| generation | gemini-3.8-flash | yes | 10012 | 45803 | 0 | 0 | 0.0896 |
| fix-1 | gemini-3.8-flash | no | 54352 | 1299 | 0 | 288802 | 0.0673 |
| fix-2 | gemini-3.8-flash | no | 86527 | 1733 | 0 | 748892 | 0.1276 |
| audit | gemini-3.1-flash-lite | no | 24357 | 263 | 0 | 22333 | 0.0070 |
| fix-3 | gemini-3.8-flash | no | 29467 | 967 | 0 | 80086 | 0.0317 |
| fix-1 | gemini-3.8-flash | no | 85336 | 12949 | 0 | 692274 | 0.1645 |
| fix-2 | gemini-3.8-flash | no | 63078 | 3239 | 0 | 467470 | 0.0945 |

Total: $0.5823. Prices: Anthropic list prices.
