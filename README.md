<div align="center">

# 🦀 Claw Code — Architecture Docs

**A deep dive into [claw-code](https://github.com/instructkr/claw-code), a clean-room Rust rewrite of Claude Code's agent harness**

*Dissected, diagrammed, and explained*

[![Built with VitePress](https://img.shields.io/badge/Built%20with-VitePress-646cff?style=for-the-badge&logo=vitepress&logoColor=white)](https://vitepress.dev)
[![Rust](https://img.shields.io/badge/Source-Rust-dea584?style=for-the-badge&logo=rust&logoColor=white)](https://github.com/instructkr/claw-code)

</div>

---

## What is this?

An interactive documentation site that reverse-engineers the architecture of **claw-code** — a working CLI agent built in Rust that can converse with the Anthropic API, execute tools, manage sessions, and enforce permissions.

The docs cover **6 Rust crates**, **19 built-in tools**, **3 escalation + 2 behavioral permission modes**, **22 slash commands**, and every major subsystem — all with Mermaid diagrams verified against the source code.

---

## Architecture at a Glance

### Crate Dependency Graph

Six crates, one foundation. Everything depends on `runtime`.

```mermaid
graph TD
    CLI["rusty-claude-cli<br/><i>Binary crate — the claw CLI</i>"]
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

    style CLI fill:#e8f5e9,stroke:#2e7d32,color:#000
    style RUNTIME fill:#fff3e0,stroke:#ef6c00,color:#000
    style API fill:#e3f2fd,stroke:#1565c0,color:#000
    style TOOLS fill:#fce4ec,stroke:#c62828,color:#000
    style COMMANDS fill:#f3e5f5,stroke:#7b1fa2,color:#000
    style COMPAT fill:#f5f5f5,stroke:#616161,color:#000
```

### The Agentic Loop

The heart of the system — `ConversationRuntime::run_turn()` orchestrates user → API → tool → result cycles:

```mermaid
flowchart TD
    A["User sends message"] --> B["Push to session"]
    B --> C["Enter loop"]
    C --> D{"iterations<br/>exceeded?"}
    D -- Yes --> ERR["Error: max iterations"]
    D -- No --> E["Send session to API"]
    E --> F["Parse AssistantEvents"]
    F --> G["Record usage"]
    G --> H["Push assistant msg"]
    H --> I{"tool_use<br/>blocks?"}
    I -- No --> J["Break loop"]
    I -- Yes --> K["For each tool_use"]
    K --> L{"Permission<br/>granted?"}
    L -- Deny --> N["Record denial"]
    L -- Allow --> O["PreToolUse hook"]
    O --> P{"Hook<br/>denied?"}
    P -- Yes --> Q["Record hook denial"]
    P -- No --> R["Execute tool"]
    R --> S["PostToolUse hook"]
    S --> T["Merge hook feedback"]
    T --> U["Push tool_result"]
    N --> U
    Q --> U
    U --> C
    J --> V["maybe_auto_compact()"]
    V --> W["Return TurnSummary"]

    style A fill:#e8f5e9,stroke:#2e7d32,color:#000
    style W fill:#e8f5e9,stroke:#2e7d32,color:#000
    style ERR fill:#ffebee,stroke:#c62828,color:#000
```

### 19 Tools Across 3 Permission Tiers

Every tool is gated by a permission level — from read-only file access to full shell execution:

```mermaid
graph TD
    subgraph RO["ReadOnly"]
        read_file
        glob_search
        grep_search
        WebFetch
        WebSearch
        Skill
        ToolSearch
        Sleep
        SendUserMessage
        StructuredOutput
    end

    subgraph WW["WorkspaceWrite"]
        write_file
        edit_file
        TodoWrite
        NotebookEdit
        Config
    end

    subgraph DFA["DangerFullAccess"]
        bash
        Agent
        REPL
        PowerShell
    end

    style RO fill:#e8f5e9,stroke:#2e7d32,color:#000
    style WW fill:#fff3e0,stroke:#ef6c00,color:#000
    style DFA fill:#ffebee,stroke:#c62828,color:#000
```

### Data Flow

From user input to rendered response — the full request lifecycle:

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

---

## What's Inside

| Page | What You'll Learn |
|:-----|:------------------|
| [Architecture Overview](architecture.md) | Crate map, module index, data flow |
| [The Agentic Loop](agentic-loop.md) | `ConversationRuntime`, `run_turn()`, event types |
| [Tool System](tools.md) | 19 tools, `ToolExecutor` trait, agent sub-loops |
| [Permission Model](permissions.md) | 3 escalation + 2 behavioral modes, authorization logic |
| [Hook System](hooks.md) | PreToolUse/PostToolUse lifecycle, exit codes |
| [Session & Compaction](sessions.md) | Persistence, auto-compaction, token estimation |
| [API Client](api-client.md) | OAuth PKCE, SSE streaming, retry strategy |
| [System Prompt](system-prompt.md) | Prompt assembly, CLAUDE.md discovery |
| [MCP Integration](mcp.md) | Server transports, tool namespacing, FNV-1a |
| [CLI & Commands](cli.md) | 22 slash commands, REPL loop |
| [Trivia](trivia.md) | Fun facts and Easter eggs from the source |

---

## Fun Facts

- **♾️ Infinite by default** — `max_iterations` is `usize::MAX` (18.4 quintillion). The agent could loop for 584 billion years.
- **🚫 Zero `unsafe`** — The entire workspace has `unsafe_code = "forbid"`. Pure safe Rust.
- **🔧 No dependencies for basics** — Hand-rolled SSE parser, JSON parser, base64url encoder, percent encoder. No serde for sessions.
- **📏 Token estimation** — `text.len() / 4 + 1`. No tokenizer needed.
- **🔑 Exit code 2 = Deny** — Hooks use Unix convention: 0 = allow, 2 = deny, anything else = warn but continue.

---

## Interactive Terminal Replay

An interactive sandbox that simulates real Claude Code sessions while highlighting the architecture under the hood:

<div align="center">
<img src="sandbox/demo.gif" alt="Terminal Replay Demo — showing the Full Agent Loop, Permission Escalation, and Multi-Tool scenarios" width="800" />
</div>

Three scenarios with verified source paths:
- **Full Agent Loop** — input → prompt → API → `read_file` → `edit_file` → `bash` (permission escalation) → `end_turn`
- **Permission Escalation** — `WorkspaceWrite` < `DangerFullAccess` → `PermissionPrompter::decide()` → `PreToolUse` hook → `execute_bash()`
- **Multi-Tool** — hook denial (exit 2), auto-compaction (`compact.rs`, local summarization), `Agent` tool sub-task

Open [`sandbox/index.html`](sandbox/index.html) in any browser to try it — no build step needed.

---

## Local Development

```bash
npm install
npx vitepress dev     # http://localhost:5173
npx vitepress build   # Static output → .vitepress/dist/
```

---

<div align="center">
<sub>Built by studying the <a href="https://github.com/instructkr/claw-code">instructkr/claw-code</a> source code</sub>
</div>
