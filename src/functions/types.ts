import type { CellError, CellValue } from "../../interfaces/types.js";

/**
 * Type representing any cell value, error, or nested array passed as function arguments.
 */
export type FunctionArgument = CellValue | CellError | FunctionArgument[];

/**
 * Evaluation context provided to function implementations.
 */
export interface FunctionContext {
  readonly excel1900LeapBug?: boolean;
  getCellValue(ref: string): CellValue | CellError;
  getRangeValues(rangeRef: string): (CellValue | CellError)[][];
}

/**
 * Function signature for spreadsheet functions.
 */
export type FunctionImplementation = (
  args: readonly FunctionArgument[],
  context: FunctionContext,
) => CellValue | CellError;

/**
 * Interface for the function registry.
 */
export interface IFunctionRegistry {
  register(name: string, fn: FunctionImplementation): void;
  get(name: string): FunctionImplementation | undefined;
  has(name: string): boolean;
  names(): string[];
}
