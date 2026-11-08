import type { CellError, CellValue } from "../../interfaces/types.js";
import { findFirstError, toNumber } from "./helpers.js";
import type { FunctionArgument, FunctionContext } from "./types.js";

/**
 * Converts Year, Month, Day to an Excel serial date number.
 * Excel date system starts at 1900-01-01 (serial 1).
 * If excel1900LeapBug is true (default in Excel), 1900 is treated as a leap year (Feb 29, 1900 = 60).
 */
export function dateToSerial(
  year: number,
  month: number,
  day: number,
  excel1900LeapBug = true,
): number {
  // Handle two-digit years like Excel if desired, or treat as passed
  let y = year;
  if (y >= 0 && y <= 1899) {
    y += 1900;
  }

  // If year is 1900 and month is 2 and day is 29, handle leap bug
  if (excel1900LeapBug && y === 1900 && month === 2 && day === 29) {
    return 60;
  }

  // Normalize using UTC Date
  const dt = new Date(Date.UTC(y, month - 1, day));
  const normY = dt.getUTCFullYear();
  const normM = dt.getUTCMonth() + 1;
  const normD = dt.getUTCDate();

  // Number of days between 1900-01-01 and dt
  // Epoch of 1900-01-01 UTC: Date.UTC(1900, 0, 1) = -2208988800000
  const epoch = Date.UTC(1900, 0, 1);
  const current = Date.UTC(normY, normM - 1, normD);
  const diffDays = Math.floor((current - epoch) / (1000 * 60 * 60 * 24));

  let serial = diffDays + 1; // 1900-01-01 is day 1

  // In Excel with the 1900 leap bug:
  // Dates on or after March 1, 1900 are 1 day higher because Excel considered 1900 a leap year (day 60 = 1900-02-29)
  if (excel1900LeapBug && (normY > 1900 || (normY === 1900 && normM > 2))) {
    serial += 1;
  }

  return serial;
}

/**
 * Converts an Excel serial date number to { year, month, day }.
 */
export function serialToDate(
  serial: number,
  excel1900LeapBug = true,
): { year: number; month: number; day: number } {
  if (serial < 1) {
    return { year: 1900, month: 1, day: 0 };
  }

  if (excel1900LeapBug && serial === 60) {
    return { year: 1900, month: 2, day: 29 };
  }

  let adjustedSerial = serial;
  if (excel1900LeapBug && serial > 60) {
    adjustedSerial -= 1;
  }

  const epoch = Date.UTC(1900, 0, 1);
  const time = epoch + (adjustedSerial - 1) * 24 * 60 * 60 * 1000;
  const dt = new Date(time);
  return {
    year: dt.getUTCFullYear(),
    month: dt.getUTCMonth() + 1,
    day: dt.getUTCDate(),
  };
}

export function fnDate(
  args: readonly FunctionArgument[],
  context: FunctionContext,
): CellValue | CellError {
  const err = findFirstError(args);
  if (err) return err;
  if (args.length < 3) return "#VALUE!";

  const y = toNumber(args[0]);
  const m = toNumber(args[1]);
  const d = toNumber(args[2]);
  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return "#VALUE!";

  const leapBug = context.excel1900LeapBug !== false;
  return dateToSerial(Math.floor(y), Math.floor(m), Math.floor(d), leapBug);
}

export function fnYear(
  args: readonly FunctionArgument[],
  context: FunctionContext,
): CellValue | CellError {
  const err = findFirstError(args);
  if (err) return err;
  if (args.length < 1) return "#VALUE!";

  const s = toNumber(args[0]);
  if (Number.isNaN(s)) return "#VALUE!";
  if (s < 0) return "#NUM!";

  const leapBug = context.excel1900LeapBug !== false;
  const parsed = serialToDate(s, leapBug);
  return parsed.year;
}

export function fnMonth(
  args: readonly FunctionArgument[],
  context: FunctionContext,
): CellValue | CellError {
  const err = findFirstError(args);
  if (err) return err;
  if (args.length < 1) return "#VALUE!";

  const s = toNumber(args[0]);
  if (Number.isNaN(s)) return "#VALUE!";
  if (s < 0) return "#NUM!";

  const leapBug = context.excel1900LeapBug !== false;
  const parsed = serialToDate(s, leapBug);
  return parsed.month;
}

export function fnDay(
  args: readonly FunctionArgument[],
  context: FunctionContext,
): CellValue | CellError {
  const err = findFirstError(args);
  if (err) return err;
  if (args.length < 1) return "#VALUE!";

  const s = toNumber(args[0]);
  if (Number.isNaN(s)) return "#VALUE!";
  if (s < 0) return "#NUM!";

  const leapBug = context.excel1900LeapBug !== false;
  const parsed = serialToDate(s, leapBug);
  return parsed.day;
}

export function fnNow(
  _args: readonly FunctionArgument[],
  _context: FunctionContext,
): CellValue | CellError {
  // In headless tests, return a fixed or current serial
  const now = new Date();
  const s = dateToSerial(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate());
  const frac = (now.getUTCHours() * 3600 + now.getUTCMinutes() * 60 + now.getUTCSeconds()) / 86400;
  return s + frac;
}

export function fnToday(
  _args: readonly FunctionArgument[],
  context: FunctionContext,
): CellValue | CellError {
  const now = new Date();
  const leapBug = context.excel1900LeapBug !== false;
  return dateToSerial(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate(), leapBug);
}
