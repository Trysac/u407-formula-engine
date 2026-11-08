import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { DependencyGraph, FormulaError } from "../../src/graph/index.js";

describe("DependencyGraph acceptance criteria", () => {
  it("WHEN a circular dependency edge 'A1' -> 'B1' and 'B1' -> 'A1' is added THEN graph.detectCycle('A1') returns ['A1', 'B1']", () => {
    const graph = new DependencyGraph();
    graph.setDependencies("A1", ["B1"]);
    graph.setDependencies("B1", ["A1"]);
    expect(graph.detectCycle("A1")).toEqual(["A1", "B1"]);
  });

  it("WHEN 'B1' changes in graph where 'A1' depends on 'B1' and 'C1' is independent THEN graph.getEvaluationOrder(['B1']) returns order ['A1']", () => {
    const graph = new DependencyGraph();
    graph.setDependencies("A1", ["B1"]);
    graph.addCell("C1");
    const plan = graph.getEvaluationOrder(["B1"]);
    expect(plan.order).toEqual(["A1"]);
    expect(plan.cycleCells).toEqual([]);
  });

  it("WHEN diamond dependency graph A1->B1, A1->C1, B1->D1, C1->D1 is invalidated from 'D1' THEN graph.getEvaluationOrder(['D1']) returns ['B1', 'C1', 'A1'] with each node evaluated exactly once", () => {
    const graph = new DependencyGraph();
    graph.setDependencies("A1", ["B1", "C1"]);
    graph.setDependencies("B1", ["D1"]);
    graph.setDependencies("C1", ["D1"]);
    graph.addCell("D1");
    const plan = graph.getEvaluationOrder(["D1"]);
    expect(plan.order).toEqual(["B1", "C1", "A1"]);
    expect(new Set(plan.order).size).toBe(plan.order.length);
    expect(plan.cycleCells).toEqual([]);
  });
});

describe("DependencyGraph operations and lifecycle", () => {
  it("handles addCell, hasCell, and duplicate addCell idempotency", () => {
    const graph = new DependencyGraph();
    expect(graph.hasCell("A1")).toBe(false);
    graph.addCell("A1");
    expect(graph.hasCell("A1")).toBe(true);
    graph.addCell("A1");
    expect(graph.hasCell("A1")).toBe(true);
  });

  it("enforces maxCellCount limit with FormulaError", () => {
    const graph = new DependencyGraph({ maxCellCount: 2 });
    graph.addCell("A1");
    graph.addCell("B1");
    expect(() => graph.addCell("C1")).toThrow(FormulaError);
    try {
      graph.addCell("C1");
    } catch (err) {
      expect(err).toBeInstanceOf(FormulaError);
      expect((err as FormulaError).code).toBe("CELL_LIMIT_EXCEEDED");
    }
  });

  it("constructs FormulaError with default message when message is omitted", () => {
    const err = new FormulaError("CIRCULAR_REFERENCE");
    expect(err.code).toBe("CIRCULAR_REFERENCE");
    expect(err.message).toBe("CIRCULAR_REFERENCE");
    expect(err.name).toBe("FormulaError");
  });

  it("handles removeCell with nonexistent and existing cell edges", () => {
    const graph = new DependencyGraph();
    graph.removeCell("Z99");

    graph.setDependencies("A1", ["B1", "C1"]);
    graph.setDependencies("X1", ["A1"]);
    expect(graph.getDependents("B1")).toEqual(["A1"]);
    expect(graph.getDependencies("X1")).toEqual(["A1"]);

    graph.removeCell("A1");
    expect(graph.hasCell("A1")).toBe(false);
    expect(graph.getDependents("B1")).toEqual([]);
    expect(graph.getDependents("C1")).toEqual([]);
    expect(graph.getDependencies("X1")).toEqual([]);
  });

  it("clears all state", () => {
    const graph = new DependencyGraph();
    graph.setDependencies("A1", ["B1"]);
    expect(graph.hasCell("A1")).toBe(true);
    expect(graph.hasCell("B1")).toBe(true);
    graph.clear();
    expect(graph.hasCell("A1")).toBe(false);
    expect(graph.hasCell("B1")).toBe(false);
    expect(graph.getDependencies("A1")).toEqual([]);
    expect(graph.getDependents("B1")).toEqual([]);
  });

  it("updates dependencies and cleans up unreferenced dependents", () => {
    const graph = new DependencyGraph();
    graph.setDependencies("A1", ["B1", "C1"]);
    expect(graph.getDependencies("A1")).toEqual(["B1", "C1"]);
    expect(graph.getDependents("B1")).toEqual(["A1"]);
    expect(graph.getDependents("C1")).toEqual(["A1"]);

    graph.setDependencies("A1", ["C1", "D1"]);
    expect(graph.getDependencies("A1")).toEqual(["C1", "D1"]);
    expect(graph.getDependents("B1")).toEqual([]);
    expect(graph.getDependents("C1")).toEqual(["A1"]);
    expect(graph.getDependents("D1")).toEqual(["A1"]);
  });

  it("deduplicates dependencies array inputs", () => {
    const graph = new DependencyGraph();
    graph.setDependencies("A1", ["B1", "B1", "B1"]);
    expect(graph.getDependencies("A1")).toEqual(["B1"]);
  });
});

describe("DependencyGraph cycle detection and evaluation order edge cases", () => {
  it("detects self cycles: A1 -> A1", () => {
    const graph = new DependencyGraph();
    graph.setDependencies("A1", ["A1"]);
    expect(graph.detectCycle("A1")).toEqual(["A1"]);
  });

  it("detects 3-node cycles: A1 -> B1 -> C1 -> A1", () => {
    const graph = new DependencyGraph();
    graph.setDependencies("A1", ["B1"]);
    graph.setDependencies("B1", ["C1"]);
    graph.setDependencies("C1", ["A1"]);
    expect(graph.detectCycle("A1")).toEqual(["A1", "B1", "C1"]);
    expect(graph.detectCycle("B1")).toEqual(["B1", "C1", "A1"]);
  });

  it("returns null for unknown cells and acyclic branches", () => {
    const graph = new DependencyGraph();
    expect(graph.detectCycle("UNKNOWN")).toBeNull();

    graph.setDependencies("A1", ["B1"]);
    graph.setDependencies("B1", ["C1"]);
    expect(graph.detectCycle("A1")).toBeNull();
  });

  it("detects cycle that starts downstream: X1 -> A1 -> B1 -> A1", () => {
    const graph = new DependencyGraph();
    graph.setDependencies("X1", ["A1"]);
    graph.setDependencies("A1", ["B1"]);
    graph.setDependencies("B1", ["A1"]);
    expect(graph.detectCycle("X1")).toEqual(["A1", "B1"]);
  });

  it("handles empty dirtyCells and dirtyCells with no dependents", () => {
    const graph = new DependencyGraph();
    expect(graph.getEvaluationOrder([])).toEqual({ order: [], cycleCells: [] });

    graph.addCell("Z1");
    expect(graph.getEvaluationOrder(["Z1"])).toEqual({ order: [], cycleCells: [] });
  });

  it("populates cycleCells when circular dependencies block recalculation", () => {
    const graph = new DependencyGraph();
    graph.setDependencies("A1", ["B1"]);
    graph.setDependencies("B1", ["A1"]);
    const plan = graph.getEvaluationOrder(["A1"]);
    expect(plan.order).toEqual([]);
    expect(plan.cycleCells).toEqual(["A1", "B1"]);
  });

  it("evaluates independent branch while isolating cycleCells", () => {
    const graph = new DependencyGraph();
    graph.setDependencies("Valid1", ["Input"]);
    graph.setDependencies("CycA", ["Input", "CycB"]);
    graph.setDependencies("CycB", ["CycA"]);

    const plan = graph.getEvaluationOrder(["Input"]);
    expect(plan.order).toEqual(["Valid1"]);
    expect(plan.cycleCells).toEqual(["CycA", "CycB"]);
  });
});

describe("DependencyGraph property invariants", () => {
  it("topological order preserves dependency ordering across arbitrary DAGs", () => {
    fc.assert(
      fc.property(fc.integer({ min: 3, max: 20 }), (nodeCount) => {
        const graph = new DependencyGraph();
        const nodes = Array.from({ length: nodeCount }, (_, i) => `N${i}`);
        for (const node of nodes) {
          graph.addCell(node);
        }

        for (let i = 1; i < nodeCount; i++) {
          const depIndex = Math.floor(i / 2);
          graph.setDependencies(nodes[i]!, [nodes[depIndex]!]);
        }

        const plan = graph.getEvaluationOrder([nodes[0]!]);
        expect(plan.cycleCells).toEqual([]);
        const orderIndex = new Map(plan.order.map((node, idx) => [node, idx]));

        for (const [node, idx] of orderIndex.entries()) {
          for (const dep of graph.getDependencies(node)) {
            if (orderIndex.has(dep)) {
              expect(orderIndex.get(dep)!).toBeLessThan(idx);
            }
          }
        }
      }),
      { numRuns: 50 },
    );
  });
});
