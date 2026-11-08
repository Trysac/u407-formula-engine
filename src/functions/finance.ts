import type { CellError, CellValue } from "../../interfaces/types.js";
import { findFirstError, flattenArgs, toNumber } from "./helpers.js";
import type { FunctionArgument, FunctionContext } from "./types.js";

/**
 * PMT(rate, nper, pv, [fv], [type])
 * Calculates the payment for a loan based on constant payments and a constant interest rate.
 */
export function fnPmt(
  args: readonly FunctionArgument[],
  _context: FunctionContext,
): CellValue | CellError {
  const err = findFirstError(args);
  if (err) return err;
  if (args.length < 3) return "#VALUE!";

  const rate = toNumber(args[0]);
  const nper = toNumber(args[1]);
  const pv = toNumber(args[2]);
  const fv = args.length > 3 && args[3] !== undefined && args[3] !== null ? toNumber(args[3]) : 0;
  const type = args.length > 4 && args[4] !== undefined && args[4] !== null ? toNumber(args[4]) : 0;

  if (
    Number.isNaN(rate) ||
    Number.isNaN(nper) ||
    Number.isNaN(pv) ||
    Number.isNaN(fv) ||
    Number.isNaN(type)
  ) {
    return "#VALUE!";
  }

  if (nper === 0) return "#NUM!";

  if (rate === 0) {
    return -(pv + fv) / nper;
  }

  const pvif = (1 + rate) ** nper;
  let pmt = (rate / (pvif - 1)) * -(pv * pvif + fv);
  if (type === 1) {
    pmt /= 1 + rate;
  }
  return pmt;
}

/**
 * PV(rate, nper, pmt, [fv], [type])
 * Returns the present value of an investment.
 */
export function fnPv(
  args: readonly FunctionArgument[],
  _context: FunctionContext,
): CellValue | CellError {
  const err = findFirstError(args);
  if (err) return err;
  if (args.length < 3) return "#VALUE!";

  const rate = toNumber(args[0]);
  const nper = toNumber(args[1]);
  const pmt = toNumber(args[2]);
  const fv = args.length > 3 && args[3] !== undefined && args[3] !== null ? toNumber(args[3]) : 0;
  const type = args.length > 4 && args[4] !== undefined && args[4] !== null ? toNumber(args[4]) : 0;

  if (
    Number.isNaN(rate) ||
    Number.isNaN(nper) ||
    Number.isNaN(pmt) ||
    Number.isNaN(fv) ||
    Number.isNaN(type)
  ) {
    return "#VALUE!";
  }

  if (rate === 0) {
    return -pmt * nper - fv;
  }

  const pvif = (1 + rate) ** nper;
  let res: number;
  if (type === 1) {
    res = (-fv - pmt * (1 + rate) * ((pvif - 1) / rate)) / pvif;
  } else {
    res = (-fv - pmt * ((pvif - 1) / rate)) / pvif;
  }
  return res;
}

/**
 * FV(rate, nper, pmt, [pv], [type])
 * Returns the future value of an investment.
 */
export function fnFv(
  args: readonly FunctionArgument[],
  _context: FunctionContext,
): CellValue | CellError {
  const err = findFirstError(args);
  if (err) return err;
  if (args.length < 3) return "#VALUE!";

  const rate = toNumber(args[0]);
  const nper = toNumber(args[1]);
  const pmt = toNumber(args[2]);
  const pv = args.length > 3 && args[3] !== undefined && args[3] !== null ? toNumber(args[3]) : 0;
  const type = args.length > 4 && args[4] !== undefined && args[4] !== null ? toNumber(args[4]) : 0;

  if (
    Number.isNaN(rate) ||
    Number.isNaN(nper) ||
    Number.isNaN(pmt) ||
    Number.isNaN(pv) ||
    Number.isNaN(type)
  ) {
    return "#VALUE!";
  }

  if (rate === 0) {
    return -pv - pmt * nper;
  }

  const pvif = (1 + rate) ** nper;
  let res: number;
  if (type === 1) {
    res = -pv * pvif - pmt * (1 + rate) * ((pvif - 1) / rate);
  } else {
    res = -pv * pvif - pmt * ((pvif - 1) / rate);
  }
  return res;
}

/**
 * NPER(rate, pmt, pv, [fv], [type])
 * Returns the number of periods for an investment based on periodic, constant payments.
 */
export function fnNper(
  args: readonly FunctionArgument[],
  _context: FunctionContext,
): CellValue | CellError {
  const err = findFirstError(args);
  if (err) return err;
  if (args.length < 3) return "#VALUE!";

  const rate = toNumber(args[0]);
  const pmt = toNumber(args[1]);
  const pv = toNumber(args[2]);
  const fv = args.length > 3 && args[3] !== undefined && args[3] !== null ? toNumber(args[3]) : 0;
  const type = args.length > 4 && args[4] !== undefined && args[4] !== null ? toNumber(args[4]) : 0;

  if (
    Number.isNaN(rate) ||
    Number.isNaN(pmt) ||
    Number.isNaN(pv) ||
    Number.isNaN(fv) ||
    Number.isNaN(type)
  ) {
    return "#VALUE!";
  }

  if (rate === 0) {
    if (pmt === 0) return "#DIV/0!";
    return -(pv + fv) / pmt;
  }

  const z = type === 1 ? (pmt * (1 + rate)) / rate : pmt / rate;
  const num = -fv + z;
  const den = pv + z;
  if (num / den <= 0) return "#NUM!";
  return Math.log(num / den) / Math.log(1 + rate);
}

/**
 * NPV(rate, val1, [val2], ...)
 * Calculates the net present value of an investment by using a discount rate and a series of future payments.
 */
export function fnNpv(
  args: readonly FunctionArgument[],
  _context: FunctionContext,
): CellValue | CellError {
  const err = findFirstError(args);
  if (err) return err;
  if (args.length < 2) return "#VALUE!";

  const rate = toNumber(args[0]);
  if (Number.isNaN(rate)) return "#VALUE!";
  if (rate <= -1) return "#NUM!";

  const cashflows = flattenArgs(args.slice(1));
  let npv = 0;
  for (let i = 0; i < cashflows.length; i++) {
    const flow = toNumber(cashflows[i]);
    if (Number.isNaN(flow)) return "#VALUE!";
    npv += flow / (1 + rate) ** (i + 1);
  }
  return npv;
}
