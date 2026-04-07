// Scenario 2: Permission Escalation
// Demonstrates what happens when WorkspaceWrite mode encounters a bash tool requiring DangerFullAccess.
//
// Verified against: rust/crates/runtime/src/permissions.rs (PermissionPolicy::authorize, lines 89-134)
//                   rust/crates/runtime/src/hooks.rs (HookRunner, exit code semantics)
//                   rust/crates/runtime/src/conversation.rs (run_turn tool execution pipeline)
//                   rust/crates/tools/src/lib.rs (bash → DangerFullAccess)

window.SCENARIO_PERMISSION = {
  title: "Permission Escalation",
  archNodes: [
    { id: "tooluse",    label: "ToolUse Event Parsed" },
    { id: "policy",     label: "PermissionPolicy::authorize()" },
    { id: "escalation", label: "WorkspaceWrite < DangerFullAccess" },
    { id: "prompter",   label: "PermissionPrompter::decide()" },
    { id: "tui",        label: "CLI Confirmation Prompt" },
    { id: "approve",    label: "PermissionPromptDecision::Allow" },
    { id: "hook",       label: "HookRunner::run_pre_tool_use()" },
    { id: "execute",    label: "execute_bash()" },
  ],
  frames: [
    // Context
    {
      type: "output",
      text: "Mode: WorkspaceWrite  │  Model: claude-sonnet-4-20250514",
      cls: "dim",
      delay: 100,
      archStep: null,
    },
    {
      type: "output",
      text: "",
      cls: "output",
      delay: 200,
    },
    {
      type: "streaming",
      text: "I need to install the missing dependency to fix the import error.",
      cls: "streaming",
      delay: 30,
      archStep: "tooluse",
      archInfo: {
        subsystem: "AssistantEvent::ToolUse parsed",
        file: "rust/crates/runtime/src/conversation.rs:200-209",
        description: "The streamed AssistantEvents include ToolUse { name: \"bash\", input: \"{\\\"command\\\": \\\"npm install lodash\\\"}\" }. build_assistant_message() assembles them into a ConversationMessage. The loop collects pending_tool_uses from ContentBlock::ToolUse variants.",
      },
    },
    {
      type: "output",
      text: "",
      cls: "output",
      delay: 200,
    },

    // Tool use box
    {
      type: "output",
      text: "╭──────────────────────────────────────╮",
      cls: "separator",
      delay: 50,
    },
    {
      type: "output",
      text: "│  bash  npm install lodash             │",
      cls: "tool-name",
      delay: 50,
    },
    {
      type: "output",
      text: "╰──────────────────────────────────────╯",
      cls: "separator",
      delay: 50,
    },
    {
      type: "output",
      text: "",
      cls: "output",
      delay: 200,
    },

    // Policy check
    {
      type: "output",
      text: "⚙ PermissionPolicy::authorize(\"bash\", input, prompter)",
      cls: "info",
      delay: 200,
      archStep: "policy",
      archInfo: {
        subsystem: "PermissionPolicy::authorize()",
        file: "rust/crates/runtime/src/permissions.rs:89-98",
        description: "The policy calls required_mode_for(\"bash\"), which looks up tool_requirements. In mvp_tool_specs(), bash has required_permission: DangerFullAccess. First check: current_mode == Allow? No. current_mode >= required_mode? WorkspaceWrite >= DangerFullAccess? No. Falls through.",
      },
    },
    {
      type: "output",
      text: "  Tool: bash",
      cls: "dim",
      delay: 80,
    },
    {
      type: "output",
      text: "  Required: DangerFullAccess (from mvp_tool_specs)",
      cls: "dim",
      delay: 80,
    },
    {
      type: "output",
      text: "  Current:  WorkspaceWrite",
      cls: "dim",
      delay: 80,
    },
    {
      type: "output",
      text: "",
      cls: "output",
      delay: 100,
    },

    // Escalation detected
    {
      type: "output",
      text: "⚠ Escalation branch: WorkspaceWrite + DangerFullAccess → invoke prompter",
      cls: "warning",
      delay: 200,
      archStep: "escalation",
      archInfo: {
        subsystem: "Escalation Branch (permissions.rs:108-111)",
        file: "rust/crates/runtime/src/permissions.rs",
        description: "The code checks: current_mode == Prompt OR (current_mode == WorkspaceWrite AND required_mode == DangerFullAccess). This second condition is true — so it falls into the prompter invocation branch instead of an outright deny.",
      },
    },
    {
      type: "output",
      text: "",
      cls: "output",
      delay: 200,
    },

    // Prompter
    {
      type: "output",
      text: "⚙ Calling prompter.decide(PermissionRequest { … })",
      cls: "info",
      delay: 150,
      archStep: "prompter",
      archInfo: {
        subsystem: "PermissionPrompter trait",
        file: "rust/crates/runtime/src/permissions.rs:39-41",
        description: "PermissionPrompter::decide(&mut self, request: &PermissionRequest) → PermissionPromptDecision. The request contains { tool_name, input, current_mode, required_mode }. If no prompter is available (None), the tool is denied with a descriptive reason.",
      },
    },
    {
      type: "output",
      text: "",
      cls: "output",
      delay: 100,
    },

    // CLI confirmation dialog
    {
      type: "output",
      text: "┌─────────────────────────────────────────┐",
      cls: "permission",
      delay: 50,
      archStep: "tui",
      archInfo: {
        subsystem: "CLI Confirmation Prompt",
        file: "rust/crates/rusty-claude-cli/src/main.rs",
        description: "The CLI's prompter implementation renders a confirmation in the terminal. It shows the tool name, command, and the permission gap. The user can allow once, allow for session, or deny. Uses rustyline for input, not a TUI framework.",
      },
    },
    {
      type: "output",
      text: "│  Claude wants to run:                   │",
      cls: "permission",
      delay: 50,
    },
    {
      type: "output",
      text: "│                                         │",
      cls: "permission",
      delay: 30,
    },
    {
      type: "output",
      text: "│    npm install lodash                   │",
      cls: "highlight",
      delay: 50,
    },
    {
      type: "output",
      text: "│                                         │",
      cls: "permission",
      delay: 30,
    },
    {
      type: "output",
      text: "│  (y) Allow once                         │",
      cls: "permission",
      delay: 50,
    },
    {
      type: "output",
      text: "│  (a) Allow for this session             │",
      cls: "permission",
      delay: 50,
    },
    {
      type: "output",
      text: "│  (n) Deny                               │",
      cls: "permission",
      delay: 50,
    },
    {
      type: "output",
      text: "└─────────────────────────────────────────┘",
      cls: "permission",
      delay: 50,
    },
    {
      type: "output",
      text: "",
      cls: "output",
      delay: 600,
    },

    // User approves
    {
      type: "output",
      text: "→ PermissionPromptDecision::Allow",
      cls: "permission-approve",
      delay: 200,
      archStep: "approve",
      archInfo: {
        subsystem: "Prompter Decision",
        file: "rust/crates/runtime/src/permissions.rs:113-115",
        description: "The prompter returns PermissionPromptDecision::Allow. The authorize() method maps this to PermissionOutcome::Allow. If Deny { reason } were returned, it would become PermissionOutcome::Deny and the tool_result would contain the denial message.",
      },
    },
    {
      type: "output",
      text: "",
      cls: "output",
      delay: 200,
    },

    // PreToolUse hook
    {
      type: "output",
      text: "⚙ HookRunner::run_pre_tool_use(\"bash\", input)",
      cls: "info",
      delay: 150,
      archStep: "hook",
      archInfo: {
        subsystem: "PreToolUse Hook Execution",
        file: "rust/crates/runtime/src/hooks.rs:66-75",
        description: "After permission is granted, HookRunner spawns each configured PreToolUse command. Env vars: HOOK_EVENT=PreToolUse, HOOK_TOOL_NAME=bash, HOOK_TOOL_INPUT=<json>. JSON payload piped to stdin. Exit 0 = Allow, exit 2 = Deny (stdout = denial msg), any other = Warn.",
      },
    },
    {
      type: "output",
      text: "  Hook: safety-check.sh → exit 0 (Allow)",
      cls: "success",
      delay: 200,
    },
    {
      type: "output",
      text: "",
      cls: "output",
      delay: 200,
    },

    // Execution
    {
      type: "output",
      text: "  Running: npm install lodash",
      cls: "dim",
      delay: 300,
      archStep: "execute",
      archInfo: {
        subsystem: "execute_bash()",
        file: "rust/crates/runtime/src/bash.rs",
        description: "Permission granted, PreToolUse hook passed. execute_bash() spawns the child process, captures stdout/stderr. The output becomes the tool_result. PostToolUse hooks then run (can append feedback or deny).",
      },
    },
    {
      type: "output",
      text: "  added 1 package in 2.3s",
      cls: "output",
      delay: 200,
    },
    {
      type: "output",
      text: "  ✓ bash completed (exit 0)",
      cls: "success",
      delay: 100,
    },
    {
      type: "output",
      text: "",
      cls: "output",
      delay: 200,
    },
    {
      type: "output",
      text: "",
      cls: "output",
      delay: 200,
    },
    {
      type: "output",
      text: "> _",
      cls: "user-input",
      delay: 0,
    },
  ],
}
