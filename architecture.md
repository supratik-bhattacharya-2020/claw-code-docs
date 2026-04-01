# Architecture Overview

The **claw-code** project is a clean-room reimplementation of Claude Code's agent harness in **Rust**, with a companion **Python** metadata workspace. It provides a working CLI agent (`claw`) that can converse with the Anthropic API, execute tools, manage sessions, and enforce permissions — all without depending on the original TypeScript codebase.

## Two Implementations

The repository contains two distinct implementations:

| Implementation | Language | Purpose |
|:--|:--|:--|
| `rust/crates/` | Rust | A **working CLI agent** with agentic loop, tools, permissions, hooks, sessions, MCP |
| `src/` | Python | A **parity tracker** that audits porting progress against JSON snapshots of the original TS surface |

The Rust side is the real product — this documentation focuses on it.

## Crate Dependency Graph

```mermaid
graph TD
    CLI["rusty-claude-cli<br/><i>Binary crate — the <code>claw</code> CLI</i>"]
    API["api<br/><i>Anthropic API client, SSE, OAuth</i>"]
    TOOLS["tools<br/><i>Tool specs, executor, agent subloop</i>"]
    COMMANDS["commands<br/><i>Slash command parsing & dispatch</i>"]
    RUNTIME["runtime<br/><i>Core: conversation, session, permissions,<br/>hooks, compaction, config, MCP, prompt</i>"]
    COMPAT["compat-harness<br/><i>Upstream manifest extraction</i>"]

    CLI --> API
    CLI --> TOOLS
    CLI --> COMMANDS
    CLI --> RUNTIME
    CLI --> COMPAT
    TOOLS --> API
    TOOLS --> RUNTIME
    COMMANDS --> RUNTIME
    COMPAT --> COMMANDS
    COMPAT --> TOOLS
    COMPAT --> RUNTIME
    API --> RUNTIME

    style CLI fill:#e8f5e9,stroke:#2e7d32
    style RUNTIME fill:#fff3e0,stroke:#ef6c00
    style API fill:#e3f2fd,stroke:#1565c0
    style TOOLS fill:#fce4ec,stroke:#c62828
    style COMMANDS fill:#f3e5f5,stroke:#7b1fa2
    style COMPAT fill:#f5f5f5,stroke:#616161
```

::: info Key Insight
The `runtime` crate is the foundation — every other crate depends on it. It contains the conversation loop, permission system, hook runner, session persistence, compaction, config loading, MCP utilities, OAuth, prompt building, and more.
:::

## Module Map

Here's a quick reference of what lives where:

### `runtime` (the foundation)

| Module | Responsibility |
|:--|:--|
| `conversation.rs` | `ConversationRuntime` — the agentic loop |
| `permissions.rs` | 5 permission modes + `PermissionPrompter` trait |
| `hooks.rs` | PreToolUse / PostToolUse shell hooks |
| `session.rs` | Session persistence with custom JSON parser |
| `compact.rs` | Auto-compaction algorithm |
| `prompt.rs` | System prompt builder, CLAUDE.md discovery |
| `config.rs` | Runtime config loader (settings.json, hooks, MCP) |
| `mcp.rs` | MCP tool naming, server signatures, CCR proxy |
| `oauth.rs` | PKCE OAuth flow, credential storage |
| `bash.rs` | Bash command execution |
| `file_ops.rs` | Read/write/edit/glob/grep file operations |
| `json.rs` | Custom JSON parser (no serde for sessions) |
| `sandbox.rs` | Sandbox environment support |
| `usage.rs` | Token usage tracking |
| `bootstrap.rs` | Bootstrap/initialization utilities |
| `remote.rs` | Remote session support |
| `mcp_client.rs` | MCP client transports (Stdio, SSE, HTTP, WS, SDK) |
| `mcp_stdio.rs` | MCP stdio process spawning, JSON-RPC, server manager |
| `sse.rs` | Incremental SSE parser (separate from `api` crate's parser) |

### `api` (Anthropic API client)

| Module | Responsibility |
|:--|:--|
| `client.rs` | `AnthropicClient` — auth, retry, streaming |
| `sse.rs` | Hand-rolled SSE parser |
| `types.rs` | Request/response types (Messages API) |
| `error.rs` | API error types with retryability |

### `tools` (tool definitions)

| Module | Responsibility |
|:--|:--|
| `lib.rs` | All tool specs, `execute_tool()` dispatcher, agent subloop |

### `commands` (slash commands)

| Module | Responsibility |
|:--|:--|
| `lib.rs` | 22 slash command definitions, parser, help renderer |

## Data Flow

```mermaid
sequenceDiagram
    participant User
    participant REPL as CLI REPL
    participant Runtime as ConversationRuntime
    participant API as AnthropicClient
    participant Tools as ToolExecutor
    participant Hooks as HookRunner

    User->>REPL: Type message
    REPL->>Runtime: run_turn(input)
    Runtime->>API: stream(request)
    API-->>Runtime: AssistantEvents

    alt Has tool_use blocks
        Runtime->>Runtime: Check permissions
        Runtime->>Hooks: run_pre_tool_use()
        alt Hook allows
            Runtime->>Tools: execute(tool_name, input)
            Tools-->>Runtime: Result
            Runtime->>Hooks: run_post_tool_use()
        else Hook denies (exit 2)
            Hooks-->>Runtime: Denied
        end
        Runtime->>API: stream(with tool_result)
    end

    Runtime->>Runtime: maybe_auto_compact()
    Runtime-->>REPL: TurnSummary
    REPL-->>User: Render response
```

## Next Steps

Dive deeper into each subsystem:

- **[The Agentic Loop](./agentic-loop)** — How `ConversationRuntime` orchestrates the conversation
- **[Tool System](./tools)** — How tools are defined, registered, and executed
- **[Permission Model](./permissions)** — The 5 modes and escalation logic
- **[Hook System](./hooks)** — Shell-based lifecycle hooks
- **[Session & Compaction](./sessions)** — Persistence and context management
- **[API Client](./api-client)** — SSE streaming and retry strategy
