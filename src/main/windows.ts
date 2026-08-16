import { BrowserWindow, ipcMain } from 'electron'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { AppWindowDeps } from './app-service.js'
import { appTitle, stripEngineBranding } from './branding.js'
import { setEngineBaseUrl } from './task-center.js'

const here = fileURLToPath(new URL('.', import.meta.url))

let mainWin: BrowserWindow | null = null

function preloadPath(): string {
  // dist/main/../preload/bridge.js（tsc 产出结构）
  return join(here, '..', 'preload', 'bridge.js')
}

function rendererPath(page: 'error-page'): string {
  return join(here, '..', '..', 'renderer', page, 'index.html')
}

function windowOptions(width: number, height: number) {
  return {
    width,
    height,
    useContentSize: true,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      preload: preloadPath(),
    },
  }
}

/** 主窗口：加载引擎 URL；标题品牌化（覆盖引擎自带标题，导航后重新覆盖）。 */
export function showMainWindow(baseUrl: string): void {
  setEngineBaseUrl(baseUrl)
  if (mainWin == null || mainWin.isDestroyed()) {
    mainWin = new BrowserWindow(windowOptions(1280, 820))
    mainWin.on('closed', () => { mainWin = null })
    // 页面标题的权威拦截点：SPA 任何时点改 document.title 都会被这里收编为品牌标题
    mainWin.on('page-title-updated', (event, title) => {
      event.preventDefault()
      mainWin?.setTitle(title.includes('DeepSeek') ? stripEngineBranding(title) : appTitle())
    })
    mainWin.setTitle(appTitle())
  }
  void mainWin.loadURL(baseUrl)
  mainWin.show()
  mainWin.focus()
}

export function focusMainWindow(): void {
  if (mainWin != null && !mainWin.isDestroyed()) {
    if (mainWin.isMinimized()) mainWin.restore()
    mainWin.show()
    mainWin.focus()
  }
}

/** 引擎故障页；渲染进程经 IPC 请求重启。 */
export function showErrorWindow(diagnosis: string, restart: () => Promise<void>): void {
  const win = new BrowserWindow({ ...windowOptions(640, 480), resizable: false })
  ipcMain.removeHandler('engine-error:restart')
  ipcMain.handle('engine-error:restart', async () => {
    await restart()
    win.close()
  })
  void win.loadFile(rendererPath('error-page'))
  win.webContents.on('did-finish-load', () => {
    win.webContents.send('engine-error:info', diagnosis)
  })
}

/** 组合根所需的窗口依赖（接缝 1 的真实实现）。 */
export function createRealWindows(): AppWindowDeps {
  return {
    showMain: showMainWindow,
    showError: showErrorWindow,
    focusMain: focusMainWindow,
  }
}
