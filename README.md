# formula-engine

[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![CI](https://github.com/Trysac/u407-formula-engine/actions/workflows/ci.yml/badge.svg)](https://github.com/Trysac/u407-formula-engine/actions/workflows/ci.yml)

Zero-dependency spreadsheet formula engine in TypeScript with A1 reference parsing, incremental recalculation via dependency DAG, and cycle detection.

## Problem

Applications that let users type spreadsheet-style formulas (`=SUM(A1:B3)`, `=IF(A1>0, A1, 0)`) need to parse them,
track which cells depend on which, recompute only what changed, and stop on circular references. Pulling in a full
spreadsheet library for this brings far more than formula evaluation. This project implements a zero-dependency
formula engine in TypeScript: a recursive-descent parser with A1 reference and range parsing, a built-in function
registry (math, logic, text, lookup, date and finance functions such as `SUM`, `IF`, `VLOOKUP`), and an in-memory
`Workbook` that keeps a dependency DAG, recalculates affected cells in topological order, and marks cells on a cycle
with `#CIRC!`. It is not a spreadsheet file reader or writer.

## Install

The package is not published to npm yet. Build it from a clone:

```sh
git clone https://github.com/Trysac/u407-formula-engine.git
cd u407-formula-engine
npm ci && npm run build
```

Requires Node.js 22 or newer. The build emits ES modules with TypeScript declarations in `dist/`.

## Usage

```ts
import { isCellError, Workbook } from "@trysac/formula-engine";

const wb = new Workbook();
wb.setCell("A1", 10);
wb.setCell("A2", 32);
wb.setCell("A3", "=SUM(A1:A2)");
wb.setCell("B1", '=IF(A3>40,"big","small")');
console.log(wb.getValue("A3")); // 42
console.log(wb.getValue("B1")); // big

// Changing an input recalculates only the cells that depend on it.
console.log(wb.setCell("A1", 20).evaluated); // [ 'A3', 'B1' ]
console.log(wb.getValue("A3")); // 52

// Circular references and formula errors come back as Excel-style codes.
wb.setCell("C1", "=C2+1");
wb.setCell("C2", "=C1+1");
console.log(wb.getValue("C1")); // #CIRC!
console.log(wb.getCycle("C1")); // [ 'C2', 'C1' ]
wb.setCell("D1", "=1/0");
console.log(isCellError(wb.getValue("D1"))); // true

// Custom functions join the built-in registry.
wb.registerFunction("DOUBLE", (x) => (x as number) * 2);
wb.setCell("D2", "=DOUBLE(A2)");
console.log(wb.getValue("D2")); // 64
```

`test/entry.test.ts` covers the same calls through the package entry point.

## API

| Export | Signature | Description |
|---|---|---|
| `Workbook` | `new Workbook(opts?: WorkbookOptions)` | In-memory sheet: `setCell`, `getValue`, `getDependents`, `getCycle`, `recalculate`, `registerFunction`, `toJSON`, `loadJSON`. |
| `isCellError` | `(value: unknown) => value is CellError` | True for cell error values such as `#DIV/0!` and `#CIRC!`. |
| `FormulaError` | class | Thrown by `setCell` for invalid formulas and exceeded limits; `code` is a `FormulaErrorCode` such as `SYNTAX_ERROR`. |
| `CellValue`, `CellError`, `FormulaErrorCode` | types | Cell contents, cell error values (`#DIV/0!`, `#N/A`, `#REF!`, `#VALUE!`, `#NAME?`, `#NUM!`, `#CIRC!`) and thrown error codes. |
| `IWorkbook`, `WorkbookOptions`, `SetCellResult`, `RecalculateResult` | types | The workbook contract, its options and the result of a change. |
| `greet` | `(name: string) => string` | Template helper kept for compatibility; not part of the engine. |

## Development

```sh
npm install
npm run check   # lint, format, types, tests with coverage, docs, secrets
```

See [AGENTS.md](AGENTS.md) for the full command list and [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow.

## License

[MIT](LICENSE) © 2026 Miguel Gomez
