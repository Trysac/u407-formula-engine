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

## Factory run formula-engine-functions (measured from API usage)

| Phase | Model | Batch | Input | Output | Cache write | Cache read | Cost (USD) |
|---|---|---|---|---|---|---|---|
| generation | gemini-3.8-flash | yes | 10136 | 17093 | 0 | 0 | 0.0358 |
| fix-1 | gemini-3.8-flash | no | 62488 | 1915 | 0 | 347804 | 0.0801 |
| fix-2 | gemini-3.8-flash | no | 112004 | 22394 | 0 | 1423147 | 0.2747 |
| fix-3 | gemini-3.8-flash | no | 79151 | 309 | 0 | 470816 | 0.0958 |
| fix-4 | gemini-3.8-flash | no | 79613 | 776 | 0 | 687328 | 0.1142 |
| audit | gemini-3.1-flash-lite | no | 0 | 0 | 0 | 0 | 0.0000 |

Total: $0.6007. Prices: Anthropic list prices.

## Factory run formula-engine-graph (measured from API usage)

| Phase | Model | Batch | Input | Output | Cache write | Cache read | Cost (USD) |
|---|---|---|---|---|---|---|---|
| generation | gemini-3.8-flash | yes | 9700 | 44334 | 0 | 0 | 0.0868 |
| audit | gemini-3.1-flash-lite | no | 33717 | 616 | 0 | 79300 | 0.0113 |
| fix-1 | gemini-3.8-flash | no | 96263 | 1916 | 0 | 1062577 | 0.1591 |

Total: $0.2572. Prices: Anthropic list prices.

## Factory run formula-engine-workbook (measured from API usage)

| Phase | Model | Batch | Input | Output | Cache write | Cache read | Cost (USD) |
|---|---|---|---|---|---|---|---|
| generation | gemini-3.8-flash | yes | 11052 | 11521 | 0 | 0 | 0.0257 |
| fix-1 | gemini-3.8-flash | no | 102275 | 767 | 0 | 1043300 | 0.1578 |
| fix-2 | gemini-3.8-flash | no | 100135 | 943 | 0 | 1033220 | 0.1561 |
| fix-3 | gemini-3.8-flash | no | 112835 | 802 | 0 | 1385025 | 0.1915 |
| fix-4 | gemini-3.8-flash | no | 131111 | 784 | 0 | 1068315 | 0.1814 |
| fix-5 | gemini-3.8-flash | no | 100682 | 1014 | 0 | 1076056 | 0.1600 |
| fix-6 | gemini-3.8-flash | no | 86235 | 1948 | 0 | 653409 | 0.1210 |
| audit | gemini-3.1-flash-lite | no | 40994 | 528 | 0 | 87695 | 0.0132 |

Total: $1.0069. Prices: Anthropic list prices.
