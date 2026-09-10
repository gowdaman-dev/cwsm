const kleur = require('kleur');
const { loadConfig } = require('./config');
const {
  scCreate,
  scConfig,
  scDelete,
  scStart,
  scStop,
  scQuery,
  serviceExists,
} = require('./sc');
const { resolveServiceLogDir } = require('./env');
const { autoStartIfNeeded } = require('./autostart');

function ok(name, message) {
  console.log(kleur.green(`✔ ${name}`) + kleur.dim(` — ${message}`));
}
function skip(name, message) {
  console.log(kleur.yellow(`• ${name}`) + kleur.dim(` — ${message}`));
}
function fail(name, message) {
  console.log(kleur.red(`✘ ${name}`) + kleur.dim(` — ${message}`));
}

function withResolvedLogDir(service) {
  if (!service.logRoot) return service;
  return { ...service, logDir: resolveServiceLogDir(service.logRoot, service.name) };
}

async function runConfigCreate(configPath, opts) {
  const services = loadConfig(configPath);
  console.log(kleur.bold(`Applying "create" to ${services.length} service(s) from ${configPath}`));
  let failures = 0;
  for (const raw of services) {
    const service = withResolvedLogDir(raw);
    try {
      const exists = await serviceExists(service.name, opts);
      if (exists) {
        skip(service.name, 'already exists, skipping');
        continue;
      }
      await scCreate(service, opts);
      if (service.logDir) console.log(kleur.dim(`    log directory: ${service.logDir}`));
      ok(service.name, exists === null ? 'would be created (dry-run)' : 'created');
      await autoStartIfNeeded(service.name, service.startType, opts);
    } catch (err) {
      failures += 1;
      fail(service.name, err.message.split('\n')[0]);
    }
  }
  if (failures) process.exitCode = 1;
}

async function runConfigEdit(configPath, opts) {
  const services = loadConfig(configPath);
  console.log(kleur.bold(`Applying "edit" to ${services.length} service(s) from ${configPath}`));
  let failures = 0;
  for (const raw of services) {
    const service = withResolvedLogDir(raw);
    try {
      await scConfig(service, opts);
      if (service.logDir) console.log(kleur.dim(`    log directory: ${service.logDir}`));
      ok(service.name, 'updated to match config');
      await autoStartIfNeeded(service.name, service.startType, opts);
    } catch (err) {
      failures += 1;
      fail(service.name, err.message.split('\n')[0]);
    }
  }
  if (failures) process.exitCode = 1;
}

async function runConfigDelete(configPath, opts) {
  const services = loadConfig(configPath);
  console.log(kleur.bold(`Applying "delete" to ${services.length} service(s) from ${configPath}`));
  let failures = 0;
  for (const service of services) {
    try {
      try {
        await scStop({ name: service.name }, opts);
      } catch (_) {
        // Not running or already stopped — fine to continue.
      }
      await scDelete({ name: service.name }, opts);
      ok(service.name, 'deleted');
    } catch (err) {
      failures += 1;
      fail(service.name, err.message.split('\n')[0]);
    }
  }
  if (failures) process.exitCode = 1;
}

async function runConfigStart(configPath, opts) {
  const services = loadConfig(configPath);
  console.log(kleur.bold(`Applying "start" to ${services.length} service(s) from ${configPath}`));
  let failures = 0;
  for (const service of services) {
    try {
      await scStart({ name: service.name }, opts);
      ok(service.name, 'started');
    } catch (err) {
      failures += 1;
      fail(service.name, err.message.split('\n')[0]);
    }
  }
  if (failures) process.exitCode = 1;
}

async function runConfigStop(configPath, opts) {
  const services = loadConfig(configPath);
  console.log(kleur.bold(`Applying "stop" to ${services.length} service(s) from ${configPath}`));
  let failures = 0;
  for (const service of services) {
    try {
      await scStop({ name: service.name }, opts);
      ok(service.name, 'stopped');
    } catch (err) {
      failures += 1;
      fail(service.name, err.message.split('\n')[0]);
    }
  }
  if (failures) process.exitCode = 1;
}

async function runConfigRestart(configPath, opts) {
  const services = loadConfig(configPath);
  console.log(kleur.bold(`Applying "restart" to ${services.length} service(s) from ${configPath}`));
  let failures = 0;
  for (const service of services) {
    try {
      try {
        await scStop({ name: service.name }, opts);
      } catch (_) {
        // Already stopped — fine to continue to start.
      }
      await scStart({ name: service.name }, opts);
      ok(service.name, 'restarted');
    } catch (err) {
      failures += 1;
      fail(service.name, err.message.split('\n')[0]);
    }
  }
  if (failures) process.exitCode = 1;
}

async function runConfigQuery(configPath, opts) {
  const services = loadConfig(configPath);
  console.log(kleur.bold(`Querying ${services.length} service(s) from ${configPath}`));
  for (const service of services) {
    try {
      const { stdout } = await scQuery({ name: service.name }, opts);
      console.log(kleur.cyan(`\n${service.name}`));
      if (stdout) console.log(stdout);
    } catch (err) {
      fail(service.name, err.message.split('\n')[0]);
    }
  }
}

module.exports = {
  runConfigCreate,
  runConfigEdit,
  runConfigDelete,
  runConfigStart,
  runConfigStop,
  runConfigRestart,
  runConfigQuery,
};
