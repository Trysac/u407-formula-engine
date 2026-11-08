import type { ASTNode } from "./types.js";

/**
 * Recursively extracts unique reference and range raw strings from an AST tree
 * preserving encounter order.
 */
export function extractReferences(ast: ASTNode): string[] {
  const refs: string[] = [];

  function walk(node: ASTNode): void {
    switch (node.type) {
      case "Reference":
        refs.push(node.raw);
        break;
      case "Range":
        refs.push(node.raw);
        break;
      case "UnaryExpression":
        walk(node.argument);
        break;
      case "BinaryExpression":
        walk(node.left);
        walk(node.right);
        break;
      case "FunctionCall":
        for (const arg of node.arguments) {
          walk(arg);
        }
        break;
      case "Literal":
        break;
    }
  }

  walk(ast);
  return Array.from(new Set(refs));
}
