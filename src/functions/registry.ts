import type { CellError, CellValue } from "../../interfaces/types.js";
import { fnDate, fnDay, fnMonth, fnNow, fnToday, fnYear } from "./date.js";
import { fnFv, fnNper, fnNpv, fnPmt, fnPv } from "./finance.js";
import { fnAnd, fnIf, fnIfError, fnNot, fnOr } from "./logic.js";
import { fnHLookup, fnIndex, fnMatch, fnVLookup } from "./lookup.js";
import { fnAbs, fnAverage, fnMax, fnMin, fnMod, fnPower, fnRound, fnSqrt, fnSum } from "./math.js";
import { fnConcat, fnLeft, fnLen, fnLower, fnMid, fnRight, fnTrim, fnUpper } from "./text.js";
import type {
  FunctionArgument,
  FunctionContext,
  FunctionImplementation,
  IFunctionRegistry,
} from "./types.js";

export class FunctionRegistry implements IFunctionRegistry {
  private readonly functions: Map<string, FunctionImplementation> = new Map();

  register(name: string, fn: FunctionImplementation): void {
    this.functions.set(name.toUpperCase(), fn);
  }

  get(name: string): FunctionImplementation | undefined {
    return this.functions.get(name.toUpperCase());
  }

  has(name: string): boolean {
    return this.functions.has(name.toUpperCase());
  }

  names(): string[] {
    return Array.from(this.functions.keys()).sort();
  }
}

/**
 * Creates and populates the default registry of spreadsheet functions.
 */
export function createDefaultFunctionRegistry(): IFunctionRegistry {
  const reg = new FunctionRegistry();

  // Math
  reg.register("SUM", fnSum);
  reg.register("AVERAGE", fnAverage);
  reg.register("MIN", fnMin);
  reg.register("MAX", fnMax);
  reg.register("ABS", fnAbs);
  reg.register("ROUND", fnRound);
  reg.register("SQRT", fnSqrt);
  reg.register("POWER", fnPower);
  reg.register("MOD", fnMod);

  // Logic
  reg.register("IF", fnIf);
  reg.register("IFERROR", fnIfError);
  reg.register("AND", fnAnd);
  reg.register("OR", fnOr);
  reg.register("NOT", fnNot);

  // Text
  reg.register("CONCAT", fnConcat);
  reg.register("CONCATENATE", fnConcat);
  reg.register("UPPER", fnUpper);
  reg.register("LOWER", fnLower);
  reg.register("LEN", fnLen);
  reg.register("TRIM", fnTrim);
  reg.register("LEFT", fnLeft);
  reg.register("RIGHT", fnRight);
  reg.register("MID", fnMid);

  // Lookup
  reg.register("VLOOKUP", fnVLookup);
  reg.register("HLOOKUP", fnHLookup);
  reg.register("INDEX", fnIndex);
  reg.register("MATCH", fnMatch);

  // Date
  reg.register("DATE", fnDate);
  reg.register("YEAR", fnYear);
  reg.register("MONTH", fnMonth);
  reg.register("DAY", fnDay);
  reg.register("NOW", fnNow);
  reg.register("TODAY", fnToday);

  // Finance
  reg.register("PMT", fnPmt);
  reg.register("PV", fnPv);
  reg.register("FV", fnFv);
  reg.register("NPER", fnNper);
  reg.register("NPV", fnNpv);

  return reg;
}

let defaultRegistryInstance: IFunctionRegistry | null = null;

/**
 * Evaluates a function by name with the given arguments and context.
 */
export function evaluateFunction(
  name: string,
  args: readonly FunctionArgument[],
  context: FunctionContext,
  registry?: IFunctionRegistry,
): CellValue | CellError {
  if (!defaultRegistryInstance) {
    defaultRegistryInstance = createDefaultFunctionRegistry();
  }
  const reg = registry ?? defaultRegistryInstance;
  const fn = reg.get(name);
  if (!fn) {
    return "#NAME?";
  }
  return fn(args, context);
}
