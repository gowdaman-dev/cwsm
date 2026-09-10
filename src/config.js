const fs = require('fs');
const yaml = require('js-yaml');
const { BUILTIN_ACCOUNTS } = require('./logon');
const { START_TYPES } = require('./sc');

function expandEnv(value) {
  if (typeof value !== 'string') return value;
  return value.replace(/\$\{([A-Z0-9_]+)\}/gi, (_, key) =>
    process.env[key] !== undefined ? process.env[key] : ''
  );
}

function normalizeAccount(entry, idx, name) {
  if (!entry.account) return {};
  const type = entry.account.type || 'LocalSystem';
  if (type === 'Custom') {
    const account = entry.account.username;
    if (!account) {
      throw new Error(`services[${idx}] (${name}): account.type is "Custom" but "username" is missing`);
    }
    return { account, password: expandEnv(entry.account.password) };
  }
  if (Object.prototype.hasOwnProperty.call(BUILTIN_ACCOUNTS, type)) {
    return { account: BUILTIN_ACCOUNTS[type] || undefined, password: undefined };
  }
  throw new Error(
    `services[${idx}] (${name}): unknown account.type "${type}" ` +
      `(expected LocalSystem, NetworkService, LocalService, or Custom)`
  );
}

function normalizeService(entry, idx, filePath) {
  if (!entry || typeof entry !== 'object') {
    throw new Error(`services[${idx}] in ${filePath} is not a valid mapping`);
  }
  const name = entry.name;
  if (!name || typeof name !== 'string') {
    throw new Error(`services[${idx}] in ${filePath} is missing a "name"`);
  }
  if (!entry.path || typeof entry.path !== 'string') {
    throw new Error(`services[${idx}] (${name}) in ${filePath} is missing a "path"`);
  }
  const start = entry.start || 'demand';
  if (!Object.prototype.hasOwnProperty.call(START_TYPES, start)) {
    throw new Error(
      `services[${idx}] (${name}): invalid "start" value "${start}" ` +
        `(expected auto, delayed-auto, demand, or disabled)`
    );
  }
  const { account, password } = normalizeAccount(entry, idx, name);

  return {
    name,
    binPath: entry.path,
    args: entry.args !== undefined ? String(entry.args) : undefined,
    logRoot: entry.logdir || undefined,
    startType: start,
    account,
    password,
  };
}

function loadConfig(filePath) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    throw new Error(`Could not read config file "${filePath}": ${err.message}`);
  }

  let doc;
  try {
    doc = yaml.load(raw);
  } catch (err) {
    throw new Error(`Invalid YAML in "${filePath}": ${err.message}`);
  }

  const services = doc && doc.services;
  if (!Array.isArray(services) || services.length === 0) {
    throw new Error(`No "services" list found in config file: ${filePath}`);
  }

  return services.map((entry, idx) => normalizeService(entry, idx, filePath));
}

module.exports = { loadConfig };
