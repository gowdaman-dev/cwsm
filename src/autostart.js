const kleur = require('kleur');
const { scStart } = require('./sc');

const AUTO_START_DELAY_MS = 2000;

const START_FAILURE_HINT =
  'The service failed to start. Every service this tool creates runs under its own ' +
  'built-in service host, so this usually means the target executable itself failed ' +
  '(wrong --path, missing dependency, bad --args/--workdir) rather than a Windows ' +
  'Service Control problem. Check the log directory (stdout.log / stderr.log) if one ' +
  'was configured, or run the target directly from a console to see its own error.';

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// After create/edit with start=auto, Windows only brings the service up on
// the next boot. Start it right away too (after a short delay) so "auto"
// actually means "running now", not just "will run next reboot".
async function autoStartIfNeeded(name, startType, opts = {}) {
  if (startType !== 'auto') return;

  console.log(
    kleur.dim(`  start=auto — starting "${name}" after a ${AUTO_START_DELAY_MS / 1000}s delay...`)
  );
  if (!opts.dryRun) {
    await delay(AUTO_START_DELAY_MS);
  }
  try {
    await scStart({ name }, opts);
    console.log(kleur.green(`✔ Service "${name}" started.`));
  } catch (err) {
    console.error(kleur.red(err.message));
    console.error(kleur.yellow(START_FAILURE_HINT));
  }
}

module.exports = { autoStartIfNeeded, START_FAILURE_HINT, AUTO_START_DELAY_MS };
