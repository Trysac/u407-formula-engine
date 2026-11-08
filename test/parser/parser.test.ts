import { describe, expect, it } from "vitest";
import {
  type BinaryExpressionNode,
  FormulaError,
  type FunctionCallNode,
  parseCellReference,
  parseFormula,
  type RangeNode,
  type ReferenceNode,
  type UnaryExpressionNode,
} from "../../src/parser/index.js";

describe("Formula Parser module", () => {
  describe("Acceptance criteria verbatim", () => {
    it("IF formula string exceeds maxFormulaLength of 4096 characters THEN parseFormula raises FormulaError with code 'FORMULA_TOO_LONG'", () => {
      const longFormula = `=${"1+".repeat(2048)}1`;
      expect(longFormula.length).toBeGreaterThan(4096);
      expect(() => parseFormula(longFormula)).toThrowError(FormulaError);
      try {
        parseFormula(longFormula);
      } catch (err) {
        expect(err).toBeInstanceOf(FormulaError);
        expect((err as FormulaError).code).toBe("FORMULA_TOO_LONG");
      }
    });

    it("IF formula nesting exceeds maxExpressionDepth of 64 levels THEN parseFormula raises FormulaError with code 'EXPRESSION_TOO_DEEP'", () => {
      const deepFormula = `=${"(".repeat(65)}1${")".repeat(65)}`;
      expect(() => parseFormula(deepFormula)).toThrowError(FormulaError);
      try {
        parseFormula(deepFormula);
      } catch (err) {
        expect(err).toBeInstanceOf(FormulaError);
        expect((err as FormulaError).code).toBe("EXPRESSION_TOO_DEEP");
      }

      const allowedDepthFormula = `=${"(".repeat(63)}1${")".repeat(63)}`;
      expect(() => parseFormula(allowedDepthFormula)).not.toThrow();
    });

    it("WHEN parsing formula '=SUM(Sheet1!$A$1:$B$2, 42)' THEN parseFormula returns AST with function name 'SUM' and reference 'Sheet1!$A$1:$B$2'", () => {
      const ast = parseFormula("=SUM(Sheet1!$A$1:$B$2, 42)");
      expect(ast.type).toBe("FunctionCall");
      const callNode = ast as FunctionCallNode;
      expect(callNode.name).toBe("SUM");
      expect(callNode.arguments).toHaveLength(2);
      const firstArg = callNode.arguments[0] as RangeNode;
      expect(firstArg.type).toBe("Range");
      expect(firstArg.raw).toBe("Sheet1!$A$1:$B$2");
      expect(firstArg.reference).toBe("Sheet1!$A$1:$B$2");
      expect(firstArg.range.sheet).toBe("Sheet1");
      expect(firstArg.range.start).toEqual({
        sheet: "Sheet1",
        row: 1,
        col: 1,
        rowAbsolute: true,
        colAbsolute: true,
      });
      expect(firstArg.range.end).toEqual({
        sheet: "Sheet1",
        row: 2,
        col: 2,
        rowAbsolute: true,
        colAbsolute: true,
      });
      expect(callNode.arguments[1]).toEqual({ type: "Literal", value: 42 });
    });

    it("WHEN parsing cell coordinate '$C$10' THEN parseCellReference returns row 10 and col 3 with absolute row and column flags true", () => {
      const coord = parseCellReference("$C$10");
      expect(coord).toEqual({
        row: 10,
        col: 3,
        rowAbsolute: true,
        colAbsolute: true,
      });
      expect(coord.row).toBe(10);
      expect(coord.col).toBe(3);
      expect(coord.rowAbsolute).toBe(true);
      expect(coord.colAbsolute).toBe(true);
    });
  });

  describe("Literals and data types", () => {
    it("parses numbers including floats, exponents, and decimals", () => {
      expect(parseFormula("123")).toEqual({ type: "Literal", value: 123 });
      expect(parseFormula("3.1415")).toEqual({ type: "Literal", value: 3.1415 }); // biome-ignore lint/suspicious/noApproximativeNumericConstant: testing literal float parsing
      expect(parseFormula(".5")).toEqual({ type: "Literal", value: 0.5 });
      expect(parseFormula("1e3")).toEqual({ type: "Literal", value: 1000 });
      expect(parseFormula("1.5e-2")).toEqual({ type: "Literal", value: 0.015 });
    });

    it("parses strings with escaped quotes", () => {
      expect(parseFormula('"Hello World"')).toEqual({ type: "Literal", value: "Hello World" });
      expect(parseFormula('"Hello ""World"""')).toEqual({
        type: "Literal",
        value: 'Hello "World"',
      });
      expect(parseFormula('""')).toEqual({ type: "Literal", value: "" });
    });

    it("parses booleans TRUE and FALSE", () => {
      expect(parseFormula("TRUE")).toEqual({ type: "Literal", value: true });
      expect(parseFormula("FALSE")).toEqual({ type: "Literal", value: false });
      expect(parseFormula("=true")).toEqual({ type: "Literal", value: true });
      expect(parseFormula("null")).toEqual({ type: "Literal", value: null });
    });
  });

  describe("Expressions and operators", () => {
    it("parses binary operators with correct precedence", () => {
      const ast = parseFormula("1 + 2 * 3") as BinaryExpressionNode;
      expect(ast.type).toBe("BinaryExpression");
      expect(ast.operator).toBe("+");
      expect(ast.left).toEqual({ type: "Literal", value: 1 });
      expect(ast.right).toEqual({
        type: "BinaryExpression",
        operator: "*",
        left: { type: "Literal", value: 2 },
        right: { type: "Literal", value: 3 },
      });
    });

    it("parses string concatenation &", () => {
      const ast = parseFormula('"A" & "B" & "C"') as BinaryExpressionNode;
      expect(ast.operator).toBe("&");
      expect(ast.right).toEqual({ type: "Literal", value: "C" });
    });

    it("parses comparison operators", () => {
      for (const op of ["=", "<>", "<", "<=", ">", ">="]) {
        const ast = parseFormula(`A1 ${op} 10`) as BinaryExpressionNode;
        expect(ast.operator).toBe(op);
      }
    });

    it("parses right-associative exponentiation ^", () => {
      const ast = parseFormula("2 ^ 3 ^ 4") as BinaryExpressionNode;
      expect(ast.operator).toBe("^");
      expect(ast.left).toEqual({ type: "Literal", value: 2 });
      const right = ast.right as BinaryExpressionNode;
      expect(right.operator).toBe("^");
      expect(right.left).toEqual({ type: "Literal", value: 3 });
      expect(right.right).toEqual({ type: "Literal", value: 4 });
    });

    it("parses unary operators", () => {
      const pos = parseFormula("+5") as UnaryExpressionNode;
      expect(pos).toEqual({
        type: "UnaryExpression",
        operator: "+",
        argument: { type: "Literal", value: 5 },
      });

      const neg = parseFormula("-A1") as UnaryExpressionNode;
      expect(neg.type).toBe("UnaryExpression");
      expect(neg.operator).toBe("-");
      expect((neg.argument as ReferenceNode).raw).toBe("A1");

      const chained = parseFormula("--5") as UnaryExpressionNode;
      expect(chained.operator).toBe("-");
      expect((chained.argument as UnaryExpressionNode).operator).toBe("-");
    });

    it("parses modulo operator %", () => {
      const ast = parseFormula("10 % 3") as BinaryExpressionNode;
      expect(ast.operator).toBe("%");
    });
  });

  describe("Function calls", () => {
    it("parses nullary, unary and multi-argument function calls", () => {
      const now = parseFormula("NOW()") as FunctionCallNode;
      expect(now).toEqual({ type: "FunctionCall", name: "NOW", arguments: [] });

      const abs = parseFormula("ABS(-10)") as FunctionCallNode;
      expect(abs.name).toBe("ABS");
      expect(abs.arguments).toHaveLength(1);

      const sum = parseFormula("SUM(1, 2, 3)") as FunctionCallNode;
      expect(sum.name).toBe("SUM");
      expect(sum.arguments).toHaveLength(3);
    });

    it("parses empty / omitted arguments as null", () => {
      const ast = parseFormula("IF(A1, , 2)") as FunctionCallNode;
      expect(ast.arguments).toHaveLength(3);
      expect(ast.arguments[1]).toEqual({ type: "Literal", value: null });

      const trailing = parseFormula("FOO(1, )") as FunctionCallNode;
      expect(trailing.arguments).toHaveLength(2);
      expect(trailing.arguments[1]).toEqual({ type: "Literal", value: null });

      const emptyLeading = parseFormula("FOO(, )") as FunctionCallNode;
      expect(emptyLeading.arguments).toHaveLength(2);
      expect(emptyLeading.arguments[0]).toEqual({ type: "Literal", value: null });
      expect(emptyLeading.arguments[1]).toEqual({ type: "Literal", value: null });

      const multipleEmpty = parseFormula("FOO(, , )") as FunctionCallNode;
      expect(multipleEmpty.arguments).toHaveLength(3);
      expect(multipleEmpty.arguments).toEqual([
        { type: "Literal", value: null },
        { type: "Literal", value: null },
        { type: "Literal", value: null },
      ]);
    });
  });

  describe("Syntax errors and edge cases", () => {
    it("throws SYNTAX_ERROR on empty or equal-only formula", () => {
      expect(() => parseFormula("")).toThrowError(FormulaError);
      expect(() => parseFormula("  ")).toThrowError(FormulaError);
      expect(() => parseFormula("=")).toThrowError(FormulaError);
      expect(() => parseFormula("   =   ")).toThrowError(FormulaError);
    });

    it("throws SYNTAX_ERROR on unterminated strings", () => {
      expect(() => parseFormula('"unterminated')).toThrowError(FormulaError);
    });

    it("throws SYNTAX_ERROR on unclosed parentheses", () => {
      expect(() => parseFormula("=(1+")).toThrowError(FormulaError);
      expect(() => parseFormula("SUM(1, 2")).toThrowError(FormulaError);
    });

    it("throws SYNTAX_ERROR on unexpected tokens and extra tokens", () => {
      expect(() => parseFormula("1 + * 2")).toThrowError(FormulaError);
      expect(() => parseFormula("1 2")).toThrowError(FormulaError);
      expect(() => parseFormula("UNKNOWN_ID")).toThrowError(FormulaError);
    });

    it("respects custom ParserOptions", () => {
      expect(() => parseFormula("=1+2", { maxFormulaLength: 3 })).toThrowError(FormulaError);
      expect(() => parseFormula("=(1+(2+3))", { maxExpressionDepth: 2 })).toThrowError(
        FormulaError,
      );
    });
  });
});
