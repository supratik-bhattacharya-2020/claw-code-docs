<template>
  <div class="stepper-container">
    <div class="stepper-header">
      <div class="step-counter">{{ currentStep + 1 }} / {{ steps.length }}</div>
      <div class="playback-controls">
        <button
          v-for="speed in [0.5, 1, 2]"
          :key="speed"
          :class="['speed-btn', { active: playbackSpeed === speed && isPlaying }]"
          @click="setSpeed(speed)"
        >
          {{ speed }}x
        </button>
        <button class="play-btn" @click="togglePlay">
          {{ isPlaying ? '⏸' : '▶' }}
        </button>
      </div>
    </div>

    <div class="progress-bar">
      <div
        v-for="(step, i) in steps"
        :key="i"
        :class="['progress-dot', { active: i === currentStep, done: i < currentStep }]"
        @click="goTo(i)"
      >
        <span class="dot-label">{{ step.short }}</span>
      </div>
    </div>

    <Transition name="step" mode="out-in">
      <div class="step-content" :key="currentStep">
        <div class="step-title-row">
          <span class="step-number">{{ String(currentStep + 1).padStart(2, '0') }}</span>
          <h3 class="step-title">{{ steps[currentStep].title }}</h3>
        </div>
        <p class="step-source">
          <code>{{ steps[currentStep].source }}</code>
        </p>
        <p class="step-description">{{ steps[currentStep].description }}</p>
        <div class="step-code" v-if="steps[currentStep].code">
          <div class="code-header">{{ steps[currentStep].codeLabel || 'Rust' }}</div>
          <pre><code>{{ steps[currentStep].code }}</code></pre>
        </div>
        <div class="step-detail" v-if="steps[currentStep].detail">
          <span class="detail-icon">💡</span>
          <span>{{ steps[currentStep].detail }}</span>
        </div>
      </div>
    </Transition>

    <div class="stepper-nav">
      <button class="nav-btn" :disabled="currentStep === 0" @click="prev">
        ← Previous
      </button>
      <button class="nav-btn" :disabled="currentStep === steps.length - 1" @click="next">
        Next →
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onUnmounted } from 'vue'

const currentStep = ref(0)
const isPlaying = ref(false)
const playbackSpeed = ref(1)
let timer = null

const steps = [
  {
    short: 'Input',
    title: 'User Input Capture',
    source: 'rusty-claude-cli/src/main.rs',
    description: 'The user types a message into the REPL or pipes input through stdin. The CLI binary captures the input and prepares it for the agentic loop.',
    code: `fn main() {\n    let input = read_user_input(); // REPL or stdin\n    let runtime = build_runtime(api_client, tool_executor);\n    let summary = runtime.run_turn(&input)?;\n}`,
    detail: 'In non-interactive mode (piped stdin), the CLI reads the entire input at once and runs a single turn.',
  },
  {
    short: 'Message',
    title: 'Build User Message',
    source: 'runtime/src/conversation.rs → run_turn()',
    description: 'The input string is wrapped into a ConversationMessage with role "user" and a single Text content block, then pushed onto the session\'s message list.',
    code: `let user_msg = ConversationMessage::user_text(input);\nself.session.messages.push(user_msg);`,
    detail: 'Every message in the session carries a role (User, Assistant, Tool) and a Vec<ContentBlock>.',
  },
  {
    short: 'History',
    title: 'Load Session History',
    source: 'runtime/src/session.rs',
    description: 'The full conversation history — all prior user messages, assistant responses, and tool results — is already in memory as part of the Session struct. The entire history will be sent to the API.',
    code: `pub struct Session {\n    pub version: u32,              // Always 1\n    pub messages: Vec<ConversationMessage>,\n}`,
    detail: 'Sessions can be persisted to disk as JSON and resumed later with the /resume command.',
  },
  {
    short: 'System',
    title: 'System Prompt Assembly',
    source: 'runtime/src/prompt.rs → SystemPromptBuilder::build()',
    description: 'The system prompt is assembled from static sections (agent instructions, tool permissions, task guidelines) plus dynamic sections (environment context, CLAUDE.md files, git status, runtime config). A boundary marker separates cacheable from per-session content.',
    code: `sections.push(get_simple_intro_section());\nsections.push(get_simple_system_section());\nsections.push(get_simple_doing_tasks_section());\nsections.push(get_actions_section());\nsections.push(SYSTEM_PROMPT_DYNAMIC_BOUNDARY);\nsections.push(self.environment_section());\n// + project context, CLAUDE.md files, config`,
    detail: 'CLAUDE.md files are discovered by walking up from CWD to root, with a 4,000 char/file and 12,000 char total budget.',
  },
  {
    short: 'API',
    title: 'Stream API Request',
    source: 'api/src/client.rs → AnthropicClient::stream()',
    description: 'The system prompt, full message history, and tool definitions are sent to the Anthropic Messages API. The response streams back as Server-Sent Events, parsed by a hand-rolled SSE parser.',
    code: `let request = ApiRequest {\n    system_prompt: self.system_prompt.clone(),\n    messages: self.session.messages.clone(),\n};\nlet events = self.api_client.stream(request)?;`,
    detail: 'Retries up to 2 times with exponential backoff (200ms, 400ms) on status codes 408, 409, 429, 500, 502, 503, 504.',
  },
  {
    short: 'Tokens',
    title: 'Track Token Usage',
    source: 'runtime/src/usage.rs',
    description: 'The Usage event from the API response carries input_tokens, output_tokens, and cache metrics. These are accumulated in the UsageTracker for the auto-compaction threshold check.',
    code: `AssistantEvent::Usage(usage) => {\n    self.usage_tracker.record(usage);\n}`,
    detail: 'Auto-compaction triggers when cumulative input tokens exceed 200,000 (configurable via CLAUDE_CODE_AUTO_COMPACT_INPUT_TOKENS).',
  },
  {
    short: 'Tools?',
    title: 'Check for Tool Use',
    source: 'runtime/src/conversation.rs → run_turn()',
    description: 'The assistant message is scanned for tool_use content blocks. If there are none, the loop breaks — the assistant\'s text response is the final answer. If there are tool_use blocks, each one needs to be executed.',
    code: `let tool_uses: Vec<_> = assistant_msg.blocks.iter()\n    .filter(|b| matches!(b, ContentBlock::ToolUse { .. }))\n    .collect();\nif tool_uses.is_empty() {\n    break; // Done — no tools requested\n}`,
    detail: 'This is the key decision point: tool_use blocks mean the loop continues, no tool_use means we\'re done.',
  },
  {
    short: 'Permit',
    title: 'Permission Check',
    source: 'runtime/src/permissions.rs → PermissionPolicy::authorize()',
    description: 'Each tool_use is checked against the active permission mode. Allow mode auto-approves everything. If the mode >= the tool\'s required level, it\'s allowed. WorkspaceWrite can prompt for DangerFullAccess tools. ReadOnly denies writes outright.',
    code: `if current_mode == PermissionMode::Allow\n    || current_mode >= required_mode {\n    return PermissionOutcome::Allow;\n}`,
    detail: 'Unknown tools default to requiring DangerFullAccess — safety by default.',
  },
  {
    short: 'Hooks',
    title: 'PreToolUse Hook',
    source: 'runtime/src/hooks.rs → HookRunner',
    description: 'Before executing the tool, registered PreToolUse hooks run as shell commands. They receive the tool name and input as environment variables and JSON on stdin. Exit code 0 allows, exit code 2 denies, anything else warns but allows.',
    code: `// Unix:  sh -lc "hook_command"\n// Windows: cmd /C "hook_command"\n// Env: HOOK_EVENT, HOOK_TOOL_NAME, HOOK_TOOL_INPUT`,
    codeLabel: 'Shell',
    detail: 'A hook that crashes (exit 1) only produces a warning — only explicit exit 2 blocks the tool.',
  },
  {
    short: 'Execute',
    title: 'Tool Execution',
    source: 'tools/src/lib.rs → execute_tool()',
    description: 'The tool executor dispatches to the appropriate handler — bash runs a shell command, read_file reads from disk, Agent spawns an entire sub-ConversationRuntime. The result (or error) is captured as a string.',
    code: `match tool_name {\n    "bash" => execute_bash(input),\n    "read_file" => read_file(input),\n    "Agent" => {\n        let sub_runtime = build_agent_runtime();\n        sub_runtime.run_turn(agent_prompt)\n    }\n    // ... 19 tools total\n}`,
    detail: 'The Agent tool is recursive — it creates a new ConversationRuntime, enabling sub-agents with their own sessions.',
  },
  {
    short: 'Result',
    title: 'Record Tool Result & Loop',
    source: 'runtime/src/conversation.rs',
    description: 'The tool output is wrapped as a tool_result ContentBlock and pushed to the session. PostToolUse hooks run, potentially appending feedback. Then the loop returns to the API call step — sending the updated session (now including the tool result) back to the model.',
    code: `let result_msg = ConversationMessage::tool_result(\n    tool_use_id, tool_name, output, is_error\n);\nself.session.messages.push(result_msg);\n// Loop back to API call`,
    detail: 'The loop continues until the assistant responds without any tool_use blocks.',
  },
  {
    short: 'Compact',
    title: 'Auto-Compaction Check',
    source: 'runtime/src/compact.rs → compact_session()',
    description: 'After the loop ends, maybe_auto_compact() checks if cumulative input tokens exceed the threshold. If so, older messages are summarized (extracting tool names, pending work, key files) and replaced with a compact continuation message.',
    code: `fn maybe_auto_compact(&mut self) {\n    if self.usage_tracker.cumulative_usage().input_tokens\n        < self.auto_compaction_input_tokens_threshold {\n        return None;\n    }\n    compact_session(&self.session, config)\n}`,
    detail: 'Token estimation uses text.len() / 4 + 1 — no tokenizer dependency.',
  },
  {
    short: 'Return',
    title: 'Return TurnSummary',
    source: 'runtime/src/conversation.rs',
    description: 'The completed turn returns a TurnSummary containing all assistant messages, tool results, iteration count, token usage, and whether auto-compaction occurred. The CLI REPL renders the response to the terminal.',
    code: `TurnSummary {\n    assistant_messages,\n    tool_results,\n    iterations,\n    usage,\n    auto_compaction,\n}`,
    detail: 'The REPL then awaits the next user input, and the cycle begins again.',
  },
]

function next() {
  if (currentStep.value < steps.length - 1) currentStep.value++
}

function prev() {
  if (currentStep.value > 0) currentStep.value--
}

function goTo(i) {
  currentStep.value = i
  stopPlay()
}

function setSpeed(speed) {
  playbackSpeed.value = speed
  if (isPlaying.value) {
    stopPlay()
    startPlay()
  }
}

function togglePlay() {
  isPlaying.value ? stopPlay() : startPlay()
}

function startPlay() {
  isPlaying.value = true
  timer = setInterval(() => {
    if (currentStep.value < steps.length - 1) {
      currentStep.value++
    } else {
      stopPlay()
    }
  }, 3000 / playbackSpeed.value)
}

function stopPlay() {
  isPlaying.value = false
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

onUnmounted(() => stopPlay())
</script>

<style scoped>
.stepper-container {
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  padding: 24px;
  margin: 24px 0;
  background: var(--vp-c-bg-soft);
}

.stepper-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.step-counter {
  font-size: 14px;
  font-weight: 600;
  color: var(--vp-c-text-2);
  font-family: var(--vp-font-family-mono);
}

.playback-controls {
  display: flex;
  gap: 6px;
  align-items: center;
}

.speed-btn, .play-btn {
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
  color: var(--vp-c-text-2);
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
  font-family: var(--vp-font-family-mono);
}

.speed-btn:hover, .play-btn:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}

.speed-btn.active {
  background: var(--vp-c-brand-1);
  color: #fff;
  border-color: var(--vp-c-brand-1);
}

.play-btn {
  padding: 4px 12px;
  font-size: 14px;
}

.progress-bar {
  display: flex;
  gap: 4px;
  margin-bottom: 20px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.progress-dot {
  flex: 1;
  min-width: 0;
  text-align: center;
  cursor: pointer;
  padding: 6px 2px;
  border-radius: 6px;
  transition: all 0.2s;
  background: var(--vp-c-bg);
  border: 2px solid var(--vp-c-divider);
}

.progress-dot:hover {
  border-color: var(--vp-c-brand-1);
}

.progress-dot.active {
  border-color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
}

.progress-dot.done {
  border-color: var(--vp-c-brand-2);
  background: var(--vp-c-brand-soft);
  opacity: 0.6;
}

.dot-label {
  font-size: 10px;
  font-weight: 600;
  color: var(--vp-c-text-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
}

.progress-dot.active .dot-label {
  color: var(--vp-c-brand-1);
}

.step-content {
  min-height: 280px;
}

.step-title-row {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 8px;
}

.step-number {
  font-size: 32px;
  font-weight: 800;
  color: var(--vp-c-brand-1);
  font-family: var(--vp-font-family-mono);
  line-height: 1;
  opacity: 0.4;
}

.step-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--vp-c-text-1);
  margin: 0;
  border: none;
  padding: 0;
}

.step-source {
  margin: 0 0 12px 0;
  font-size: 13px;
}

.step-source code {
  color: var(--vp-c-brand-1);
  font-size: 12px;
  background: var(--vp-c-brand-soft);
  padding: 2px 8px;
  border-radius: 4px;
}

.step-description {
  color: var(--vp-c-text-1);
  line-height: 1.7;
  font-size: 15px;
  margin-bottom: 16px;
}

.step-code {
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 12px;
  border: 1px solid var(--vp-c-divider);
}

.code-header {
  background: var(--vp-c-default-soft);
  padding: 4px 12px;
  font-size: 11px;
  font-weight: 600;
  color: var(--vp-c-text-2);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.step-code pre {
  margin: 0;
  padding: 12px 16px;
  background: var(--vp-code-block-bg);
  overflow-x: auto;
}

.step-code code {
  font-size: 13px;
  line-height: 1.6;
  color: var(--vp-c-text-1);
  font-family: var(--vp-font-family-mono);
}

.step-detail {
  display: flex;
  gap: 8px;
  padding: 10px 14px;
  background: var(--vp-c-default-soft);
  border-radius: 8px;
  font-size: 13px;
  color: var(--vp-c-text-2);
  line-height: 1.5;
  align-items: flex-start;
}

.detail-icon {
  flex-shrink: 0;
}

.stepper-nav {
  display: flex;
  justify-content: space-between;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--vp-c-divider);
}

.nav-btn {
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  border-radius: 8px;
  padding: 8px 20px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.nav-btn:hover:not(:disabled) {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}

.nav-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

/* Transitions */
.step-enter-active {
  transition: all 0.25s ease-out;
}
.step-leave-active {
  transition: all 0.15s ease-in;
}
.step-enter-from {
  opacity: 0;
  transform: translateX(20px);
}
.step-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}
</style>
