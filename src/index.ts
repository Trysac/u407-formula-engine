/**
 * Public entry point of @trysac/formula-engine.
 *
 * `Workbook` holds cells addressed in A1 notation, parses formulas, tracks dependencies and
 * recalculates only the cells affected by a change. Errors are Excel-style codes such as
 * `#DIV/0!` and `#CIRC!`; `isCellError` tells them apart from values. Invalid formulas and
 * exceeded limits throw `FormulaError` with a `code`.
 */

export { FormulaError } from "./parser/types.js";
export { isCellError } from "./workbook/evaluator.js";
export { Workbook } from "./workbook/index.js";
export type {
  CellError,
  CellValue,
  FormulaErrorCode,
  IWorkbook,
  RecalculateResult,
  SetCellResult,
  WorkbookOptions,
} from "./workbook/types.js";

/**
 * Builds a greeting for `name`.
 *
 * @param name - Who to greet. Surrounding whitespace is ignored.
 * @returns The greeting, for example `"Hello, Ada!"`.
 * @throws {TypeError} When `name` is empty after trimming.
 */
export function greet(name: string): string {
  const trimmed = name.trim();
  if (trimmed === "") {
    throw new TypeError("name must not be empty");
  }
  return `Hello, ${trimmed}!`;
}
