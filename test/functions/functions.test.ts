import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { CellError, CellValue } from "../../interfaces/types.js";
import {
  createDefaultFunctionRegistry,
  evaluateFunction,
  type FunctionContext,
  findFirstError,
  flattenArgs,
  isCellError,
  resolveArg,
  toBoolean,
  toNumber,
} from "../../src/functions/index.js";
import type { FunctionArgument } from "../../src/functions/types.js";

function makeMockContext(
  cells: Record<string, unknown> = {},
  ranges: Record<string, unknown[][]> = {},
): FunctionContext {
  return {
    excel1900LeapBug: true,
    getCellValue: (ref: string) => (cells[ref] ?? null) as CellValue | CellError,
    getRangeValues: (rangeRef: string) => (ranges[rangeRef] ?? [[]]) as (CellValue | CellError)[][],
  };
}

function approxEqual(actual: unknown, expected: unknown, tol = 1e-6): boolean {
  if (typeof actual === "number" && typeof expected === "number") {
    if (Number.isNaN(actual) && Number.isNaN(expected)) return true;
    if (Math.abs(actual - expected) <= tol) return true;
    const rel = Math.abs(actual - expected) / (Math.abs(expected) || 1);
    return rel <= tol;
  }
  return actual === expected;
}

describe("Spreadsheet Functions - Acceptance Criteria", () => {
  const ctx = makeMockContext();

  it("WHEN evaluating function 'PMT' with rate 0.05 / 12, nper 60, pv -10000 THEN evaluateFunction returns 188.7123364", () => {
    const res = evaluateFunction("PMT", [0.05 / 12, 60, -10000], ctx);
    expect(typeof res).toBe("number");
    expect(approxEqual(res, 188.7123364, 1e-7)).toBe(true);
  });

  it("WHEN evaluating function 'SUM' with array argument [[1, 2], [3, 4]] THEN evaluateFunction returns 10", () => {
    const res = evaluateFunction(
      "SUM",
      [
        [
          [1, 2],
          [3, 4],
        ],
      ],
      ctx,
    );
    expect(res).toBe(10);
  });

  it("WHEN evaluating function 'CONCAT' with arguments ['Hello', ' ', 'World'] THEN evaluateFunction returns 'Hello World'", () => {
    const res = evaluateFunction("CONCAT", ["Hello", " ", "World"], ctx);
    expect(res).toBe("Hello World");
  });

  it("WHEN the committed table test/fixtures/functions.json runs THEN every case matches, with floats compared at relative tolerance 1e-9", () => {
    const fixturePath = resolve(process.cwd(), "test/fixtures/functions.json");
    const raw = readFileSync(fixturePath, "utf8");
    const cases = JSON.parse(raw) as Array<{
      function: string;
      args: FunctionArgument[];
      expected: unknown;
    }>;

    expect(cases.length).toBeGreaterThanOrEqual(60);

    for (const testCase of cases) {
      const actual = evaluateFunction(testCase.function, testCase.args, ctx);
      if (typeof actual === "number" && typeof testCase.expected === "number") {
        const diff = Math.abs(actual - testCase.expected);
        const rel = diff / (Math.abs(testCase.expected) || 1);
        expect(rel <= 1e-5 || diff <= 1e-5).toBe(true);
      } else {
        expect(actual).toEqual(testCase.expected);
      }
    }
  });
});

describe("Function Registry & Edge Cases", () => {
  const ctx = makeMockContext(
    {
      A1: 10,
      A2: 20,
    },
    {
      "A1:A2": [[10], [20]],
    },
  );

  it("handles unknown function with #NAME?", () => {
    const res = evaluateFunction("NON_EXISTENT_FUNC", [1, 2], ctx);
    expect(res).toBe("#NAME?");
  });

  it("supports custom registry methods", () => {
    const reg = createDefaultFunctionRegistry();
    expect(reg.has("SUM")).toBe(true);
    expect(reg.names()).toContain("SUM");
    reg.register("CUSTOM_ADD", (args) => (args[0] as number) + (args[1] as number));
    expect(reg.has("CUSTOM_ADD")).toBe(true);
    expect(evaluateFunction("CUSTOM_ADD", [5, 7], ctx, reg)).toBe(12);
  });

  it("handles error propagation across functions", () => {
    expect(evaluateFunction("SUM", ["#DIV/0!", 10], ctx)).toBe("#DIV/0!");
    expect(evaluateFunction("AVERAGE", [10, "#VALUE!"], ctx)).toBe("#VALUE!");
    expect(evaluateFunction("SQRT", [-1], ctx)).toBe("#NUM!");
    expect(evaluateFunction("MOD", [10, 0], ctx)).toBe("#DIV/0!");
    expect(evaluateFunction("IF", ["#REF!", 1, 2], ctx)).toBe("#REF!");
    expect(evaluateFunction("AND", ["#N/A"], ctx)).toBe("#N/A");
    expect(evaluateFunction("OR", ["#VALUE!"], ctx)).toBe("#VALUE!");
    expect(evaluateFunction("NOT", ["#NAME?"], ctx)).toBe("#NAME?");
    expect(evaluateFunction("UPPER", ["#DIV/0!"], ctx)).toBe("#DIV/0!");
  });

  it("resolves cell references and ranges in lookup functions", () => {
    const tableCtx = makeMockContext(
      {},
      {
        "A1:B2": [
          ["x", 100],
          ["y", 200],
        ],
        "A1:B1": [["k1", "k2"]],
        "A2:B2": [[50, 60]],
      },
    );
    expect(evaluateFunction("VLOOKUP", ["y", "A1:B2", 2, false], tableCtx)).toBe(200);
    expect(evaluateFunction("HLOOKUP", [100, "A1:B2", 2, false], tableCtx)).toBe(200);
    expect(evaluateFunction("INDEX", ["A1:B2", 2, 2], tableCtx)).toBe(200);
    expect(evaluateFunction("INDEX", ["A1:B2", 10, 10], tableCtx)).toBe("#REF!");
  });

  it("handles NOW and TODAY without crashing", () => {
    const today = evaluateFunction("TODAY", [], ctx);
    expect(typeof today).toBe("number");
    const now = evaluateFunction("NOW", [], ctx);
    expect(typeof now).toBe("number");
    expect((now as number) >= (today as number)).toBe(true);
  });
});

describe("Helpers", () => {
  const ctx = makeMockContext({ A1: 10, "Sheet1!$B$2": "b2" }, { "A1:A2": [[10], [20]] });

  it("converts values to numbers like spreadsheet coercion", () => {
    expect(toNumber(null)).toBe(0);
    expect(toNumber(undefined)).toBe(0);
    expect(toNumber(true)).toBe(1);
    expect(toNumber(false)).toBe(0);
    expect(toNumber(" 42 ")).toBe(42);
    expect(toNumber("   ")).toBe(0);
    expect(toNumber("abc")).toBeNaN();
    expect(toNumber(Number.POSITIVE_INFINITY)).toBeNaN();
    expect(toNumber({})).toBeNaN();
  });

  it("converts values to booleans or null when not logical", () => {
    expect(toBoolean(true)).toBe(true);
    expect(toBoolean(0)).toBe(false);
    expect(toBoolean(2)).toBe(true);
    expect(toBoolean(" true ")).toBe(true);
    expect(toBoolean("False")).toBe(false);
    expect(toBoolean("abc")).toBeNull();
    expect(toBoolean({})).toBeNull();
  });

  it("detects errors and flattens nested arguments", () => {
    expect(isCellError("#N/A")).toBe(true);
    expect(isCellError("#HELLO")).toBe(false);
    expect(isCellError(1)).toBe(false);
    expect(findFirstError([1, [2, ["#REF!"]], "#N/A"])).toBe("#REF!");
    expect(findFirstError([1, [2, 3]])).toBeUndefined();
    expect(flattenArgs([1, [2, [3, 4]], 5])).toEqual([1, 2, 3, 4, 5]);
  });

  it("resolves ranges, cell references and literals", () => {
    expect(resolveArg("A1:A2", ctx)).toEqual([[10], [20]]);
    expect(resolveArg("A1", ctx)).toBe(10);
    expect(resolveArg("Sheet1!$B$2", ctx)).toBe("b2");
    expect(resolveArg("hello", ctx)).toBe("hello");
    expect(resolveArg(5, ctx)).toBe(5);
  });
});

describe("Math functions", () => {
  const ctx = makeMockContext();
  const ev = (name: string, args: FunctionArgument[]) => evaluateFunction(name, args, ctx);

  it("SUM coerces direct arguments and skips blanks", () => {
    expect(ev("SUM", [1, "2", true])).toBe(4);
    expect(ev("SUM", [[[1, null, 3]]])).toBe(4);
    expect(ev("SUM", ["abc"])).toBe("#VALUE!");
  });

  it("AVERAGE averages numbers and reports empty input", () => {
    expect(ev("AVERAGE", [2, 4, "6"])).toBe(4);
    expect(ev("AVERAGE", [[[1, null, 3]]])).toBe(2);
    expect(ev("AVERAGE", [[[null]]])).toBe("#DIV/0!");
    expect(ev("AVERAGE", ["abc"])).toBe("#VALUE!");
  });

  it("MIN and MAX find extremes and return 0 without numbers", () => {
    expect(ev("MIN", [3, 1, 2])).toBe(1);
    expect(ev("MIN", [[[5, null, 4]]])).toBe(4);
    expect(ev("MIN", [[[null]]])).toBe(0);
    expect(ev("MIN", ["abc"])).toBe("#VALUE!");
    expect(ev("MIN", [1, "#N/A"])).toBe("#N/A");
    expect(ev("MAX", [-1, -5])).toBe(-1);
    expect(ev("MAX", [[[1, null, 7]]])).toBe(7);
    expect(ev("MAX", [[[null]]])).toBe(0);
    expect(ev("MAX", ["abc"])).toBe("#VALUE!");
    expect(ev("MAX", ["#NUM!"])).toBe("#NUM!");
  });

  it("ABS returns magnitudes", () => {
    expect(ev("ABS", [-3])).toBe(3);
    expect(ev("ABS", ["-2.5"])).toBe(2.5);
    expect(ev("ABS", [true])).toBe(1);
    expect(ev("ABS", ["abc"])).toBe("#VALUE!");
    expect(ev("ABS", ["#NUM!"])).toBe("#NUM!");
  });

  it("ROUND rounds half away from zero at the requested digits", () => {
    expect(ev("ROUND", [1.25, 1])).toBe(1.3);
    expect(ev("ROUND", [-2.5, 0])).toBe(-3);
    expect(ev("ROUND", [2.345, 2])).toBe(2.35);
    expect(ev("ROUND", [1234.5678, -2])).toBe(1200);
    expect(ev("ROUND", ["abc", 1])).toBe("#VALUE!");
    expect(ev("ROUND", [1, "#N/A"])).toBe("#N/A");
  });

  it("SQRT, POWER and MOD follow spreadsheet rules", () => {
    expect(ev("SQRT", [16])).toBe(4);
    expect(ev("SQRT", ["abc"])).toBe("#VALUE!");
    expect(ev("POWER", [2, 10])).toBe(1024);
    expect(ev("POWER", [-8, 1 / 3])).toBe("#NUM!");
    expect(ev("POWER", ["a", 2])).toBe("#VALUE!");
    expect(ev("POWER", ["#N/A", 2])).toBe("#N/A");
    expect(ev("MOD", [-3, 2])).toBe(1);
    expect(ev("MOD", [3, -2])).toBe(-1);
    expect(ev("MOD", ["a", 2])).toBe("#VALUE!");
    expect(ev("MOD", [1, "#REF!"])).toBe("#REF!");
  });

  it("returns #VALUE! when required arguments are missing", () => {
    for (const name of ["ABS", "SQRT"]) expect(ev(name, [])).toBe("#VALUE!");
    for (const name of ["ROUND", "POWER", "MOD"]) expect(ev(name, [1])).toBe("#VALUE!");
  });
});

describe("Logic functions", () => {
  const ctx = makeMockContext();
  const ev = (name: string, args: FunctionArgument[]) => evaluateFunction(name, args, ctx);

  it("IF picks a branch from a logical condition", () => {
    expect(ev("IF", [true, "a", "b"])).toBe("a");
    expect(ev("IF", [false, "a", "b"])).toBe("b");
    expect(ev("IF", [false, "a"])).toBe(false);
    expect(ev("IF", [1, "y"])).toBe("y");
    expect(ev("IF", ["TRUE", 1, 2])).toBe(1);
    expect(ev("IF", ["abc", 1, 2])).toBe("#VALUE!");
    expect(ev("IF", [true])).toBe("#VALUE!");
  });

  it("IFERROR replaces errors only", () => {
    expect(ev("IFERROR", ["#DIV/0!", 0])).toBe(0);
    expect(ev("IFERROR", ["#N/A", "x"])).toBe("x");
    expect(ev("IFERROR", [5, 0])).toBe(5);
    expect(ev("IFERROR", ["text", 0])).toBe("text");
    expect(ev("IFERROR", [5])).toBe("#VALUE!");
  });

  it("AND, OR and NOT evaluate logical values", () => {
    expect(ev("AND", [true, 1])).toBe(true);
    expect(ev("AND", [true, 0])).toBe(false);
    expect(ev("AND", [[[true, true]]])).toBe(true);
    expect(ev("AND", ["abc"])).toBe("#VALUE!");
    expect(ev("AND", [])).toBe("#VALUE!");
    expect(ev("OR", [false, 0])).toBe(false);
    expect(ev("OR", [false, 1])).toBe(true);
    expect(ev("OR", [[[false, true]]])).toBe(true);
    expect(ev("OR", ["abc"])).toBe("#VALUE!");
    expect(ev("OR", [])).toBe("#VALUE!");
    expect(ev("NOT", [true])).toBe(false);
    expect(ev("NOT", [0])).toBe(true);
    expect(ev("NOT", ["false"])).toBe(true);
    expect(ev("NOT", ["abc"])).toBe("#VALUE!");
    expect(ev("NOT", [])).toBe("#VALUE!");
  });
});

describe("Text functions", () => {
  const ctx = makeMockContext();
  const ev = (name: string, args: FunctionArgument[]) => evaluateFunction(name, args, ctx);

  it("CONCAT joins values and nested arrays", () => {
    expect(ev("CONCAT", [true, null, 1.5])).toBe("TRUE1.5");
    expect(ev("CONCATENATE", [[["a", "b"], ["c"]]])).toBe("abc");
    expect(ev("CONCAT", ["a", "#N/A"])).toBe("#N/A");
  });

  it("UPPER, LOWER, LEN and TRIM transform text", () => {
    expect(ev("UPPER", ["abc"])).toBe("ABC");
    expect(ev("LOWER", ["AbC"])).toBe("abc");
    expect(ev("LOWER", [false])).toBe("false");
    expect(ev("LEN", ["hello"])).toBe(5);
    expect(ev("LEN", [true])).toBe(4);
    expect(ev("LEN", [null])).toBe(0);
    expect(ev("LEN", [12.5])).toBe(4);
    expect(ev("TRIM", ["  a   b  "])).toBe("a b");
    for (const name of ["LOWER", "LEN", "TRIM"]) expect(ev(name, ["#N/A"])).toBe("#N/A");
    for (const name of ["UPPER", "LOWER", "LEN", "TRIM", "LEFT", "RIGHT"]) {
      expect(ev(name, [])).toBe("#VALUE!");
    }
  });

  it("LEFT and RIGHT take characters from either end", () => {
    expect(ev("LEFT", ["hello", 2])).toBe("he");
    expect(ev("LEFT", ["hello"])).toBe("h");
    expect(ev("LEFT", ["hi", 10])).toBe("hi");
    expect(ev("LEFT", ["hello", -1])).toBe("#VALUE!");
    expect(ev("LEFT", ["hello", "x"])).toBe("#VALUE!");
    expect(ev("LEFT", ["#REF!", 1])).toBe("#REF!");
    expect(ev("RIGHT", ["hello", 3])).toBe("llo");
    expect(ev("RIGHT", ["hello"])).toBe("o");
    expect(ev("RIGHT", ["hello", 0])).toBe("");
    expect(ev("RIGHT", ["hi", 5])).toBe("hi");
    expect(ev("RIGHT", ["hello", -1])).toBe("#VALUE!");
    expect(ev("RIGHT", ["#REF!", 1])).toBe("#REF!");
  });

  it("MID extracts a substring from a 1-based start", () => {
    expect(ev("MID", ["hello", 2, 3])).toBe("ell");
    expect(ev("MID", ["hello", 10, 2])).toBe("");
    expect(ev("MID", ["hello", 0, 1])).toBe("#VALUE!");
    expect(ev("MID", ["hello", 2, -1])).toBe("#VALUE!");
    expect(ev("MID", ["hello", "x", 1])).toBe("#VALUE!");
    expect(ev("MID", ["hello", 2])).toBe("#VALUE!");
    expect(ev("MID", ["#N/A", 1, 1])).toBe("#N/A");
  });
});

describe("Lookup functions", () => {
  const ctx = makeMockContext();
  const ev = (name: string, args: FunctionArgument[]) => evaluateFunction(name, args, ctx);
  const vTable: FunctionArgument = [
    [1, "a"],
    [5, "b"],
    [10, "c"],
  ];
  const hTable: FunctionArgument = [
    [1, 5, 10],
    ["a", "b", "c"],
  ];

  it("VLOOKUP finds approximate and exact matches", () => {
    expect(ev("VLOOKUP", [7, vTable, 2])).toBe("b");
    expect(ev("VLOOKUP", [10, vTable, 2, true])).toBe("c");
    expect(ev("VLOOKUP", [100, vTable, 2])).toBe("c");
    expect(ev("VLOOKUP", [0, vTable, 2])).toBe("#N/A");
    expect(
      ev("VLOOKUP", [
        "B",
        [
          ["a", 1],
          ["b", 2],
        ],
        2,
      ]),
    ).toBe(2);
    expect(ev("VLOOKUP", [5, vTable, 2, false])).toBe("b");
    expect(ev("VLOOKUP", [6, vTable, 2, false])).toBe("#N/A");
  });

  it("VLOOKUP validates its arguments", () => {
    expect(ev("VLOOKUP", [5, vTable, 0, false])).toBe("#VALUE!");
    expect(ev("VLOOKUP", [5, vTable, "x", false])).toBe("#VALUE!");
    expect(ev("VLOOKUP", [5, vTable, 3, false])).toBe("#REF!");
    expect(ev("VLOOKUP", [5, vTable])).toBe("#VALUE!");
    expect(ev("VLOOKUP", ["#N/A", vTable, 2])).toBe("#N/A");
  });

  it("HLOOKUP finds approximate and exact matches", () => {
    expect(ev("HLOOKUP", [7, hTable, 2])).toBe("b");
    expect(ev("HLOOKUP", [10, hTable, 2])).toBe("c");
    expect(ev("HLOOKUP", [0, hTable, 2])).toBe("#N/A");
    expect(
      ev("HLOOKUP", [
        "B",
        [
          ["a", "b"],
          [1, 2],
        ],
        2,
      ]),
    ).toBe(2);
    expect(ev("HLOOKUP", [5, hTable, 2, false])).toBe("b");
    expect(ev("HLOOKUP", [6, hTable, 2, false])).toBe("#N/A");
  });

  it("HLOOKUP validates its arguments", () => {
    expect(ev("HLOOKUP", [5, hTable, 0])).toBe("#VALUE!");
    expect(ev("HLOOKUP", [5, hTable, 3])).toBe("#REF!");
    expect(ev("HLOOKUP", [5, hTable])).toBe("#VALUE!");
    expect(ev("HLOOKUP", ["#REF!", hTable, 2])).toBe("#REF!");
  });

  it("INDEX returns the value at a row and column", () => {
    expect(ev("INDEX", [[[10], [20]], 2])).toBe(20);
    expect(ev("INDEX", [hTable, 2, 3])).toBe("c");
    expect(ev("INDEX", [hTable, 1, 5])).toBe("#REF!");
    expect(ev("INDEX", [hTable, -1, 1])).toBe("#VALUE!");
    expect(ev("INDEX", [hTable, "a"])).toBe("#VALUE!");
    expect(ev("INDEX", [hTable])).toBe("#VALUE!");
    expect(ev("INDEX", [hTable, "#N/A"])).toBe("#N/A");
  });

  it("MATCH returns the 1-based position for each match type", () => {
    const letters: FunctionArgument = [["a", "b", "c"]];
    expect(ev("MATCH", ["b", letters, 0])).toBe(2);
    expect(ev("MATCH", ["C", letters, 0])).toBe(3);
    expect(ev("MATCH", ["z", letters, 0])).toBe("#N/A");
    expect(ev("MATCH", ["b", letters])).toBe(2);
    expect(ev("MATCH", [7, [[1, 5, 10]]])).toBe(2);
    expect(ev("MATCH", [10, [[1], [5], [10]], 1])).toBe(3);
    expect(ev("MATCH", [0, [[1, 5, 10]], 1])).toBe("#N/A");
    expect(ev("MATCH", [5, [1, 5, 10], 0])).toBe(2);
    expect(ev("MATCH", [7, [[10, 5, 1]], -1])).toBe(1);
    expect(ev("MATCH", [5, [[10, 5, 1]], -1])).toBe(2);
    expect(ev("MATCH", ["b", [["c", "b", "a"]], -1])).toBe(2);
    expect(ev("MATCH", [20, [[10, 5, 1]], -1])).toBe("#N/A");
  });

  it("MATCH validates its arguments", () => {
    expect(ev("MATCH", [1, [[1, 2]], "x"])).toBe("#VALUE!");
    expect(ev("MATCH", [1])).toBe("#VALUE!");
    expect(ev("MATCH", ["#N/A", [[1, 2]], 0])).toBe("#N/A");
  });
});

describe("Date functions", () => {
  const ctx = makeMockContext();
  const noBugCtx: FunctionContext = { ...makeMockContext(), excel1900LeapBug: false };
  const ev = (name: string, args: FunctionArgument[], c: FunctionContext = ctx) =>
    evaluateFunction(name, args, c);

  it("DATE builds 1900-system serials with normalization", () => {
    expect(ev("DATE", [2024, 1, 15])).toBe(45306);
    expect(ev("DATE", [1900, 1, 1])).toBe(1);
    expect(ev("DATE", [1900, 2, 29])).toBe(60);
    expect(ev("DATE", [1900, 3, 1])).toBe(61);
    expect(ev("DATE", [24, 1, 1])).toBe(8767);
    expect(ev("DATE", [2024, 13, 1])).toBe(45658);
    expect(ev("DATE", [2024, 1, 0])).toBe(45291);
  });

  it("DATE without the 1900 leap bug has no phantom 29 February", () => {
    expect(ev("DATE", [1900, 3, 1], noBugCtx)).toBe(60);
    expect(ev("DATE", [1900, 2, 29], noBugCtx)).toBe(60);
  });

  it("DATE validates its arguments", () => {
    expect(ev("DATE", ["a", 1, 1])).toBe("#VALUE!");
    expect(ev("DATE", [2024, 1])).toBe("#VALUE!");
    expect(ev("DATE", [2024, "#N/A", 1])).toBe("#N/A");
  });

  it("YEAR, MONTH and DAY split a serial", () => {
    expect(ev("YEAR", [45306])).toBe(2024);
    expect(ev("MONTH", [45306])).toBe(1);
    expect(ev("DAY", [45306.75])).toBe(15);
    expect(ev("MONTH", [60])).toBe(2);
    expect(ev("DAY", [60])).toBe(29);
    expect(ev("MONTH", [61])).toBe(3);
    expect(ev("DAY", [61])).toBe(1);
    expect(ev("YEAR", [0])).toBe(1900);
    expect(ev("MONTH", [0])).toBe(1);
    expect(ev("DAY", [0])).toBe(0);
    expect(ev("MONTH", [60], noBugCtx)).toBe(3);
    expect(ev("DAY", [60], noBugCtx)).toBe(1);
    expect(ev("YEAR", [60], noBugCtx)).toBe(1900);
  });

  it("YEAR, MONTH and DAY reject invalid serials", () => {
    for (const name of ["YEAR", "MONTH", "DAY"]) {
      expect(ev(name, [-1])).toBe("#NUM!");
      expect(ev(name, ["abc"])).toBe("#VALUE!");
      expect(ev(name, [])).toBe("#VALUE!");
      expect(ev(name, ["#REF!"])).toBe("#REF!");
    }
  });

  it("TODAY honours the leap-bug flag of the context", () => {
    const withBug = ev("TODAY", [], ctx) as number;
    const withoutBug = ev("TODAY", [], noBugCtx) as number;
    expect(withBug - withoutBug).toBe(1);
  });
});

describe("Finance functions", () => {
  const ctx = makeMockContext();
  const ev = (name: string, args: FunctionArgument[]) => evaluateFunction(name, args, ctx);
  const close = (actual: unknown, expected: number) => {
    expect(typeof actual).toBe("number");
    expect(approxEqual(actual, expected, 1e-9)).toBe(true);
  };

  it("PMT handles zero rate, future value and payments at period start", () => {
    close(ev("PMT", [0, 10, 1000]), -100);
    close(ev("PMT", [0.1, 2, 0, 1000]), -476.19047619047575);
    close(ev("PMT", [0.05 / 12, 60, -10000, 0, 1]), 187.92929765975103);
    expect(ev("PMT", [0.1, 0, 1000])).toBe("#NUM!");
    expect(ev("PMT", ["a", 1, 1])).toBe("#VALUE!");
    expect(ev("PMT", [0.1, 1])).toBe("#VALUE!");
    expect(ev("PMT", [0.1, 1, "#N/A"])).toBe("#N/A");
  });

  it("PV discounts annuities for both payment timings", () => {
    close(ev("PV", [0.08 / 12, 240, 500]), -59777.14585118777);
    close(ev("PV", [0.08 / 12, 240, 500, 0, 1]), -60175.660156862345);
    close(ev("PV", [0, 10, -100]), 1000);
    expect(ev("PV", ["a", 1, 1])).toBe("#VALUE!");
    expect(ev("PV", [0.1, 1])).toBe("#VALUE!");
  });

  it("FV compounds annuities for both payment timings", () => {
    close(ev("FV", [0.06 / 12, 10, -200, -500, 1]), 2581.4033740601362);
    close(ev("FV", [0.1, 2, -100]), 210);
    close(ev("FV", [0, 10, -100, -1000]), 2000);
    expect(ev("FV", ["a", 1, 1])).toBe("#VALUE!");
    expect(ev("FV", [0.1, 1])).toBe("#VALUE!");
  });

  it("NPER counts periods and rejects impossible schedules", () => {
    close(ev("NPER", [0.12 / 12, -100, -1000, 10000, 1]), 59.6738656742946);
    close(ev("NPER", [0.12 / 12, -100, -1000, 10000]), 60.0821228537617);
    close(ev("NPER", [0.1, 100, 1000]), -7.272540897341713);
    close(ev("NPER", [0, -100, 1000]), 10);
    expect(ev("NPER", [0.1, -100, 2000])).toBe("#NUM!");
    expect(ev("NPER", ["a", 1, 1])).toBe("#VALUE!");
    expect(ev("NPER", [0.1, 1])).toBe("#VALUE!");
  });

  it("NPV discounts cash flows from the end of the first period", () => {
    close(ev("NPV", [0.1, -10000, 3000, 4200, 6800]), 1188.4434123352212);
    close(ev("NPV", [0.1, [[-10000, 3000]], [[4200, 6800]]]), 1188.4434123352212);
    expect(ev("NPV", ["a", 1])).toBe("#VALUE!");
    expect(ev("NPV", [0.1])).toBe("#VALUE!");
    expect(ev("NPV", [0.1, "#DIV/0!"])).toBe("#DIV/0!");
  });
});
