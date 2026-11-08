import type { CellError, CellValue } from "../../interfaces/types.js";
import { findFirstError, resolveArg, toNumber } from "./helpers.js";
import type { FunctionArgument, FunctionContext } from "./types.js";

function valuesEqual(a: unknown, b: unknown): boolean {
  if (typeof a === "string" && typeof b === "string") {
    return a.toLowerCase() === b.toLowerCase();
  }
  return a === b;
}

export function fnVLookup(
  args: readonly FunctionArgument[],
  context: FunctionContext,
): CellValue | CellError {
  const err = findFirstError(args);
  if (err) return err;
  if (args.length < 3) return "#VALUE!";

  const lookupVal = args[0];
  const table = resolveArg(args[1], context);
  const colIndex = toNumber(args[2]);
  const approximate = args.length > 3 ? Boolean(args[3]) : true;

  if (!Array.isArray(table) || table.length === 0 || !Array.isArray(table[0])) {
    return "#VALUE!";
  }
  if (Number.isNaN(colIndex) || colIndex < 1) {
    return "#VALUE!";
  }
  if (colIndex > table[0].length) {
    return "#REF!";
  }

  const colIdx0 = Math.floor(colIndex) - 1;

  if (!approximate) {
    // Exact match
    for (let r = 0; r < table.length; r++) {
      const candidate = table[r][0];
      if (valuesEqual(candidate, lookupVal)) {
        return table[r][colIdx0] as CellValue | CellError;
      }
    }
    return "#N/A";
  }

  // Approximate match assumes sorted ascending
  let bestRow = -1;
  for (let r = 0; r < table.length; r++) {
    const candidate = table[r][0];
    if (candidate === lookupVal) {
      bestRow = r;
      break;
    }
    if (typeof candidate === "number" && typeof lookupVal === "number") {
      if (candidate <= lookupVal) {
        bestRow = r;
      } else {
        break;
      }
    } else if (valuesEqual(candidate, lookupVal)) {
      bestRow = r;
      break;
    }
  }

  if (bestRow === -1) return "#N/A";
  return table[bestRow][colIdx0] as CellValue | CellError;
}

export function fnHLookup(
  args: readonly FunctionArgument[],
  context: FunctionContext,
): CellValue | CellError {
  const err = findFirstError(args);
  if (err) return err;
  if (args.length < 3) return "#VALUE!";

  const lookupVal = args[0];
  const table = resolveArg(args[1], context);
  const rowIndex = toNumber(args[2]);
  const approximate = args.length > 3 ? Boolean(args[3]) : true;

  if (!Array.isArray(table) || table.length === 0 || !Array.isArray(table[0])) {
    return "#VALUE!";
  }
  if (Number.isNaN(rowIndex) || rowIndex < 1) {
    return "#VALUE!";
  }
  if (rowIndex > table.length) {
    return "#REF!";
  }

  const rowIdx0 = Math.floor(rowIndex) - 1;
  const numCols = table[0].length;

  if (!approximate) {
    for (let c = 0; c < numCols; c++) {
      const candidate = table[0][c];
      if (valuesEqual(candidate, lookupVal)) {
        return table[rowIdx0][c] as CellValue | CellError;
      }
    }
    return "#N/A";
  }

  let bestCol = -1;
  for (let c = 0; c < numCols; c++) {
    const candidate = table[0][c];
    if (candidate === lookupVal) {
      bestCol = c;
      break;
    }
    if (typeof candidate === "number" && typeof lookupVal === "number") {
      if (candidate <= lookupVal) {
        bestCol = c;
      } else {
        break;
      }
    } else if (valuesEqual(candidate, lookupVal)) {
      bestCol = c;
      break;
    }
  }
  if (bestCol === -1) return "#N/A";
  return table[rowIdx0][bestCol] as CellValue | CellError;
}

export function fnIndex(
  args: readonly FunctionArgument[],
  context: FunctionContext,
): CellValue | CellError {
  const err = findFirstError(args);
  if (err) return err;
  if (args.length < 2) return "#VALUE!";

  const range = resolveArg(args[0], context);
  if (!Array.isArray(range) || range.length === 0) {
    return "#VALUE!";
  }

  const rowNum = toNumber(args[1]);
  const colNum = args.length > 2 ? toNumber(args[2]) : 1;
  if (Number.isNaN(rowNum) || Number.isNaN(colNum)) return "#VALUE!";
  if (rowNum < 1 || colNum < 1) return "#VALUE!";

  const r = Math.floor(rowNum) - 1;
  const c = Math.floor(colNum) - 1;

  if (r >= range.length) return "#REF!";
  const row = range[r];
  if (!Array.isArray(row) || c >= row.length) return "#REF!";

  return row[c] as CellValue | CellError;
}

export function fnMatch(
  args: readonly FunctionArgument[],
  context: FunctionContext,
): CellValue | CellError {
  const err = findFirstError(args);
  if (err) return err;
  if (args.length < 2) return "#VALUE!";

  const lookupVal = args[0];
  const lookupArrayRaw = resolveArg(args[1], context);
  const matchType = args.length > 2 ? toNumber(args[2]) : 1;
  if (Number.isNaN(matchType)) return "#VALUE!";

  // Flatten 2D array if 1D range
  const list: unknown[] = [];
  if (Array.isArray(lookupArrayRaw)) {
    for (const row of lookupArrayRaw) {
      if (Array.isArray(row)) {
        list.push(...row);
      } else {
        list.push(row);
      }
    }
  } else {
    return "#VALUE!";
  }

  if (matchType === 0) {
    // Exact match
    for (let i = 0; i < list.length; i++) {
      if (valuesEqual(list[i], lookupVal)) {
        return i + 1;
      }
    }
    return "#N/A";
  }

  if (matchType === 1) {
    // Largest value <= lookupVal, sorted ascending
    let bestIndex = -1;
    for (let i = 0; i < list.length; i++) {
      const val = list[i];
      if (val === lookupVal) {
        bestIndex = i;
        break;
      }
      if (typeof val === "number" && typeof lookupVal === "number") {
        if (val <= lookupVal) {
          bestIndex = i;
        } else {
          break;
        }
      } else if (valuesEqual(val, lookupVal)) {
        bestIndex = i;
        break;
      }
    }
    if (bestIndex === -1) return "#N/A";
    return bestIndex + 1;
  }

  if (matchType === -1) {
    // Smallest value >= lookupVal, sorted descending
    let bestIndex = -1;
    for (let i = 0; i < list.length; i++) {
      const val = list[i];
      if (val === lookupVal) {
        bestIndex = i;
        break;
      }
      if (typeof val === "number" && typeof lookupVal === "number") {
        if (val >= lookupVal) {
          bestIndex = i;
        } else {
          break;
        }
      } else if (valuesEqual(val, lookupVal)) {
        bestIndex = i;
        break;
      }
    }
    if (bestIndex === -1) return "#N/A";
    return bestIndex + 1;
  }

  return "#VALUE!";
}
