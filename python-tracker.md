# Python Parity Tracker

The `src/` directory contains a **Python** workspace that serves as a parity audit tool. It does **not** implement a working agent — instead, it tracks how much of the original TypeScript Claude Code surface has been ported to Rust.

## What It Does

The Python workspace:

1. **Loads JSON snapshots** of the original TypeScript commands and tools
2. **Provides CLI scripts** for querying, routing, and simulating runtime behavior
3. **Maps Python modules** to their TypeScript counterparts
4. **Tracks porting progress** across ~98 Python source files

## Structure

```
src/
├── commands/         — Python mirrors of TS slash commands
├── tools/            — Python mirrors of TS tool definitions
├── runtime/          — Python stubs for runtime behavior
├── services/         — Service layer stubs
└── tests/            — Validation surfaces
```

## Relationship to Rust

The Python workspace is a **planning and tracking tool** for the Rust implementation. It answers questions like:

- Which TypeScript commands have Rust equivalents?
- Which tools are missing from the Rust port?
- What runtime behaviors still need to be implemented?

The `compat-harness` Rust crate works with the Python workspace by extracting upstream manifests:

```rust
// compat-harness/src/lib.rs
// Extracts command and tool manifests from the upstream project
```

## Not a Working Agent

::: warning Important
The Python code does **not** make API calls, execute tools, or manage conversations. It's purely a metadata workspace for tracking porting progress. The actual working agent is the Rust implementation.
:::

If you want to use claw-code as an agent, look at the Rust crates — specifically the `claw` binary in `rusty-claude-cli`.
