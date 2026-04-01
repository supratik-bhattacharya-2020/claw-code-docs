# System Prompt & CLAUDE.md

The system prompt is assembled dynamically at startup by `SystemPromptBuilder`. It combines hardcoded agent instructions with project context, discovered instruction files (CLAUDE.md), and runtime configuration.

## Prompt Structure

The system prompt is built as a `Vec<String>` of sections, joined with double newlines:

```mermaid
flowchart TD
    subgraph Static["Static Sections (cacheable)"]
        INTRO["Introduction<br/><i>Agent role & URL policy</i>"]
        STYLE["Output Style (optional)<br/><i>Custom response style</i>"]
        SYSTEM["System<br/><i>Tool permissions, tags, hooks</i>"]
        TASKS["Doing Tasks<br/><i>Read before changing, no speculation</i>"]
        ACTIONS["Actions with Care<br/><i>Reversibility & blast radius</i>"]
    end

    ACTIONS --> BOUNDARY

    BOUNDARY["__SYSTEM_PROMPT_DYNAMIC_BOUNDARY__"]

    BOUNDARY --> ENV

    subgraph Dynamic["Dynamic Sections (per-session)"]
        ENV["Environment Context<br/><i>Model, working dir, date, platform</i>"]
        PROJECT["Project Context<br/><i>Git status, git diff</i>"]
        CLAUDE["CLAUDE.md Files<br/><i>Instruction files from ancestor chain</i>"]
        CONFIG["Runtime Config<br/><i>settings.json contents</i>"]
        APPEND["Appended Sections<br/><i>Extra custom sections</i>"]
    end

    INTRO --> STYLE --> SYSTEM --> TASKS --> ACTIONS
    ENV --> PROJECT --> CLAUDE --> CONFIG --> APPEND

    style Static fill:#e3f2fd,stroke:#1565c0
    style Dynamic fill:#fff3e0,stroke:#ef6c00
    style BOUNDARY fill:#ffebee,stroke:#c62828
```

::: info The Dynamic Boundary
The `__SYSTEM_PROMPT_DYNAMIC_BOUNDARY__` marker separates static (cacheable) sections from dynamic (per-session) sections. Everything above the boundary is the same across sessions; everything below changes based on the project context.
:::

## CLAUDE.md Discovery

Instruction files are discovered by collecting directories from the working directory **up** to the filesystem root, then processing them in **root-first** order:

```mermaid
flowchart TD
    subgraph ROOT["/home/user/project (root → processed first)"]
        direction LR
        R1["CLAUDE.md"] --> R2["CLAUDE.local.md"] --> R3[".claude/CLAUDE.md"] --> R4[".claude/instructions.md"]
    end

    subgraph PARENT["/home/user/project/apps"]
        direction LR
        P1["CLAUDE.md"] --> P2["CLAUDE.local.md"] --> P3[".claude/CLAUDE.md"] --> P4[".claude/instructions.md"]
    end

    subgraph CWD["/home/user/project/apps/api (cwd → processed last)"]
        direction LR
        F1["CLAUDE.md"] --> F2["CLAUDE.local.md"] --> F3[".claude/CLAUDE.md"] --> F4[".claude/instructions.md"]
    end

    ROOT --> PARENT --> CWD

    style ROOT fill:#e3f2fd,stroke:#1565c0
    style PARENT fill:#fff3e0,stroke:#ef6c00
    style CWD fill:#e8f5e9,stroke:#2e7d32
```

For **each directory** (from root down to cwd), these files are checked in order:
1. `CLAUDE.md`
2. `CLAUDE.local.md`
3. `.claude/CLAUDE.md`
4. `.claude/instructions.md`

### Deduplication

Files with identical content (after normalizing blank lines and trimming) are deduplicated using a hash:

```rust
fn dedupe_instruction_files(files: Vec<ContextFile>) -> Vec<ContextFile> {
    let mut seen_hashes = Vec::new();
    files.into_iter().filter(|file| {
        let hash = stable_content_hash(&normalize(file.content));
        if seen_hashes.contains(&hash) { false }
        else { seen_hashes.push(hash); true }
    }).collect()
}
```

### Content Budgeting

Instruction files are subject to character limits:
- **Per file**: 4,000 characters max
- **Total**: 12,000 characters max across all files

Files exceeding the per-file limit are truncated with a `[truncated]` marker. Once the total budget is exhausted, remaining files show: *"Additional instruction content omitted after reaching the prompt budget."*

## Environment Section

```
# Environment context
 - Model family: Claude Opus 4.6
 - Working directory: /home/user/project
 - Date: 2026-04-01
 - Platform: linux 6.8
```

::: tip Trivia: Hardcoded Frontier Model
The frontier model name is hardcoded as `"Claude Opus 4.6"` in a constant called `FRONTIER_MODEL_NAME`. This is embedded in every system prompt regardless of which model is actually being used.
:::

## Git Context

When using `ProjectContext::discover_with_git()`, the prompt includes:

1. **Git status** — output of `git --no-optional-locks status --short --branch`
2. **Git diff** — both staged (`git diff --cached`) and unstaged (`git diff`) changes

These give the agent awareness of the current repository state.

## Runtime Config Section

If a settings file is loaded, its contents are rendered into the prompt:

```
# Runtime config
 - Loaded User: /home/user/.claude/settings.json

{"permissionMode":"acceptEdits","hooks":{...}}
```

This allows the agent to see its own configuration and adjust behavior accordingly.
