<div align="center">

<img src="src-tauri/icons/icon.png" alt="RepoShelf" width="80" />

# RepoShelf

**A dashboard for local repositories: Git status, latest commits, and project commands with logs in one window**

![Tauri](https://img.shields.io/badge/Tauri-2-24C8D8?style=flat-square&logo=tauri&logoColor=white)
![Rust](https://img.shields.io/badge/Rust-2021-DEA584?style=flat-square&logo=rust&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)

**English** · [Українська](README.uk.md) · [Русский](README.ru.md) · [Slovenčina](README.sk.md) · [Deutsch](README.de.md)

</div>

---

## Overview

RepoShelf scans a folder and brings your local Git repositories together in one dashboard

See which projects have uncommitted changes, which branch is checked out, and what the latest commit was. Save a launch command for each project, open your editor, and view process output

The app runs locally, requires no account, and does not send repository contents to a server

---

## Features

| Feature | Details |
|---|---|
| Project list | Discover repositories in the selected folder and nested directories up to 5 levels deep |
| Git status | Current branch, changed and untracked files, commits ahead of and behind the upstream branch |
| Diff viewer | Highlighted additions and deletions, line numbers, separate index and working tree views |
| Latest commit | Message, author, short hash, and time |
| Quick search | Search by name, path, or branch with `⌘ K` / `Ctrl K` |
| Filters | All projects, changed, recently opened, and running |
| Editors | VS Code, Cursor, Zed, and IntelliJ IDEA through commands in PATH |
| Custom commands | A saved launch command for each repository |
| Project commands | Detect package.json scripts for npm, pnpm, Yarn, and Bun, plus Cargo commands and binary targets |
| Process logs | stdout and stderr, the latest 2000 entries per project, and a clear button |
| Background updates | File system watching with a 900 ms debounce |
| Local settings | Working folder, editor, commands, and opening history persist between sessions |

---

## Tech stack

| Layer | Tool | Purpose |
|---|---|---|
| Desktop | Tauri 2 | Native window and communication between the UI and Rust |
| Backend | Rust | Scanning, Git, settings, and process management |
| Frontend | React 18 + TypeScript | Project dashboard and log viewer |
| Build | Vite | Frontend development and static asset builds |
| Git | System `git` command | Status, branches, history, and worktree support |
| File system | notify + walkdir | File watching and directory traversal |
| Icons | Lucide | Interface icons |

---

## Getting started

You need Node.js 20.19+ or 22.12+, npm, a current stable Rust toolchain, Git in PATH, and the [Tauri system prerequisites](https://v2.tauri.app/start/prerequisites/)

On macOS, install Command Line Tools if needed:

```bash
xcode-select --install
```

From the project folder:

```bash
npm install
npm run desktop
```

On the first run, Cargo downloads and builds the Rust dependencies

1. Click **Choose folder** and select the directory containing your projects
2. Select a repository to see its branch, latest commit, and changed files
3. Choose a detected command or enter your own, such as `npm run dev`, `cargo run`, or `python3 app.py`
4. Click **Run project** and open **Logs**

Command discovery only reads project files and does not run anything. Selecting a command fills the input; click **Run project** to execute it

Commands are saved when launched; you can also save them using the checkmark button or Enter

### Viewing changes

Click a file in **Changes** to open its diff

- **Working tree** shows changes relative to the index and the contents of untracked files
- **Staged** shows changes prepared for the next commit
- Renamed files retain both their original and new paths
- The refresh button reloads the diff, and Escape closes the dialog

An open diff refreshes with the repository when files change. Viewing does not modify files or the index; previews are limited to 256 KiB or 4000 lines

### Browser preview

```bash
npm run dev
```

Open `http://127.0.0.1:1420` to preview the interface with demo data

Folder access, opening editors, and running commands are available in the desktop app

### Building

```bash
npm run build
npm run tauri -- build
```

The first command builds the frontend into `dist/`; the second creates the desktop binary in `src-tauri/target/release/`

Installer creation is currently disabled through `bundle.active` in the Tauri configuration

---

## Editors and launch commands

Open settings from the sidebar or with `⌘ ,` / `Ctrl ,`

| Editor | Command in PATH |
|---|---|
| Visual Studio Code | `code` |
| Cursor | `cursor` |
| Zed | `zed` |
| IntelliJ IDEA | `idea` |

For VS Code on macOS, open the command palette and run `Shell Command: Install 'code' command in PATH`

Project commands run in the repository directory using `/bin/sh -c` on macOS/Linux or `cmd /C` on Windows. Tools and environment variables are inherited from the RepoShelf process

You can run several projects at once, with one process per repository. Stop running projects before changing the working folder

The stop button terminates the process tree on Windows and the process group on macOS/Linux. Managed processes are also stopped when the app exits

---

## Architecture

```text
React / TypeScript
    |
    | Tauri invoke
    v
Rust
    |-- walkdir -> repositories and worktrees
    |-- git CLI -> status, branch, commit, upstream
    |-- notify -> file changes -> dashboard refresh
    |-- processes -> stdout / stderr -> log events
    '-- settings.json -> working folder, commands, editor, history
```

Scanning, opening editors, and launching commands run outside the window's main thread. Process output is read by separate threads

The frontend uses Tauri's built-in API through `withGlobalTauri`; the JavaScript API is shipped with the Rust application

Git is called with `--no-optional-locks` to avoid unnecessary index locks when reading status

Settings live in the system configuration folder for `dev.reposhelf.desktop`, with the path resolved by Tauri. Writes use a temporary file followed by a rename

---

## Project structure

```text
RepoShelf/
├── src/
│   ├── App.tsx                       - dashboard state and user actions
│   ├── components/
│   │   ├── RepositoryCard.tsx         - repository card
│   │   ├── RepositoryDetails.tsx      - details, launch command, and logs
│   │   └── FileDiffDialog.tsx         - file diff viewer
│   ├── diff.ts                       - unified diff line parser
│   ├── desktop.ts                    - typed access to the built-in Tauri API
│   ├── demo.ts                       - browser preview data
│   ├── format.ts                     - relative timestamps
│   ├── types.ts                      - data types
│   └── styles.css                    - theme and responsive layout
├── src-tauri/
│   ├── src/
│   │   ├── lib.rs                    - Tauri commands, settings, and file watching
│   │   ├── commands.rs               - command discovery from project files
│   │   ├── diff.rs                   - diff loading and untracked file previews
│   │   ├── git.rs                    - repository scanning and Git queries
│   │   └── runner.rs                 - processes, termination, and streamed logs
│   ├── capabilities/default.json     - window permissions
│   └── tauri.conf.json               - desktop app configuration
├── tests/ui.test.mjs                  - UI tests
└── vite.config.ts
```

---

## Checks

```bash
npm run check
npm run test:ui
npm run test:rust
cargo fmt --manifest-path src-tauri/Cargo.toml --check
```

UI tests run the built app in jsdom and check search, filtering, project selection, settings, shortcuts, command selection, running process restoration after a UI reload, diff source switching, line numbers, error handling, and browser mode restrictions

Rust tests create temporary Git repositories and cover empty history, untracked and modified files, commits, renames with spaces, worktrees, dependency directory exclusions, command discovery, stdout/stderr, exit codes, child process termination, and diffs for new, renamed, deleted, and binary files

---

## MVP limitations

- One working folder at a time; commands and history are kept when switching folders
- Scanning is limited to 5 levels and does not follow symbolic links
- Nested repositories and submodules inside another repository are not listed separately
- `.git`, `node_modules`, `target`, `.venv`, `dist`, and `vendor` are excluded from scanning
- No commit, push, pull, or branch switching operations
- Diffs are limited to 256 KiB or 4000 lines; binary files show a message without text content
- Diffs display UTF-8 text; invalid byte sequences are replaced with the replacement character
- Installers, code signing, and automatic updates are not configured
- The log viewer displays text without TTY emulation; interactive commands are not supported
- Logs are held in memory, and terminal control sequences are not interpreted
- Ahead/behind counts use the local upstream reference without automatic fetch
- Commands that create a separate session and detach from their parent may survive a project stop
- The application interface is currently in Russian; README translations do not change the UI language

---

## Roadmap

- [ ] Multiple working folders
- [x] Detect available commands from `package.json` and `Cargo.toml`
- [x] Detailed diffs for changed files
- [ ] Links to local servers for running projects
- [ ] Save logs to disk
- [ ] Builds and installers for macOS, Windows, and Linux
