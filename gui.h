#ifndef GUI_H
#define GUI_H

#include <stdio.h>
#include <windows.h>
#include <commctrl.h>
#include "resource.h"

int cwsm_gui(int, cwsm_service_t *);
void centre_window(HWND);
int configure(HWND, cwsm_service_t *, cwsm_service_t *);
int install(HWND);
int remove(HWND);
int edit(HWND, cwsm_service_t *);
void browse(HWND);
INT_PTR CALLBACK cwsm_dlg(HWND, UINT, WPARAM, LPARAM);

#endif
