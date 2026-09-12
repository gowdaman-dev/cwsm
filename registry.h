#ifndef REGISTRY_H
#define REGISTRY_H

#define CWSM_REGISTRY _T("SYSTEM\\CurrentControlSet\\Services\\%s")
#define CWSM_REG_PARAMETERS _T("Parameters")
#define CWSM_REGISTRY_GROUPS _T("SYSTEM\\CurrentControlSet\\Control\\ServiceGroupOrder")
#define CWSM_REG_GROUPS _T("List")
#define CWSM_REG_EXE _T("Application")
#define CWSM_REG_FLAGS _T("AppParameters")
#define CWSM_REG_DIR _T("AppDirectory")
#define CWSM_REG_ENV _T("AppEnvironment")
#define CWSM_REG_ENV_EXTRA _T("AppEnvironmentExtra")
#define CWSM_REG_EXIT _T("AppExit")
#define CWSM_REG_RESTART_DELAY _T("AppRestartDelay")
#define CWSM_REG_THROTTLE _T("AppThrottle")
#define CWSM_REG_STOP_METHOD_SKIP _T("AppStopMethodSkip")
#define CWSM_REG_KILL_CONSOLE_GRACE_PERIOD _T("AppStopMethodConsole")
#define CWSM_REG_KILL_WINDOW_GRACE_PERIOD _T("AppStopMethodWindow")
#define CWSM_REG_KILL_THREADS_GRACE_PERIOD _T("AppStopMethodThreads")
#define CWSM_REG_KILL_PROCESS_TREE _T("AppKillProcessTree")
#define CWSM_REG_STDIN _T("AppStdin")
#define CWSM_REG_STDOUT _T("AppStdout")
#define CWSM_REG_STDERR _T("AppStderr")
#define CWSM_REG_STDIO_SHARING _T("ShareMode")
#define CWSM_REG_STDIO_DISPOSITION _T("CreationDisposition")
#define CWSM_REG_STDIO_FLAGS _T("FlagsAndAttributes")
#define CWSM_REG_STDIO_COPY_AND_TRUNCATE _T("CopyAndTruncate")
#define CWSM_REG_HOOK_SHARE_OUTPUT_HANDLES _T("AppRedirectHook")
#define CWSM_REG_ROTATE _T("AppRotateFiles")
#define CWSM_REG_ROTATE_ONLINE _T("AppRotateOnline")
#define CWSM_REG_ROTATE_SECONDS _T("AppRotateSeconds")
#define CWSM_REG_ROTATE_BYTES_LOW _T("AppRotateBytes")
#define CWSM_REG_ROTATE_BYTES_HIGH _T("AppRotateBytesHigh")
#define CWSM_REG_ROTATE_DELAY _T("AppRotateDelay")
#define CWSM_REG_TIMESTAMP_LOG _T("AppTimestampLog")
#define CWSM_REG_PRIORITY _T("AppPriority")
#define CWSM_REG_AFFINITY _T("AppAffinity")
#define CWSM_REG_NO_CONSOLE _T("AppNoConsole")
#define CWSM_REG_HOOK _T("AppEvents")
#define CWSM_STDIO_LENGTH 29

HKEY open_service_registry(const TCHAR *, REGSAM sam, bool);
long open_registry(const TCHAR *, const TCHAR *, REGSAM sam, HKEY *, bool);
HKEY open_registry(const TCHAR *, const TCHAR *, REGSAM sam, bool);
HKEY open_registry(const TCHAR *, const TCHAR *, REGSAM sam);
HKEY open_registry(const TCHAR *, REGSAM sam);
long enumerate_registry_values(HKEY, unsigned long *, TCHAR *, unsigned long);
int create_messages();
int create_parameters(cwsm_service_t *, bool);
int create_exit_action(TCHAR *, const TCHAR *, bool);
int get_environment(TCHAR *, HKEY, TCHAR *, TCHAR **, unsigned long *);
int get_string(HKEY, TCHAR *, TCHAR *, unsigned long, bool, bool, bool);
int get_string(HKEY, TCHAR *, TCHAR *, unsigned long, bool);
int expand_parameter(HKEY, TCHAR *, TCHAR *, unsigned long, bool, bool);
int expand_parameter(HKEY, TCHAR *, TCHAR *, unsigned long, bool);
int set_string(HKEY, TCHAR *, TCHAR *, bool);
int set_string(HKEY, TCHAR *, TCHAR *);
int set_expand_string(HKEY, TCHAR *, TCHAR *);
int set_number(HKEY, TCHAR *, unsigned long);
int get_number(HKEY, TCHAR *, unsigned long *, bool);
int get_number(HKEY, TCHAR *, unsigned long *);
int format_double_null(TCHAR *, unsigned long, TCHAR **, unsigned long *);
int unformat_double_null(TCHAR *, unsigned long, TCHAR **, unsigned long *);
int copy_double_null(TCHAR *, unsigned long, TCHAR **);
int append_to_double_null(TCHAR *, unsigned long, TCHAR **, unsigned long *, TCHAR *, size_t, bool);
int remove_from_double_null(TCHAR *, unsigned long, TCHAR **, unsigned long *, TCHAR *, size_t, bool);
void override_milliseconds(TCHAR *, HKEY, TCHAR *, unsigned long *, unsigned long, unsigned long);
int get_io_parameters(cwsm_service_t *, HKEY);
int get_parameters(cwsm_service_t *, STARTUPINFO *);
int get_exit_action(const TCHAR *, unsigned long *, TCHAR *, bool *);
int set_hook(const TCHAR *, const TCHAR *, const TCHAR *, TCHAR *);
int get_hook(const TCHAR *, const TCHAR *, const TCHAR *, TCHAR *, unsigned long);

#endif
