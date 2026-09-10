const fs = require('fs');
const path = require('path');
const os = require('os');

const HOST_EXE_NAME = 'chronexa-service-host.exe';

function bundledAssetPath() {
  // Works both in dev (real file on disk) and inside a pkg snapshot (pkg
  // patches fs to serve assets listed under package.json's pkg.assets).
  return path.join(__dirname, '..', 'assets', HOST_EXE_NAME);
}

function installDir() {
  if (process.env.ProgramData) {
    return path.join(process.env.ProgramData, 'Chronexa', 'bin');
  }
  return path.join(os.homedir(), '.chronexa', 'bin');
}

// Copies the bundled service host exe to a real on-disk path (sc.exe can't
// launch a file living inside the pkg snapshot) and returns that path.
// Skips the write when the file on disk already matches, since overwriting
// the binary of an already-running host process would fail.
function resolveHostExePath() {
  let bundled;
  try {
    bundled = fs.readFileSync(bundledAssetPath());
  } catch (err) {
    throw new Error(
      `Could not read the bundled service host (${HOST_EXE_NAME}): ${err.message}`
    );
  }

  const dest = path.join(installDir(), HOST_EXE_NAME);
  const upToDate = fs.existsSync(dest) && fs.readFileSync(dest).equals(bundled);
  if (!upToDate) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, bundled);
  }
  return dest;
}

module.exports = { resolveHostExePath, HOST_EXE_NAME };
