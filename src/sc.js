const { execFile } = require('child_process');
const { resolveHostExePath } = require('./hostAssets');

const START_TYPES = {
  auto: 'auto',
  demand: 'demand',
  disabled: 'disabled',
  'delayed-auto': 'delayed-auto',
};

function runNative(cmd, args, { dryRun = false } = {}) {
  const label = `${cmd} ${args.join(' ')}`;
  if (dryRun) {
    console.log(`[dry-run] ${label}`);
    return Promise.resolve({ stdout: '', stderr: '', dryRun: true });
  }
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { windowsHide: true }, (error, stdout, stderr) => {
      if (error) {
        // sc.exe writes its actual failure reason (e.g. "FAILED 1053: ...")
        // to stdout, not stderr — surface both instead of just error.message,
        // which for a non-zero exit with empty stderr is just "Command failed: ...".
        const detail = [stdout, stderr]
          .map((s) => (s || '').trim())
          .filter(Boolean)
          .join('\n');
        reject(new Error(`Command failed: ${label}${detail ? `\n${detail}` : ''}`));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

function quote(value) {
  return `"${String(value).replace(/"/g, '\\"')}"`;
}

// Every service this tool creates runs under our own service host, which
// implements the Windows Service Control API and supervises the real
// target as a plain child process. This is what makes `create` work
// uniformly for any executable or script, not just ones that were built
// to hook into the Service Control Manager themselves.
function buildHostBinPath({ name, target, args, cwd, logDir }) {
  const hostExePath = resolveHostExePath();
  const parts = [quote(hostExePath), '--service-name', quote(name), '--target', quote(target)];
  if (args) parts.push('--args', quote(args));
  if (cwd) parts.push('--cwd', quote(cwd));
  if (logDir) parts.push('--logdir', quote(logDir));
  return parts.join(' ');
}

function scCreate({ name, target, args, cwd, logDir, startType, account, password }, opts) {
  const argv = ['create', name, 'binPath=', buildHostBinPath({ name, target, args, cwd, logDir })];
  argv.push('start=', START_TYPES[startType] || START_TYPES.demand);
  if (account) {
    argv.push('obj=', account);
    if (password !== undefined && password !== null) {
      argv.push('password=', password);
    }
  }
  return runNative('sc', argv, opts);
}

function scConfig({ name, target, args, cwd, logDir, startType, account, password }, opts) {
  const argv = ['config', name];
  if (target) {
    argv.push('binPath=', buildHostBinPath({ name, target, args, cwd, logDir }));
  }
  if (startType) {
    argv.push('start=', START_TYPES[startType] || startType);
  }
  if (account) {
    argv.push('obj=', account);
    if (password !== undefined && password !== null) {
      argv.push('password=', password);
    }
  }
  return runNative('sc', argv, opts);
}

function scDelete({ name }, opts) {
  return runNative('sc', ['delete', name], opts);
}

function scStart({ name }, opts) {
  return runNative('sc', ['start', name], opts);
}

function scStop({ name }, opts) {
  return runNative('sc', ['stop', name], opts);
}

function scQuery({ name }, opts) {
  return runNative('sc', ['query', name], opts);
}

function scQueryConfig({ name }, opts) {
  return runNative('sc', ['qc', name], opts);
}

// `sc stop` only requests the stop and returns immediately (the service is
// typically still STOP_PENDING/RUNNING) — starting it again right away, as
// `restart` does, races the SCM and fails with 1056 "already running".
// Poll until the service actually reaches STOPPED (or gives up after the
// timeout, letting the caller's next command surface whatever's wrong).
async function scWaitForStopped({ name }, opts = {}, { timeoutMs = 15000, intervalMs = 300 } = {}) {
  if (opts.dryRun) return;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    let stdout = '';
    try {
      ({ stdout } = await scQuery({ name }, opts));
    } catch (_) {
      return; // no longer queryable — nothing more to wait for
    }
    if (/STATE\s*:\s*\d+\s*STOPPED/.test(stdout)) return;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

// Real existence check against the live system (never useful in --dry-run,
// since dry-run must not touch the machine). Returns null when unknown
// (dry-run mode) so callers can skip the check instead of misreporting it.
async function serviceExists(name, opts = {}) {
  if (opts.dryRun) return null;
  try {
    await runNative('sc', ['qc', name], { dryRun: false });
    return true;
  } catch (_) {
    return false;
  }
}

module.exports = {
  START_TYPES,
  runNative,
  scCreate,
  scConfig,
  scDelete,
  scStart,
  scStop,
  scQuery,
  scQueryConfig,
  scWaitForStopped,
  serviceExists,
};
