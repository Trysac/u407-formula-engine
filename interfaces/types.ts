/**
 * Primitive cell values supported by the spreadsheet engine.
 */
export type CellValue = number | string | boolean | null;

/**
 * Standard spreadsheet error literal strings.
 */
export type CellError = "#DIV/0!" | "#N/A" | "#REF!" | "#VALUE!" | "#NAME?" | "#NUM!" | "#CIRC!";

/**
 * Error codes thrown by parser and evaluation limits.
 */
export type FormulaErrorCode =
  | "FORMULA_TOO_LONG"
  | "EXPRESSION_TOO_DEEP"
  | "CELL_LIMIT_EXCEEDED"
  | "SYNTAX_ERROR"
  | "CIRCULAR_REFERENCE"
  | "UNKNOWN_FUNCTION";

/**
 * Custom error class for formula parsing and execution errors.
 */
export declare class FormulaError extends Error {
  readonly code: FormulaErrorCode;
  constructor(code: FormulaErrorCode, message?: string);
}

/**
 * Coordinate representing a single cell location.
 */
export interface CellCoord {
  readonly sheet?: string;
  readonly row: number;
  readonly col: number;
  readonly rowAbsolute?: boolean;
  readonly colAbsolute?: boolean;
}

/**
 * Rectangular range of cells.
 */
export interface CellRange {
  readonly sheet?: string;
  readonly start: CellCoord;
  readonly end: CellCoord;
}
