# CLI & Commands

The `claw` binary (`rusty-claude-cli`) provides a REPL interface with 22 slash commands, session management, and rich terminal output with syntax highlighting.

## CLI Architecture

```
rusty-claude-cli/src/
├── main.rs    — Entry point, arg parsing, OAuth login
├── app.rs     — Main REPL loop, session management
├── args.rs    — CLI argument definitions
├── init.rs    — Project initialization
├── input.rs   — Rustyline-based input handling
└── render.rs  — Markdown rendering with syntect
```

The CLI depends on:
- **crossterm** — Terminal manipulation
- **rustyline** — Readline-style input with history
- **pulldown-cmark** — Markdown parsing
- **syntect** — Syntax highlighting for code blocks

## Slash Commands

22 slash commands are available, organized by category:

### Session Management
| Command | Description | Works with `--resume` |
|:--|:--|:-:|
| `/status` | Show current session status | |
| `/compact` | Compact local session history | Yes |
| `/clear [--confirm]` | Start a fresh local session | Yes |
| `/cost` | Show cumulative token usage | Yes |
| `/resume <path>` | Load a saved session | |
| `/session [list\|switch]` | List or switch managed sessions | |
| `/export [file]` | Export conversation to a file | Yes |

### Configuration
| Command | Description | Works with `--resume` |
|:--|:--|:-:|
| `/model [model]` | Show or switch the active model | |
| `/permissions [mode]` | Show or switch permission mode | |
| `/config [section]` | Inspect config files | Yes |
| `/memory` | Inspect loaded instruction files | Yes |
| `/init` | Create a starter CLAUDE.md | Yes |

### Developer Tools
| Command | Description | Works with `--resume` |
|:--|:--|:-:|
| `/help` | Show available slash commands | Yes |
| `/diff` | Show git diff for workspace | Yes |
| `/version` | Show CLI version info | Yes |
| `/debug-tool-call` | Replay last tool call with debug | |

### AI-Powered Commands
| Command | Description |
|:--|:--|
| `/bughunter [scope]` | Inspect codebase for likely bugs |
| `/commit` | Generate commit message and create git commit |
| `/pr [context]` | Draft or create a pull request |
| `/issue [context]` | Draft or create a GitHub issue |
| `/ultraplan [task]` | Deep planning with multi-step reasoning |
| `/teleport <target>` | Jump to a file or symbol in workspace |

## Command Parsing

Slash commands are parsed with a simple prefix matcher:

```rust
pub fn parse(input: &str) -> Option<SlashCommand> {
    let trimmed = input.trim();
    if !trimmed.starts_with('/') { return None; }

    let mut parts = trimmed.trim_start_matches('/').split_whitespace();
    let command = parts.next()?;
    match command {
        "help" => Some(SlashCommand::Help),
        "compact" => Some(SlashCommand::Compact),
        "model" => Some(SlashCommand::Model { model: parts.next()... }),
        // ... 22 total
        other => Some(SlashCommand::Unknown(other.to_string())),
    }
}
```

## Command Dispatch

Commands are handled at two levels:

1. **Static handlers** (`commands` crate) — `/compact` and `/help` can be handled without the REPL runtime
2. **Runtime handlers** (`rusty-claude-cli`) — Everything else needs the full CLI context

```rust
pub fn handle_slash_command(input, session, compaction) -> Option<SlashCommandResult> {
    match SlashCommand::parse(input)? {
        SlashCommand::Compact => { /* compact session */ }
        SlashCommand::Help => { /* render help text */ }
        _ => None,  // Handled by the REPL
    }
}
```

## Help Output

The `/help` command renders a formatted table:

```
Slash commands
  [resume] means the command also works with --resume SESSION.json
  /help                Show available slash commands [resume]
  /status              Show current session status
  /compact             Compact local session history [resume]
  /model [model]       Show or switch the active model
  ...
```

## Resume Support

11 of the 22 commands support the `--resume` flag, meaning they work when loading a previous session file. Commands like `/model` and `/clear` that modify runtime state don't support resume since they need the live REPL context.
