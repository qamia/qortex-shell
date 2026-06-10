# Qortex

**Editing evolved.** Qortex is an AI-native development environment by
**[Qamia](https://github.com/qamia)** — an editor built around an agentic
platform, not a chatbot bolted onto a text editor.

This repository contains the **Qortex editor shell**.

## What makes Qortex different

🤖 **FenneQ — the built-in agentic platform.** Qortex ships with the FenneQ
agent preinstalled: an autonomous coding agent that plans, edits across files,
runs commands, and connects to your own knowledge base through the Fenneq MCP
server. No setup, no extensions to hunt for — it's part of the editor.

⚡ **Model tiers that match the task.** Pick the intelligence level per job:

| Variant | Tier | Best for |
|---|---|---|
| **FenneQ Solar** | Frontier | Hard architecture, large refactors |
| **FenneQ Aurora** | Balanced | Daily driving |
| **FenneQ Comet** | Fast | Quick edits, instant answers |

💰 **Engineered for efficiency.** The platform is built around aggressive
**prompt caching**, **codebase retrieval** (send relevant context, not whole
files), **diff-based edits**, and **smart model routing** — so agentic coding
stays fast and affordable instead of burning tokens.

🔓 **Open ecosystem.** Extensions come from [Open VSX](https://open-vsx.org),
the vendor-neutral open registry.

## Getting started

```bash
npm install        # install dependencies
npm run compile    # build the editor
./scripts/code.sh  # launch (scripts\code.bat on Windows)
```

Cross-platform builds are produced by the [Qortex Build](.github/workflows/qortex-build.yml)
workflow (Windows, macOS, Linux).

## Repository structure

This is the editor shell. The wider platform (FenneQ agent, backend, docs)
lives in the [qamia/qortex](https://github.com/qamia/qortex) monorepo.

## Built on open source

Qortex's editor core builds on **Code-OSS**, the MIT-licensed open-source
project, which we keep current with weekly upstream refreshes — so Qortex
always benefits from the latest editor improvements, while everything above
the editor layer (the agentic platform, the optimization stack, and the
product direction) is Qamia's own. We're grateful to the open-source community.

## License

[MIT](LICENSE.txt). Third-party notices in [ThirdPartyNotices.txt](ThirdPartyNotices.txt).
