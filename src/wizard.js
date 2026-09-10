const prompts = require('prompts');
const kleur = require('kleur');
const { scCreate, scConfig, scDelete, scStart, scStop, scQuery } = require('./sc');
const { setServiceLogDir, resolveServiceLogDir } = require('./env');
const { promptLogon } = require('./logon');
const { autoStartIfNeeded } = require('./autostart');

const onCancel = () => {
  console.log(kleur.yellow('\nCancelled. No changes were made.'));
  process.exit(0);
};

const START_TYPE_CHOICES = [
  { title: 'Automatic', value: 'auto' },
  { title: 'Automatic (Delayed Start)', value: 'delayed-auto' },
  { title: 'Manual', value: 'demand' },
  { title: 'Disabled', value: 'disabled' },
];

function heading(text) {
  console.log('\n' + kleur.bold().cyan(text));
  console.log(kleur.dim('-'.repeat(text.length)));
}

function summaryLine(label, value) {
  console.log(`  ${kleur.dim(label.padEnd(14))} ${value ?? kleur.dim('(unchanged)')}`);
}

async function mainMenu({ dryRun } = {}) {
  heading('Chronexa WS Manager');
  console.log(kleur.dim('Owned and maintained by Chronexa\n'));
  const { action } = await prompts(
    {
      type: 'select',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { title: 'Create a new service', value: 'create' },
        { title: 'Edit an existing service', value: 'edit' },
        { title: 'Start a service', value: 'start' },
        { title: 'Stop a service', value: 'stop' },
        { title: 'Restart a service', value: 'restart' },
        { title: 'Delete a service', value: 'delete' },
        { title: 'Query a service status', value: 'query' },
        { title: 'Exit', value: 'exit' },
      ],
    },
    { onCancel }
  );

  if (!action || action === 'exit') {
    console.log(kleur.dim('Goodbye.'));
    return;
  }

  if (action === 'create') await runCreateWizard({ dryRun });
  else if (action === 'edit') await runEditWizard({ dryRun });
  else if (action === 'start') await runStartWizard({ dryRun });
  else if (action === 'stop') await runStopWizard({ dryRun });
  else if (action === 'restart') await runRestartWizard({ dryRun });
  else if (action === 'delete') await runDeleteWizard({ dryRun });
  else if (action === 'query') await runQueryWizard({ dryRun });
}

async function confirmAndRun(summaryEntries, action) {
  heading('Review');
  summaryEntries.forEach(([label, value]) => summaryLine(label, value));

  const { ok } = await prompts(
    { type: 'confirm', name: 'ok', message: 'Proceed?', initial: true },
    { onCancel }
  );
  if (!ok) {
    console.log(kleur.yellow('Cancelled. No changes were made.'));
    return;
  }
  await action();
}

async function runCreateWizard({ dryRun } = {}) {
  heading('Create a Windows Service');

  const basics = await prompts(
    [
      {
        type: 'text',
        name: 'name',
        message: 'Service name (no spaces, used with sc.exe)',
        validate: (v) => (/^[^\s]+$/.test(v || '') ? true : 'Required, no spaces'),
      },
      {
        type: 'text',
        name: 'binPath',
        message: 'Full path to the service executable',
        validate: (v) => (v && v.trim().length > 0 ? true : 'Required'),
      },
      {
        type: 'text',
        name: 'args',
        message: 'Startup arguments (leave blank for none)',
      },
      {
        type: 'confirm',
        name: 'wantsLogDir',
        message: 'Configure a log directory for this service? (optional)',
        initial: false,
      },
    ],
    { onCancel }
  );

  let logRoot;
  let logDir;
  if (basics.wantsLogDir) {
    ({ logRoot } = await prompts(
      {
        type: 'text',
        name: 'logRoot',
        message: 'Log root directory (a subfolder named after the service will be created under it)',
        validate: (v) => (v && v.trim().length > 0 ? true : 'Required'),
      },
      { onCancel }
    ));
    logDir = resolveServiceLogDir(logRoot, basics.name);
  }

  const { startType } = await prompts(
    {
      type: 'select',
      name: 'startType',
      message: 'Startup type',
      choices: START_TYPE_CHOICES,
      initial: 2,
    },
    { onCancel }
  );

  const { wantsLogon } = await prompts(
    {
      type: 'confirm',
      name: 'wantsLogon',
      message: 'Configure a specific logon account? (default: LocalSystem)',
      initial: false,
    },
    { onCancel }
  );

  const logon = wantsLogon ? await promptLogon() : {};

  await confirmAndRun(
    [
      ['Name', basics.name],
      ['Path', basics.binPath],
      ['Args', basics.args || kleur.dim('(none)')],
      ['Log dir', logDir || kleur.dim('(none)')],
      ['Start type', startType],
      ['Account', logon.account || 'LocalSystem'],
    ],
    async () => {
      await scCreate(
        { name: basics.name, binPath: basics.binPath, args: basics.args, startType, ...logon },
        { dryRun }
      );
      if (logRoot) {
        await setServiceLogDir(basics.name, logRoot, { dryRun });
      }
      console.log(kleur.green(`\n✔ Service "${basics.name}" created.`));
      await autoStartIfNeeded(basics.name, startType, { dryRun });
    }
  );
}

async function runEditWizard({ dryRun } = {}) {
  heading('Edit a Windows Service');

  const { name } = await prompts(
    {
      type: 'text',
      name: 'name',
      message: 'Service name to edit',
      validate: (v) => (v && v.trim().length > 0 ? true : 'Required'),
    },
    { onCancel }
  );

  const { fields } = await prompts(
    {
      type: 'multiselect',
      name: 'fields',
      message: 'Which fields do you want to change? (space to select, enter to confirm)',
      choices: [
        { title: 'Executable path / arguments', value: 'path' },
        { title: 'Log directory', value: 'logdir' },
        { title: 'Startup type', value: 'start' },
        { title: 'Logon account', value: 'logon' },
      ],
      min: 1,
    },
    { onCancel }
  );

  const changes = { name };
  let logRoot;
  let logDir;

  if (fields.includes('path')) {
    const answers = await prompts(
      [
        { type: 'text', name: 'binPath', message: 'New executable path' },
        { type: 'text', name: 'args', message: 'New startup arguments (blank for none)' },
      ],
      { onCancel }
    );
    changes.binPath = answers.binPath;
    changes.args = answers.args;
  }

  if (fields.includes('logdir')) {
    ({ logRoot } = await prompts(
      {
        type: 'text',
        name: 'logRoot',
        message: 'New log root directory (a subfolder named after the service will be created under it)',
      },
      { onCancel }
    ));
    logDir = resolveServiceLogDir(logRoot, name);
  }

  if (fields.includes('start')) {
    const { startType } = await prompts(
      {
        type: 'select',
        name: 'startType',
        message: 'New startup type',
        choices: START_TYPE_CHOICES,
      },
      { onCancel }
    );
    changes.startType = startType;
  }

  let logon = {};
  if (fields.includes('logon')) {
    logon = await promptLogon();
  }

  await confirmAndRun(
    [
      ['Name', name],
      ['Path', changes.binPath],
      ['Args', changes.args],
      ['Log dir', logDir],
      ['Start type', changes.startType],
      ['Account', logon.account],
    ],
    async () => {
      await scConfig({ ...changes, ...logon }, { dryRun });
      if (logRoot) {
        await setServiceLogDir(name, logRoot, { dryRun });
      }
      console.log(kleur.green(`\n✔ Service "${name}" updated.`));
      if (changes.startType === 'auto') {
        await autoStartIfNeeded(name, changes.startType, { dryRun });
      }
    }
  );
}

async function runDeleteWizard({ dryRun } = {}) {
  heading('Delete a Windows Service');

  const { name } = await prompts(
    {
      type: 'text',
      name: 'name',
      message: 'Service name to delete',
      validate: (v) => (v && v.trim().length > 0 ? true : 'Required'),
    },
    { onCancel }
  );

  const { confirmName } = await prompts(
    {
      type: 'text',
      name: 'confirmName',
      message: kleur.red(`Type "${name}" again to confirm deletion`),
    },
    { onCancel }
  );

  if (confirmName !== name) {
    console.log(kleur.yellow('Names did not match. Cancelled — no changes were made.'));
    return;
  }

  await (async () => {
    try {
      await scStop({ name }, { dryRun });
    } catch (_) {
      // Not running or already stopped — fine to continue.
    }
    await scDelete({ name }, { dryRun });
    console.log(kleur.green(`\n✔ Service "${name}" deleted.`));
  })();
}

async function runQueryWizard({ dryRun } = {}) {
  heading('Query a Windows Service');
  const { name } = await prompts(
    {
      type: 'text',
      name: 'name',
      message: 'Service name to query',
      validate: (v) => (v && v.trim().length > 0 ? true : 'Required'),
    },
    { onCancel }
  );
  const { stdout } = await scQuery({ name }, { dryRun });
  if (stdout) console.log('\n' + stdout);
}

async function promptServiceName(message) {
  const { name } = await prompts(
    {
      type: 'text',
      name: 'name',
      message,
      validate: (v) => (v && v.trim().length > 0 ? true : 'Required'),
    },
    { onCancel }
  );
  return name;
}

async function runStartWizard({ dryRun } = {}) {
  heading('Start a Windows Service');
  const name = await promptServiceName('Service name to start');
  try {
    await scStart({ name }, { dryRun });
    console.log(kleur.green(`\n✔ Service "${name}" started.`));
  } catch (err) {
    console.error(kleur.red(`\n${err.message}`));
    console.error(
      kleur.yellow(
        'If it hangs on "Starting..." then fails, the target executable likely does not ' +
          'implement the Windows Service Control API (StartServiceCtrlDispatcher). A plain ' +
          'console app/script cannot run directly as a service — wrap it with something like ' +
          'NSSM or WinSW, or make the binary a proper Windows service.'
      )
    );
  }
}

async function runStopWizard({ dryRun } = {}) {
  heading('Stop a Windows Service');
  const name = await promptServiceName('Service name to stop');
  try {
    await scStop({ name }, { dryRun });
    console.log(kleur.green(`\n✔ Service "${name}" stopped.`));
  } catch (err) {
    console.error(kleur.red(`\n${err.message}`));
  }
}

async function runRestartWizard({ dryRun } = {}) {
  heading('Restart a Windows Service');
  const name = await promptServiceName('Service name to restart');
  try {
    try {
      await scStop({ name }, { dryRun });
    } catch (_) {
      // Already stopped — fine to continue to start.
    }
    await scStart({ name }, { dryRun });
    console.log(kleur.green(`\n✔ Service "${name}" restarted.`));
  } catch (err) {
    console.error(kleur.red(`\n${err.message}`));
  }
}

module.exports = {
  mainMenu,
  runCreateWizard,
  runEditWizard,
  runStartWizard,
  runStopWizard,
  runRestartWizard,
  runDeleteWizard,
  runQueryWizard,
};
