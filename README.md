# formula-engine

[![npm version](https://img.shields.io/npm/v/@trysac/formula-engine.svg)](https://www.npmjs.com/package/@trysac/formula-engine)
[![license: MIT](https://img.shields.io/npm/l/@trysac/formula-engine.svg)](LICENSE)
[![CI](https://github.com/Trysac/u407-formula-engine/actions/workflows/ci.yml/badge.svg)](https://github.com/Trysac/u407-formula-engine/actions/workflows/ci.yml)

Zero-dependency spreadsheet formula engine in TypeScript with A1 reference parsing, incremental recalculation via dependency DAG, and cycle detection.

## Problem

Applications that let users type spreadsheet-style formulas (`=SUM(A1:B3)`, `=IF(A1>0, A1, 0)`) need to parse them,
track which cells depend on which, recompute only what changed, and stop on circular references. Pulling in a full
spreadsheet library for this brings far more than formula evaluation. This project implements a zero-dependency
formula engine in TypeScript: a recursive-descent parser with A1 reference and range parsing, a built-in function
registry (math, logic, text, lookup, date and finance functions such as `SUM`, `IF`, `VLOOKUP`), and an in-memory
`Workbook` that keeps a dependency DAG, recalculates affected cells in topological order, and marks cells on a cycle
with `#CIRC!`. It is not a spreadsheet file reader or writer. The engine lives under `src/` and is not yet exported
from the package entry point; see [API](#api).

## Install

```sh
npm install @trysac/formula-engine
```

Requires Node.js 20 or newer. The package ships ES modules with TypeScript declarations.

## Usage

```ts
import { greet } from "@trysac/formula-engine";

// Build a greeting; surrounding whitespace is ignored.
const message = greet("  Ada ");
console.log(message); // "Hello, Ada!"

try {
  greet("   ");
} catch (error) {
  console.error((error as Error).message); // "name must not be empty"
}
```

## API

| Export | Signature | Description |
|---|---|---|
| `greet` | `(name: string) => string` | Placeholder API; replace it with the real one. |

## Development

```sh
npm install
npm run check   # lint, format, types, tests with coverage, docs, secrets
```

See [AGENTS.md](AGENTS.md) for the full command list and [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow.

## License

[MIT](LICENSE) © 2026 Miguel Gomez
