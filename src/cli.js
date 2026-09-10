#!/usr/bin/env node

const { Command } = require('commander');
const kleur = require('kleur');
const { ensureWindows } = require('./platform-guard');
const { scCreate, scConfig, scDelete, scStart, scStop, scQuery } = require('./sc');
const { resolveServiceLogDir } = require('./env');
const { resolveLogonFromFlags } = require('./logon');
const wizard = require('./wizard');
const configRunner = require('./configRunner');
const { autoStartIfNeeded, START_FAILURE_HINT } = require('./autostart');

ensureWindows();

const program = new Command();

const VERSION = '1.0.0';

program
  .name('chronexa-ws-manager')
  .description('Create, edit, and delete Windows services via sc.exe')
  .version(
    `chronexa-ws-manager v${VERSION}\nOwned and maintained by Chronexa`,
    '-v, --version',
    'output the current version'
  )
  .option('--dry-run', 'print the sc.exe/reg.exe commands without executing them', false);

function dryRunFrom(cmd) {
  // Global --dry-run may be set on the root program or on the subcommand itself.
  return Boolean(program.opts().dryRun || cmd.optsWithGlobals?.().dryRun);
}

async function withConfigErrors(fn) {
  try {
    await fn();
  } catch (err) {
    console.error(kleur.red(err.message));
    process.exitCode = 1;
  }
}

program
  .command('create')
  .description('create a new Windows service (or every service in a --config file)')
  .option('-n, --name <name>', 'service name')
  .option('-p, --path <path>', 'full path to the service executable')
  .option('-a, --args <args>', 'startup arguments passed to the executable')
  .option('-w, --workdir <dir>', 'working directory the executable runs from')
  .option('-l, --logdir <dir>', 'log root; service writes to <dir>\\<name> (LOG_DIR env var + stdout/stderr files)')
  .option(
    '-s, --start <type>',
    'startup type: auto | delayed-auto | demand | disabled',
    'demand'
  )
  .option('--account <account>', 'logon account: LocalSystem | NetworkService | LocalService | DOMAIN\\user')
  .option('--username <username>', 'alias for a custom --account')
  .option('--password <password>', 'password for a custom logon account')
  .option('-c, --config <file>', 'YAML file listing multiple services to create in one go')
  .option('-i, --interactive', 'walk through an interactive prompt instead of flags', false)
  .action(async (opts, cmd) => {
    const dryRun = dryRunFrom(cmd);
    if (opts.config) {
      await withConfigErrors(() => configRunner.runConfigCreate(opts.config, { dryRun }));
      return;
    }
    if (opts.interactive) {
      await wizard.runCreateWizard({ dryRun });
      return;
    }
    if (!opts.name || !opts.path) {
      console.error(kleur.red('Error: --name and --path are required (or use --interactive / --config).'));
      process.exitCode = 1;
      return;
    }
    const logon = resolveLogonFromFlags(opts);
    const logDir = opts.logdir ? resolveServiceLogDir(opts.logdir, opts.name) : undefined;
    try {
      await scCreate(
        {
          name: opts.name,
          target: opts.path,
          args: opts.args,
          cwd: opts.workdir,
          logDir,
          startType: opts.start,
          ...logon,
        },
        { dryRun }
      );
      if (logDir) console.log(kleur.dim(`  Log directory: ${logDir}`));
      console.log(kleur.green(`✔ Service "${opts.name}" created.`));
      await autoStartIfNeeded(opts.name, opts.start, { dryRun });
    } catch (err) {
      console.error(kleur.red(err.message));
      process.exitCode = 1;
    }
  });

program
  .command('edit')
  .description('edit an existing Windows service (or every service in a --config file)')
  .option('-n, --name <name>', 'service name')
  .option('-p, --path <path>', 'new executable path')
  .option('-a, --args <args>', 'new startup arguments')
  .option('-w, --workdir <dir>', 'new working directory the executable runs from')
  .option('-l, --logdir <dir>', 'new log root; service writes to <dir>\\<name> (LOG_DIR env var + stdout/stderr files)')
  .option('-s, --start <type>', 'new startup type: auto | delayed-auto | demand | disabled')
  .option('--account <account>', 'logon account: LocalSystem | NetworkService | LocalService | DOMAIN\\user')
  .option('--username <username>', 'alias for a custom --account')
  .option('--password <password>', 'password for a custom logon account')
  .option('-c, --config <file>', 'YAML file listing multiple services to update in one go')
  .option('-i, --interactive', 'walk through an interactive prompt instead of flags', false)
  .action(async (opts, cmd) => {
    const dryRun = dryRunFrom(cmd);
    if (opts.config) {
      await withConfigErrors(() => configRunner.runConfigEdit(opts.config, { dryRun }));
      return;
    }
    if (opts.interactive) {
      await wizard.runEditWizard({ dryRun });
      return;
    }
    if (!opts.name) {
      console.error(kleur.red('Error: --name is required (or use --interactive / --config).'));
      process.exitCode = 1;
      return;
    }
    if ((opts.args || opts.workdir || opts.logdir) && !opts.path) {
      console.error(
        kleur.red(
          'Error: --path is required whenever --args, --workdir, or --logdir is set, since the ' +
            "service's full launch command is rebuilt together (pass the executable's existing " +
            'path unchanged if you only meant to update one of the others).'
        )
      );
      process.exitCode = 1;
      return;
    }
    const logon = resolveLogonFromFlags(opts);
    const logDir = opts.logdir ? resolveServiceLogDir(opts.logdir, opts.name) : undefined;
    try {
      await scConfig(
        {
          name: opts.name,
          target: opts.path,
          args: opts.args,
          cwd: opts.workdir,
          logDir,
          startType: opts.start,
          ...logon,
        },
        { dryRun }
      );
      if (logDir) console.log(kleur.dim(`  Log directory: ${logDir}`));
      console.log(kleur.green(`✔ Service "${opts.name}" updated.`));
      if (opts.start === 'auto') {
        await autoStartIfNeeded(opts.name, opts.start, { dryRun });
      }
    } catch (err) {
      console.error(kleur.red(err.message));
      process.exitCode = 1;
    }
  });

program
  .command('delete')
  .description('delete a Windows service (or every service in a --config file)')
  .option('-n, --name <name>', 'service name')
  .option('-f, --force', 'stop the service first if it is running', false)
  .option('-c, --config <file>', 'YAML file listing multiple services to delete in one go')
  .option('-i, --interactive', 'walk through an interactive, confirmed prompt', false)
  .action(async (opts, cmd) => {
    const dryRun = dryRunFrom(cmd);
    if (opts.config) {
      await withConfigErrors(() => configRunner.runConfigDelete(opts.config, { dryRun }));
      return;
    }
    if (opts.interactive) {
      await wizard.runDeleteWizard({ dryRun });
      return;
    }
    if (!opts.name) {
      console.error(kleur.red('Error: --name is required (or use --interactive / --config).'));
      process.exitCode = 1;
      return;
    }
    try {
      if (opts.force) {
        try {
          await scStop({ name: opts.name }, { dryRun });
        } catch (_) {
          // Already stopped or not running — fine to continue.
        }
      }
      await scDelete({ name: opts.name }, { dryRun });
      console.log(kleur.green(`✔ Service "${opts.name}" deleted.`));
    } catch (err) {
      console.error(kleur.red(err.message));
      process.exitCode = 1;
    }
  });

program
  .command('start')
  .description('start a Windows service (or every service in a --config file)')
  .option('-n, --name <name>', 'service name')
  .option('-c, --config <file>', 'YAML file listing multiple services to start in one go')
  .option('-i, --interactive', 'prompt for the service name', false)
  .action(async (opts, cmd) => {
    const dryRun = dryRunFrom(cmd);
    if (opts.config) {
      await withConfigErrors(() => configRunner.runConfigStart(opts.config, { dryRun }));
      return;
    }
    if (opts.interactive || !opts.name) {
      await wizard.runStartWizard({ dryRun });
      return;
    }
    try {
      await scStart({ name: opts.name }, { dryRun });
      console.log(kleur.green(`✔ Service "${opts.name}" started.`));
    } catch (err) {
      console.error(kleur.red(err.message));
      console.error(kleur.yellow(START_FAILURE_HINT));
      process.exitCode = 1;
    }
  });

program
  .command('stop')
  .description('stop a Windows service (or every service in a --config file)')
  .option('-n, --name <name>', 'service name')
  .option('-c, --config <file>', 'YAML file listing multiple services to stop in one go')
  .option('-i, --interactive', 'prompt for the service name', false)
  .action(async (opts, cmd) => {
    const dryRun = dryRunFrom(cmd);
    if (opts.config) {
      await withConfigErrors(() => configRunner.runConfigStop(opts.config, { dryRun }));
      return;
    }
    if (opts.interactive || !opts.name) {
      await wizard.runStopWizard({ dryRun });
      return;
    }
    try {
      await scStop({ name: opts.name }, { dryRun });
      console.log(kleur.green(`✔ Service "${opts.name}" stopped.`));
    } catch (err) {
      console.error(kleur.red(err.message));
      process.exitCode = 1;
    }
  });

program
  .command('restart')
  .description('stop then start a Windows service (or every service in a --config file)')
  .option('-n, --name <name>', 'service name')
  .option('-c, --config <file>', 'YAML file listing multiple services to restart in one go')
  .option('-i, --interactive', 'prompt for the service name', false)
  .action(async (opts, cmd) => {
    const dryRun = dryRunFrom(cmd);
    if (opts.config) {
      await withConfigErrors(() => configRunner.runConfigRestart(opts.config, { dryRun }));
      return;
    }
    if (opts.interactive || !opts.name) {
      await wizard.runRestartWizard({ dryRun });
      return;
    }
    try {
      try {
        await scStop({ name: opts.name }, { dryRun });
      } catch (_) {
        // Already stopped — fine to continue to start.
      }
      await scStart({ name: opts.name }, { dryRun });
      console.log(kleur.green(`✔ Service "${opts.name}" restarted.`));
    } catch (err) {
      console.error(kleur.red(err.message));
      process.exitCode = 1;
    }
  });

program
  .command('query')
  .description('show the status of a Windows service (or every service in a --config file)')
  .option('-n, --name <name>', 'service name')
  .option('-c, --config <file>', 'YAML file listing multiple services to query in one go')
  .option('-i, --interactive', 'prompt for the service name', false)
  .action(async (opts, cmd) => {
    const dryRun = dryRunFrom(cmd);
    if (opts.config) {
      await withConfigErrors(() => configRunner.runConfigQuery(opts.config, { dryRun }));
      return;
    }
    if (opts.interactive || !opts.name) {
      await wizard.runQueryWizard({ dryRun });
      return;
    }
    try {
      const { stdout } = await scQuery({ name: opts.name }, { dryRun });
      if (stdout) console.log(stdout);
    } catch (err) {
      console.error(kleur.red(err.message));
      process.exitCode = 1;
    }
  });

async function main() {
  // No arguments at all → drop straight into the full interactive wizard
  // instead of printing a bare --help, so the tool is friendly by default.
  if (process.argv.length <= 2) {
    await wizard.mainMenu({ dryRun: false });
    return;
  }
  await program.parseAsync(process.argv);
}

main();
