import { Lexer, type Token, type TokenType } from "./lexer.js";
import { parseCellReference, truncateInput } from "./reference.js";
import {
  type ASTNode,
  type BinaryExpressionNode,
  FormulaError,
  type FunctionCallNode,
  type LiteralNode,
  type ParserOptions,
  type RangeNode,
  type ReferenceNode,
  type UnaryExpressionNode,
} from "./types.js";

const BINARY_PRECEDENCE: Record<string, number> = {
  "=": 1,
  "<>": 1,
  "<": 1,
  "<=": 1,
  ">": 1,
  ">=": 1,
  "&": 2,
  "+": 3,
  "-": 3,
  "*": 4,
  "/": 4,
  "%": 4,
  "^": 5,
};

/**
 * Parses a spreadsheet formula string into an ASTNode tree.
 */
export function parseFormula(formula: string, options?: ParserOptions): ASTNode {
  const maxFormulaLength = options?.maxFormulaLength ?? 4096;
  const maxExpressionDepth = options?.maxExpressionDepth ?? 64;

  if (formula.length > maxFormulaLength) {
    throw new FormulaError(
      "FORMULA_TOO_LONG",
      `Formula length of ${formula.length} exceeds maximum allowed length of ${maxFormulaLength}`,
    );
  }

  let text = formula.trim();
  if (text.startsWith("=")) {
    text = text.slice(1).trim();
  }

  if (text.length === 0) {
    throw new FormulaError("SYNTAX_ERROR", "Formula is empty");
  }

  const lexer = new Lexer(text);
  const tokens = lexer.tokenize();
  const parser = new FormulaParser(tokens, text, maxExpressionDepth);
  return parser.parse();
}

class FormulaParser {
  private readonly tokens: Token[];
  private readonly source: string;
  private readonly maxDepth: number;
  private pos = 0;

  constructor(tokens: Token[], source: string, maxDepth: number) {
    this.tokens = tokens;
    this.source = source;
    this.maxDepth = maxDepth;
  }

  public parse(): ASTNode {
    const ast = this.parseExpression(0, 1);
    if (this.current().type !== "EOF") {
      throw new FormulaError(
        "SYNTAX_ERROR",
        `Unexpected token '${this.current().value}' after formula: ${truncateInput(this.source)}`,
      );
    }
    return ast;
  }

  private checkDepth(depth: number): void {
    if (depth > this.maxDepth) {
      throw new FormulaError(
        "EXPRESSION_TOO_DEEP",
        `Formula nesting exceeds maximum depth of ${this.maxDepth}`,
      );
    }
  }

  private current(): Token {
    const token = this.tokens[this.pos];
    if (token === undefined) {
      return { type: "EOF", value: "", start: this.source.length, end: this.source.length };
    }
    return token;
  }

  private consume(expectedType?: TokenType): Token {
    const token = this.current();
    if (expectedType && token.type !== expectedType) {
      throw new FormulaError(
        "SYNTAX_ERROR",
        `Expected token type ${expectedType} but found ${token.type} ('${token.value}') in ${truncateInput(this.source)}`,
      );
    }
    this.pos++;
    return token;
  }

  private parseExpression(minPrecedence: number, depth: number): ASTNode {
    this.checkDepth(depth);
    let left = this.parsePrefix(depth);

    while (true) {
      const token = this.current();
      if (token.type !== "OPERATOR") {
        break;
      }
      const precedence = BINARY_PRECEDENCE[token.value];
      if (precedence === undefined || precedence < minPrecedence) {
        break;
      }

      this.consume("OPERATOR");
      const isRightAssoc = token.value === "^";
      const nextMinPrec = isRightAssoc ? precedence : precedence + 1;
      const right = this.parseExpression(nextMinPrec, depth + 1);

      const binaryNode: BinaryExpressionNode = {
        type: "BinaryExpression",
        operator: token.value as BinaryExpressionNode["operator"],
        left,
        right,
      };
      left = binaryNode;
    }

    return left;
  }

  private parsePrefix(depth: number): ASTNode {
    this.checkDepth(depth);
    const token = this.current();

    if (token.type === "OPERATOR" && (token.value === "+" || token.value === "-")) {
      this.consume("OPERATOR");
      const arg = this.parseExpression(6, depth + 1);
      const unaryNode: UnaryExpressionNode = {
        type: "UnaryExpression",
        operator: token.value as "+" | "-",
        argument: arg,
      };
      return unaryNode;
    }

    return this.parseAtom(depth);
  }

  private parseAtom(depth: number): ASTNode {
    this.checkDepth(depth);
    const token = this.current();

    if (token.type === "NUMBER") {
      this.consume("NUMBER");
      const val = Number(token.value);
      const literalNode: LiteralNode = { type: "Literal", value: val };
      return literalNode;
    }

    if (token.type === "STRING") {
      this.consume("STRING");
      const literalNode: LiteralNode = { type: "Literal", value: token.value };
      return literalNode;
    }

    if (token.type === "BOOLEAN") {
      this.consume("BOOLEAN");
      const literalNode: LiteralNode = {
        type: "Literal",
        value: token.value.toUpperCase() === "TRUE",
      };
      return literalNode;
    }

    if (token.type === "LPAREN") {
      this.consume("LPAREN");
      const expr = this.parseExpression(0, depth + 1);
      this.consume("RPAREN");
      return expr;
    }

    if (token.type === "CELL_REF") {
      const startTok = this.consume("CELL_REF");
      if (this.current().type === "COLON") {
        this.consume("COLON");
        const endTok = this.consume("CELL_REF");
        const raw = this.source.slice(startTok.start, endTok.end);
        const startCoord = parseCellReference(startTok.value);
        let endCoord = parseCellReference(endTok.value);
        if (startCoord.sheet !== undefined && endCoord.sheet === undefined) {
          endCoord = { ...endCoord, sheet: startCoord.sheet };
        }
        const sheet = startCoord.sheet ?? endCoord.sheet;
        const rangeNode: RangeNode = {
          type: "Range",
          range: {
            ...(sheet !== undefined ? { sheet } : {}),
            start: startCoord,
            end: endCoord,
          },
          raw,
          reference: raw,
        };
        return rangeNode;
      }

      const coord = parseCellReference(startTok.value);
      const refNode: ReferenceNode = {
        type: "Reference",
        coord,
        raw: startTok.value,
        reference: startTok.value,
      };
      return refNode;
    }

    if (token.type === "IDENTIFIER") {
      const nameTok = this.consume("IDENTIFIER");
      if (this.current().type === "LPAREN") {
        this.consume("LPAREN");
        const args: ASTNode[] = [];
        if (this.current().type !== "RPAREN") {
          while (true) {
            if (this.current().type === "COMMA") {
              args.push({ type: "Literal", value: null });
            } else {
              args.push(this.parseExpression(0, depth + 1));
            }

            if (this.current().type === "COMMA") {
              this.consume("COMMA");
              if (this.current().type === "RPAREN") {
                args.push({ type: "Literal", value: null });
                break;
              }
            } else {
              break;
            }
          }
        }
        this.consume("RPAREN");
        const callNode: FunctionCallNode = {
          type: "FunctionCall",
          name: nameTok.value.toUpperCase(),
          arguments: args,
        };
        return callNode;
      }

      if (nameTok.value.toUpperCase() === "NULL") {
        return { type: "Literal", value: null };
      }

      throw new FormulaError(
        "SYNTAX_ERROR",
        `Unknown identifier or missing parentheses '${nameTok.value}' in formula: ${truncateInput(this.source)}`,
      );
    }

    throw new FormulaError(
      "SYNTAX_ERROR",
      `Unexpected token '${token.value}' at position ${token.start} in formula: ${truncateInput(this.source)}`,
    );
  }
}
