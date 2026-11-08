export interface RecalculationPlan {
  readonly order: string[];
  readonly cycleCells: string[];
}

export interface IDependencyGraph {
  addCell(cell: string): void;
  removeCell(cell: string): void;
  setDependencies(cell: string, dependencies: string[]): void;
  getDependencies(cell: string): string[];
  getDependents(cell: string): string[];
  detectCycle(startCell: string): string[] | null;
  getEvaluationOrder(dirtyCells: string[]): RecalculationPlan;
  hasCell(cell: string): boolean;
  clear(): void;
}

export declare class DependencyGraph implements IDependencyGraph {
  constructor();
  addCell(cell: string): void;
  removeCell(cell: string): void;
  setDependencies(cell: string, dependencies: string[]): void;
  getDependencies(cell: string): string[];
  getDependents(cell: string): string[];
  detectCycle(startCell: string): string[] | null;
  getEvaluationOrder(dirtyCells: string[]): RecalculationPlan;
  hasCell(cell: string): boolean;
  clear(): void;
}
