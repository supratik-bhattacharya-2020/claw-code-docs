---
layout: home

hero:
  name: "Claw Code"
  text: "Architecture Documentation"
  tagline: A clean-room Rust rewrite of Claude Code's agent harness — dissected, diagrammed, and explained
  actions:
    - theme: brand
      text: Explore the Architecture
      link: /architecture
    - theme: alt
      text: Fun Facts & Trivia
      link: /trivia

features:
  - title: The Agentic Loop
    details: "A generic, trait-based conversation runtime that drives the core user \u2192 API \u2192 tool \u2192 result cycle."
    link: /agentic-loop
  - title: Permission Model
    details: "5 escalating permission modes with a pluggable prompter trait for interactive approval."
    link: /permissions
  - title: Tool System
    details: "19 built-in tools from bash execution to web search, all registered through a unified trait."
    link: /tools
  - title: Hook System
    details: "Shell-based PreToolUse and PostToolUse hooks with exit-code-driven allow/deny/warn semantics."
    link: /hooks
  - title: Session & Compaction
    details: "Persistent JSON sessions with automatic compaction that summarizes old messages to stay within context limits."
    link: /sessions
  - title: MCP Integration
    details: "Stdio and remote MCP server support with tool namespacing, config hashing, and CCR proxy unwrapping."
    link: /mcp
---

<style>
:root {
  --vp-home-hero-name-color: transparent;
  --vp-home-hero-name-background: -webkit-linear-gradient(120deg, #bd34fe 30%, #ff6347);
}
</style>
