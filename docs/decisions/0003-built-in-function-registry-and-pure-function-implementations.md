# Built-in Function Registry and Pure Function Implementations

Status: accepted (generated, pending human review)

## Context

The formula engine needs a comprehensive library of spreadsheet built-in functions covering Math, Logic, Text, Lookup, Date, and Finance families. The implementation must support arbitrary nested ranges/arrays, standard spreadsheet error handling (such as #DIV/0!, #N/A, #VALUE!, #NAME?, #NUM!), and date serialization compatible with Excel's 1900 date system.

## Decision

Implement modular function definitions organized by functional domain (math, logic, text, lookup, date, finance), unified via a `FunctionRegistry` class and `createDefaultFunctionRegistry()` factory. All functions operate deterministically with range resolution and error short-circuiting helpers.

## Consequences

Functions are pure, decoupled from the workbook state, and directly testable against standard test fixture matrices. Additional custom functions can easily be registered through the registry interface.
