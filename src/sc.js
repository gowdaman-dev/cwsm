const { execFile } = require('child_process');

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

function buildBinPath(binPath, args) {
  const quotedPath = `"${binPath}"`;
  return args ? `${quotedPath} ${args}` : quotedPath;
}

function scCreate({ name, binPath, args, startType, account, password }, opts) {
  const argv = ['create', name, 'binPath=', buildBinPath(binPath, args)];
  argv.push('start=', START_TYPES[startType] || START_TYPES.demand);
  if (account) {
    argv.push('obj=', account);
    if (password !== undefined && password !== null) {
      argv.push('password=', password);
    }
  }
  return runNative('sc', argv, opts);
}

function scConfig({ name, binPath, args, startType, account, password }, opts) {
  const argv = ['config', name];
  if (binPath) {
    argv.push('binPath=', buildBinPath(binPath, args));
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
  serviceExists,
};
