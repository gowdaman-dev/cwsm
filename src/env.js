const { runNative } = require('./sc');

function servicesRegKey(name) {
  return `HKLM\\SYSTEM\\CurrentControlSet\\Services\\${name}`;
}

// Scopes a log root to the service, e.g. ("C:\logs", "MyService") ->
// "C:\logs\MyService", so each service writes into its own subfolder instead
// of every service sharing one flat directory.
function resolveServiceLogDir(logRoot, name) {
  const trimmed = logRoot.replace(/[\\/]+$/, '');
  return `${trimmed}\\${name}`;
}

// Windows Service Control Manager reads a REG_MULTI_SZ "Environment" value
// under the service's registry key and injects each NAME=VALUE entry into
// the child process environment when it launches the service.
function setServiceLogDir(name, logRoot, opts) {
  const logDir = resolveServiceLogDir(logRoot, name);
  const argv = [
    'add',
    servicesRegKey(name),
    '/v',
    'Environment',
    '/t',
    'REG_MULTI_SZ',
    '/d',
    `LOG_DIR=${logDir}`,
    '/f',
  ];
  return runNative('reg', argv, opts).then((result) => ({ ...result, logDir }));
}

function clearServiceLogDir(name, opts) {
  const argv = ['delete', servicesRegKey(name), '/v', 'Environment', '/f'];
  return runNative('reg', argv, opts).catch(() => {
    // No Environment value present — nothing to clear.
  });
}

module.exports = { setServiceLogDir, clearServiceLogDir, resolveServiceLogDir };
