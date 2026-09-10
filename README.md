# Chronexa WS Manager

A standalone Windows CLI that **creates, edits, deletes, starts, stops, restarts, and queries
Windows services** — with a friendly interactive wizard, scriptable flags, and bulk operations
driven by a YAML config file.

> Owned and maintained by **Chronexa**.

Ships as a single `chronexa-ws-manager.exe` (built with [`pkg`](https://github.com/vercel/pkg)) —
no Node.js runtime needed on the target Windows machine. Every service it creates runs under its
own built-in service host, so it works uniformly for any executable or script — not just binaries
that were purpose-built as Windows services.

---

## Table of contents

- [Requirements](#requirements)
- [How it works](#how-it-works)
- [Install / build](#install--build)
- [Two ways to use it](#two-ways-to-use-it)
- [Commands](#commands)
  - [create](#create)
  - [edit](#edit)
  - [start / stop / restart](#start--stop--restart)
  - [delete](#delete)
  - [query](#query)
- [Bulk operations with a YAML config file (`--config`)](#bulk-operations-with-a-yaml-config-file---config)
- [Logon accounts](#logon-accounts)
- [Log directories](#log-directories)
- [Working directory](#working-directory)
- [Auto-start behavior](#auto-start-behavior)
- [Troubleshooting](#troubleshooting)
- [Safety notes](#safety-notes)
- [Global options](#global-options)
- [Project structure](#project-structure)

---

## Requirements

- **Runs on Windows only.** `sc.exe` is a native Windows tool; the CLI refuses to run on any other
  platform (`src/platform-guard.js`), unless `CSM_ALLOW_NON_WINDOWS=1` is set for local dry-run
  development on non-Windows machines.
- **Run elevated (Administrator).** Creating, editing, deleting, and starting/stopping services all
  require admin privileges — `sc.exe` will fail silently or with access-denied errors otherwise.

## How it works

Windows only lets `sc.exe` actually *run* an executable as a service if that executable implements
the Windows Service Control API itself (calling `StartServiceCtrlDispatcher` and reporting status
back to the Service Control Manager). Most executables and scripts don't — pointing `sc create`
straight at them results in the service hanging on "Starting..." and failing with error 1053.

To make `create` work for **any** target uniformly, this CLI never registers your executable
directly. Instead, every service it creates points at its own bundled service host
(`chronexa-service-host.exe`, in `service-host/`), which:

1. implements the Service Control API on your target's behalf,
2. spawns your real executable (`--path`, with `--args`, in `--workdir`) as a supervised child
   process when the service starts,
3. keeps the service's state in sync with that child — `SERVICE_RUNNING` while it's alive, stops it
   (and reports `SERVICE_STOPPED`) when the SCM asks the service to stop, and stops itself if the
   child exits on its own,
4. optionally redirects the child's stdout/stderr to log files and sets `LOG_DIR` in its
   environment, when `--logdir` is given.

The host exe is materialized once to a stable path (`%ProgramData%\Chronexa\bin\`) the first time
it's needed and reused after that — you only ever distribute the one `chronexa-ws-manager.exe`.

## Install / build

Building from source requires the [.NET SDK](https://dotnet.microsoft.com/download) (8.0+, to
build the service host) and Node.js (to build the CLI) — both can cross-compile the Windows
binaries from Linux/macOS.

```bash
npm install
npm run build:all
```

This builds `service-host/ChronexaServiceHost` (self-contained `win-x64`), copies it into
`assets/chronexa-service-host.exe` so `pkg` bundles it, then builds `dist/chronexa-ws-manager.exe`.
Copy that single file to the target Windows machine — nothing else is required.

Individual steps: `npm run build:host` (service host only) and `npm run build:exe` (CLI only, once
`assets/chronexa-service-host.exe` already exists).

For local development (including dry-run testing from Linux/macOS):

```bash
node src/cli.js <command> [options]
```

## Two ways to use it

1. **Interactive wizard** — run the exe with no arguments and answer guided prompts.
2. **Flags** — pass all options directly, for scripting and automation.

### Interactive wizard

```
chronexa-ws-manager.exe
```

You'll get a menu: *Create / Edit / Start / Stop / Restart / Delete / Query / Exit*. Each flow asks
only for what it needs, shows a review screen before making any change, and requires re-typing the
service name to confirm a delete.

### Flag mode

```
chronexa-ws-manager.exe <command> [options]
```

## Commands

### create

Registers a new Windows service.

| Flag | Description |
|---|---|
| `-n, --name <name>` | Service name (required) |
| `-p, --path <path>` | Full path to the executable/script to run (required) |
| `-a, --args <args>` | Startup arguments passed to it (optional) |
| `-w, --workdir <dir>` | Working directory it runs from (optional; defaults to the executable's own folder) |
| `-l, --logdir <dir>` | Log root directory (optional). A per-service subfolder `<dir>\<name>` is created; the host sets `LOG_DIR` there and writes `stdout.log`/`stderr.log`. |
| `-s, --start <type>` | `auto` \| `delayed-auto` \| `demand` \| `disabled` (default: `demand`) |
| `--account <account>` | `LocalSystem` \| `NetworkService` \| `LocalService` \| `DOMAIN\user` |
| `--username <user>` | Alias for a custom `--account` |
| `--password <pw>` | Password for a custom logon account |
| `-c, --config <file>` | YAML file listing multiple services to create in one go — see [Bulk operations](#bulk-operations-with-a-yaml-config-file---config) |
| `-i, --interactive` | Use the guided prompt flow instead of flags |
| `--dry-run` | Print the underlying `sc.exe` command without running it |

```
chronexa-ws-manager.exe create ^
  --name ChronexaWorker ^
  --path "C:\Program Files\nodejs\node.exe" ^
  --args "worker.js --mode prod" ^
  --workdir "C:\apps\chronexa" ^
  --logdir "C:\ProgramData\Chronexa\logs" ^
  --start auto
```

### edit

Updates an existing service. Only the flags you pass are changed — everything else is left as-is,
**except** that `--args`, `--workdir`, and `--logdir` all require `--path` to be given alongside
them, since the service's launch command is one atomic string that gets fully rebuilt together (pass
the executable's current path unchanged if you're only touching one of the others).

| Flag | Description |
|---|---|
| `-n, --name <name>` | Service name to edit (required) |
| `-p, --path <path>` | New executable path |
| `-a, --args <args>` | New startup arguments |
| `-w, --workdir <dir>` | New working directory |
| `-l, --logdir <dir>` | New log root (again scoped to `<dir>\<name>`) |
| `-s, --start <type>` | New startup type |
| `--account` / `--username` / `--password` | New logon account |
| `-c, --config <file>` | YAML file listing multiple services to update in one go |
| `-i, --interactive` | Pick which fields to change from a checklist |
| `--dry-run` | Preview only |

```
chronexa-ws-manager.exe edit --name ChronexaWorker --start delayed-auto
```

### start / stop / restart

```
chronexa-ws-manager.exe start   --name ChronexaWorker
chronexa-ws-manager.exe stop    --name ChronexaWorker
chronexa-ws-manager.exe restart --name ChronexaWorker
```

Each also accepts `-c, --config <file>` to act on every service in a YAML file, and `-i, --interactive`
to be prompted for the service name.

### delete

| Flag | Description |
|---|---|
| `-n, --name <name>` | Service name to delete (required) |
| `-f, --force` | Stop the service first if it's running |
| `-c, --config <file>` | YAML file listing multiple services to delete in one go |
| `-i, --interactive` | Guided flow — asks you to re-type the name to confirm |
| `--dry-run` | Preview only |

```
chronexa-ws-manager.exe delete --name ChronexaWorker --force
```

### query

Shows the current status of a service (wraps `sc query`).

```
chronexa-ws-manager.exe query --name ChronexaWorker
```

## Bulk operations with a YAML config file (`--config`)

Every command above also accepts `-c, --config <file>` in place of `--name` and the rest of the
per-service flags. Instead of acting on one service, it loads a YAML file listing multiple services
(Docker-Compose style) and applies that same command to all of them, printing a per-service result
line.

```
chronexa-ws-manager.exe create  --config services.yaml
chronexa-ws-manager.exe edit    --config services.yaml
chronexa-ws-manager.exe start   --config services.yaml
chronexa-ws-manager.exe stop    --config services.yaml
chronexa-ws-manager.exe restart --config services.yaml
chronexa-ws-manager.exe delete  --config services.yaml
chronexa-ws-manager.exe query   --config services.yaml
```

### YAML schema

| Field | Description |
|---|---|
| `services` | A list of service entries (required, top-level key) |
| `name` | Service name (required) |
| `path` | Full path to the executable/script to run (required) |
| `args` | Startup arguments (optional) |
| `workdir` | Working directory it runs from (optional; defaults to the executable's own folder) |
| `logdir` | Log root directory (optional) — scoped to `<logdir>\<name>`, same as `--logdir` |
| `start` | `auto` \| `delayed-auto` \| `demand` \| `disabled` (default: `demand`) |
| `account.type` | `LocalSystem` (default) \| `NetworkService` \| `LocalService` \| `Custom` |
| `account.username` | Required when `account.type` is `Custom` |
| `account.password` | Password for a `Custom` account. Supports `${ENV_VAR}` expansion so secrets don't have to sit in the file. |

```yaml
services:
  - name: ChronexaWorker
    path: "C:\Program Files\nodejs\node.exe"
    args: "worker.js --queue default"
    workdir: "C:\Chronexa\worker"
    logdir: "C:\ProgramData\Chronexa\logs"
    start: auto
    account:
      type: Custom
      username: ".\svc_chronexa"
      password: "${CHRONEXA_SVC_PASSWORD}"
```

A full example with four services (including a manual-start service and each account type) ships at
[`examples/services.sample.yaml`](examples/services.sample.yaml).

### Behavior per command

- **create** — for each service: if it already exists on the machine, it's **skipped** and reported
  as "already exists"; it is never overwritten. Only missing services are created.
- **edit** — always applies the YAML's settings to each listed service (`sc config`), whether or not
  something changed.
- **start / stop / restart** — applies to every service listed, in file order.
- **delete** — stops (if running) then deletes every service listed.
- **query** — prints the status of every service listed.

Each service is processed independently — one failing service is reported and skipped, the rest
still run; the command exits non-zero if any service failed.

## Logon accounts

By default a service runs as `LocalSystem`. You can instead choose:

- `NetworkService` — limited local privileges, network access as the computer account
- `LocalService` — limited local privileges, no network credentials
- A custom account (`DOMAIN\user` or `.\user`) — you'll be prompted for a password (masked input in
  the interactive wizard)

## Log directories

`--logdir` gives your service its own log folder without your target executable having to know
anything about Windows services. Pass a log **root**; the CLI scopes it to a subfolder named after
the service (`--logdir C:\logs` on `ChronexaWorker` becomes `C:\logs\ChronexaWorker`) and hands that
resolved path to the service host, which:

- creates the folder if it doesn't exist,
- sets `LOG_DIR` in the child process's environment (so the target can also write there itself if it
  wants to), and
- redirects the child's stdout/stderr to `stdout.log` / `stderr.log` in that folder, timestamped per
  line — so you get logs even from a target that never reads `LOG_DIR` at all.

This flag is entirely optional; omit it if the service doesn't need dedicated logs.

## Working directory

`--workdir` sets the working directory the target process runs from — useful for anything that reads
relative paths (config files, `require`/`import` resolution, relative log paths of its own). If
omitted, it defaults to the folder containing the `--path` executable.

## Auto-start behavior

Windows only brings a `start=auto` service up on the **next boot** — `sc create`/`sc config` alone
won't start it immediately. To make `--start auto` actually mean "running now", this CLI waits 2
seconds after a successful `create` or `edit` (when `start` is `auto`) and then issues `sc start`
itself. This applies in flag mode, the interactive wizard, and `--config` bulk mode alike. In
`--dry-run` mode the wait is skipped and the would-be `sc start` command is printed instead.

## Troubleshooting

Since every service runs under the built-in host, a start failure almost always means your **target
executable itself** failed to launch or exited immediately — not a Windows Service Control problem.
Check, in order:

1. **The log directory**, if `--logdir` was set — `stdout.log`/`stderr.log` there usually show the
   target's own error directly.
2. **`--path` and `--workdir`** — confirm the executable exists at that exact path and that any
   relative paths it uses resolve correctly from the working directory you gave it (or its own
   folder, if you didn't set one).
3. **Run the target directly** from a console with the same `--args`/`--workdir` to see its error
   without the service layer at all.
4. **Windows Event Viewer** → *Windows Logs → System*, source "Service Control Manager", for the
   exact failure Windows recorded.

## Safety notes

- Run from an elevated (Administrator) prompt — `sc.exe` will fail silently or with access-denied
  errors otherwise.
- Always use `--dry-run` first when scripting against a new/unfamiliar service name to confirm the
  exact command that will run.
- `delete` is irreversible. The interactive wizard requires re-typing the service name as a safety
  check; flag mode does not — double-check `--name` before running.

## Global options

| Flag | Description |
|---|---|
| `--dry-run` | Print the `sc.exe` command(s) instead of executing them. Works on every subcommand. |
| `-v, --version` | Print the CLI version and maintainer info. |

## Project structure

```
src/
  cli.js            commander-based entry point, wires up every subcommand
  wizard.js         interactive TUI (prompts + kleur) for the no-args flow
  sc.js             sc.exe wrapper: create / config / delete / start / stop / query, builds the
                     host-wrapped binPath for every service
  hostAssets.js     materializes the bundled service host exe to a stable on-disk path
  env.js            resolveServiceLogDir: scopes a log root to a per-service subfolder
  logon.js          logon account resolution (interactive + flag-based) and builtin account map
  autostart.js      2s-delayed sc start after create/edit when start=auto
  config.js         loads and validates a --config YAML file
  configRunner.js   applies create/edit/start/stop/restart/delete/query across all services in a config
  platform-guard.js refuses to run off Windows (bypassable with CSM_ALLOW_NON_WINDOWS=1 for dev)
service-host/
  ChronexaServiceHost/   .NET Worker Service that implements the Service Control API and
                         supervises the real target as a child process (see How it works)
examples/
  services.sample.yaml   sample multi-service config
```
