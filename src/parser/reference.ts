import { type CellCoord, type CellRange, FormulaError } from "./types.js";

/**
 * Truncates an input string to at most maxLen characters for safe error messages.
 */
export function truncateInput(input: string, maxLen = 200): string {
  if (input.length <= maxLen) {
    return input;
  }
  return `${input.slice(0, maxLen)}...`;
}

/**
 * Converts 1-based column number to A1 column letters (e.g. 1 -> A, 27 -> AA).
 */
export function indexToColName(index: number): string {
  if (!Number.isInteger(index) || index < 1) {
    throw new FormulaError("SYNTAX_ERROR", `Invalid column index: ${index}`);
  }
  let name = "";
  let n = index;
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

/**
 * Converts A1 column letters to 1-based column number (e.g. A -> 1, AA -> 27).
 */
export function colNameToIndex(colStr: string): number {
  const upper = colStr.toUpperCase();
  let col = 0;
  for (let i = 0; i < upper.length; i++) {
    const charCode = upper.charCodeAt(i);
    if (charCode < 65 || charCode > 90) {
      throw new FormulaError("SYNTAX_ERROR", `Invalid column letter: ${upper.charAt(i)}`);
    }
    col = col * 26 + (charCode - 64);
  }
  return col;
}

/**
 * Parses a single cell reference string (e.g. '$C$10', 'Sheet1!A1') into a CellCoord.
 */
export function parseCellReference(ref: string): CellCoord {
  if (!ref || typeof ref !== "string") {
    throw new FormulaError("SYNTAX_ERROR", "Cell reference cannot be empty");
  }
  const trimmed = ref.trim();
  if (trimmed.length === 0) {
    throw new FormulaError("SYNTAX_ERROR", "Cell reference cannot be empty");
  }

  let sheet: string | undefined;
  let cellPart = trimmed;

  if (trimmed.startsWith("'")) {
    let i = 1;
    let sheetName = "";
    let found = false;
    while (i < trimmed.length) {
      const char = trimmed[i];
      if (char === "'") {
        if (i + 1 < trimmed.length && trimmed[i + 1] === "'") {
          sheetName += "'";
          i += 2;
        } else if (i + 1 < trimmed.length && trimmed[i + 1] === "!") {
          sheet = sheetName;
          cellPart = trimmed.slice(i + 2);
          found = true;
          break;
        } else {
          throw new FormulaError(
            "SYNTAX_ERROR",
            `Invalid quoted sheet name: ${truncateInput(trimmed)}`,
          );
        }
      } else if (char !== undefined) {
        sheetName += char;
        i++;
      }
    }
    if (!found) {
      throw new FormulaError(
        "SYNTAX_ERROR",
        `Unterminated quoted sheet name: ${truncateInput(trimmed)}`,
      );
    }
  } else {
    const bangIndex = trimmed.indexOf("!");
    if (bangIndex !== -1) {
      sheet = trimmed.slice(0, bangIndex);
      if (sheet.length === 0) {
        throw new FormulaError(
          "SYNTAX_ERROR",
          `Empty sheet name in cell reference: ${truncateInput(trimmed)}`,
        );
      }
      cellPart = trimmed.slice(bangIndex + 1);
    }
  }

  const match = /^(\$?)([A-Za-z]+)(\$?)([1-9][0-9]*)$/.exec(cellPart);
  if (!match) {
    throw new FormulaError(
      "SYNTAX_ERROR",
      `Invalid cell reference format: ${truncateInput(trimmed)}`,
    );
  }

  const colStr = match[2];
  const rowStr = match[4];
  if (colStr === undefined || rowStr === undefined) {
    throw new FormulaError(
      "SYNTAX_ERROR",
      `Invalid cell reference format: ${truncateInput(trimmed)}`,
    );
  }

  const colAbsolute = match[1] === "$";
  const col = colNameToIndex(colStr);
  const rowAbsolute = match[3] === "$";
  const row = parseInt(rowStr, 10);

  return {
    ...(sheet !== undefined ? { sheet } : {}),
    row,
    col,
    rowAbsolute,
    colAbsolute,
  };
}

/**
 * Parses a cell range string (e.g. 'Sheet1!$A$1:$B$2') into a CellRange.
 */
export function parseRangeReference(rangeRef: string): CellRange {
  if (!rangeRef || typeof rangeRef !== "string") {
    throw new FormulaError("SYNTAX_ERROR", "Range reference cannot be empty");
  }
  const trimmed = rangeRef.trim();

  let inQuote = false;
  let colonIndex = -1;
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (ch === "'") {
      if (inQuote && i + 1 < trimmed.length && trimmed[i + 1] === "'") {
        i++;
      } else {
        inQuote = !inQuote;
      }
    } else if (ch === ":" && !inQuote) {
      if (colonIndex !== -1) {
        throw new FormulaError(
          "SYNTAX_ERROR",
          `Multiple colons in range reference: ${truncateInput(trimmed)}`,
        );
      }
      colonIndex = i;
    }
  }

  if (colonIndex === -1) {
    throw new FormulaError(
      "SYNTAX_ERROR",
      `Range reference missing colon: ${truncateInput(trimmed)}`,
    );
  }

  const part1 = trimmed.slice(0, colonIndex).trim();
  const part2 = trimmed.slice(colonIndex + 1).trim();

  const startCoord = parseCellReference(part1);
  let endCoord: CellCoord;

  if (startCoord.sheet !== undefined && !part2.includes("!")) {
    const parsedEnd = parseCellReference(part2);
    endCoord = {
      ...parsedEnd,
      sheet: startCoord.sheet,
    };
  } else {
    endCoord = parseCellReference(part2);
  }

  const sheet = startCoord.sheet ?? endCoord.sheet;

  return {
    ...(sheet !== undefined ? { sheet } : {}),
    start: startCoord,
    end: endCoord,
  };
}

/**
 * Formats a CellCoord back to an A1 string (e.g. '$C$10' or 'Sheet1!$A$1').
 */
export function formatCellReference(coord: CellCoord): string {
  if (!coord || typeof coord.row !== "number" || typeof coord.col !== "number") {
    throw new FormulaError("SYNTAX_ERROR", "Invalid coordinate: row and col must be numbers");
  }
  if (!Number.isInteger(coord.row) || coord.row < 1) {
    throw new FormulaError("SYNTAX_ERROR", `Invalid row coordinate: ${coord.row}`);
  }
  if (!Number.isInteger(coord.col) || coord.col < 1) {
    throw new FormulaError("SYNTAX_ERROR", `Invalid col coordinate: ${coord.col}`);
  }

  let sheetPrefix = "";
  if (coord.sheet !== undefined && coord.sheet.length > 0) {
    const needsQuotes = /[^A-Za-z0-9_]/.test(coord.sheet) || /^[0-9]/.test(coord.sheet);
    if (needsQuotes) {
      sheetPrefix = `'${coord.sheet.replace(/'/g, "''")}'!`;
    } else {
      sheetPrefix = `${coord.sheet}!`;
    }
  }

  const colPrefix = coord.colAbsolute ? "$" : "";
  const rowPrefix = coord.rowAbsolute ? "$" : "";
  const colLetters = indexToColName(coord.col);

  return `${sheetPrefix}${colPrefix}${colLetters}${rowPrefix}${coord.row}`;
}
