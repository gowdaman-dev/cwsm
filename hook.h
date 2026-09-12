#ifndef HOOK_H
#define HOOK_H

#define CWSM_HOOK_EVENT_START _T("Start")
#define CWSM_HOOK_EVENT_STOP _T("Stop")
#define CWSM_HOOK_EVENT_EXIT _T("Exit")
#define CWSM_HOOK_EVENT_POWER _T("Power")
#define CWSM_HOOK_EVENT_ROTATE _T("Rotate")

#define CWSM_HOOK_ACTION_PRE _T("Pre")
#define CWSM_HOOK_ACTION_POST _T("Post")
#define CWSM_HOOK_ACTION_CHANGE _T("Change")
#define CWSM_HOOK_ACTION_RESUME _T("Resume")

/* Hook name will be "<service> (<event>/<action>)" */
#define HOOK_NAME_LENGTH SERVICE_NAME_LENGTH * 2

#define CWSM_HOOK_VERSION 1

/* Hook ran successfully. */
#define CWSM_HOOK_STATUS_SUCCESS 0
/* No hook configured. */
#define CWSM_HOOK_STATUS_NOTFOUND 1
/* Hook requested abort. */
#define CWSM_HOOK_STATUS_ABORT 99
/* Internal error launching hook. */
#define CWSM_HOOK_STATUS_ERROR 100
/* Hook was not run. */
#define CWSM_HOOK_STATUS_NOTRUN 101
/* Hook timed out. */
#define CWSM_HOOK_STATUS_TIMEOUT 102
/* Hook returned non-zero. */
#define CWSM_HOOK_STATUS_FAILED 111

/* Version 1. */
#define CWSM_HOOK_ENV_VERSION _T("CWSM_HOOK_VERSION")
#define CWSM_HOOK_ENV_IMAGE_PATH _T("CWSM_EXE")
#define CWSM_HOOK_ENV_CWSM_CONFIGURATION _T("CWSM_CONFIGURATION")
#define CWSM_HOOK_ENV_CWSM_VERSION _T("CWSM_VERSION")
#define CWSM_HOOK_ENV_BUILD_DATE _T("CWSM_BUILD_DATE")
#define CWSM_HOOK_ENV_PID _T("CWSM_PID")
#define CWSM_HOOK_ENV_DEADLINE _T("CWSM_DEADLINE")
#define CWSM_HOOK_ENV_SERVICE_NAME _T("CWSM_SERVICE_NAME")
#define CWSM_HOOK_ENV_SERVICE_DISPLAYNAME _T("CWSM_SERVICE_DISPLAYNAME")
#define CWSM_HOOK_ENV_COMMAND_LINE _T("CWSM_COMMAND_LINE")
#define CWSM_HOOK_ENV_APPLICATION_PID _T("CWSM_APPLICATION_PID")
#define CWSM_HOOK_ENV_EVENT _T("CWSM_EVENT")
#define CWSM_HOOK_ENV_ACTION _T("CWSM_ACTION")
#define CWSM_HOOK_ENV_TRIGGER _T("CWSM_TRIGGER")
#define CWSM_HOOK_ENV_LAST_CONTROL _T("CWSM_LAST_CONTROL")
#define CWSM_HOOK_ENV_START_REQUESTED_COUNT _T("CWSM_START_REQUESTED_COUNT")
#define CWSM_HOOK_ENV_START_COUNT _T("CWSM_START_COUNT")
#define CWSM_HOOK_ENV_THROTTLE_COUNT _T("CWSM_THROTTLE_COUNT")
#define CWSM_HOOK_ENV_EXIT_COUNT _T("CWSM_EXIT_COUNT")
#define CWSM_HOOK_ENV_EXITCODE _T("CWSM_EXITCODE")
#define CWSM_HOOK_ENV_RUNTIME _T("CWSM_RUNTIME")
#define CWSM_HOOK_ENV_APPLICATION_RUNTIME _T("CWSM_APPLICATION_RUNTIME")

typedef struct {
  TCHAR name[HOOK_NAME_LENGTH];
  HANDLE thread_handle;
} hook_thread_data_t;

typedef struct {
  hook_thread_data_t *data;
  int num_threads;
} hook_thread_t;

bool valid_hook_name(const TCHAR *, const TCHAR *, bool);
void await_hook_threads(hook_thread_t *, SERVICE_STATUS_HANDLE, SERVICE_STATUS *, unsigned long);
int cwsm_hook(hook_thread_t *, cwsm_service_t *, TCHAR *, TCHAR *, unsigned long *, unsigned long, bool);
int cwsm_hook(hook_thread_t *, cwsm_service_t *, TCHAR *, TCHAR *, unsigned long *, unsigned long);
int cwsm_hook(hook_thread_t *, cwsm_service_t *, TCHAR *, TCHAR *, unsigned long *);

#endif
