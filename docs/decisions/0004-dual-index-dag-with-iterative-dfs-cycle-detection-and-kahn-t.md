# Dual-index DAG with iterative DFS cycle detection and Kahn topological ordering

Status: accepted (generated, pending human review)

## Context

Spreadsheet formulas require dynamic dependency tracking, fast incremental invalidation, cycle detection, and topological evaluation order calculation without overflowing the call stack on deep chains.

## Decision

Implemented DependencyGraph with synchronized dual adjacency sets (dependencies and dependents), iterative DFS for cycle detection avoiding call stack limits, and Kahn's algorithm over downstream affected subgraphs to produce the evaluation order and isolate cycle cells.

## Consequences

Provides deterministic O(V + E) cycle detection and incremental recalculation planning with no runtime dependencies and clean cycle isolation.
