# CWSM - Chronexa Windows Service Manager

**Publisher:** Chronexa  
**Repository:** [Chronexa-ws-manager](https://github.com/Sree-Cognicoders/Chronexa-ws-manager)  
**Binary:** `cwsm.exe`

**CWSM** (Chronexa Windows Service Manager) is a high-performance Windows service manager helper and supervisor. It allows you to run any Windows application, script, or executable as a native Windows service with automatic restart supervision, process management, I/O redirection, environment variable configuration, rotation, and graphical UI management.

---

## Features

- **Native Service Wrapper:** Run any `.exe`, batch file, PowerShell script, or Node/Python/Go application as a background Windows service.
- **Service Supervisor & Auto-Restart:** Continuously monitors your application and restarts it if it crashes or terminates unexpectedly.
- **Graphical Installer & Editor:** Full GUI dialogs for service installation, editing, configuration, and removal (`cwsm install`, `cwsm edit`, `cwsm remove`).
- **Comprehensive CLI Control:** Manage service lifecycle directly from command prompt or scripts (`start`, `stop`, `restart`, `status`, `statuscode`, `rotate`, `list`, `processes`).
- **I/O Redirection & Log Rotation:** Direct `stdin`, `stdout`, and `stderr` to files with real-time log rotation and timestamping.
- **Process Priority & CPU Affinity:** Pin services to specific CPU cores and tune priority classes.
- **Custom Environment Variables & Hooks:** Set extra environment variables and define pre/post lifecycle hook scripts.
- **Graceful Shutdown:** Configurable console events (Ctrl+C), window messages, and process tree termination timeouts before forced termination.

---

## Command-Line Usage

### Service Installation

- **Launch Graphical Installer:**
  ```cmd
  cwsm install [<servicename>]
  ```
- **Install Service via CLI:**
  ```cmd
  cwsm install <servicename> <app_path> [<args>...]
  ```

### Service Editing & Parameter Management

- **Launch Graphical Editor:**
  ```cmd
  cwsm edit <servicename>
  ```
- **Dump Service Configuration Commands:**
  ```cmd
  cwsm dump <servicename>
  ```
- **Get a Service Parameter:**
  ```cmd
  cwsm get <servicename> <parameter> [<subparameter>]
  ```
- **Set a Service Parameter:**
  ```cmd
  cwsm set <servicename> <parameter> [<subparameter>] <value>
  ```
- **Reset a Service Parameter to Default:**
  ```cmd
  cwsm reset <servicename> <parameter> [<subparameter>]
  ```

### Service Control & Lifecycle

- **Start Service:**
  ```cmd
  cwsm start <servicename>
  ```
- **Stop Service:**
  ```cmd
  cwsm stop <servicename>
  ```
- **Restart Service:**
  ```cmd
  cwsm restart <servicename>
  ```
- **Check Service Status:**
  ```cmd
  cwsm status <servicename>
  cwsm statuscode <servicename>
  ```
- **List Managed Services:**
  ```cmd
  cwsm list
  ```
- **Show Process Tree:**
  ```cmd
  cwsm processes <servicename>
  ```
- **Trigger Log File Rotation:**
  ```cmd
  cwsm rotate <servicename>
  ```
- **Remove Service:**
  ```cmd
  cwsm remove <servicename>
  cwsm remove <servicename> confirm
  ```

---

## Building from Source

### Visual Studio / MSBuild
1. Open [`cwsm.sln`](file:///home/gowdaman/Projects/personal/chronexa-ws-manager/cwsm.sln) in Visual Studio.
2. Select target configuration (`Release|Win32` or `Release|x64`).
3. Build the solution. Pre-build steps will run [`version.cmd`](file:///home/gowdaman/Projects/personal/chronexa-ws-manager/version.cmd) and generate `version.h`, and compile `messages.mc` into message tables.
4. The output binary `cwsm.exe` will be generated in `out\Release\<platform>\`.

---

## License & Copyright

Copyright © 2026 **Chronexa**. All rights reserved.
