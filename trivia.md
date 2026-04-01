# Trivia & Fun Facts

A collection of interesting code patterns, design decisions, and Easter eggs found in the claw-code codebase.

## The Infinite Loop Default

```rust
max_iterations: usize::MAX,  // 18,446,744,073,709,551,615
```

The default `max_iterations` for the agentic loop is `usize::MAX` on 64-bit systems — that's **18.4 quintillion iterations**. If each iteration took 1 second, the agent could loop for **584 billion years** — about 42 times the age of the universe. In practice, the loop exits when the assistant produces no `tool_use` blocks.

---

## The 4-Character Token Estimator

```rust
text.len() / 4 + 1
```

Instead of using a tokenizer like tiktoken or cl100k, claw-code estimates tokens by dividing the byte length by 4 and adding 1. This is a well-known approximation for English text (roughly 4 characters per token). The `+ 1` ensures that even empty strings get counted as at least 1 token.

---

## Exit Code 2 = Deny

Hook exit codes follow a specific convention:
- **0** = Allow (standard Unix success)
- **2** = Deny (chosen because it's the "misuse of shell builtins" code)
- **Everything else** = Warn but allow

This means a hook that crashes (exit 1) or is killed by a signal (no exit code) won't block tool execution — only an explicit exit 2 will deny.

---

## Custom JSON Parser

The session persistence system (`json.rs`) uses a **hand-written JSON parser** instead of serde. The `JsonValue` enum provides `parse()` and `render()` methods for reading and writing session files. This gives the project full control over the serialization format without depending on serde's behavior.

---

## Hand-Rolled SSE Parser

The `SseParser` in `api/src/sse.rs` is written from scratch in about 100 lines. It handles:
- Chunked delivery across TCP packets
- Both `\n\n` and `\r\n\r\n` frame separators
- Multi-line `data:` fields
- Comment lines (starting with `:`)
- Ping events
- The `[DONE]` sentinel

No SSE library needed.

---

## Hand-Rolled OAuth

The OAuth implementation includes:
- Its own **base64url encoder** (a 64-entry lookup table, ~30 lines)
- Its own **percent encoder/decoder**
- PKCE with SHA-256 challenge generation
- Token storage in `~/.claude/credentials.json`

All without external auth libraries.

---

## The Retryable Seven

These 7 HTTP status codes trigger automatic retries:

```
408  Request Timeout
409  Conflict
429  Too Many Requests
500  Internal Server Error
502  Bad Gateway
503  Service Unavailable
504  Gateway Timeout
```

The backoff strategy doubles from 200ms: 200ms → 400ms → 800ms (capped at 2s).

---

## Pending Work Detection

The compaction system infers "pending work" by scanning text for keywords:

```rust
lowered.contains("todo")
    || lowered.contains("next")
    || lowered.contains("pending")
    || lowered.contains("follow up")
    || lowered.contains("remaining")
```

A simple keyword search that preserves context about what the user was working on.

---

## File Candidate Detection

The compaction extracts key file paths from conversation text by looking for whitespace-separated tokens that:
1. Contain a `/` character
2. End with a known extension: `.rs`, `.ts`, `.tsx`, `.js`, `.json`, `.md`

No regex, no AST parsing — just string splitting and extension checking.

---

## The Frontier Model Name

```rust
pub const FRONTIER_MODEL_NAME: &str = "Claude Opus 4.6";
```

The frontier model name is hardcoded as a constant. It appears in every system prompt regardless of which model is actually being used.

---

## dontAsk Default Permission

The Rust port's `init` command writes `dontAsk` as the default permission mode — essentially full trust by default. This contrasts with the more conservative defaults you might expect from a security-conscious tool.

---

## FNV-1a for Config Hashing

MCP server configs are hashed using the FNV-1a algorithm with the standard 64-bit parameters:

```rust
let mut hash = 0xcbf2_9ce4_8422_2325_u64;  // FNV offset basis
for byte in value.as_bytes() {
    hash ^= u64::from(*byte);
    hash = hash.wrapping_mul(0x0100_0000_01b3);  // FNV prime
}
```

This produces a deterministic 16-character hex string for change detection.

---

## Instruction File Budget

CLAUDE.md files have a strict character budget:
- **4,000 chars** per individual file
- **12,000 chars** total across all discovered files

Anything beyond the budget is truncated or omitted entirely.

---

## Shell Execution Differences

Hooks are executed differently per platform:
- **Unix**: `sh -lc "command"` (login shell for full env)
- **Windows**: `cmd /C "command"`

The `-l` flag on Unix ensures the user's full login environment is available to hooks.

---

## 22 Slash Commands

The slash command system defines exactly **22 commands**, of which **11 support `--resume`** (working with restored session files). Commands range from basic utilities (`/help`, `/status`) to AI-powered features (`/ultraplan`, `/bughunter`, `/teleport`).

---

## No `unsafe` Allowed

```toml
[workspace.lints.rust]
unsafe_code = "forbid"
```

The entire workspace forbids `unsafe` code at the lint level. This is enforced across all crates — the agent harness is 100% safe Rust.
