import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  colNameToIndex,
  FormulaError,
  formatCellReference,
  indexToColName,
  parseCellReference,
  parseRangeReference,
} from "../../src/parser/index.js";

describe("Reference parsing and formatting", () => {
  describe("Column conversion", () => {
    it("converts single and multi-letter column names", () => {
      expect(colNameToIndex("A")).toBe(1);
      expect(colNameToIndex("Z")).toBe(26);
      expect(colNameToIndex("AA")).toBe(27);
      expect(colNameToIndex("AB")).toBe(28);
      expect(colNameToIndex("AZ")).toBe(52);
      expect(colNameToIndex("BA")).toBe(53);
      expect(colNameToIndex("ZZ")).toBe(702);
      expect(colNameToIndex("AAA")).toBe(703);
      expect(colNameToIndex("XFD")).toBe(16384);
    });

    it("converts column indices back to letters", () => {
      expect(indexToColName(1)).toBe("A");
      expect(indexToColName(26)).toBe("Z");
      expect(indexToColName(27)).toBe("AA");
      expect(indexToColName(702)).toBe("ZZ");
      expect(indexToColName(703)).toBe("AAA");
      expect(indexToColName(16384)).toBe("XFD");
    });

    it("throws on invalid column index or letters", () => {
      expect(() => indexToColName(0)).toThrowError(FormulaError);
      expect(() => indexToColName(-1)).toThrowError(FormulaError);
      expect(() => indexToColName(1.5)).toThrowError(FormulaError);
      expect(() => colNameToIndex("123")).toThrowError(FormulaError);
    });
  });

  describe("parseCellReference", () => {
    it("parses relative, absolute and mixed cell references", () => {
      expect(parseCellReference("A1")).toEqual({
        row: 1,
        col: 1,
        rowAbsolute: false,
        colAbsolute: false,
      });
      expect(parseCellReference("$B2")).toEqual({
        row: 2,
        col: 2,
        rowAbsolute: false,
        colAbsolute: true,
      });
      expect(parseCellReference("C$3")).toEqual({
        row: 3,
        col: 3,
        rowAbsolute: true,
        colAbsolute: false,
      });
      expect(parseCellReference("$D$4")).toEqual({
        row: 4,
        col: 4,
        rowAbsolute: true,
        colAbsolute: true,
      });
    });

    it("parses references with unquoted sheet names", () => {
      expect(parseCellReference("Sheet1!$A$1")).toEqual({
        sheet: "Sheet1",
        row: 1,
        col: 1,
        rowAbsolute: true,
        colAbsolute: true,
      });
    });

    it("parses references with quoted sheet names and escaped quotes", () => {
      expect(parseCellReference("'Sheet 1'!A1")).toEqual({
        sheet: "Sheet 1",
        row: 1,
        col: 1,
        rowAbsolute: false,
        colAbsolute: false,
      });
      expect(parseCellReference("'Joe''s Sheet'!$B$2")).toEqual({
        sheet: "Joe's Sheet",
        row: 2,
        col: 2,
        rowAbsolute: true,
        colAbsolute: true,
      });
    });

    it("throws SYNTAX_ERROR on malformed cell references", () => {
      expect(() => parseCellReference("")).toThrowError(FormulaError);
      expect(() => parseCellReference("  ")).toThrowError(FormulaError);
      expect(() => parseCellReference("A0")).toThrowError(FormulaError);
      expect(() => parseCellReference("1A")).toThrowError(FormulaError);
      expect(() => parseCellReference("$$A1")).toThrowError(FormulaError);
      expect(() => parseCellReference("!A1")).toThrowError(FormulaError);
      expect(() => parseCellReference("'Unclosed!A1")).toThrowError(FormulaError);
      expect(() => parseCellReference("'Bad'Sheet'!A1")).toThrowError(FormulaError);
    });
  });

  describe("parseRangeReference", () => {
    it("parses range references with and without sheets", () => {
      expect(parseRangeReference("A1:B2")).toEqual({
        start: { row: 1, col: 1, rowAbsolute: false, colAbsolute: false },
        end: { row: 2, col: 2, rowAbsolute: false, colAbsolute: false },
      });
      expect(parseRangeReference("Sheet1!A1:B2")).toEqual({
        sheet: "Sheet1",
        start: { sheet: "Sheet1", row: 1, col: 1, rowAbsolute: false, colAbsolute: false },
        end: { sheet: "Sheet1", row: 2, col: 2, rowAbsolute: false, colAbsolute: false },
      });
      expect(parseRangeReference("'Data Grid'!$A$1:$C$10")).toEqual({
        sheet: "Data Grid",
        start: { sheet: "Data Grid", row: 1, col: 1, rowAbsolute: true, colAbsolute: true },
        end: { sheet: "Data Grid", row: 10, col: 3, rowAbsolute: true, colAbsolute: true },
      });
    });

    it("throws SYNTAX_ERROR on malformed range references", () => {
      expect(() => parseRangeReference("")).toThrowError(FormulaError);
      expect(() => parseRangeReference("A1")).toThrowError(FormulaError);
      expect(() => parseRangeReference("A1:B2:C3")).toThrowError(FormulaError);
    });
  });

  describe("formatCellReference", () => {
    it("formats cell coordinates accurately", () => {
      expect(formatCellReference({ row: 10, col: 3, rowAbsolute: true, colAbsolute: true })).toBe(
        "$C$10",
      );
      expect(formatCellReference({ row: 1, col: 1 })).toBe("A1");
      expect(
        formatCellReference({
          sheet: "Sheet1",
          row: 10,
          col: 3,
          rowAbsolute: true,
          colAbsolute: true,
        }),
      ).toBe("Sheet1!$C$10");
      expect(formatCellReference({ sheet: "Sheet 1", row: 5, col: 2 })).toBe("'Sheet 1'!B5");
      expect(formatCellReference({ sheet: "Bob's", row: 1, col: 1 })).toBe("'Bob''s'!A1");
    });

    it("throws SYNTAX_ERROR on invalid coordinates", () => {
      expect(() => formatCellReference({ row: 0, col: 1 })).toThrowError(FormulaError);
      expect(() => formatCellReference({ row: 1, col: 0 })).toThrowError(FormulaError);
      expect(() => formatCellReference({ row: -5, col: 1 })).toThrowError(FormulaError);
      expect(() => formatCellReference({ row: 1.2, col: 1 })).toThrowError(FormulaError);
    });
  });

  describe("Property-based round-trip tests with fast-check", () => {
    it("preserves cell coordinates through format -> parse cycle", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 1048576 }),
          fc.integer({ min: 1, max: 16384 }),
          fc.boolean(),
          fc.boolean(),
          (row, col, rowAbsolute, colAbsolute) => {
            const coord = { row, col, rowAbsolute, colAbsolute };
            const formatted = formatCellReference(coord);
            const parsed = parseCellReference(formatted);
            expect(parsed).toEqual(coord);
          },
        ),
      );
    });
  });
});
