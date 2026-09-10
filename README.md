# Chronexa WS Manager

A standalone Windows CLI that wraps the native `sc.exe` / `reg.exe` tools to **create, edit, delete,
start, stop, restart, and query Windows services** — with a friendly interactive wizard, scriptable
flags, and bulk operations driven by a YAML config file.

> Owned and maintained by **Chronexa**.

Ships as a single `chronexa-ws-manager.exe` (built with [`pkg`](https://github.com/vercel/pkg)) —
no Node.js runtime needed on the target Windows machine.

---

## Table of contents

- [Requirements](#requirements)
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
- [Auto-start behavior](#auto-start-behavior)
- [Troubleshooting: service won't start / stuck on "Starting..."](#troubleshooting-service-wont-start--stuck-on-starting)
- [Safety notes](#safety-notes)
- [Global options](#global-options)
- [Project structure](#project-structure)

---

## Requirements

- **Runs on Windows only.** `sc.exe` and `reg.exe` are native Windows tools; the CLI refuses to run
  on any other platform (`src/platform-guard.js`), unless `CSM_ALLOW_NON_WINDOWS=1` is set for local
  dry-run development on non-Windows machines.
- **Run elevated (Administrator).** Creating, editing, deleting, and starting/stopping services all
  require admin privileges — `sc.exe`/`reg.exe` will fail silently or with access-denied errors
  otherwise.

## Install / build

```bash
npm install
npm run build:exe
```

This produces `dist/chronexa-ws-manager.exe`, targeting `node18-win-x64` (the newest Node runtime
`pkg` ships prebuilt binaries for). Copy that single file to the target Windows machine — nothing
else is required.

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
| `-p, --path <path>` | Full path to the service executable (required) |
| `-a, --args <args>` | Startup arguments passed to the executable (optional) |
| `-l, --logdir <dir>` | Log root directory (optional). A per-service subfolder `<dir>\<name>` is created and exposed as the `LOG_DIR` env var. |
| `-s, --start <type>` | `auto` \| `delayed-auto` \| `demand` \| `disabled` (default: `demand`) |
| `--account <account>` | `LocalSystem` \| `NetworkService` \| `LocalService` \| `DOMAIN\user` |
| `--username <user>` | Alias for a custom `--account` |
| `--password <pw>` | Password for a custom logon account |
| `-c, --config <file>` | YAML file listing multiple services to create in one go — see [Bulk operations](#bulk-operations-with-a-yaml-config-file---config) |
| `-i, --interactive` | Use the guided prompt flow instead of flags |
| `--dry-run` | Print the underlying `sc.exe`/`reg.exe` commands without running them |

```
chronexa-ws-manager.exe create ^
  --name ChronexaWorker ^
  --path "C:\apps\chronexa\worker.exe" ^
  --args "--mode prod" ^
  --logdir "C:\ProgramData\Chronexa\logs" ^
  --start auto
```

### edit

Updates an existing service. Only the flags you pass are changed — everything else is left as-is.

| Flag | Description |
|---|---|
| `-n, --name <name>` | Service name to edit (required) |
| `-p, --path <path>` | New executable path |
| `-a, --args <args>` | New startup arguments |
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
| `path` | Full path to the service executable (required) |
| `args` | Startup arguments (optional) |
| `logdir` | Log root directory (optional) — scoped to `<logdir>\<name>`, same as `--logdir` |
| `start` | `auto` \| `delayed-auto` \| `demand` \| `disabled` (default: `demand`) |
| `account.type` | `LocalSystem` (default) \| `NetworkService` \| `LocalService` \| `Custom` |
| `account.username` | Required when `account.type` is `Custom` |
| `account.password` | Password for a `Custom` account. Supports `${ENV_VAR}` expansion so secrets don't have to sit in the file. |

```yaml
services:
  - name: ChronexaWorker
    path: "C:\Chronexa\wrappers\nssm.exe"
    args: "ChronexaWorker --queue default"
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

`sc.exe` has no native concept of "service logs" — it only registers the service definition. To make
logs discoverable per service, `--logdir` writes a `LOG_DIR` environment variable into the service's
registry key (`HKLM\SYSTEM\CurrentControlSet\Services\<name>\Environment`), scoped to a subfolder
named after the service. The Service Control Manager injects this into the process environment when
it launches the service, so the service binary itself is responsible for reading `LOG_DIR` and
writing its logs there.

Passing `--logdir C:\logs` for a service named `ChronexaWorker` results in
`LOG_DIR=C:\logs\ChronexaWorker` — each service gets its own subfolder automatically. This flag is
entirely optional; omit it if the service doesn't need this convention.

## Auto-start behavior

Windows only brings a `start=auto` service up on the **next boot** — `sc create`/`sc config` alone
won't start it immediately. To make `--start auto` actually mean "running now", this CLI waits 2
seconds after a successful `create` or `edit` (when `start` is `auto`) and then issues `sc start`
itself. This applies in flag mode, the interactive wizard, and `--config` bulk mode alike. In
`--dry-run` mode the wait is skipped and the would-be `sc start` command is printed instead.

## Troubleshooting: service won't start / stuck on "Starting..."

`sc.exe` (and therefore this tool) can *register* any executable as a service, but Windows can only
actually **run** it as a service if that executable implements the Windows **Service Control API** —
on launch it must call `StartServiceCtrlDispatcher` and report status (`SERVICE_RUNNING`, etc.) back
to the Service Control Manager (SCM).

**Symptom:** the service is created fine, but starting it (from this CLI, from `services.msc`, or
with `net start`) just spins on "Starting..." and eventually fails — typically Windows error
**1053: "The service did not respond to the start or control request in a timely fashion."**

**Cause:** the binary at `--path` is a normal console app / script that was never built to hook into
the SCM. The SCM waits for the startup acknowledgement, never gets it, and times out. This is also
why `start=auto` alone doesn't bring the service up on boot — the same handshake is missing
regardless of how the service is triggered.

**Fix:** either

- (a) the target executable needs to be a genuine Windows service binary (e.g. built with a service
  framework such as .NET's `Microsoft.Extensions.Hosting.WindowsServices`, or a Node service wrapper
  library), or
- (b) wrap the existing executable with a battle-tested service shim such as **NSSM** (Non-Sucking
  Service Manager) or **WinSW**, which itself implements the Service Control API and
  launches/monitors your real process as a child. Point `--path` at the shim (e.g.
  `nssm.exe`/`WinSW.exe`) instead of directly at your script or console app.

## Safety notes

- Run from an elevated (Administrator) prompt — `sc.exe`/`reg.exe` will fail silently or with
  access-denied errors otherwise.
- Always use `--dry-run` first when scripting against a new/unfamiliar service name to confirm the
  exact command that will run.
- `delete` is irreversible. The interactive wizard requires re-typing the service name as a safety
  check; flag mode does not — double-check `--name` before running.

## Global options

| Flag | Description |
|---|---|
| `--dry-run` | Print the `sc.exe`/`reg.exe` command(s) instead of executing them. Works on every subcommand. |
| `-v, --version` | Print the CLI version and maintainer info. |

## Project structure

```
src/
  cli.js            commander-based entry point, wires up every subcommand
  wizard.js         interactive TUI (prompts + kleur) for the no-args flow
  sc.js             sc.exe wrapper: create / config / delete / start / stop / query
  env.js            writes the per-service LOG_DIR into the registry
  logon.js          logon account resolution (interactive + flag-based) and builtin account map
  autostart.js       2s-delayed sc start after create/edit when start=auto
  config.js         loads and validates a --config YAML file
  configRunner.js   applies create/edit/start/stop/restart/delete/query across all services in a config
  platform-guard.js refuses to run off Windows (bypassable with CSM_ALLOW_NON_WINDOWS=1 for dev)
examples/
  services.sample.yaml   sample multi-service config
```
