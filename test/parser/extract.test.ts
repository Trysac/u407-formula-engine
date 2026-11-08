import { describe, expect, it } from "vitest";
import { extractReferences, parseFormula } from "../../src/parser/index.js";

describe("extractReferences", () => {
  it("extracts cell references and ranges from expressions", () => {
    const ast = parseFormula("=SUM(Sheet1!$A$1:$B$2, 42) + C1 * D1");
    const refs = extractReferences(ast);
    expect(refs).toEqual(["Sheet1!$A$1:$B$2", "C1", "D1"]);
  });

  it("deduplicates references preserving order", () => {
    const ast = parseFormula("=A1 + B1 + A1 + B1");
    const refs = extractReferences(ast);
    expect(refs).toEqual(["A1", "B1"]);
  });

  it("returns empty array for pure literal expressions", () => {
    const ast = parseFormula("=1 + 2 * (3 + 4)");
    const refs = extractReferences(ast);
    expect(refs).toEqual([]);
  });

  it("extracts references from unary expressions and nested function calls", () => {
    const ast = parseFormula("=-A1 + MAX(B1:B10, ABS(-C1))");
    const refs = extractReferences(ast);
    expect(refs).toEqual(["A1", "B1:B10", "C1"]);
  });
});
