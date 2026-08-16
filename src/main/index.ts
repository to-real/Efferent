import { app, Menu, ipcMain } from 'electron'
// asar 内 CJS 互操作不支持具名导出（打包环境实测），须走默认导出解构
import electronUpdaterPkg from 'electron-updater'
const { autoUpdater } = electronUpdaterPkg
import { join } from 'node:path'
import { createApp, type AppDeps } from './app-service.js'
import { createEngineProcess, createRealEngineDeps } from './engine-process.js'
import { pickFreePort, listenProbe } from './port-picker.js'
import { createRealWindows, resolveWorkbench, sendToMainWindow } from './windows.js'
import { createOrphanCleaner, realListProcesses, realTreeKill } from './orphan-cleaner.js'
import { BRAND } from './branding.js'
import { showSplash, hideSplash } from './splash.js'
import { openTaskCenter } from './task-center.js'
import { createGateway, type Gateway } from './gateway.js'
import { subscribeEvents } from './event-stream.js'
import { realPost } from './engine-api.js'
import { mkdirSync } from 'node:fs'

// ---------- 资源与数据目录 ----------

function resourcesDir(): string {
  // 打包后：安装目录 resources/；开发态：仓库根/resources/（npm run stage 的产出）
  return app.isPackaged
    ? process.resourcesPath
    : join(process.cwd(), 'resources')
}

function appDataDir(): string {
  return join(app.getPath('appData'), 'Efferent')
}

function enginePaths() {
  const res = resourcesDir()
  return {
    nodeExe: join(res, 'runtime', 'node.exe'),
    engineEntry: join(res, 'engine', 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js'),
    dshHome: join(appDataDir(), 'dsh-home'),
  }
}

// ---------- 单实例 ----------

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
}

// ---------- 装配 ----------
// 新手引导（API Key / 工作区）完全交给 DSH 原生界面，壳不设门槛。

// 关于面板（产品身份，无引擎字样）
app.setAboutPanelOptions({
  applicationName: BRAND.name,
  applicationVersion: app.getVersion(),
  version: app.getVersion(),
  credits: `${BRAND.slogan} · MIT © 2026 Zhang Jingyuan`,
})

function installMenu(): void {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: '文件', submenu: [{ role: 'quit', label: '退出' }] },
    { label: '查看', submenu: [
      { label: '任务中心', accelerator: 'CmdOrCtrl+T', click: () => { openTaskCenter() } },
    ] },
    { label: '开发者', submenu: [
      { label: '引擎诊断界面（自带 UI）', click: () => { openDiagnosticWindow() } },
    ] },
    { label: '帮助', submenu: [{ role: 'about', label: `关于 ${BRAND.name}` }] },
  ]))
}

let currentBaseUrl: string | null = null
let gatewayRef: Gateway | null = null

/** 诊断模式：引擎自带 Web UI 的隐藏入口（默认产品界面为自研工作台）。 */
function openDiagnosticWindow(): void {
  if (currentBaseUrl == null) return
  const { BrowserWindow } = require('electron') as typeof import('electron')
  const win = new BrowserWindow({ width: 1280, height: 820, autoHideMenuBar: true })
  void win.loadURL(currentBaseUrl)
}

function installGatewayIpc(): void {
  ipcMain.handle('ef:rpc', (_e, method: string, payload: Record<string, unknown>) => {
    if (gatewayRef == null) throw new Error('网关未就绪')
    return gatewayRef.rpc(method, payload)
  })
  ipcMain.handle('ef:subscribe', (_e, sessionId: string) => {
    gatewayRef?.subscribeSession(sessionId)
  })
  ipcMain.handle('ef:respond', async (_e, rpcId: string, value: unknown) => {
    if (currentBaseUrl == null) throw new Error('引擎未就绪')
    // 审批/提问应答：POST /api/respond，ClientResponse 信封，rpcId 回声原帧
    return realPost(currentBaseUrl)('/api/respond', {
      type: 'client-response',
      rpcId,
      result: { ok: true, value },
    })
  })
}

async function bootstrap(): Promise<void> {
  installMenu()
  // 插件宿主装配先于窗口：主窗入口来自 plugins/（找不到 workbench 插件即启动失败）
  await resolveWorkbench()
  const paths = enginePaths()

  // 断电/强杀残留的引擎进程：启动前清理（排除自身）
  const orphanCleaner = createOrphanCleaner(paths.engineEntry, {
    listProcesses: realListProcesses,
    treeKill: realTreeKill,
  })
  const killed = await orphanCleaner.clean()
  if (killed.length > 0) console.log(`[efferent] 已清理 ${killed.length} 个残留引擎进程: ${killed.join(', ')}`)

  const port = await pickFreePort({ isFree: listenProbe() })
  const engine = createEngineProcess(paths, port, createRealEngineDeps())

  // 默认工作区目录（引擎要求已存在）
  const defaultWorkspaceDir = join(appDataDir(), 'workspace-default')
  mkdirSync(defaultWorkspaceDir, { recursive: true })
  process.env.EFFERENT_DEFAULT_WS = defaultWorkspaceDir

  const deps: AppDeps = {
    engine,
    windows: createRealWindows(),
    splash: { show: showSplash, hide: hideSplash },
    updater: {
      async checkAndNotify() {
        autoUpdater.autoDownload = true
        // v0.1：下载完成后在下次退出时安装，不弹更新 UI
        await autoUpdater.checkForUpdatesAndNotify()
      },
    },
    lock: {
      acquire: () => gotLock,
      onSecondInstance: cb => { app.on('second-instance', cb) },
    },
    log: msg => { console.log(`[efferent] ${msg}`) },
  }

  installGatewayIpc()
  const appService = createApp(deps)
  await appService.init()

  // 引擎就绪：建立网关（RPC + 双流订阅），帧转发主窗口
  const engineUrl = engine.currentUrl()
  if (engineUrl != null) {
    currentBaseUrl = engineUrl
    gatewayRef = createGateway({
      baseUrl: engineUrl,
      post: realPost(engineUrl),
      send: (channel, payload) => { sendToMainWindow(channel, payload) },
      subscribeStream: (path, onFrame, signal) => subscribeEvents(engineUrl, path, onFrame, signal),
    })
    void gatewayRef.start()
  }

  // 退出流程：先停引擎再退出
  let quitting = false
  app.on('before-quit', event => {
    if (quitting) return
    quitting = true
    event.preventDefault()
    void appService.shutdown().finally(() => { app.exit(0) })
  })
  app.on('window-all-closed', () => { app.quit() })
}

void app.whenReady().then(bootstrap).catch(err => {
  console.error('[efferent] 启动失败：', err)
  app.exit(1)
})
