const prompts = require('prompts');

const BUILTIN_ACCOUNTS = {
  LocalSystem: null, // omitted from `obj=` entirely; sc.exe default
  NetworkService: 'NT AUTHORITY\\NetworkService',
  LocalService: 'NT AUTHORITY\\LocalService',
};

const ACCOUNT_CHOICES = [
  { title: 'LocalSystem (default)', value: 'LocalSystem' },
  { title: 'NetworkService', value: 'NetworkService' },
  { title: 'LocalService', value: 'LocalService' },
  { title: 'Custom account (username/password)', value: 'Custom' },
];

async function promptLogon() {
  const { accountType } = await prompts(
    {
      type: 'select',
      name: 'accountType',
      message: 'Select the account this service should run as',
      choices: ACCOUNT_CHOICES,
      initial: 0,
    },
    { onCancel: () => process.exit(1) }
  );

  if (accountType !== 'Custom') {
    return resolveBuiltinAccount(accountType);
  }

  const { username, password } = await prompts(
    [
      {
        type: 'text',
        name: 'username',
        message: 'Account username (e.g. DOMAIN\\svc_account or .\\svc_account)',
        validate: (v) => (v && v.trim().length > 0 ? true : 'Username is required'),
      },
      {
        type: 'password',
        name: 'password',
        message: 'Account password',
      },
    ],
    { onCancel: () => process.exit(1) }
  );

  return { account: username, password };
}

function resolveBuiltinAccount(accountType) {
  const account = BUILTIN_ACCOUNTS[accountType];
  return { account: account || undefined, password: undefined };
}

// Non-interactive resolution from flags: --account / --username / --password.
// --account may be one of the builtin names or an explicit DOMAIN\user string.
function resolveLogonFromFlags({ account, username, password }) {
  if (!account && !username) {
    return {};
  }
  if (account && Object.prototype.hasOwnProperty.call(BUILTIN_ACCOUNTS, account)) {
    return resolveBuiltinAccount(account);
  }
  const resolvedAccount = account || username;
  return { account: resolvedAccount, password };
}

module.exports = { promptLogon, resolveLogonFromFlags, BUILTIN_ACCOUNTS };
