import type { CellError, CellValue } from "../../interfaces/types.js";
import { findFirstError, flattenArgs, toNumber } from "./helpers.js";
import type { FunctionArgument, FunctionContext } from "./types.js";

function stringify(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "boolean") return val ? "TRUE" : "FALSE";
  return String(val);
}

export function fnConcat(
  args: readonly FunctionArgument[],
  _context: FunctionContext,
): CellValue | CellError {
  const err = findFirstError(args);
  if (err) return err;
  const flat = flattenArgs(args);
  return flat.map((x) => stringify(x)).join("");
}

export function fnUpper(
  args: readonly FunctionArgument[],
  _context: FunctionContext,
): CellValue | CellError {
  const err = findFirstError(args);
  if (err) return err;
  if (args.length === 0) return "#VALUE!";
  return stringify(args[0]).toUpperCase();
}

export function fnLower(
  args: readonly FunctionArgument[],
  _context: FunctionContext,
): CellValue | CellError {
  const err = findFirstError(args);
  if (err) return err;
  if (args.length === 0) return "#VALUE!";
  return stringify(args[0]).toLowerCase();
}

export function fnLen(
  args: readonly FunctionArgument[],
  _context: FunctionContext,
): CellValue | CellError {
  const err = findFirstError(args);
  if (err) return err;
  if (args.length === 0) return "#VALUE!";
  return stringify(args[0]).length;
}

export function fnTrim(
  args: readonly FunctionArgument[],
  _context: FunctionContext,
): CellValue | CellError {
  const err = findFirstError(args);
  if (err) return err;
  if (args.length === 0) return "#VALUE!";
  // Excel TRIM removes leading, trailing, and repeated internal spaces
  const s = stringify(args[0]).trim();
  return s.replace(/\s+/g, " ");
}

export function fnLeft(
  args: readonly FunctionArgument[],
  _context: FunctionContext,
): CellValue | CellError {
  const err = findFirstError(args);
  if (err) return err;
  if (args.length === 0) return "#VALUE!";
  const str = stringify(args[0]);
  const count = args.length > 1 ? toNumber(args[1]) : 1;
  if (Number.isNaN(count) || count < 0) return "#VALUE!";
  return str.slice(0, count);
}

export function fnRight(
  args: readonly FunctionArgument[],
  _context: FunctionContext,
): CellValue | CellError {
  const err = findFirstError(args);
  if (err) return err;
  if (args.length === 0) return "#VALUE!";
  const str = stringify(args[0]);
  const count = args.length > 1 ? toNumber(args[1]) : 1;
  if (Number.isNaN(count) || count < 0) return "#VALUE!";
  if (count === 0) return "";
  return str.slice(Math.max(0, str.length - count));
}

export function fnMid(
  args: readonly FunctionArgument[],
  _context: FunctionContext,
): CellValue | CellError {
  const err = findFirstError(args);
  if (err) return err;
  if (args.length < 3) return "#VALUE!";
  const str = stringify(args[0]);
  const start = toNumber(args[1]);
  const len = toNumber(args[2]);
  if (Number.isNaN(start) || Number.isNaN(len) || start < 1 || len < 0) return "#VALUE!";
  return str.slice(start - 1, start - 1 + len);
}
