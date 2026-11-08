import type { CellError, CellValue } from "./types.js";

export interface WorkbookOptions {
  maxFormulaLength?: number;
  maxExpressionDepth?: number;
  maxCellCount?: number;
  excel1900LeapBug?: boolean;
}

export interface SetCellResult {
  evaluated: string[];
}

export interface RecalculateResult {
  evaluatedCount: number;
  dirtyCount: number;
}

export interface IWorkbook {
  setCell(ref: string, content: CellValue): SetCellResult;
  getValue(ref: string): CellValue | CellError;
  getDependents(ref: string): string[];
  getCycle(ref: string): string[] | null;
  recalculate(dirtyCells?: string[]): RecalculateResult;
  registerFunction(name: string, fn: (...args: any[]) => CellValue): void;
  toJSON(): Record<string, CellValue>;
  loadJSON(data: Record<string, CellValue>): void;
}

export declare class Workbook implements IWorkbook {
  constructor(opts?: WorkbookOptions);
  setCell(ref: string, content: CellValue): SetCellResult;
  getValue(ref: string): CellValue | CellError;
  getDependents(ref: string): string[];
  getCycle(ref: string): string[] | null;
  recalculate(dirtyCells?: string[]): RecalculateResult;
  registerFunction(name: string, fn: (...args: any[]) => CellValue): void;
  toJSON(): Record<string, CellValue>;
  loadJSON(data: Record<string, CellValue>): void;
}
