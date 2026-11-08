# Recursive descent formula parser with strict resource limits

Status: accepted (generated, pending human review)

## Context

Formula parsing must safely handle user-supplied spreadsheet formulas up to 4096 characters, expression nesting up to 64 levels, standard A1 and sheet reference syntaxes, and all spreadsheet operators while rejecting malformed inputs with typed FormulaError instances.

## Decision

Implement a recursive descent Pratt parser with dedicated lexing for cell references, sheet qualifiers, operators, and literals. Enforce maxFormulaLength before tokenization and maxExpressionDepth during recursive parsing. Provide exact A1 reference parsing, formatting, range handling, and reference extraction.

## Consequences

Guarantees linear-time parsing without stack overflow risks, satisfies all acceptance criteria, and provides AST structures consumed by dependency graphing and workbook evaluation.
