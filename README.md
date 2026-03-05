<div align="center">

 <a href="https://github.com/HelloGGX/vibe-coding-cli">
    <img src="./logo.jpg" alt="Vibe Coding CLI Logo" width="600" />
  </a>

  <p>
    <strong>The vibe coding ecosystem builder, specifically designed for OpenCode.</strong>
  </p>

[![vibe-coding: enabled](https://img.shields.io/badge/vibe--coding-enabled-BD00FF?style=flat-square&logo=github&logoColor=white&labelColor=2D3748)](https://github.com/HelloGGX/vibe-coding-cli)
[![npm version](https://img.shields.io/npm/v/@vibe-coder/cli.svg?style=flat-square)](https://www.npmjs.com/package/@vibe-coder/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](../../LICENSE.md)
[![Built with Bun](https://img.shields.io/badge/Bun-%23000000.svg?style=flat-square&logo=bun&logoColor=white)](https://bun.sh)

<p>
    <b>English</b> · <a href="https://github.com/HelloGGX/skill/blob/main/packages/vibe/README.zh.md">简体中文</a>
  </p>

<p>
    <em>"One-click aggregation of AI tools and contextual rules, enabling Agents to truly understand your codebase architecture."</em>
  </p>

</div>

## 📖 Introduction

`@vibe-coder/cli` is a modern command-line scaffolding tool built specifically for the **OpenCode** platform. Its core mission is to quickly set up a Vibe Coding development environment and simplify resource management for rule-driven development.

With the `vibe` command, you can pull TypeScript/Python tool scripts or Markdown rule files from remote GitHub repositories with a single click. These are seamlessly and automatically registered into your OpenCode configuration while managing underlying runtime dependencies, allowing you to focus entirely on **"co-creating code with AI."**

## ✨ Features

- 🛠 **Fully Automated Tool Management**: Rapidly parse, multi-select, and download `.ts` / `.py` scripts from any GitHub repository for out-of-the-box local usage.
- 📜 **Perfect Fusion of Context and Capabilities**: Innovative ecosystem aggregation that deeply binds the **tool skills** required by Agents with your **behavioral guidelines**. Supports on-demand installation of `.md` rule files, ensuring AI truly understands your architectural intent.
- 📦 **Smart Configuration Injection**: Automatically intercepts and updates `.opencode/opencode.jsonc`, silently injecting tool toggles and prompt directive paths. Say goodbye to tedious manual configuration.
- ⚡ **Blazing Fast Parallel Updates**: Designed with a concurrency model to simultaneously process resource comparisons and pulls across multiple source repositories, drastically reducing update wait times.
- 🪄 **Standard Skill Aggregation**: Deeply integrated with Vercel's `pnpx skills` ecosystem, allowing you to manage both standard Agent skill libraries and local extension resources within a unified CLI workflow.

---

## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) >= 18.0.0 or [Bun](https://bun.sh/) >= 1.0.0

### Installation

Install globally:

```bash
# Using npm
npm i -g @vibe-coder/cli

# Using bun
bun add -g @vibe-coder/cli
```

### Basic Usage

Initialize and add an ecosystem repository (e.g., `helloggx/skill` from this project):

```bash
vibe add helloggx/skill
```

_The CLI will launch an interactive menu, allowing you to flexibly multi-select the **Tools** and **Rules** you want to install, and will automatically handle all environment configurations for you._

---

## 📚 Commands

| Command                  | Alias | Description                                                                                                                                            |
| ------------------------ | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `vibe add <repo>`        | `a`   | Parses the target GitHub repo, launches a UI list for on-demand installation of tools/rules, and auto-injects configurations.                          |
| `vibe list`              | `ls`  | Prints a clear status map of all installed resources (local tools, context rules, global standard skills) in the current project.                      |
| `vibe update`            | `up`  | Concurrently pulls all source repositories listed in `vibe-lock.json` with one click, intelligently comparing and overwriting local scripts and rules. |
| `vibe remove [resource]` | `rm`  | **Run without args**: Launches a UI multi-select list to delete local items.<br>                                                                       |

<br>

## <br>**Run with args**: Quickly matches and removes specified standard skills or local tools, synchronously cleaning up configurations. |

## 🏗️ Build Your Own Resource Repository

We strongly encourage you or your team to create dedicated Vibe Coding resource repositories on GitHub to standardize your team's favorite AI tools and custom coding conventions across all projects.

### Recommended Directory Structure

To ensure perfect compatibility with `@vibe-coder/cli`, we recommend adopting the following conventions (refer to `helloggx/skill`):

```text
your-custom-repo/
├── skill/                  # (Optional) Standard Vercel AI Agent skill library
├── tool/                   # Custom TS/Python executable tools
│   ├── get_dsl.ts
│   ├── get_dsl.py          # 💡 Python scripts should share the same name as the TS tool calling them
│   └── shadcn_vue_init.ts
└── rules/                  # Personalized Markdown context rules
    ├── common/             # Global common rules applicable to all projects
    │   ├── coding-style.md
    │   └── security.md
    └── typescript/         # Tech-stack specific rules
        └── coding-style.md # 💡 Recommended to share the same name as the extended common rule

```

### Organization Best Practices

- **Cross-language tool linkage**: If your `.ts` tool relies on an underlying `.py` script, **ensure the base names of both files are exactly the same** (e.g., `get_dsl.ts` and `get_dsl.py`). The CLI will intelligently recognize and pull them together.
- **Rule inheritance and extension**:
- Global common rules must be placed under `rules/common/`.
- When writing rules for a specific tech stack (e.g., `rules/typescript/`), if you need to inherit a `common` rule, it is recommended to **keep the same name** and explicitly declare the inheritance at the top of the file:
  _> This file extends [common/coding-style.md](https://www.google.com/search?q=../common/coding-style.md) and adds TS-specific content._

---

## 📂 Workspace Structure

After running `vibe add`, the tool will automatically take over and maintain the following structure in your project's root directory:

```text
your-project/
├── .opencode/
│   ├── tool/                   # Underlying .ts / .py tool scripts
│   ├── rules/                  # .md rule files (archived by category)
│   ├── opencode.jsonc          # Core OpenCode configuration (CLI auto-injects tool toggles & directive paths)
│   └── vibe-lock.json          # State lock file, accurately recording resource origins and versions
├── .venv/                      # (Created on demand) Isolated Python virtual environment
└── requirements.txt            # (Maintained on demand) Python script dependency list

```

---

## 🤝 Join the Ecosystem

If your open-source project (like Agent Skills, Tools, or Rules) is compatible with and utilizes the vibe-coding specification, you are welcome to add this exclusive badge to your `README.md` to show off your modern workflow to the community!

Copy the following Markdown code to add it to your project:

```markdown
[![vibe-coding: enabled](https://img.shields.io/badge/vibe--coding-enabled-BD00FF?style=flat-square&logo=github&logoColor=white&labelColor=2D3748)](https://github.com/HelloGGX/vibe-coding-cli)
```

_(By adding the badge, you'll have the opportunity to be featured in the official Hall of Fame curated list!)_

## 🛠️ Development

This project is built on top of the blazing-fast [Bun](https://bun.sh/) runtime.

```bash
bun install             # 1. Install dependencies
bun run dev --help      # 2. Local debugging
bun run typecheck       # 3. Type checking
bun run build           # 4. Build production version (outputs to ./dist)
```

## 📄 License

[MIT License](https://www.google.com/search?q=../../LICENSE.md) © 2026 [HelloGGX](https://github.com/HelloGGX)
