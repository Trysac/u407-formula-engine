import type { CellError, CellValue } from "../../interfaces/types.js";
import { findFirstError, flattenArgs, toBoolean } from "./helpers.js";
import type { FunctionArgument, FunctionContext } from "./types.js";

export function fnIf(
  args: readonly FunctionArgument[],
  _context: FunctionContext,
): CellValue | CellError {
  if (args.length < 2) return "#VALUE!";
  const conditionArg = args[0];
  if (typeof conditionArg === "string" && conditionArg.startsWith("#")) {
    return conditionArg as CellError;
  }
  const cond = toBoolean(conditionArg);
  if (cond === null) return "#VALUE!";
  if (cond) {
    return (args[1] !== undefined ? args[1] : true) as CellValue | CellError;
  }
  return (args.length >= 3 ? args[2] : false) as CellValue | CellError;
}

export function fnIfError(
  args: readonly FunctionArgument[],
  _context: FunctionContext,
): CellValue | CellError {
  if (args.length < 2) return "#VALUE!";
  const val = args[0];
  const alt = args[1];
  if (typeof val === "string" && val.startsWith("#")) {
    return alt as CellValue | CellError;
  }
  return val as CellValue | CellError;
}

export function fnAnd(
  args: readonly FunctionArgument[],
  _context: FunctionContext,
): CellValue | CellError {
  const err = findFirstError(args);
  if (err) return err;
  const flat = flattenArgs(args);
  if (flat.length === 0) return "#VALUE!";
  for (const item of flat) {
    const b = toBoolean(item);
    if (b === null) return "#VALUE!";
    if (!b) return false;
  }
  return true;
}

export function fnOr(
  args: readonly FunctionArgument[],
  _context: FunctionContext,
): CellValue | CellError {
  const err = findFirstError(args);
  if (err) return err;
  const flat = flattenArgs(args);
  if (flat.length === 0) return "#VALUE!";
  for (const item of flat) {
    const b = toBoolean(item);
    if (b === null) return "#VALUE!";
    if (b) return true;
  }
  return false;
}

export function fnNot(
  args: readonly FunctionArgument[],
  _context: FunctionContext,
): CellValue | CellError {
  const err = findFirstError(args);
  if (err) return err;
  if (args.length === 0) return "#VALUE!";
  const b = toBoolean(args[0]);
  if (b === null) return "#VALUE!";
  return !b;
}
