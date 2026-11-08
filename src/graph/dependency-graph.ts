import type { IDependencyGraph, RecalculationPlan } from "../../interfaces/graph.js";

/**
 * Primitive cell error and status codes.
 */
export type FormulaErrorCode =
  | "FORMULA_TOO_LONG"
  | "EXPRESSION_TOO_DEEP"
  | "CELL_LIMIT_EXCEEDED"
  | "SYNTAX_ERROR"
  | "CIRCULAR_REFERENCE"
  | "UNKNOWN_FUNCTION";

/**
 * Typed error for formula engine operations.
 */
export class FormulaError extends Error {
  readonly code: FormulaErrorCode;

  constructor(code: FormulaErrorCode, message?: string) {
    super(message ?? code);
    this.name = "FormulaError";
    this.code = code;
  }
}

export type { IDependencyGraph, RecalculationPlan };

/**
 * Configuration options for DependencyGraph.
 */
export interface DependencyGraphOptions {
  readonly maxCellCount?: number;
}

const DEFAULT_MAX_CELL_COUNT = 100_000;

/**
 * Directed acyclic graph tracking cell dependencies and dependents for
 * incremental spreadsheet formula recalculation.
 */
export class DependencyGraph implements IDependencyGraph {
  private readonly cells = new Set<string>();
  private readonly dependencies = new Map<string, Set<string>>();
  private readonly dependents = new Map<string, Set<string>>();
  private readonly maxCellCount: number;

  constructor(options?: DependencyGraphOptions) {
    this.maxCellCount = options?.maxCellCount ?? DEFAULT_MAX_CELL_COUNT;
  }

  /**
   * Adds a cell node to the graph if not already present.
   * Enforces the configured cell count limit.
   */
  addCell(cell: string): void {
    if (this.cells.has(cell)) {
      return;
    }
    if (this.cells.size >= this.maxCellCount) {
      throw new FormulaError(
        "CELL_LIMIT_EXCEEDED",
        `Maximum cell count limit of ${this.maxCellCount} exceeded`,
      );
    }
    this.cells.add(cell);
    this.dependencies.set(cell, new Set());
    this.dependents.set(cell, new Set());
  }

  /**
   * Removes a cell node and all incoming/outgoing edges from the graph.
   */
  removeCell(cell: string): void {
    if (!this.cells.has(cell)) {
      return;
    }

    const cellDeps = this.dependencies.get(cell);
    if (cellDeps) {
      for (const dep of cellDeps) {
        this.dependents.get(dep)?.delete(cell);
      }
    }

    const cellDependents = this.dependents.get(cell);
    if (cellDependents) {
      for (const dependent of cellDependents) {
        this.dependencies.get(dependent)?.delete(cell);
      }
    }

    this.dependencies.delete(cell);
    this.dependents.delete(cell);
    this.cells.delete(cell);
  }

  /**
   * Updates the dependencies of a given cell. Automatically synchronizes reverse dependent edges.
   */
  setDependencies(cell: string, dependencies: string[]): void {
    this.addCell(cell);
    const currentDeps = this.dependencies.get(cell) ?? new Set<string>();
    const newDeps = new Set(dependencies);

    for (const oldDep of currentDeps) {
      if (!newDeps.has(oldDep)) {
        this.dependents.get(oldDep)?.delete(cell);
      }
    }

    for (const newDep of newDeps) {
      this.addCell(newDep);
      if (!currentDeps.has(newDep)) {
        this.dependents.get(newDep)?.add(cell);
      }
    }

    this.dependencies.set(cell, newDeps);
  }

  /**
   * Returns the list of dependencies that the given cell directly depends on.
   */
  getDependencies(cell: string): string[] {
    const deps = this.dependencies.get(cell);
    return deps ? Array.from(deps) : [];
  }

  /**
   * Returns the list of dependents that directly depend on the given cell.
   */
  getDependents(cell: string): string[] {
    const deps = this.dependents.get(cell);
    return deps ? Array.from(deps) : [];
  }

  /**
   * Checks whether the cell is registered in the graph.
   */
  hasCell(cell: string): boolean {
    return this.cells.has(cell);
  }

  /**
   * Detects whether traversing dependencies from `startCell` leads to a cycle.
   * Returns the simple cycle path as an array of cell names, or null if acyclic.
   */
  detectCycle(startCell: string): string[] | null {
    if (!this.hasCell(startCell)) {
      return null;
    }

    const visited = new Set<string>();
    const inStack = new Map<string, number>();
    const path: string[] = [];
    const stack: { node: string; depIndex: number; deps: string[] }[] = [];

    stack.push({
      node: startCell,
      depIndex: 0,
      deps: this.getDependencies(startCell),
    });
    inStack.set(startCell, 0);
    path.push(startCell);

    while (stack.length > 0) {
      const top = stack[stack.length - 1]!;
      if (top.depIndex < top.deps.length) {
        const dep = top.deps[top.depIndex]!;
        top.depIndex++;

        if (inStack.has(dep)) {
          const cycleStartIndex = inStack.get(dep)!;
          return path.slice(cycleStartIndex);
        }

        if (!visited.has(dep)) {
          inStack.set(dep, path.length);
          path.push(dep);
          stack.push({
            node: dep,
            depIndex: 0,
            deps: this.getDependencies(dep),
          });
        }
      } else {
        visited.add(top.node);
        inStack.delete(top.node);
        path.pop();
        stack.pop();
      }
    }

    return null;
  }

  /**
   * Computes the topological recalculation plan for all downstream dependents of dirty cells.
   */
  getEvaluationOrder(dirtyCells: string[]): RecalculationPlan {
    const affected = new Set<string>();
    const bfsQueue: string[] = [];

    for (const cell of dirtyCells) {
      for (const dep of this.getDependents(cell)) {
        if (!affected.has(dep)) {
          affected.add(dep);
          bfsQueue.push(dep);
        }
      }
    }

    while (bfsQueue.length > 0) {
      const current = bfsQueue.shift()!;
      for (const dep of this.getDependents(current)) {
        if (!affected.has(dep)) {
          affected.add(dep);
          bfsQueue.push(dep);
        }
      }
    }

    if (affected.size === 0) {
      return { order: [], cycleCells: [] };
    }

    const inDegree = new Map<string, number>();
    for (const node of affected) {
      let count = 0;
      for (const dep of this.getDependencies(node)) {
        if (affected.has(dep)) {
          count++;
        }
      }
      inDegree.set(node, count);
    }

    const topoQueue: string[] = [];
    for (const node of affected) {
      if ((inDegree.get(node) ?? 0) === 0) {
        topoQueue.push(node);
      }
    }

    const order: string[] = [];
    while (topoQueue.length > 0) {
      const current = topoQueue.shift()!;
      order.push(current);

      for (const dep of this.getDependents(current)) {
        if (affected.has(dep)) {
          const remaining = (inDegree.get(dep) ?? 0) - 1;
          inDegree.set(dep, remaining);
          if (remaining === 0) {
            topoQueue.push(dep);
          }
        }
      }
    }

    const cycleCells: string[] = [];
    if (order.length < affected.size) {
      const orderSet = new Set(order);
      for (const node of affected) {
        if (!orderSet.has(node)) {
          cycleCells.push(node);
        }
      }
      cycleCells.sort();
    }

    return { order, cycleCells };
  }

  /**
   * Clears all cells and relationships from the dependency graph.
   */
  clear(): void {
    this.cells.clear();
    this.dependencies.clear();
    this.dependents.clear();
  }
}
