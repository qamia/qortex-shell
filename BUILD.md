# Building Qortex (editor shell)

This repo is a Code-OSS / `microsoft/vscode` fork. The canonical, reproducible
build is the CI pipeline in [`.github/workflows/qortex-build.yml`](.github/workflows/qortex-build.yml)
— read that first; this doc explains the prerequisites and the one non-obvious
local gotcha (the Windows LTCG patch).

## Prerequisites (all platforms)

- **Node**: the version pinned in [`.nvmrc`](.nvmrc) (currently **24.15.0**). Use
  `nvm use` / a matching install — other major versions will fail the native builds.
- **Python 3.11** — required by `node-gyp` for native modules.
- **~12–15 GB free disk.** Source + `node_modules` + extensions are ~7 GB; the
  compile/package step spikes another ~5 GB of intermediates. Builds fail in
  confusing ways (half-built `.node` binaries) if the disk hits zero mid-compile.

## Platform toolchains

### Linux
```bash
sudo apt-get install -y \
  build-essential pkg-config \
  libx11-dev libxkbfile-dev libsecret-1-dev libkrb5-dev \
  fakeroot rpm
```

### macOS
- Xcode Command Line Tools (`xcode-select --install`).

### Windows
Install **Visual Studio Build Tools 2022** with these components:
- `Microsoft.VisualStudio.Component.VC.Tools.x86.x64` (MSVC v14.4x)
- `Microsoft.VisualStudio.Component.VC.Runtimes.x86.x64.Spectre` (**Spectre-mitigated libs** — required)
- `Microsoft.VisualStudio.Component.VC.Llvm.Clang` + `...VC.Llvm.ClangToolset` (**ClangCL** — `tree-sitter` needs it)

> ⚠️ LLVM/ClangCL is large (~9 GB). Combined with the 12–15 GB build need, watch disk.

#### Windows LTCG patch (the non-obvious one)

`node-gyp`'s default Release config passes `/LTCG:INCREMENTAL`, which ClangCL's
`llvm-lib` rejects — the `tree-sitter` native build fails with a link error. The
fix is to disable the LTCG block in `node-gyp`'s `addon.gypi`:

- Find the `addon.gypi` of the **node-gyp that npm actually uses** — it's bundled
  inside npm, at `<node-install-dir>\node_modules\npm\node_modules\node-gyp\addon.gypi`
  (derive `<node-install-dir>` from `Split-Path (Get-Command node).Source`).
- Replace the sentinel `node_with_ltcg=="true"` with anything else (e.g.
  `node_with_ltcg=="true_DISABLED_qortex_clangcl"`) so the LTCG block is skipped.

CI does this automatically (see the *"Windows node-gyp LTCG workaround"* step in
`qortex-build.yml`). Locally you must apply it **before** `npm ci`/`npm install`.

#### signtool on PATH

`vscode-win32-*-min` ends with a task that runs `signtool.exe` (a signature
check, no certificate needed). It lives in the Windows SDK, not on PATH, so a
local packaged build fails at the very end with `spawn signtool.exe ENOENT` —
the app folder is complete by then, only the version-resource restamp of the
native modules is skipped. Put the SDK's `bin\<version>d` on PATH first, as
the *"Add Windows SDK signtool to PATH"* step in `qortex-build.yml` does.

> **Known wart (tracked in QAM-516):** this patches a file under the machine-global
> npm install — it is not yet captured in-repo. It is reversible (revert the
> sentinel). A follow-up should move it into a repo preinstall/gulp step so a clean
> checkout builds without hand-editing global state.

## Build

```bash
npm install                          # or `npm ci`
npm run compile                      # dev build (~6 min); out/ ~200 MB
./scripts/code.sh                    # launch  (scripts\code.bat on Windows)
```

Packaged platform bundles (what CI produces):
```bash
npm run gulp vscode-linux-x64-min    # | vscode-win32-x64-min | vscode-darwin-arm64-min
```

### FenneQ Studio (the bundled sidebar)

Packaged builds bundle [FenneQ Studio](https://github.com/qamia/fenneq-studio)
as a built-in extension (`resources/app/extensions/fenneq-studio`). The shell
does not compile it: `build/lib/fenneqStudio.ts` (gulp task
`compile-fenneq-studio-build`, part of every `vscode-*` task) copies a
ready-made build from the first of

1. `FENNEQ_STUDIO_VSIX` — a `.vsix` made with `npx vsce package --no-dependencies --skip-license` in the studio repo;
2. `.build/fenneq-studio.vsix` — the same file where CI puts it;
3. `FENNEQ_STUDIO_DIR` — a built checkout (`npm run build` done, `dist/extension.js` present);
4. `../fenneq-studio` — the sibling checkout, same rule.

With no source found the build warns and ships without the studio;
`FENNEQ_REQUIRED=1` (set by CI) turns that into an error. A manifest that is
not `qamia.fenneq-studio` is refused. CI builds the VSIX in the `studio` job of
`qortex-build.yml` from the private repo, which needs the `FENNEQ_STUDIO_TOKEN`
secret (fine-grained PAT, read on qamia/fenneq-studio).

### After a disk-zero crash
If a compile dies at 0 GB, native modules can be left half-built (e.g.
`policy-watcher`, `spdlog`, `windows-registry`) and only surface as errors at
launch. Free space, then:
```bash
npm rebuild                          # rebuilds all native modules for the Electron ABI
```
(The optional `ssh2` crypto `.node` may fail to build — that's safe to ignore.)
