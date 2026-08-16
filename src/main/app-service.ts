import type { EngineProcess, EngineState } from './engine-process.js'

export interface AppWindowDeps {
  showMain(baseUrl: string): void
  showError(diagnosis: string, restart: () => Promise<void>): void
  focusMain(): void
}

export interface AppSplashDeps {
  show(): void
  hide(): void
}

export interface AppDeps {
  engine: Pick<EngineProcess, 'start' | 'stop' | 'onStateChange'>
  windows: AppWindowDeps
  splash: AppSplashDeps
  updater: { checkAndNotify(): Promise<void> }
  lock: {
    acquire(): boolean
    onSecondInstance(cb: () => void): void
  }
  log(msg: string): void
}

export interface App {
  init(): Promise<void>
  shutdown(): Promise<void>
}

const errorMessage = (err: unknown): string => (err instanceof Error ? err.message : String(err))

/**
 * 桌面行为组合根：所有决策（启动顺序、崩溃恢复、退出清理、单实例仲裁）
 * 集中于此，且不 import 任何 Electron API——可全量假依赖测试（接缝 1）。
 * 新手引导（API Key / 工作区）完全交给 DSH 原生界面，壳不设门槛。
 */
export function createApp(deps: AppDeps): App {
  let initialized = false

  const restart = async (): Promise<void> => {
    try {
      const { baseUrl } = await deps.engine.start()
      deps.windows.showMain(baseUrl)
    } catch (err) {
      deps.log(`引擎重启失败：${errorMessage(err)}`)
      deps.windows.showError(errorMessage(err), restart)
    }
  }

  const focusMain = () => { deps.windows.focusMain() }

  async function init(): Promise<void> {
    if (initialized) throw new Error('app 已初始化，不可重复 init')
    initialized = true

    if (!deps.lock.acquire()) {
      deps.log('已有实例在运行，本实例退出')
      deps.lock.onSecondInstance(focusMain)
      return
    }
    deps.lock.onSecondInstance(focusMain)

    deps.splash.show()
    try {
      const { baseUrl } = await deps.engine.start()
      deps.splash.hide()
      deps.windows.showMain(baseUrl)
    } catch (err) {
      deps.splash.hide()
      deps.log(`引擎启动失败：${errorMessage(err)}`)
      deps.windows.showError(errorMessage(err), restart)
      return
    }

    deps.engine.onStateChange(state => {
      if (state === 'crashed') {
        deps.windows.showError('引擎进程意外退出，可尝试重启。', restart)
      }
    })

    // 更新检查后台进行，不阻塞启动
    void deps.updater.checkAndNotify().catch(err => {
      deps.log(`更新检查失败（忽略）：${errorMessage(err)}`)
    })
  }

  async function shutdown(): Promise<void> {
    try {
      await deps.engine.stop()
    } catch (err) {
      // 退出流程不因引擎僵死而挂起（树杀兜底已在 EngineProcess 内）
      deps.log(`引擎停止异常（忽略以完成退出）：${errorMessage(err)}`)
    }
  }

  return { init, shutdown }
}
