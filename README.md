# Qortex

**Editing evolved.** Qortex is an AI-native development environment by
**[Qamia](https://github.com/qamia)** — an editor built around an agentic
platform, not a chatbot bolted onto a text editor.

This repository contains the **Qortex editor shell**.

## What makes Qortex different

🤖 **FenneQ Studio — the harness, live in the sidebar.** Qortex is built around
FenneQ, Qamia's optimization harness. FenneQ Studio, the bundled sidebar, drives
a run end to end: you describe the job, the harness asks for the data it needs,
puts its questions to you, builds and solves the model, and stops at a human
gate before anything is promoted. The studio ships as a built-in extension
([qamia/fenneq-studio](https://github.com/qamia/fenneq-studio)): present on
first launch, not uninstallable, and Qortex's only agent surface.

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

This is the editor shell. FenneQ Studio, the bundled sidebar, lives in
[qamia/fenneq-studio](https://github.com/qamia/fenneq-studio); the harness and
its engine in [qamia/Fennec-Agentic-Plateform](https://github.com/qamia/Fennec-Agentic-Plateform);
the backend proxy and docs in the [qamia/qortex](https://github.com/qamia/qortex)
monorepo. Packaged builds bundle the studio from a VSIX or a built checkout —
see [BUILD.md](BUILD.md).

## Built on open source

Qortex's editor core builds on **Code-OSS**, the MIT-licensed open-source
project. We track upstream releases with an automated rebase workflow — so
Qortex benefits from the latest editor improvements, while everything above
the editor layer (the agentic platform, the optimization stack, and the
product direction) is Qamia's own. We're grateful to the open-source community.

## License

[MIT](LICENSE.txt). Third-party notices in [ThirdPartyNotices.txt](ThirdPartyNotices.txt).
