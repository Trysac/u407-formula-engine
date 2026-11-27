import { describe, expect, it } from "vitest";
import { DependencyGraph, FormulaError as GraphFormulaError } from "../src/graph/index.js";
import { FormulaError } from "../src/index.js";

describe("error identity", () => {
  it("throws the exported FormulaError when the dependency graph exceeds its cell limit", () => {
    const graph = new DependencyGraph({ maxCellCount: 1 });
    graph.addCell("A1");
    let thrown: unknown;
    try {
      graph.addCell("A2");
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(FormulaError);
    expect((thrown as FormulaError).code).toBe("CELL_LIMIT_EXCEEDED");
    expect((thrown as Error).message).toBe("Maximum cell count limit of 1 exceeded");
  });

  it("re-exports the same FormulaError class from the graph module", () => {
    expect(GraphFormulaError).toBe(FormulaError);
  });
});
