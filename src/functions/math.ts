import type { CellError, CellValue } from "../../interfaces/types.js";
import { findFirstError, flattenArgs, toNumber } from "./helpers.js";
import type { FunctionArgument, FunctionContext } from "./types.js";

export function fnSum(
  args: readonly FunctionArgument[],
  _context: FunctionContext,
): CellValue | CellError {
  const err = findFirstError(args);
  if (err) return err;

  const flat = flattenArgs(args);
  let sum = 0;
  for (const item of flat) {
    if (item === null || item === "") continue;
    const num = typeof item === "number" ? item : toNumber(item);
    if (Number.isNaN(num)) return "#VALUE!";
    sum += num;
  }
  return sum;
}

export function fnAverage(
  args: readonly FunctionArgument[],
  _context: FunctionContext,
): CellValue | CellError {
  const err = findFirstError(args);
  if (err) return err;

  const flat = flattenArgs(args);
  let sum = 0;
  let count = 0;
  for (const item of flat) {
    if (item === null || item === "") continue;
    const num = typeof item === "number" ? item : toNumber(item);
    if (Number.isNaN(num)) return "#VALUE!";
    sum += num;
    count++;
  }
  if (count === 0) return "#DIV/0!";
  return sum / count;
}

export function fnMin(
  args: readonly FunctionArgument[],
  _context: FunctionContext,
): CellValue | CellError {
  const err = findFirstError(args);
  if (err) return err;

  const flat = flattenArgs(args);
  let minVal = Number.POSITIVE_INFINITY;
  let count = 0;
  for (const item of flat) {
    if (item === null || item === "") continue;
    const num = typeof item === "number" ? item : toNumber(item);
    if (Number.isNaN(num)) return "#VALUE!";
    if (num < minVal) minVal = num;
    count++;
  }
  return count === 0 ? 0 : minVal;
}

export function fnMax(
  args: readonly FunctionArgument[],
  _context: FunctionContext,
): CellValue | CellError {
  const err = findFirstError(args);
  if (err) return err;

  const flat = flattenArgs(args);
  let maxVal = Number.NEGATIVE_INFINITY;
  let count = 0;
  for (const item of flat) {
    if (item === null || item === "") continue;
    const num = typeof item === "number" ? item : toNumber(item);
    if (Number.isNaN(num)) return "#VALUE!";
    if (num > maxVal) maxVal = num;
    count++;
  }
  return count === 0 ? 0 : maxVal;
}

export function fnAbs(
  args: readonly FunctionArgument[],
  _context: FunctionContext,
): CellValue | CellError {
  const err = findFirstError(args);
  if (err) return err;
  if (args.length === 0) return "#VALUE!";
  const num = toNumber(args[0]);
  if (Number.isNaN(num)) return "#VALUE!";
  return Math.abs(num);
}

export function fnRound(
  args: readonly FunctionArgument[],
  _context: FunctionContext,
): CellValue | CellError {
  const err = findFirstError(args);
  if (err) return err;
  if (args.length < 2) return "#VALUE!";
  const val = toNumber(args[0]);
  const digits = toNumber(args[1]);
  if (Number.isNaN(val) || Number.isNaN(digits)) return "#VALUE!";
  // Excel rounds half away from zero; toPrecision(15) absorbs binary representation
  // error so that values such as 2.345 round as their decimal form suggests.
  const factor = 10 ** Math.trunc(digits);
  const scaled = Number((Math.abs(val) * factor).toPrecision(15));
  const rounded = Math.round(scaled) / factor;
  return val < 0 ? -rounded : rounded;
}

export function fnSqrt(
  args: readonly FunctionArgument[],
  _context: FunctionContext,
): CellValue | CellError {
  const err = findFirstError(args);
  if (err) return err;
  if (args.length === 0) return "#VALUE!";
  const val = toNumber(args[0]);
  if (Number.isNaN(val)) return "#VALUE!";
  if (val < 0) return "#NUM!";
  return Math.sqrt(val);
}

export function fnPower(
  args: readonly FunctionArgument[],
  _context: FunctionContext,
): CellValue | CellError {
  const err = findFirstError(args);
  if (err) return err;
  if (args.length < 2) return "#VALUE!";
  const base = toNumber(args[0]);
  const exp = toNumber(args[1]);
  if (Number.isNaN(base) || Number.isNaN(exp)) return "#VALUE!";
  const res = base ** exp;
  if (!Number.isFinite(res) || Number.isNaN(res)) return "#NUM!";
  return res;
}

export function fnMod(
  args: readonly FunctionArgument[],
  _context: FunctionContext,
): CellValue | CellError {
  const err = findFirstError(args);
  if (err) return err;
  if (args.length < 2) return "#VALUE!";
  const n = toNumber(args[0]);
  const d = toNumber(args[1]);
  if (Number.isNaN(n) || Number.isNaN(d)) return "#VALUE!";
  if (d === 0) return "#DIV/0!";
  // Excel modulo: n - d * floor(n / d)
  return n - d * Math.floor(n / d);
}
