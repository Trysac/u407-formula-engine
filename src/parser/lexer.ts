import { truncateInput } from "./reference.js";
import { FormulaError } from "./types.js";

export type TokenType =
  | "NUMBER"
  | "STRING"
  | "BOOLEAN"
  | "CELL_REF"
  | "IDENTIFIER"
  | "OPERATOR"
  | "COLON"
  | "COMMA"
  | "LPAREN"
  | "RPAREN"
  | "EOF";

export interface Token {
  readonly type: TokenType;
  readonly value: string;
  readonly start: number;
  readonly end: number;
}

export class Lexer {
  private readonly input: string;
  private pos = 0;

  constructor(input: string) {
    this.input = input;
  }

  public tokenize(): Token[] {
    const tokens: Token[] = [];

    while (this.pos < this.input.length) {
      this.skipWhitespace();
      if (this.pos >= this.input.length) {
        break;
      }

      const ch = this.input[this.pos];
      if (ch === undefined) {
        break;
      }
      const start = this.pos;

      if (ch === "(") {
        tokens.push({ type: "LPAREN", value: "(", start, end: start + 1 });
        this.pos++;
      } else if (ch === ")") {
        tokens.push({ type: "RPAREN", value: ")", start, end: start + 1 });
        this.pos++;
      } else if (ch === ",") {
        tokens.push({ type: "COMMA", value: ",", start, end: start + 1 });
        this.pos++;
      } else if (ch === ":") {
        tokens.push({ type: "COLON", value: ":", start, end: start + 1 });
        this.pos++;
      } else if (ch === '"') {
        tokens.push(this.readString());
      } else if (this.isOperatorStart(ch)) {
        tokens.push(this.readOperator());
      } else if (this.isDigit(ch) || (ch === "." && this.isDigit(this.peek(1)))) {
        tokens.push(this.readNumber());
      } else if (ch === "'" || ch === "$" || this.isAlpha(ch) || ch === "_") {
        tokens.push(this.readReferenceOrIdentifier());
      } else {
        throw new FormulaError(
          "SYNTAX_ERROR",
          `Unexpected character '${ch}' at position ${this.pos}: ${truncateInput(this.input)}`,
        );
      }
    }

    tokens.push({ type: "EOF", value: "", start: this.pos, end: this.pos });
    return tokens;
  }

  private skipWhitespace(): void {
    while (this.pos < this.input.length) {
      const ch = this.input[this.pos];
      if (ch !== undefined && /\s/.test(ch)) {
        this.pos++;
      } else {
        break;
      }
    }
  }

  private peek(offset = 0): string {
    const idx = this.pos + offset;
    return idx < this.input.length ? (this.input[idx] ?? "") : "";
  }

  private isDigit(ch: string): boolean {
    return ch >= "0" && ch <= "9";
  }

  private isAlpha(ch: string): boolean {
    return (ch >= "A" && ch <= "Z") || (ch >= "a" && ch <= "z");
  }

  private isOperatorStart(ch: string): boolean {
    return "+-*/^%&=<>".includes(ch);
  }

  private readOperator(): Token {
    const start = this.pos;
    const ch = this.input[this.pos] ?? "";
    const next = this.peek(1);

    if ((ch === "<" && (next === "=" || next === ">")) || (ch === ">" && next === "=")) {
      this.pos += 2;
      return { type: "OPERATOR", value: ch + next, start, end: this.pos };
    }

    this.pos++;
    return { type: "OPERATOR", value: ch, start, end: this.pos };
  }

  private readString(): Token {
    const start = this.pos;
    this.pos++; // skip opening "
    let value = "";

    while (this.pos < this.input.length) {
      const ch = this.input[this.pos];
      if (ch === '"') {
        if (this.peek(1) === '"') {
          value += '"';
          this.pos += 2;
        } else {
          this.pos++; // skip closing "
          return { type: "STRING", value, start, end: this.pos };
        }
      } else {
        value += ch;
        this.pos++;
      }
    }

    throw new FormulaError(
      "SYNTAX_ERROR",
      `Unterminated string literal: ${truncateInput(this.input)}`,
    );
  }

  private readNumber(): Token {
    const start = this.pos;
    const rest = this.input.slice(this.pos);
    const match = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/.exec(rest);
    if (!match) {
      throw new FormulaError(
        "SYNTAX_ERROR",
        `Invalid number format at ${this.pos}: ${truncateInput(this.input)}`,
      );
    }
    this.pos += match[0].length;
    return { type: "NUMBER", value: match[0], start, end: this.pos };
  }

  private readReferenceOrIdentifier(): Token {
    const start = this.pos;

    // 1. Quoted sheet reference: 'Sheet Name'!A1
    if (this.input[this.pos] === "'") {
      this.pos++;
      while (this.pos < this.input.length) {
        if (this.input[this.pos] === "'") {
          if (this.peek(1) === "'") {
            this.pos += 2;
          } else {
            this.pos++;
            break;
          }
        } else {
          this.pos++;
        }
      }
      if (this.pos >= this.input.length || this.input[this.pos] !== "!") {
        throw new FormulaError(
          "SYNTAX_ERROR",
          `Expected '!' after quoted sheet name: ${truncateInput(this.input)}`,
        );
      }
      this.pos++; // skip !
      this.consumeCellCoord();
      return { type: "CELL_REF", value: this.input.slice(start, this.pos), start, end: this.pos };
    }

    // 2. Scan word
    const wordStart = this.pos;
    while (this.pos < this.input.length) {
      const char = this.input[this.pos];
      if (
        char !== undefined &&
        (this.isAlpha(char) || this.isDigit(char) || char === "_" || char === "." || char === "$")
      ) {
        this.pos++;
      } else {
        break;
      }
    }

    // Check if this was followed by exclamation mark (unquoted sheet name)
    if (this.pos < this.input.length && this.input[this.pos] === "!") {
      this.pos++; // skip !
      this.consumeCellCoord();
      return { type: "CELL_REF", value: this.input.slice(start, this.pos), start, end: this.pos };
    }

    const rawWord = this.input.slice(wordStart, this.pos);

    // Check if word is a cell coordinate
    if (/^\$?[A-Za-z]+\$?[1-9][0-9]*$/.test(rawWord)) {
      return { type: "CELL_REF", value: rawWord, start, end: this.pos };
    }

    // Check for boolean literal (not followed by '(')
    const upper = rawWord.toUpperCase();
    this.skipWhitespace();
    const nextChar = this.peek(0);
    if (nextChar !== "(") {
      if (upper === "TRUE" || upper === "FALSE") {
        return { type: "BOOLEAN", value: upper, start, end: start + rawWord.length };
      }
    }

    return { type: "IDENTIFIER", value: rawWord, start, end: start + rawWord.length };
  }

  private consumeCellCoord(): void {
    const start = this.pos;
    const rest = this.input.slice(start);
    const match = /^\$?[A-Za-z]+\$?[1-9][0-9]*/.exec(rest);
    if (!match) {
      throw new FormulaError(
        "SYNTAX_ERROR",
        `Expected cell coordinate after '!': ${truncateInput(this.input)}`,
      );
    }
    this.pos += match[0].length;
  }
}
