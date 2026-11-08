import type { FunctionArgument, FunctionContext, IFunctionRegistry } from "../functions/index.js";
import { evaluateFunction } from "../functions/index.js";
import type {
  ASTNode,
  BinaryExpressionNode,
  CellError,
  CellValue,
  FunctionCallNode,
  LiteralNode,
  RangeNode,
  ReferenceNode,
  UnaryExpressionNode,
} from "../parser/index.js";
import { formatCellReference } from "../parser/index.js";

const CELL_ERROR_STRINGS: ReadonlySet<string> = new Set([
  "#DIV/0!",
  "#N/A",
  "#REF!",
  "#VALUE!",
  "#NAME?",
  "#NUM!",
  "#CIRC!",
]);

export function isCellError(val: unknown): val is CellError {
  return typeof val === "string" && CELL_ERROR_STRINGS.has(val);
}

function coerceToNumber(val: CellValue | CellError): number | CellError {
  if (isCellError(val)) return val;
  if (val === null || val === false) return 0;
  if (val === true) return 1;
  if (typeof val === "number") return val;
  const trimmed = val.trim();
  if (trimmed === "") return 0;
  const num = Number(trimmed);
  if (Number.isNaN(num)) return "#VALUE!";
  return num;
}

function coerceToString(val: CellValue | CellError): string | CellError {
  if (isCellError(val)) return val;
  if (val === null) return "";
  if (typeof val === "boolean") return val ? "TRUE" : "FALSE";
  return String(val);
}

export function evaluateAST(
  node: ASTNode,
  context: FunctionContext,
  registry: IFunctionRegistry,
): CellValue | CellError {
  switch (node.type) {
    case "Literal": {
      const lit = node as LiteralNode;
      return lit.value;
    }
    case "Reference": {
      const ref = node as ReferenceNode;
      const canon = formatCellReference(ref.coord);
      return context.getCellValue(canon);
    }
    case "Range": {
      const rng = node as RangeNode;
      return context.getRangeValues(rng.raw) as unknown as CellValue;
    }
    case "UnaryExpression": {
      const unary = node as UnaryExpressionNode;
      const arg = evaluateAST(unary.argument, context, registry);
      if (isCellError(arg)) return arg;
      const num = coerceToNumber(arg);
      if (isCellError(num)) return num;
      return unary.operator === "-" ? -num : num;
    }
    case "BinaryExpression": {
      const bin = node as BinaryExpressionNode;
      const left = evaluateAST(bin.left, context, registry);
      if (isCellError(left)) return left;
      const right = evaluateAST(bin.right, context, registry);
      if (isCellError(right)) return right;

      const op = bin.operator;
      if (op === "&") {
        const s1 = coerceToString(left);
        if (isCellError(s1)) return s1;
        const s2 = coerceToString(right);
        if (isCellError(s2)) return s2;
        return s1 + s2;
      }

      if (op === "=" || op === "<>" || op === "<" || op === "<=" || op === ">" || op === ">=") {
        return evaluateComparison(left, right, op);
      }

      const n1 = coerceToNumber(left);
      if (isCellError(n1)) return n1;
      const n2 = coerceToNumber(right);
      if (isCellError(n2)) return n2;

      switch (op) {
        case "+":
          return n1 + n2;
        case "-":
          return n1 - n2;
        case "*":
          return n1 * n2;
        case "/":
          if (n2 === 0) return "#DIV/0!";
          return n1 / n2;
        case "^":
          return n1 ** n2;
        case "%":
          return n1 * (n2 / 100);
        default:
          return "#VALUE!";
      }
    }
    case "FunctionCall": {
      const call = node as FunctionCallNode;
      const upperName = call.name.toUpperCase();

      // Special handling for IFERROR: do not eagerly fail on error in 1st argument
      if (upperName === "IFERROR") {
        if (call.arguments.length !== 2) return "#VALUE!";
        const val = evaluateAST(call.arguments[0]!, context, registry);
        if (isCellError(val)) {
          return evaluateAST(call.arguments[1]!, context, registry);
        }
        return val;
      }

      // Special handling for IF: short-circuiting
      if (upperName === "IF") {
        const callArgs = call.arguments;
        if (callArgs.length < 2 || callArgs.length > 3) return "#VALUE!";
        const condNode = callArgs[0];
        const thenNode = callArgs[1];
        if (!condNode || !thenNode) return "#VALUE!";
        const cond = evaluateAST(condNode, context, registry);
        if (isCellError(cond)) return cond;
        const isTrue = Boolean(cond);
        if (isTrue) {
          return evaluateAST(thenNode, context, registry);
        }
        if (callArgs.length === 3) {
          const elseNode = callArgs[2];
          if (!elseNode) return "#VALUE!";
          return evaluateAST(elseNode, context, registry);
        }
        return false;
      }

      const evaluatedArgs: FunctionArgument[] = [];
      for (const argNode of call.arguments) {
        if (argNode.type === "Range") {
          const rng = argNode as RangeNode;
          evaluatedArgs.push(context.getRangeValues(rng.raw));
        } else {
          const res = evaluateAST(argNode, context, registry);
          evaluatedArgs.push(res);
        }
      }

      return evaluateFunction(upperName, evaluatedArgs, context, registry);
    }
    default:
      return "#VALUE!";
  }
}

function evaluateComparison(
  left: CellValue,
  right: CellValue,
  op: "=" | "<>" | "<" | "<=" | ">" | ">=",
): boolean {
  if (left === null && right === null) {
    return op === "=" || op === "<=" || op === ">=";
  }

  let cmp: number;
  if (typeof left === "number" && typeof right === "number") {
    cmp = left < right ? -1 : left > right ? 1 : 0;
  } else if (typeof left === "string" && typeof right === "string") {
    const lLow = left.toLowerCase();
    const rLow = right.toLowerCase();
    cmp = lLow < rLow ? -1 : lLow > rLow ? 1 : 0;
  } else if (typeof left === "boolean" && typeof right === "boolean") {
    cmp = left === right ? 0 : left ? 1 : -1;
  } else {
    // Different types: convert to string for equality, or standard Excel comparison order
    const lStr = String(left ?? "");
    const rStr = String(right ?? "");
    cmp = lStr < rStr ? -1 : lStr > rStr ? 1 : 0;
  }

  switch (op) {
    case "=":
      return cmp === 0;
    case "<>":
      return cmp !== 0;
    case "<":
      return cmp < 0;
    case "<=":
      return cmp <= 0;
    case ">":
      return cmp > 0;
    case ">=":
      return cmp >= 0;
  }
}
