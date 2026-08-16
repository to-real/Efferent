import { app } from 'electron'
// asar 内 CJS 互操作不支持具名导出（打包环境实测），须走默认导出解构
import electronUpdaterPkg from 'electron-updater'
const { autoUpdater } = electronUpdaterPkg
import { join } from 'node:path'
import { createApp, type AppDeps } from './app-service.js'
import { createEngineProcess, createRealEngineDeps } from './engine-process.js'
import { pickFreePort, listenProbe } from './port-picker.js'
import { createRealWindows } from './windows.js'
import { createOrphanCleaner, realListProcesses, realTreeKill } from './orphan-cleaner.js'

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

async function bootstrap(): Promise<void> {
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

  const deps: AppDeps = {
    engine,
    windows: createRealWindows(),
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

  const appService = createApp(deps)
  await appService.init()

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
