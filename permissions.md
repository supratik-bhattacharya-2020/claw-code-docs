# Permission Model

The permission system controls which tools the agent can use. It has **5 escalating modes** and a pluggable **prompter trait** that allows interactive approval during execution.

## The 5 Permission Modes

```rust
pub enum PermissionMode {
    ReadOnly,           // Can only read files, search, fetch
    WorkspaceWrite,     // Can also write/edit files
    DangerFullAccess,   // Can run bash, REPL, PowerShell
    Prompt,             // Always asks the user
    Allow,              // Allows everything without asking
}
```

The modes form an escalation hierarchy:

```mermaid
graph TD
    subgraph Escalation["Capability Escalation (linear)"]
        direction LR
        RO["ReadOnly"] --> WW["WorkspaceWrite"] --> DFA["DangerFullAccess"]
    end
    subgraph Behavioral["Behavioral Modes (orthogonal)"]
        direction LR
        P["Prompt<br/><i>Always asks user</i>"]
        A["Allow<br/><i>Auto-approves all</i>"]
    end

    style RO fill:#e8f5e9,stroke:#2e7d32,color:#000
    style WW fill:#fff3e0,stroke:#ef6c00,color:#000
    style DFA fill:#ffebee,stroke:#c62828,color:#000
    style P fill:#e3f2fd,stroke:#1565c0,color:#000
    style A fill:#f5f5f5,stroke:#616161,color:#000
```

## Authorization Decision Tree

When a tool is invoked, `PermissionPolicy::authorize()` follows this logic:

```mermaid
flowchart TD
    START["authorize(tool, input)"] --> CHECK_ALLOW{"Allow mode?<br/>OR<br/>mode >= required?"}
    CHECK_ALLOW -- Yes --> ALLOW["✓ Allow"]
    CHECK_ALLOW -- No --> CHECK_PROMPT{"Prompt mode?"}
    CHECK_PROMPT -- Yes --> ASK["Invoke Prompter"]
    CHECK_PROMPT -- No --> CHECK_ESCALATE{"WorkspaceWrite +<br/>tool needs DFA?"}
    CHECK_ESCALATE -- Yes --> ASK
    CHECK_ESCALATE -- No --> DENY["✗ Deny"]
    ASK --> PROMPTER{"Prompter<br/>available?"}
    PROMPTER -- Yes --> DECISION{"User decides"}
    DECISION -- Allow --> ALLOW
    DECISION -- Deny --> DENY2["✗ Deny<br/><i>user reason</i>"]
    PROMPTER -- No --> DENY3["✗ Deny<br/><i>no prompter</i>"]

    style ALLOW fill:#e8f5e9,stroke:#2e7d32,color:#000
    style DENY fill:#ffebee,stroke:#c62828,color:#000
    style DENY2 fill:#ffebee,stroke:#c62828,color:#000
    style DENY3 fill:#ffebee,stroke:#c62828,color:#000
    style ASK fill:#e3f2fd,stroke:#1565c0,color:#000
```

## The PermissionPrompter Trait

```rust
pub trait PermissionPrompter {
    fn decide(&mut self, request: &PermissionRequest) -> PermissionPromptDecision;
}

pub struct PermissionRequest {
    pub tool_name: String,
    pub input: String,
    pub current_mode: PermissionMode,
    pub required_mode: PermissionMode,
}

pub enum PermissionPromptDecision {
    Allow,
    Deny { reason: String },
}
```

The prompter is passed as `Option<&mut dyn PermissionPrompter>`. When the user runs the CLI interactively, the REPL provides a prompter that renders a TUI confirmation dialog. In tests, mock prompters are used.

## Per-Tool Requirements

The `PermissionPolicy` stores per-tool permission requirements:

```rust
let policy = PermissionPolicy::new(PermissionMode::WorkspaceWrite)
    .with_tool_requirement("read_file", PermissionMode::ReadOnly)
    .with_tool_requirement("bash", PermissionMode::DangerFullAccess);
```

If no specific requirement is registered for a tool, it defaults to `DangerFullAccess` — the most restrictive level.

::: tip Default is Restrictive
Unknown tools default to requiring `DangerFullAccess`. This means adding a new tool without registering its permission level makes it require the highest privilege. Safety by default.
:::

## Escalation Scenarios

| Active Mode | Tool Requires | Result |
|:--|:--|:--|
| Allow | Anything | Always allowed |
| DangerFullAccess | DangerFullAccess | Allowed |
| WorkspaceWrite | WorkspaceWrite | Allowed |
| WorkspaceWrite | DangerFullAccess | **Prompts user** (if prompter available) |
| ReadOnly | WorkspaceWrite | Denied outright |
| ReadOnly | DangerFullAccess | Denied outright |
| Prompt | Anything | **Always prompts user** |

::: warning Key Insight
The `WorkspaceWrite → DangerFullAccess` escalation is special. Unlike `ReadOnly`, which just denies, `WorkspaceWrite` mode can prompt for dangerous tools. This lets users run in a "mostly safe" mode while still being able to approve individual bash commands.
:::

## Denied Tool Results

When a tool is denied, the result is recorded as an error `tool_result`:

```rust
PermissionOutcome::Deny { reason } => {
    ConversationMessage::tool_result(tool_use_id, tool_name, reason, true)
}
```

The assistant sees the denial reason and can adjust its approach.
