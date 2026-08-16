import { BrowserWindow, ipcMain } from 'electron'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readdir, readFile } from 'node:fs/promises'
import type { AppWindowDeps } from './app-service.js'
import { appTitle, stripEngineBranding } from './branding.js'
import { setEngineBaseUrl } from './task-center.js'
import { discoverPlugins, selectWorkbench } from './plugin-host.js'

const here = fileURLToPath(new URL('.', import.meta.url))

let mainWin: BrowserWindow | null = null
let workbenchEntry: string | null = null

/**
 * 插件宿主装配：解析 plugins/ 下第一个 workbench 插件的入口。
 * 主窗不再认识任何具体前端（SPEC-0002 插件架构）——找不到即启动失败（显性优于白屏）。
 */
export async function resolveWorkbench(): Promise<string> {
  const root = join(here, '..', '..', 'plugins')
  const { plugins, issues } = await discoverPlugins(root, {
    readdir: (dir) => readdir(dir),
    readFile: (file) => readFile(file, 'utf8'),
  })
  for (const issue of issues) console.warn(`[efferent] 插件 ${issue.dir} 跳过：${issue.reason}`)
  const workbench = selectWorkbench(plugins)
  if (workbench == null) throw new Error('未找到 workbench 插件（plugins/*/plugin.json，kind=workbench）')
  workbenchEntry = workbench.entryPath
  return workbenchEntry
}

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

/** 主窗口：加载 workbench 插件入口；引擎 URL 仅供网关与诊断窗口。 */
export function showMainWindow(baseUrl: string): void {
  setEngineBaseUrl(baseUrl)
  if (mainWin == null || mainWin.isDestroyed()) {
    mainWin = new BrowserWindow(windowOptions(1280, 820))
    mainWin.on('closed', () => { mainWin = null })
    mainWin.on('page-title-updated', (event, title) => {
      event.preventDefault()
      mainWin?.setTitle(title.includes('DeepSeek') ? stripEngineBranding(title) : appTitle())
    })
    mainWin.setTitle(appTitle())
  }
  if (workbenchEntry == null) throw new Error('workbench 插件未解析（bootstrap 必须先 await resolveWorkbench()）')
  void mainWin.loadFile(workbenchEntry)
  mainWin.show()
  mainWin.focus()
}

/** 网关帧转发到主窗口（自研工作台的数据生命线）。 */
export function sendToMainWindow(channel: string, payload: unknown): void {
  if (mainWin != null && !mainWin.isDestroyed()) {
    mainWin.webContents.send(channel, payload)
  }
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
