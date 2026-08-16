import { BrowserWindow, ipcMain } from 'electron'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createEngineApi, realPost, toTaskRows, type TaskRow } from './engine-api.js'
import { focusMainWindow } from './windows.js'

const here = fileURLToPath(new URL('.', import.meta.url))

let centerWin: BrowserWindow | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null
let engineBaseUrl: string | null = null

/** 由主窗口装配处注入引擎地址（showMainWindow 收到 baseUrl 时调用）。 */
export function setEngineBaseUrl(url: string): void {
  engineBaseUrl = url
}

function preloadPath(): string {
  return join(here, '..', 'preload', 'bridge.js')
}

function pushRows(): void {
  if (centerWin == null || centerWin.isDestroyed() || engineBaseUrl == null) return
  const api = createEngineApi(engineBaseUrl, { post: realPost(engineBaseUrl) })
  void Promise.all([api.listSessions(), api.listWorkspaces()])
    .then(([sessions, workspaces]) => {
      centerWin?.webContents.send('tasks:rows', toTaskRows(sessions, workspaces))
    })
    .catch(() => {
      // 引擎离线/未就绪：推送空态，下轮重试
      centerWin?.webContents.send('tasks:rows', [] as TaskRow[])
    })
}

/** 任务中心：多会话并行总览（2s 轮询）。 */
export function openTaskCenter(): void {
  if (centerWin != null && !centerWin.isDestroyed()) {
    centerWin.show()
    centerWin.focus()
    pushRows()
    return
  }
  centerWin = new BrowserWindow({
    width: 880,
    height: 560,
    useContentSize: true,
    autoHideMenuBar: true,
    title: '任务中心 · Efferent',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      preload: preloadPath(),
    },
  })
  centerWin.on('closed', () => {
    if (pollTimer != null) { clearInterval(pollTimer); pollTimer = null }
    centerWin = null
  })
  ipcMain.removeHandler('tasks:focus-main')
  ipcMain.handle('tasks:focus-main', () => { focusMainWindow() })
  void centerWin.loadFile(join(here, '..', '..', 'renderer', 'tasks', 'index.html'))
  pollTimer = setInterval(pushRows, 2_000)
  pushRows()
}
