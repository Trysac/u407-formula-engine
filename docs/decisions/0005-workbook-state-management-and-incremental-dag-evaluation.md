# Workbook state management and incremental DAG evaluation

Status: accepted (generated, pending human review)

## Context

The workbook coordinates cell storage, parsing of formula text, dependency extraction via parseRangeReference and formatCellReference, incremental recalculation plans using DependencyGraph, cycle isolation via '#CIRC!' markers, and built-in and user-registered function evaluation.

## Decision

Store cell states in an in-memory Map keyed by canonical reference strings. On cell mutation, update dependencies in DependencyGraph, compute the topological recalculation plan, handle circular references by flagging involved cells with '#CIRC!', and evaluate updated formulas in plan order using a FunctionContext that exposes cell and rectangular range lookups.

## Consequences

Incremental edits re-evaluate only the transitive closure of dirty cells. Circular references are safely isolated without infinite recursion or uncaught exceptions, and serialization via toJSON/loadJSON restores complete workbook state.
