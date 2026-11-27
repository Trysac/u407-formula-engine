import { describe, expect, it } from "vitest";
import { FormulaError, greet, isCellError, Workbook } from "../src/index.js";

describe("package entry point", () => {
  it("exports Workbook with dependency-driven recalculation", () => {
    const wb = new Workbook();
    wb.setCell("A1", 10);
    wb.setCell("A2", 32);
    wb.setCell("A3", "=SUM(A1:A2)");
    expect(wb.getValue("A3")).toBe(42);
    expect(wb.setCell("A1", 20)).toEqual({ evaluated: ["A3"] });
    expect(wb.getValue("A3")).toBe(52);
  });

  it("reports cycles and formula errors as cell errors", () => {
    const wb = new Workbook();
    wb.setCell("B1", "=B2+1");
    wb.setCell("B2", "=B1+1");
    expect(wb.getValue("B1")).toBe("#CIRC!");
    wb.setCell("C1", "=1/0");
    expect(isCellError(wb.getValue("C1"))).toBe(true);
  });

  it("throws FormulaError with a code for invalid formulas", () => {
    const wb = new Workbook();
    expect(() => wb.setCell("A1", "=SUM(")).toThrow(FormulaError);
    try {
      wb.setCell("A1", "=SUM(");
    } catch (error) {
      expect((error as FormulaError).code).toBe("SYNTAX_ERROR");
    }
  });

  it("keeps greet", () => {
    expect(greet(" Ada ")).toBe("Hello, Ada!");
  });
});
