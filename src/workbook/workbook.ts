import {
  createDefaultFunctionRegistry,
  type FunctionContext,
  type FunctionImplementation,
  type IFunctionRegistry,
} from "../functions/index.js";
import { DependencyGraph, type IDependencyGraph } from "../graph/index.js";
import {
  extractReferences,
  formatCellReference,
  parseCellReference,
  parseFormula,
  parseRangeReference,
} from "../parser/index.js";
import { type CellError, type CellValue, FormulaError } from "../parser/types.js";
import { evaluateAST } from "./evaluator.js";
import type { IWorkbook, RecalculateResult, SetCellResult, WorkbookOptions } from "./types.js";

type CustomFunction = Parameters<IWorkbook["registerFunction"]>[1];

interface CellState {
  readonly rawInput: CellValue;
  readonly isFormula: boolean;
  ast?: ReturnType<typeof parseFormula>;
  value: CellValue | CellError;
  dependencies: string[];
}

const DEFAULT_MAX_FORMULA_LENGTH = 4096;
const DEFAULT_MAX_EXPRESSION_DEPTH = 64;
const DEFAULT_MAX_CELL_COUNT = 100_000;

function canonicalRef(ref: string): string {
  const coord = parseCellReference(ref);
  return formatCellReference(coord);
}

function expandRangeCells(rangeRef: string): string[] {
  const rng = parseRangeReference(rangeRef);
  const minRow = Math.min(rng.start.row, rng.end.row);
  const maxRow = Math.max(rng.start.row, rng.end.row);
  const minCol = Math.min(rng.start.col, rng.end.col);
  const maxCol = Math.max(rng.start.col, rng.end.col);

  const result: string[] = [];
  for (let r = minRow; r <= maxRow; r++) {
    for (let c = minCol; c <= maxCol; c++) {
      result.push(
        formatCellReference({
          ...(rng.sheet !== undefined ? { sheet: rng.sheet } : {}),
          row: r,
          col: c,
        }),
      );
    }
  }
  return result;
}

export class Workbook implements IWorkbook {
  private readonly options: Required<WorkbookOptions>;
  private readonly cells: Map<string, CellState> = new Map();
  private readonly graph: IDependencyGraph = new DependencyGraph();
  private readonly registry: IFunctionRegistry;
  private activeCycles: Map<string, string[]> = new Map();

  constructor(opts?: WorkbookOptions) {
    this.options = {
      maxFormulaLength: opts?.maxFormulaLength ?? DEFAULT_MAX_FORMULA_LENGTH,
      maxExpressionDepth: opts?.maxExpressionDepth ?? DEFAULT_MAX_EXPRESSION_DEPTH,
      maxCellCount: opts?.maxCellCount ?? DEFAULT_MAX_CELL_COUNT,
      excel1900LeapBug: opts?.excel1900LeapBug ?? false,
    };
    this.registry = createDefaultFunctionRegistry();
  }

  public registerFunction(name: string, fn: CustomFunction): void {
    const upper = name.toUpperCase();
    const impl: FunctionImplementation = (args) => {
      try {
        return fn(...args);
      } catch {
        return "#VALUE!";
      }
    };
    this.registry.register(upper, impl);
  }

  public getDependents(ref: string): string[] {
    const canon = canonicalRef(ref);
    return this.graph.getDependents(canon);
  }

  public getCycle(ref: string): string[] | null {
    const canon = canonicalRef(ref);
    const direct = this.activeCycles.get(canon);
    if (direct) return [...direct];
    return this.graph.detectCycle(canon);
  }

  public getValue(ref: string): CellValue | CellError {
    const canon = canonicalRef(ref);
    const state = this.cells.get(canon);
    if (!state) return null;
    return state.value;
  }

  public setCell(ref: string, content: CellValue): SetCellResult {
    const canon = canonicalRef(ref);
    const existing = this.cells.get(canon);

    if (!existing && this.cells.size >= this.options.maxCellCount) {
      throw new FormulaError(
        "CELL_LIMIT_EXCEEDED",
        `Cell limit of ${this.options.maxCellCount} reached`,
      );
    }

    if (typeof content === "string" && content.startsWith("=")) {
      const ast = parseFormula(content, {
        maxFormulaLength: this.options.maxFormulaLength,
        maxExpressionDepth: this.options.maxExpressionDepth,
      });

      const rawRefs = extractReferences(ast);
      const depSet = new Set<string>();
      for (const r of rawRefs) {
        if (r.includes(":")) {
          for (const expanded of expandRangeCells(r)) {
            depSet.add(expanded);
          }
        } else {
          depSet.add(canonicalRef(r));
        }
      }
      const dependencies = Array.from(depSet);

      this.cells.set(canon, {
        rawInput: content,
        isFormula: true,
        ast,
        value: null,
        dependencies,
      });
      this.graph.addCell(canon);
      this.graph.setDependencies(canon, dependencies);
    } else {
      this.cells.set(canon, {
        rawInput: content,
        isFormula: false,
        value: content,
        dependencies: [],
      });
      this.graph.addCell(canon);
      this.graph.setDependencies(canon, []);
    }

    const plan = this.graph.getEvaluationOrder([canon]);
    const evaluated = this.executePlan(plan, [canon], canon);
    return { evaluated };
  }

  public recalculate(dirtyCells?: string[]): RecalculateResult {
    const dirty = dirtyCells ? dirtyCells.map(canonicalRef) : Array.from(this.cells.keys());

    const plan = this.graph.getEvaluationOrder(dirty);
    const evaluated = this.executePlan(plan, dirty);
    return {
      evaluatedCount: evaluated.length,
      dirtyCount: dirty.length,
    };
  }

  public toJSON(): Record<string, CellValue> {
    const result: Record<string, CellValue> = {};
    for (const [key, state] of this.cells) {
      if (state.rawInput !== null && state.rawInput !== undefined) {
        result[key] = state.rawInput;
      }
    }
    return result;
  }

  public loadJSON(data: Record<string, CellValue>): void {
    this.cells.clear();
    this.graph.clear();
    this.activeCycles.clear();

    for (const [key, val] of Object.entries(data)) {
      const canon = canonicalRef(key);
      if (typeof val === "string" && val.startsWith("=")) {
        const ast = parseFormula(val, {
          maxFormulaLength: this.options.maxFormulaLength,
          maxExpressionDepth: this.options.maxExpressionDepth,
        });
        const rawRefs = extractReferences(ast);
        const depSet = new Set<string>();
        for (const r of rawRefs) {
          if (r.includes(":")) {
            for (const expanded of expandRangeCells(r)) {
              depSet.add(expanded);
            }
          } else {
            depSet.add(canonicalRef(r));
          }
        }
        const dependencies = Array.from(depSet);
        this.cells.set(canon, {
          rawInput: val,
          isFormula: true,
          ast,
          value: null,
          dependencies,
        });
        this.graph.addCell(canon);
        this.graph.setDependencies(canon, dependencies);
      } else {
        this.cells.set(canon, {
          rawInput: val,
          isFormula: false,
          value: val,
          dependencies: [],
        });
        this.graph.addCell(canon);
        this.graph.setDependencies(canon, []);
      }
    }

    this.recalculate();
  }

  private executePlan(
    plan: { order: string[]; cycleCells: string[] },
    changed: string[],
    triggerCell?: string,
  ): string[] {
    // The graph's plan lists only the cells that depend on the changed ones (its contract), so the
    // changed cells are evaluated first. A changed cell absent from the plan depends on no other
    // changed cell, so evaluating it before the plan is safe.
    const planned = new Set([...plan.order, ...plan.cycleCells]);
    const order = [...new Set(changed)].filter((cell) => !planned.has(cell));
    order.push(...plan.order);
    const evaluated: string[] = [];

    for (const cycleCell of plan.cycleCells) {
      const cellState = this.cells.get(cycleCell);
      if (cellState) {
        cellState.value = "#CIRC!";
      }
      const cyclePath = this.graph.detectCycle(cycleCell) ?? [cycleCell];
      for (const node of cyclePath) {
        this.activeCycles.set(node, cyclePath);
        const st = this.cells.get(node);
        if (st) st.value = "#CIRC!";
      }
    }

    for (const cell of order) {
      const cycle = this.graph.detectCycle(cell);
      if (cycle) {
        this.activeCycles.set(cell, cycle);
        const state = this.cells.get(cell);
        if (state) state.value = "#CIRC!";
        continue;
      }
      this.activeCycles.delete(cell);

      const state = this.cells.get(cell);
      if (!state) continue;

      if (state.isFormula && state.ast) {
        const context = this.createFunctionContext();
        state.value = evaluateAST(state.ast, context, this.registry);
        if (triggerCell !== undefined) {
          if (cell !== triggerCell) {
            evaluated.push(cell);
          }
        } else {
          evaluated.push(cell);
        }
      } else if (triggerCell !== undefined && cell !== triggerCell) {
        evaluated.push(cell);
      } else if (triggerCell === undefined) {
        evaluated.push(cell);
      }
    }

    return evaluated;
  }

  private createFunctionContext(): FunctionContext {
    return {
      excel1900LeapBug: this.options.excel1900LeapBug,
      getCellValue: (ref: string): CellValue | CellError => {
        const canon = canonicalRef(ref);
        const state = this.cells.get(canon);
        return state ? state.value : null;
      },
      getRangeValues: (rangeRef: string): (CellValue | CellError)[][] => {
        const rng = parseRangeReference(rangeRef);
        const minRow = Math.min(rng.start.row, rng.end.row);
        const maxRow = Math.max(rng.start.row, rng.end.row);
        const minCol = Math.min(rng.start.col, rng.end.col);
        const maxCol = Math.max(rng.start.col, rng.end.col);

        const rows: (CellValue | CellError)[][] = [];
        for (let r = minRow; r <= maxRow; r++) {
          const rowVals: (CellValue | CellError)[] = [];
          for (let c = minCol; c <= maxCol; c++) {
            const cRef = formatCellReference({
              ...(rng.sheet !== undefined ? { sheet: rng.sheet } : {}),
              row: r,
              col: c,
            });
            const cell = this.cells.get(cRef);
            rowVals.push(cell ? cell.value : null);
          }
          rows.push(rowVals);
        }
        return rows;
      },
    };
  }
}
