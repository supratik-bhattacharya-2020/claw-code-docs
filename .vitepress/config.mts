import { defineConfig } from "vitepress"
import { withMermaid } from "vitepress-plugin-mermaid"

export default withMermaid(
  defineConfig({
    title: "Claw Code Architecture",
    description:
      "A deep dive into the architecture of claw-code — a clean-room Rust rewrite of Claude Code's agent harness",
    head: [
      [
        "link",
        {
          rel: "icon",
          href: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🦀</text></svg>",
        },
      ],
    ],
    themeConfig: {
      nav: [
        { text: "Home", link: "/" },
        { text: "Architecture", link: "/architecture" },
        { text: "Trivia", link: "/trivia" },
      ],
      sidebar: [
        {
          text: "Introduction",
          items: [{ text: "Overview", link: "/architecture" }],
        },
        {
          text: "Core Systems",
          items: [
            { text: "The Agentic Loop", link: "/agentic-loop" },
            { text: "Tool System", link: "/tools" },
            { text: "Permission Model", link: "/permissions" },
            { text: "Hook System", link: "/hooks" },
          ],
        },
        {
          text: "Infrastructure",
          items: [
            { text: "Session & Compaction", link: "/sessions" },
            { text: "API Client", link: "/api-client" },
            { text: "System Prompt & CLAUDE.md", link: "/system-prompt" },
            { text: "MCP Integration", link: "/mcp" },
          ],
        },
        {
          text: "CLI",
          items: [
            { text: "CLI & Commands", link: "/cli" },
          ],
        },
        {
          text: "Extras",
          items: [
            { text: "Python Parity Tracker", link: "/python-tracker" },
            { text: "Trivia & Fun Facts", link: "/trivia" },
          ],
        },
      ],
      socialLinks: [
        { icon: "github", link: "https://github.com/instructkr/claw-code" },
      ],
      search: {
        provider: "local",
      },
      outline: {
        level: [2, 3],
      },
    },
    mermaid: {},
    mermaidPlugin: {
      class: "mermaid",
    },
  })
)
