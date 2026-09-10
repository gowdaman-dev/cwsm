// Scopes a log root to the service, e.g. ("C:\logs", "MyService") ->
// "C:\logs\MyService", so each service writes into its own subfolder instead
// of every service sharing one flat directory. The service host receives
// this resolved path directly (as --logdir) and creates it, sets LOG_DIR
// for the child, and redirects its stdout/stderr there.
function resolveServiceLogDir(logRoot, name) {
  const trimmed = logRoot.replace(/[\\/]+$/, '');
  return `${trimmed}\\${name}`;
}

module.exports = { resolveServiceLogDir };
