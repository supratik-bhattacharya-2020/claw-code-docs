// Scenario 1: Full Agent Loop — Bug Fix Session
// Demonstrates the complete agentic loop lifecycle in the Rust runtime:
// user input → system prompt → API stream → tool_use parsing → permission → execute → loop → end_turn
//
// Paths verified against: rust/crates/runtime/src/conversation.rs, permissions.rs, hooks.rs, compact.rs, prompt.rs
//                         rust/crates/tools/src/lib.rs, rust/crates/api/src/client.rs
//                         rust/crates/rusty-claude-cli/src/{main,app,input}.rs
//
// Python parity tracker counterparts noted where relevant: src/runtime.py, src/query_engine.py

window.SCENARIO_FULL_LOOP = {
  title: "Full Agent Loop",
  archNodes: [
    { id: "input",      label: "User Input" },
    { id: "sysprompt",  label: "System Prompt Assembly" },
    { id: "api",        label: "API Request (SSE Stream)" },
    { id: "toolparse",  label: "Tool Use Detection" },
    { id: "permission", label: "Permission Check" },
    { id: "execute",    label: "Tool Execution" },
    { id: "loop",       label: "Agent Loop (re-enter)" },
    { id: "response",   label: "Final Response" },
  ],
  frames: [
    // --- User types a command ---
    {
      type: "output",
      text: "",
      cls: "output",
      delay: 100,
    },
    {
      type: "input",
      text: "> The test in utils.test.ts is failing — can you fix the bug?",
      cls: "user-input",
      delay: 40,
      archStep: "input",
      archInfo: {
        subsystem: "User Input — rustyline REPL",
        file: "rust/crates/rusty-claude-cli/src/input.rs",
        description: "The claw CLI uses rustyline for readline-style input with history and slash-command completion. The text is wrapped as ConversationMessage::user_text() and pushed onto the Session.messages vec.",
      },
    },
    {
      type: "output",
      text: "",
      cls: "output",
      delay: 200,
    },

    // --- System prompt assembly ---
    {
      type: "output",
      text: "● Assembling context…",
      cls: "dim",
      delay: 100,
      archStep: "sysprompt",
      archInfo: {
        subsystem: "System Prompt Builder",
        file: "rust/crates/runtime/src/prompt.rs",
        description: "ProjectContext::discover() walks the directory tree for CLAUDE.md files (project → user → workspace), collects git status/diff, and merges them with tool definitions into a Vec<String> system prompt. Max 4K chars per file, 12K total.",
      },
    },
    {
      type: "output",
      text: "  ├─ Loaded CLAUDE.md (project root)",
      cls: "dim",
      delay: 80,
    },
    {
      type: "output",
      text: "  ├─ Loaded .claude/settings.json",
      cls: "dim",
      delay: 80,
    },
    {
      type: "output",
      text: "  └─ 18 tools registered (from mvp_tool_specs())",
      cls: "dim",
      delay: 80,
    },
    {
      type: "output",
      text: "",
      cls: "output",
      delay: 150,
    },

    // --- API streaming begins ---
    {
      type: "output",
      text: "⏳ Streaming from AnthropicClient…",
      cls: "info",
      delay: 200,
      archStep: "api",
      archInfo: {
        subsystem: "AnthropicClient — SSE Streaming",
        file: "rust/crates/api/src/client.rs + api/src/sse.rs",
        description: "AnthropicClient builds an ApiRequest { system_prompt, messages } and opens an SSE connection. Auth is resolved from ANTHROPIC_API_KEY or saved OAuth credentials. Events arrive as AssistantEvent variants: TextDelta, ToolUse, Usage, MessageStop.",
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
      text: "I'll look at the failing test first to understand what's expected.",
      cls: "streaming",
      delay: 30,
      archStep: "api",
    },
    {
      type: "output",
      text: "",
      cls: "output",
      delay: 200,
    },

    // --- Tool use detected: read_file ---
    {
      type: "output",
      text: "╭──────────────────────────────────────╮",
      cls: "separator",
      delay: 50,
      archStep: "toolparse",
      archInfo: {
        subsystem: "Tool Use Detection — run_turn() loop",
        file: "rust/crates/runtime/src/conversation.rs:200-210",
        description: "build_assistant_message() assembles streamed events into a ConversationMessage. The loop filters ContentBlock::ToolUse { id, name, input } blocks into pending_tool_uses. If the vec is non-empty, the loop continues; if empty, it breaks.",
      },
    },
    {
      type: "output",
      text: "│  read_file  utils.test.ts            │",
      cls: "tool-name",
      delay: 50,
    },
    {
      type: "output",
      text: "╰──────────────────────────────────────╯",
      cls: "separator",
      delay: 50,
    },

    // --- Permission check for read_file ---
    {
      type: "output",
      text: "  ✓ read_file requires ReadOnly (current: WorkspaceWrite ≥ ReadOnly)",
      cls: "success",
      delay: 100,
      archStep: "permission",
      archInfo: {
        subsystem: "PermissionPolicy::authorize()",
        file: "rust/crates/runtime/src/permissions.rs:89-134",
        description: "The policy looks up the tool's required_mode (ReadOnly for read_file, per mvp_tool_specs()). Since active_mode (WorkspaceWrite) >= required_mode (ReadOnly), it returns PermissionOutcome::Allow immediately — no prompter invoked.",
      },
    },

    // --- Execute read_file ---
    {
      type: "output",
      text: "  Reading utils.test.ts…",
      cls: "dim",
      delay: 300,
      archStep: "execute",
      archInfo: {
        subsystem: "execute_tool() → read_file",
        file: "rust/crates/tools/src/lib.rs → runtime/src/file_ops.rs",
        description: "ToolExecutor::execute() dispatches to the read_file handler in runtime/src/file_ops.rs. It reads the file contents and returns them as a String. This becomes a ConversationMessage::tool_result pushed to Session.messages.",
      },
    },
    {
      type: "output",
      text: "  ✓ Read 48 lines",
      cls: "success",
      delay: 100,
    },
    {
      type: "output",
      text: "",
      cls: "output",
      delay: 150,
    },

    // --- Loop back ---
    {
      type: "output",
      text: "↻ pending_tool_uses consumed — looping back to API call…",
      cls: "info",
      delay: 200,
      archStep: "loop",
      archInfo: {
        subsystem: "Agent Loop Re-entry",
        file: "rust/crates/runtime/src/conversation.rs:183-272",
        description: "After all pending tool_uses are processed, the loop returns to the top: iterations += 1, build a new ApiRequest with the updated Session (now including the tool_result), and stream again. This continues until no tool_use blocks appear.",
      },
    },
    {
      type: "output",
      text: "",
      cls: "output",
      delay: 100,
    },

    // --- Second API call ---
    {
      type: "streaming",
      text: "I see the issue. The `formatDate` function returns ISO format but the test expects `YYYY-MM-DD`. Let me fix it.",
      cls: "streaming",
      delay: 25,
      archStep: "api",
      archInfo: {
        subsystem: "AnthropicClient — SSE Streaming (iteration 2)",
        file: "rust/crates/api/src/client.rs",
        description: "Second iteration. The model now has the file contents in the session. It produces TextDelta events (its analysis) followed by a ToolUse event for edit_file.",
      },
    },
    {
      type: "output",
      text: "",
      cls: "output",
      delay: 200,
    },

    // --- Tool use: edit_file ---
    {
      type: "output",
      text: "╭──────────────────────────────────────╮",
      cls: "separator",
      delay: 50,
      archStep: "toolparse",
    },
    {
      type: "output",
      text: "│  edit_file  src/utils.ts:12           │",
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
      text: "  ✓ edit_file requires WorkspaceWrite (current: WorkspaceWrite — match)",
      cls: "success",
      delay: 100,
      archStep: "permission",
      archInfo: {
        subsystem: "PermissionPolicy::authorize()",
        file: "rust/crates/runtime/src/permissions.rs",
        description: "edit_file requires WorkspaceWrite per mvp_tool_specs(). Current mode is WorkspaceWrite — exact match (current >= required). PermissionOutcome::Allow.",
      },
    },
    {
      type: "output",
      text: "  Applied edit to src/utils.ts",
      cls: "success",
      delay: 200,
      archStep: "execute",
      archInfo: {
        subsystem: "execute_tool() → edit_file",
        file: "rust/crates/tools/src/lib.rs → runtime/src/file_ops.rs",
        description: "The edit_file handler in file_ops.rs performs old_string → new_string replacement. It validates uniqueness, writes the file, and returns the diff. Result is pushed as a tool_result message.",
      },
    },
    {
      type: "output",
      text: "   -  return date.toISOString()",
      cls: "error",
      delay: 50,
    },
    {
      type: "output",
      text: "   +  return date.toISOString().split('T')[0]",
      cls: "success",
      delay: 50,
    },
    {
      type: "output",
      text: "",
      cls: "output",
      delay: 200,
    },

    // --- Loop again: run tests ---
    {
      type: "output",
      text: "↻ Looping — iteration 3…",
      cls: "info",
      delay: 150,
      archStep: "loop",
    },
    {
      type: "streaming",
      text: "Now let me run the tests to verify the fix.",
      cls: "streaming",
      delay: 30,
      archStep: "api",
    },
    {
      type: "output",
      text: "",
      cls: "output",
      delay: 200,
    },

    // --- Tool use: bash ---
    {
      type: "output",
      text: "╭──────────────────────────────────────╮",
      cls: "separator",
      delay: 50,
      archStep: "toolparse",
    },
    {
      type: "output",
      text: "│  bash  npm test -- utils.test.ts      │",
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
      text: "  ⚠ bash requires DangerFullAccess (current: WorkspaceWrite < DangerFullAccess)",
      cls: "warning",
      delay: 100,
      archStep: "permission",
      archInfo: {
        subsystem: "PermissionPolicy::authorize() → PermissionPrompter",
        file: "rust/crates/runtime/src/permissions.rs:108-124",
        description: "bash requires DangerFullAccess. Current is WorkspaceWrite. This triggers the special escalation branch: when current == WorkspaceWrite AND required == DangerFullAccess, the prompter is invoked. The CLI's REPL provides an interactive prompter.",
      },
    },
    {
      type: "output",
      text: "  → PermissionPrompter::decide() → Allow",
      cls: "success",
      delay: 200,
    },
    {
      type: "output",
      text: "  Running: npm test -- utils.test.ts",
      cls: "dim",
      delay: 400,
      archStep: "execute",
      archInfo: {
        subsystem: "execute_tool() → bash → execute_bash()",
        file: "rust/crates/tools/src/lib.rs → runtime/src/bash.rs",
        description: "execute_bash() in runtime/src/bash.rs spawns a child process in the project directory. stdout/stderr are captured as a String and returned as the tool_result.",
      },
    },
    {
      type: "output",
      text: "  PASS  utils.test.ts",
      cls: "success",
      delay: 100,
    },
    {
      type: "output",
      text: "    ✓ formatDate returns YYYY-MM-DD (3ms)",
      cls: "success",
      delay: 50,
    },
    {
      type: "output",
      text: "  Tests: 1 passed, 1 total",
      cls: "success",
      delay: 50,
    },
    {
      type: "output",
      text: "",
      cls: "output",
      delay: 200,
    },

    // --- Final response ---
    {
      type: "output",
      text: "↻ Looping — iteration 4…",
      cls: "info",
      delay: 150,
      archStep: "loop",
    },
    {
      type: "streaming",
      text: "Fixed! The bug was in `formatDate` — it returned the full ISO string instead of just the date portion. The test passes now.",
      cls: "streaming",
      delay: 25,
      archStep: "response",
      archInfo: {
        subsystem: "end_turn → maybe_auto_compact() → TurnSummary",
        file: "rust/crates/runtime/src/conversation.rs:214-280",
        description: "No tool_use blocks in the response — pending_tool_uses is empty → loop breaks. maybe_auto_compact() checks if cumulative input tokens exceed the threshold (default 200K, env CLAUDE_CODE_AUTO_COMPACT_INPUT_TOKENS). Returns TurnSummary { assistant_messages, tool_results, iterations, usage, auto_compaction }.",
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
      text: "",
      cls: "output",
      delay: 200,
    },
    {
      type: "output",
      text: "> _",
      cls: "user-input",
      delay: 0,
      archStep: "input",
      archInfo: {
        subsystem: "Awaiting Next Turn",
        file: "rust/crates/rusty-claude-cli/src/input.rs",
        description: "run_turn() returned. The REPL reads the next line from rustyline. The full Session (including all tool_results) persists in memory for the next turn.",
      },
    },
  ],
}
