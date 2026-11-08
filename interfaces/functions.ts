import type { CellError, CellValue } from "./types";

export interface FunctionContext {
  readonly excel1900LeapBug?: boolean;
  getCellValue(ref: string): CellValue | CellError;
  getRangeValues(rangeRef: string): (CellValue | CellError)[][];
}

export type FunctionImplementation = (
  args: any[],
  context: FunctionContext,
) => CellValue | CellError;

export interface IFunctionRegistry {
  register(name: string, fn: FunctionImplementation): void;
  get(name: string): FunctionImplementation | undefined;
  has(name: string): boolean;
  names(): string[];
}

export declare function createDefaultFunctionRegistry(): IFunctionRegistry;
export declare function evaluateFunction(
  name: string,
  args: any[],
  context: FunctionContext,
  registry?: IFunctionRegistry,
): CellValue | CellError;
