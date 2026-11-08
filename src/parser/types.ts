/**
 * Primitive cell values supported by the spreadsheet engine.
 */
export type CellValue = number | string | boolean | null;

/**
 * Standard spreadsheet error literal strings.
 */
export type CellError = "#DIV/0!" | "#N/A" | "#REF!" | "#VALUE!" | "#NAME?" | "#NUM!" | "#CIRC!";

/**
 * Error codes thrown by parser and evaluation limits.
 */
export type FormulaErrorCode =
  | "FORMULA_TOO_LONG"
  | "EXPRESSION_TOO_DEEP"
  | "CELL_LIMIT_EXCEEDED"
  | "SYNTAX_ERROR"
  | "CIRCULAR_REFERENCE"
  | "UNKNOWN_FUNCTION";

/**
 * Custom error class for formula parsing and execution errors.
 */
export class FormulaError extends Error {
  readonly code: FormulaErrorCode;

  constructor(code: FormulaErrorCode, message?: string) {
    super(message ?? code);
    this.name = "FormulaError";
    this.code = code;
    Object.setPrototypeOf(this, FormulaError.prototype);
  }
}

/**
 * Coordinate representing a single cell location.
 */
export interface CellCoord {
  readonly sheet?: string;
  readonly row: number;
  readonly col: number;
  readonly rowAbsolute?: boolean;
  readonly colAbsolute?: boolean;
}

/**
 * Rectangular range of cells.
 */
export interface CellRange {
  readonly sheet?: string;
  readonly start: CellCoord;
  readonly end: CellCoord;
}

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
  readonly reference?: string;
}

export interface RangeNode extends ASTNodeBase {
  readonly type: "Range";
  readonly range: CellRange;
  readonly raw: string;
  readonly reference?: string;
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
