# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html). Entries are derived from Conventional Commits.

## [Unreleased]

### Added

- Add DependencyGraph for formula cell DAG tracking, cycle detection, and incremental evaluation ordering.
- Implement core spreadsheet built-in function library across Math, Logic, Text, Lookup, Date, and Finance categories
- feat(parser): implement A1/sheet reference parsing, formula AST parser with depth/length limits, and FormulaError
- Initial project structure from the factory utility template.
