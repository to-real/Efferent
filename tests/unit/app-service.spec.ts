import { describe, expect, it, vi } from 'vitest'
import { createApp, type AppDeps } from '../../src/main/app-service.js'
import type { EngineState } from '../../src/main/engine-process.js'

// ---------- 替身 ----------

function makeDeps(opts: { acquire?: boolean; startError?: Error } = {}) {
  const order: string[] = []
  let stateCb: ((s: EngineState) => void) | null = null
  let startCount = 0
  const deps: AppDeps = {
    engine: {
      start: vi.fn(async () => {
        order.push(`engine.start:${++startCount}`)
        if (opts.startError) throw opts.startError
        return { port: 1, baseUrl: `http://127.0.0.1:${startCount}` }
      }),
      stop: vi.fn(async () => { order.push('engine.stop') }),
      onStateChange: cb => { stateCb = cb; return () => { stateCb = null } },
    },
    windows: {
      showMain: vi.fn((baseUrl: string) => { order.push(`showMain:${baseUrl}`) }),
      showError: vi.fn((_diag: string, _restart: () => void) => { order.push('showError') }),
      focusMain: vi.fn(() => { order.push('focusMain') }),
    },
    updater: { checkAndNotify: vi.fn(async () => { order.push('updater') }) },
    lock: {
      acquire: () => opts.acquire ?? true,
      onSecondInstance: cb => { secondInstanceCb = cb },
    },
    log: () => {},
  }
  let secondInstanceCb: (() => void) | null = null
  return {
    deps, order,
    crash: () => stateCb?.('crashed'),
    secondInstance: () => secondInstanceCb?.(),
    engineStart: deps.engine.start as ReturnType<typeof vi.fn>,
    showMain: deps.windows.showMain as ReturnType<typeof vi.fn>,
    showError: deps.windows.showError as ReturnType<typeof vi.fn>,
    focusMain: deps.windows.focusMain as ReturnType<typeof vi.fn>,
    stop: deps.engine.stop as ReturnType<typeof vi.fn>,
  }
}

// ---------- 测试 ----------

describe('createApp', () => {
  it('启动顺序：锁→引擎→主窗口→更新（后台）', async () => {
    const { deps, order } = makeDeps()
    await createApp(deps).init()
    expect(order).toEqual([
      'engine.start:1',
      'showMain:http://127.0.0.1:1',
      'updater',
    ])
  })

  it('二次实例：不起引擎不开窗口，触发时聚焦', async () => {
    const { deps, engineStart, focusMain, secondInstance } = makeDeps({ acquire: false })
    await createApp(deps).init()
    expect(engineStart).not.toHaveBeenCalled()
    secondInstance()
    expect(focusMain).toHaveBeenCalledTimes(1)
  })

  it('首实例也注册聚焦回调', async () => {
    const { deps, focusMain, secondInstance } = makeDeps({ acquire: true })
    await createApp(deps).init()
    secondInstance()
    expect(focusMain).toHaveBeenCalledTimes(1)
  })

  it('引擎启动失败：透传诊断到错误页，init 不崩', async () => {
    const boom = new Error('引擎迟迟未就绪（已等待 120s）')
    const { deps, showError } = makeDeps({ startError: boom })
    await expect(createApp(deps).init()).resolves.toBeUndefined()
    expect(showError).toHaveBeenCalledWith(expect.stringContaining('迟迟未就绪'), expect.any(Function))
  })

  it('健康后崩溃：showError，restart 重启引擎并重开主窗口', async () => {
    const { deps, crash, showError, showMain } = makeDeps()
    await createApp(deps).init()
    crash()
    expect(showError).toHaveBeenCalledTimes(1)
    const restart = (showError as ReturnType<typeof vi.fn>).mock.calls[0]![1] as () => Promise<void>
    await restart()
    expect(showMain).toHaveBeenLastCalledWith('http://127.0.0.1:2')
  })

  it('shutdown 等待 engine.stop；stop 抛错也被吞掉', async () => {
    const d = makeDeps()
    const app = createApp(d.deps)
    d.deps.engine.stop = vi.fn(async () => { throw new Error('僵死') })
    await expect(app.shutdown()).resolves.toBeUndefined()
  })

  it('正常 shutdown 调用 engine.stop', async () => {
    const { deps, stop } = makeDeps()
    const app = createApp(deps)
    await app.init()
    await app.shutdown()
    expect(stop).toHaveBeenCalled()
  })
})
