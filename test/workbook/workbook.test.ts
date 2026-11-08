import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { FormulaError } from "../../src/parser/types.js";
import { Workbook } from "../../src/workbook/index.js";

describe("Workbook acceptance tests", () => {
  it("WHEN a cell is set with '=SUM(B1:B3)' and cells 'B1', 'B2', 'B3' contain 10, 20, 30 THEN wb.getValue('A1') returns 60", () => {
    const wb = new Workbook();
    wb.setCell("B1", 10);
    wb.setCell("B2", 20);
    wb.setCell("B3", 30);
    wb.setCell("A1", "=SUM(B1:B3)");
    expect(wb.getValue("A1")).toBe(60);
  });

  it("WHEN a circular dependency is created with 'A1' set to '=B1+1' and 'B1' set to '=A1+1' THEN wb.getValue('A1') returns '#CIRC!' and wb.getCycle('A1') returns ['A1', 'B1']", () => {
    const wb = new Workbook();
    wb.setCell("A1", "=B1+1");
    wb.setCell("B1", "=A1+1");
    expect(wb.getValue("A1")).toBe("#CIRC!");
    const cycle = wb.getCycle("A1");
    expect(cycle).not.toBeNull();
    expect(cycle?.sort()).toEqual(["A1", "B1"].sort());
  });

  it("WHEN 'B1' changes from 10 to 40 in a workbook where 'A1' is '=B1*2' and 'C1' is '=5+5' THEN wb.setCell('B1', 40) returns { evaluated: ['A1'] } and wb.getValue('A1') returns 80", () => {
    const wb = new Workbook();
    wb.setCell("B1", 10);
    wb.setCell("A1", "=B1*2");
    wb.setCell("C1", "=5+5");
    const res = wb.setCell("B1", 40);
    expect(res).toEqual({ evaluated: ["A1"] });
    expect(wb.getValue("A1")).toBe(80);
  });

  it("WHEN evaluating formula '=IFERROR(1/0, 99)' THEN wb.getValue('A1') returns 99", () => {
    const wb = new Workbook();
    wb.setCell("A1", "=IFERROR(1/0, 99)");
    expect(wb.getValue("A1")).toBe(99);
  });

  it("WHEN evaluating '=DATE(1900, 2, 29)' with excel1900LeapBug enabled THEN wb.getValue('A1') returns serial number 60", () => {
    const wb = new Workbook({ excel1900LeapBug: true });
    wb.setCell("A1", "=DATE(1900, 2, 29)");
    expect(wb.getValue("A1")).toBe(60);
  });

  it("WHEN evaluating formula '=INDEX(A1:B2, 2, 1)' where range 'A1:B2' contains [[1, 2], [3, 4]] THEN wb.getValue('C1') returns 3", () => {
    const wb = new Workbook();
    wb.setCell("A1", 1);
    wb.setCell("B1", 2);
    wb.setCell("A2", 3);
    wb.setCell("B2", 4);
    wb.setCell("C1", "=INDEX(A1:B2, 2, 1)");
    expect(wb.getValue("C1")).toBe(3);
  });

  it("WHEN registering custom function 'DOUBLE' as (x: number) => x * 2 THEN evaluating '=DOUBLE(21)' returns 42", () => {
    const wb = new Workbook();
    wb.registerFunction("DOUBLE", (x: number) => x * 2);
    wb.setCell("A1", "=DOUBLE(21)");
    expect(wb.getValue("A1")).toBe(42);
  });

  it("WHEN 200 seeded property sequences of random edits run THEN every cell value after incremental recalculation equals a full recalculation of a fresh workbook loaded from wb.toJSON()", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            col: fc.constantFrom("A", "B", "C"),
            row: fc.integer({ min: 1, max: 3 }),
            value: fc.oneof(
              fc.integer({ min: -50, max: 50 }),
              fc.string({ maxLength: 5 }),
              fc.boolean(),
              fc.constantFrom(
                "=A1+B1",
                "=SUM(A1:C1)",
                "=IF(A1>0, 10, 20)",
                "=C2*2",
                "=A2&B2",
                "=10",
              ),
            ),
          }),
          { minLength: 1, maxLength: 8 },
        ),
        (operations) => {
          const wb = new Workbook();
          for (const op of operations) {
            const ref = `${op.col}${op.row}`;
            try {
              wb.setCell(ref, op.value);
            } catch (e) {
              // Formula parse error or cycle might be expected on random formula strings
              if (!(e instanceof FormulaError)) {
                throw e;
              }
            }
          }

          const json = wb.toJSON();
          const wbFresh = new Workbook();
          wbFresh.loadJSON(json);

          for (const key of Object.keys(json)) {
            const val1 = wb.getValue(key);
            const val2 = wbFresh.getValue(key);
            expect(val1).toEqual(val2);
          }
        },
      ),
      { numRuns: 200, seed: 424242 },
    );
  });
});

describe("Workbook comprehensive unit tests", () => {
  it("handles operators and comparisons", () => {
    const wb = new Workbook();
    wb.setCell("A1", 5);
    wb.setCell("A2", 10);
    wb.setCell("B1", "=A1 - A2");
    wb.setCell("B2", "=A1 / A2");
    wb.setCell("B3", "=A1 ^ 2");
    wb.setCell("B4", "=A1 % A2");
    wb.setCell("B5", "=A1 = 5");
    wb.setCell("B6", "=A1 <> 5");
    wb.setCell("B7", "=A1 < A2");
    wb.setCell("B8", "=A1 <= 5");
    wb.setCell("B9", "=A1 > A2");
    wb.setCell("B10", "=A1 >= 5");
    wb.setCell("B11", "=+A1");
    wb.setCell("B12", "=-A1");
    wb.setCell("B13", "=A1 & A2");

    expect(wb.getValue("B1")).toBe(-5);
    expect(wb.getValue("B2")).toBe(0.5);
    expect(wb.getValue("B3")).toBe(25);
    expect(wb.getValue("B4")).toBe(0.5);
    expect(wb.getValue("B5")).toBe(true);
    expect(wb.getValue("B6")).toBe(false);
    expect(wb.getValue("B7")).toBe(true);
    expect(wb.getValue("B8")).toBe(true);
    expect(wb.getValue("B9")).toBe(false);
    expect(wb.getValue("B10")).toBe(true);
    expect(wb.getValue("B11")).toBe(5);
    expect(wb.getValue("B12")).toBe(-5);
    expect(wb.getValue("B13")).toBe("510");
  });

  it("handles string comparisons and booleans", () => {
    const wb = new Workbook();
    wb.setCell("A1", "hello");
    wb.setCell("A2", "HELLO");
    wb.setCell("A3", "=A1 = A2");
    wb.setCell("A4", "=A1 <> A2");
    wb.setCell("A5", "=TRUE = TRUE");
    wb.setCell("A6", "=TRUE < FALSE");
    expect(wb.getValue("A3")).toBe(true);
    expect(wb.getValue("A4")).toBe(false);
    expect(wb.getValue("A5")).toBe(true);
    expect(wb.getValue("A6")).toBe(false);
  });

  it("handles division by zero and errors", () => {
    const wb = new Workbook();
    wb.setCell("A1", "=1 / 0");
    expect(wb.getValue("A1")).toBe("#DIV/0!");

    wb.setCell("A2", "=A1 + 5");
    expect(wb.getValue("A2")).toBe("#DIV/0!");

    wb.setCell("A3", '="notANumber" + 5');
    expect(wb.getValue("A3")).toBe("#VALUE!");
  });

  it("handles IF logic with 2 and 3 arguments", () => {
    const wb = new Workbook();
    wb.setCell("A1", `=IF(1 > 0, "yes", "no")`);
    expect(wb.getValue("A1")).toBe("yes");

    wb.setCell("A2", `=IF(1 < 0, "yes", "no")`);
    expect(wb.getValue("A2")).toBe("no");

    wb.setCell("A3", `=IF(1 < 0, "yes")`);
    expect(wb.getValue("A3")).toBe(false);
  });

  it("handles getDependents and getCycle", () => {
    const wb = new Workbook();
    wb.setCell("A1", 10);
    wb.setCell("B1", "=A1 + 1");
    wb.setCell("C1", "=A1 + 2");
    expect(wb.getDependents("A1").sort()).toEqual(["B1", "C1"].sort());
    expect(wb.getCycle("A1")).toBeNull();
  });

  it("respects maxCellCount limit", () => {
    const wb = new Workbook({ maxCellCount: 2 });
    wb.setCell("A1", 1);
    wb.setCell("A2", 2);
    expect(() => wb.setCell("A3", 3)).toThrowError(FormulaError);
  });

  it("recalculate() without args recalculates all dirty cells", () => {
    const wb = new Workbook();
    wb.setCell("A1", 10);
    wb.setCell("A2", "=A1 * 3");
    const res = wb.recalculate();
    expect(res.dirtyCount).toBe(2);
    expect(wb.getValue("A2")).toBe(30);
  });

  it("handles custom function error handling", () => {
    const wb = new Workbook();
    wb.registerFunction("THROWER", () => {
      throw new Error("boom");
    });
    wb.setCell("A1", "=THROWER(1)");
    expect(wb.getValue("A1")).toBe("#VALUE!");
  });
});
