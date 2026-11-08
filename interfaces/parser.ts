import type { CellCoord, CellRange, CellValue } from "./types.js";

export type ASTNodeType =
  | "Literal"
  | "Reference"
  | "Range"
  | "UnaryExpression"
  | "BinaryExpression"
  | "FunctionCall";

export interface ASTNodeBase {
  readonly type: ASTNodeType;
}

export interface LiteralNode extends ASTNodeBase {
  readonly type: "Literal";
  readonly value: CellValue;
}

export interface ReferenceNode extends ASTNodeBase {
  readonly type: "Reference";
  readonly coord: CellCoord;
  readonly raw: string;
}

export interface RangeNode extends ASTNodeBase {
  readonly type: "Range";
  readonly range: CellRange;
  readonly raw: string;
}

export interface UnaryExpressionNode extends ASTNodeBase {
  readonly type: "UnaryExpression";
  readonly operator: "+" | "-";
  readonly argument: ASTNode;
}

export interface BinaryExpressionNode extends ASTNodeBase {
  readonly type: "BinaryExpression";
  readonly operator: "+" | "-" | "*" | "/" | "^" | "%" | "&" | "=" | "<>" | "<" | "<=" | ">" | ">=";
  readonly left: ASTNode;
  readonly right: ASTNode;
}

export interface FunctionCallNode extends ASTNodeBase {
  readonly type: "FunctionCall";
  readonly name: string;
  readonly arguments: ASTNode[];
}

export type ASTNode =
  | LiteralNode
  | ReferenceNode
  | RangeNode
  | UnaryExpressionNode
  | BinaryExpressionNode
  | FunctionCallNode;

export interface ParserOptions {
  maxFormulaLength?: number;
  maxExpressionDepth?: number;
}

export declare function parseFormula(formula: string, options?: ParserOptions): ASTNode;
export declare function parseCellReference(ref: string): CellCoord;
export declare function parseRangeReference(rangeRef: string): CellRange;
export declare function formatCellReference(coord: CellCoord): string;
export declare function extractReferences(ast: ASTNode): string[];
