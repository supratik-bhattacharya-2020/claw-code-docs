// Scenario 3: Multi-Tool Scenarios
// Three short clips demonstrating:
//   (a) PreToolUse hook denies rm -rf via exit code 2
//   (b) Auto-compaction triggers after cumulative tokens exceed threshold
//   (c) Agent tool spawns a sub-task
//
// Verified against: rust/crates/runtime/src/hooks.rs (exit code 0/2/other semantics)
//                   rust/crates/runtime/src/compact.rs (local summarization, NOT LLM-based)
//                   rust/crates/runtime/src/conversation.rs (maybe_auto_compact, run_turn loop)
//                   rust/crates/tools/src/lib.rs (Agent tool spec: DangerFullAccess)
//
// Python counterparts: src/query_engine.py (compact_messages_if_needed)
//                      src/permissions.py (ToolPermissionContext deny lists)

window.SCENARIO_MULTI_TOOL = {
  title: "Multi-Tool Scenarios",
  archNodes: [
    { id: "hook",       label: "PreToolUse Hook" },
    { id: "deny",       label: "Hook Denial (exit 2)" },
    { id: "compact",    label: "Token Threshold Check" },
    { id: "truncate",   label: "compact_session()" },
    { id: "agent",      label: "Agent Tool Invoked" },
    { id: "subruntime", label: "Agent Sub-task" },
    { id: "result",     label: "Agent Returns" },
    { id: "resume",     label: "Parent Resumes" },
  ],
  frames: [
    // ===== CLIP A: Hook Denial =====
    {
      type: "output",
      text: "━━━ Clip A: Hook Denial ━━━━━━━━━━━━━━━━━━━━━",
      cls: "info",
      delay: 200,
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
      text: "Let me clean up the temp files.",
      cls: "streaming",
      delay: 30,
      archStep: "hook",
      archInfo: {
        subsystem: "HookRunner::run_pre_tool_use()",
        file: "rust/crates/runtime/src/hooks.rs:66-75",
        description: "The model requests bash with 'rm -rf /tmp/build-*'. After PermissionOutcome::Allow, HookRunner spawns each configured PreToolUse command. It pipes a JSON payload to stdin and sets HOOK_EVENT, HOOK_TOOL_NAME, HOOK_TOOL_INPUT as env vars.",
      },
    },
    {
      type: "output",
      text: "",
      cls: "output",
      delay: 100,
    },
    {
      type: "output",
      text: "╭──────────────────────────────────────╮",
      cls: "separator",
      delay: 50,
    },
    {
      type: "output",
      text: "│  bash  rm -rf /tmp/build-*            │",
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
      delay: 100,
    },
    {
      type: "output",
      text: "⚙ HookRunner: spawning safety-guard.sh",
      cls: "info",
      delay: 200,
    },
    {
      type: "output",
      text: "  Pattern match: rm -rf → exit code 2",
      cls: "error",
      delay: 200,
      archStep: "deny",
      archInfo: {
        subsystem: "Hook Exit Code 2 → Deny",
        file: "rust/crates/runtime/src/hooks.rs:179-181",
        description: "Exit code semantics: 0 = HookCommandOutcome::Allow (stdout is optional feedback), 2 = HookCommandOutcome::Deny (stdout becomes the denial message), any other code = HookCommandOutcome::Warn (tool proceeds, warning logged). Signal termination = Warn.",
      },
    },
    {
      type: "output",
      text: "  HookCommandOutcome::Deny { message: \"rm -rf blocked\" }",
      cls: "error",
      delay: 100,
    },
    {
      type: "output",
      text: "  ✗ Tool blocked — denial injected as tool_result(is_error=true)",
      cls: "error",
      delay: 100,
    },
    {
      type: "output",
      text: "",
      cls: "output",
      delay: 100,
    },
    {
      type: "streaming",
      text: "The `rm -rf` command was blocked by a safety hook. Let me use a safer approach instead.",
      cls: "streaming",
      delay: 30,
    },
    {
      type: "output",
      text: "",
      cls: "output",
      delay: 400,
    },

    // ===== CLIP B: Auto-Compaction =====
    {
      type: "output",
      text: "━━━ Clip B: Auto-Compaction ━━━━━━━━━━━━━━━━━",
      cls: "info",
      delay: 200,
      archStep: null,
    },
    {
      type: "output",
      text: "",
      cls: "output",
      delay: 200,
    },
    {
      type: "output",
      text: "● Turn ends — checking maybe_auto_compact()…",
      cls: "dim",
      delay: 100,
      archStep: "compact",
      archInfo: {
        subsystem: "maybe_auto_compact() threshold check",
        file: "rust/crates/runtime/src/conversation.rs:13-14, 274",
        description: "After the agent loop breaks (no more tool_use), maybe_auto_compact() runs. It checks if cumulative input tokens (from UsageTracker) exceed auto_compaction_input_tokens_threshold — default 200,000, configurable via CLAUDE_CODE_AUTO_COMPACT_INPUT_TOKENS env var.",
      },
    },
    {
      type: "output",
      text: "  Cumulative input tokens: 214,832",
      cls: "dim",
      delay: 80,
    },
    {
      type: "output",
      text: "  Threshold: 200,000 (DEFAULT_AUTO_COMPACTION_INPUT_TOKENS_THRESHOLD)",
      cls: "dim",
      delay: 80,
    },
    {
      type: "output",
      text: "  ⚠ 214,832 > 200,000 — compaction triggered",
      cls: "warning",
      delay: 200,
    },
    {
      type: "output",
      text: "",
      cls: "output",
      delay: 100,
    },
    {
      type: "output",
      text: "⚙ compact_session(session, CompactionConfig { … })",
      cls: "info",
      delay: 200,
      archStep: "truncate",
      archInfo: {
        subsystem: "compact_session() — LOCAL summarization",
        file: "rust/crates/runtime/src/compact.rs:75-111",
        description: "Compaction is LOCAL — no LLM call. It keeps the last N messages (default: preserve_recent_messages=4). Older messages are summarized by summarize_messages(): counts user/assistant/tool messages, collects tool names, extracts recent user requests, infers pending work and key files. The summary is wrapped in a System message via get_compact_continuation_message().",
      },
    },
    {
      type: "output",
      text: "  preserve_recent_messages: 4",
      cls: "dim",
      delay: 80,
    },
    {
      type: "output",
      text: "  Removing 38 older messages…",
      cls: "dim",
      delay: 200,
    },
    {
      type: "output",
      text: "  summarize_messages(): user=12, assistant=14, tool=12",
      cls: "dim",
      delay: 100,
    },
    {
      type: "output",
      text: "  Tools mentioned: bash, edit_file, grep_search, read_file",
      cls: "dim",
      delay: 100,
    },
    {
      type: "output",
      text: "  ✓ CompactionResult { removed_message_count: 38 }",
      cls: "success",
      delay: 200,
    },
    {
      type: "output",
      text: "",
      cls: "output",
      delay: 100,
    },
    {
      type: "output",
      text: "  Python parity: src/query_engine.py also has compact_messages_if_needed()",
      cls: "dim",
      delay: 100,
    },
    {
      type: "output",
      text: "  (keeps last N entries, simpler than Rust version)",
      cls: "dim",
      delay: 100,
    },
    {
      type: "output",
      text: "",
      cls: "output",
      delay: 400,
    },

    // ===== CLIP C: Agent Tool =====
    {
      type: "output",
      text: "━━━ Clip C: Agent Tool ━━━━━━━━━━━━━━━━━━━━━━",
      cls: "info",
      delay: 200,
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
      text: "I need to research how the auth module works. Let me dispatch an agent for that.",
      cls: "streaming",
      delay: 30,
      archStep: "agent",
      archInfo: {
        subsystem: "Agent tool (DangerFullAccess)",
        file: "rust/crates/tools/src/lib.rs:243-258",
        description: "The Agent tool is defined in mvp_tool_specs() with required_permission: DangerFullAccess. Its input_schema takes { description, prompt, subagent_type?, name?, model? }. The tool launches a specialized sub-task and persists handoff metadata.",
      },
    },
    {
      type: "output",
      text: "",
      cls: "output",
      delay: 100,
    },
    {
      type: "output",
      text: "╭──────────────────────────────────────╮",
      cls: "separator",
      delay: 50,
    },
    {
      type: "output",
      text: "│  Agent  \"Explore auth module\"         │",
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
      delay: 100,
    },
    {
      type: "output",
      text: "  ⚙ Launching sub-task…",
      cls: "info",
      delay: 200,
      archStep: "subruntime",
      archInfo: {
        subsystem: "Agent Sub-task Execution",
        file: "rust/crates/tools/src/lib.rs (execute_tool dispatcher)",
        description: "The tools crate dispatches the Agent tool. In the original TS codebase, this was tools/AgentTool/forkSubagent.ts which spawns a child ConversationRuntime. The Rust MVP implements agent execution through the tool executor with handoff metadata persistence.",
      },
    },
    {
      type: "output",
      text: "  │ Sub-task: reading src/auth/index.ts…",
      cls: "dim",
      delay: 200,
    },
    {
      type: "output",
      text: "  │ Sub-task: grep_search 'validateToken'…",
      cls: "dim",
      delay: 200,
    },
    {
      type: "output",
      text: "  │ Sub-task: reading src/auth/jwt.ts…",
      cls: "dim",
      delay: 200,
    },
    {
      type: "output",
      text: "  │ Sub-task: found 3 relevant files",
      cls: "dim",
      delay: 100,
    },
    {
      type: "output",
      text: "",
      cls: "output",
      delay: 100,
    },
    {
      type: "output",
      text: "  ✓ Agent completed (4 tool calls)",
      cls: "success",
      delay: 200,
      archStep: "result",
      archInfo: {
        subsystem: "Agent Result → tool_result",
        file: "rust/crates/runtime/src/conversation.rs:238-242",
        description: "The tool executor returns Ok(output) — the agent's findings as a String. This is assembled into a ConversationMessage::tool_result and pushed onto Session.messages. The parent run_turn() loop continues.",
      },
    },
    {
      type: "output",
      text: "",
      cls: "output",
      delay: 200,
    },
    {
      type: "output",
      text: "↻ Parent loop: next iteration with agent findings in session…",
      cls: "info",
      delay: 200,
      archStep: "resume",
      archInfo: {
        subsystem: "Parent Loop Resumes",
        file: "rust/crates/runtime/src/conversation.rs:183",
        description: "The parent run_turn() loop continues from the top. The session now includes the agent's tool_result. The next API call will have these findings in context for the model to synthesize.",
      },
    },
    {
      type: "output",
      text: "",
      cls: "output",
      delay: 100,
    },
    {
      type: "streaming",
      text: "Based on the agent's findings, the auth module uses JWT with RSA-256 signing. Token validation happens in src/auth/jwt.ts.",
      cls: "streaming",
      delay: 25,
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
