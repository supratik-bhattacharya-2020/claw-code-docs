# Python Parity Tracker

The `src/` directory contains a **Python** workspace that serves as a parity audit tool. It does **not** implement a working agent — instead, it tracks how much of the original TypeScript Claude Code surface has been ported to Rust.

## What It Does

The Python workspace:

1. **Loads JSON snapshots** of the original TypeScript commands and tools (from `reference_data/`)
2. **Provides a CLI** (`main.py`) with 20+ subcommands for querying, routing, and simulating runtime behavior
3. **Maps Python modules** to their TypeScript counterparts via `parity_audit.py`
4. **Simulates runtime behavior** — `PortRuntime` can route prompts, bootstrap sessions, and run multi-turn loops
5. **Manages sessions** — `QueryEnginePort` handles message submission, token tracking, compaction, and persistence

## Structure

```
src/
├── main.py               — CLI entrypoint (20+ subcommands)
├── runtime.py            — PortRuntime: routing, session bootstrap, turn loops
├── query_engine.py       — QueryEnginePort: message submission, streaming, compaction
├── models.py             — Shared dataclasses (Subsystem, PortingModule, PermissionDenial)
├── permissions.py        — ToolPermissionContext (deny lists, not escalation modes)
├── tools.py              — Tool snapshot loading from JSON, filtering by permission
├── commands.py           — Command snapshot loading from JSON
├── port_manifest.py      — Python workspace manifest generation
├── parity_audit.py       — Compare Python workspace against archived TS surface
├── context.py            — PortContext: paths, file counts
├── transcript.py         — TranscriptStore (append, compact, replay, flush)
├── session_store.py      — StoredSession JSON persistence
├── execution_registry.py — MirroredCommand/MirroredTool execution wrappers
├── tool_pool.py          — Assembles filtered tool pool
├── setup.py              — WorkspaceSetup (platform, Python version)
├── system_init.py        — Builds system init message
├── history.py            — HistoryLog
├── bootstrap_graph.py    — Bootstrap graph stages
├── command_graph.py      — Command graph segmentation
├── remote_runtime.py     — Remote/SSH/teleport mode simulation
├── direct_modes.py       — Deep link and direct connect modes
├── reference_data/       — JSON snapshots of original TS surface
│   ├── tools_snapshot.json
│   ├── commands_snapshot.json
│   ├── archive_surface_snapshot.json
│   └── subsystems/       — Per-subsystem JSON (hooks.json, services.json, etc.)
└── <28 __init__.py stubs> — Placeholder packages for archived TS subsystems
```

## Key Python Modules

### PortRuntime (`runtime.py`)

The central orchestrator for the Python parity tracker:

- **`route_prompt(prompt)`** — Fuzzy-matches user prompts against mirrored commands and tools
- **`bootstrap_session(prompt)`** — Builds a full `RuntimeSession` with context, routing, execution, and streaming
- **`run_turn_loop(prompt, max_turns)`** — Multi-turn conversation loop with stop conditions

### QueryEnginePort (`query_engine.py`)

The session engine that tracks messages, usage, and compaction:

- **`submit_message(prompt)`** — Process a message, track usage, return `TurnResult`
- **`stream_submit_message(prompt)`** — Generator yielding `message_start`, `command_match`, `tool_match`, `message_delta`, `message_stop` events
- **`compact_messages_if_needed()`** — Keeps only the last N messages (default: `compact_after_turns=12`)
- **`persist_session()`** — Saves session to `.port_sessions/<id>.json`

### ToolPermissionContext (`permissions.py`)

A different permission model than the Rust side — uses deny lists instead of escalation modes:

```python
@dataclass(frozen=True)
class ToolPermissionContext:
    deny_names: frozenset[str] = field(default_factory=frozenset)
    deny_prefixes: tuple[str, ...] = ()

    def blocks(self, tool_name: str) -> bool:
        lowered = tool_name.lower()
        return lowered in self.deny_names or any(
            lowered.startswith(prefix) for prefix in self.deny_prefixes
        )
```

## Relationship to Rust

The Python workspace is a **planning and tracking tool** for the Rust implementation. It answers questions like:

- Which TypeScript commands have Rust equivalents?
- Which tools are missing from the Rust port?
- What runtime behaviors still need to be implemented?

The `compat-harness` Rust crate works with the Python workspace by extracting upstream manifests.

## Not a Working Agent

::: warning Important
The Python code does **not** make real API calls to Anthropic or execute real tools. It simulates runtime behavior using mirrored metadata from JSON snapshots. The actual working agent is the Rust implementation in `rust/crates/`.
:::

If you want to use claw-code as an agent, look at the Rust crates — specifically the `claw` binary in `rusty-claude-cli`.
