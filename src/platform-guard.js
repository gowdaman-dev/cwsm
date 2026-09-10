function ensureWindows() {
  if (process.platform !== 'win32' && !process.env.CSM_ALLOW_NON_WINDOWS) {
    console.error(
      'Error: this tool wraps native Windows commands (sc.exe / reg.exe) and only runs on win32.\n' +
        'Set CSM_ALLOW_NON_WINDOWS=1 to bypass this check for dry-run/testing purposes.'
    );
    process.exit(1);
  }
}

module.exports = { ensureWindows };
