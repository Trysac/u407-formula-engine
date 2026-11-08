import type { CellError } from "../../interfaces/types.js";
import type { FunctionContext } from "./types.js";

/**
 * Flattens nested arrays or single values into a 1D list.
 * Useful for functions like SUM, AVERAGE, MIN, MAX.
 */
export function flattenArgs(args: readonly unknown[]): unknown[] {
  const result: unknown[] = [];
  for (const arg of args) {
    if (Array.isArray(arg)) {
      result.push(...flattenArgs(arg));
    } else {
      result.push(arg);
    }
  }
  return result;
}

/**
 * Checks if a value is a standard spreadsheet CellError.
 */
export function isCellError(val: unknown): val is CellError {
  return (
    typeof val === "string" &&
    ["#DIV/0!", "#N/A", "#REF!", "#VALUE!", "#NAME?", "#NUM!", "#CIRC!"].includes(val)
  );
}

/**
 * Returns the first error in an argument list or undefined.
 */
export function findFirstError(args: readonly unknown[]): CellError | undefined {
  for (const arg of args) {
    if (Array.isArray(arg)) {
      const nested = findFirstError(arg);
      if (nested) return nested;
    } else if (isCellError(arg)) {
      return arg;
    }
  }
  return undefined;
}

/**
 * Converts a value to a number. Returns NaN if conversion fails.
 */
export function toNumber(val: unknown): number {
  if (val === null || val === "" || val === undefined) return 0;
  if (typeof val === "boolean") return val ? 1 : 0;
  if (typeof val === "number") return Number.isFinite(val) ? val : Number.NaN;
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (trimmed === "") return 0;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : Number.NaN;
  }
  return Number.NaN;
}

/**
 * Converts a value to boolean.
 */
export function toBoolean(val: unknown): boolean | null {
  if (typeof val === "boolean") return val;
  if (typeof val === "number") return val !== 0;
  if (typeof val === "string") {
    const upper = val.trim().toUpperCase();
    if (upper === "TRUE") return true;
    if (upper === "FALSE") return false;
    const num = Number(val);
    if (!Number.isNaN(num)) return num !== 0;
  }
  return null;
}

/**
 * Resolves an argument if it represents a reference or range, or returns literal.
 */
export function resolveArg(arg: unknown, context: FunctionContext): unknown {
  if (typeof arg === "string") {
    if (arg.includes(":")) {
      return context.getRangeValues(arg);
    }
    // If it looks like a cell reference (e.g. Sheet1!A1, A1, $A$1)
    const refPattern = /^([A-Za-z0-9_]+!)?\$?[A-Za-z]+\$?\d+$/;
    if (refPattern.test(arg)) {
      return context.getCellValue(arg);
    }
  }
  return arg;
}
