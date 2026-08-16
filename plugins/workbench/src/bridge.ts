/**
 * 桥接层：Electron 里走 preload 暴露的 window.efferent（IPC→主进程网关）；
 * 纯浏览器开发态回退为 fixture 播放器（真实语料重放，UI 可离线开发）。
 */

export interface Bridge {
  rpc(method: string, payload: Record<string, unknown>): Promise<unknown>
  onFrame(cb: (frame: unknown) => void): void
  subscribeSession(sessionId: string): void
  respond(rpcId: string, value: unknown): Promise<unknown>
  defaultWorkspaceDir: string
}

interface ElectronBridgeGlobal {
  efferent: {
    rpc(method: string, payload: Record<string, unknown>): Promise<unknown>
    onFrame(cb: (frame: unknown) => void): void
    subscribeSession(sessionId: string): void
    respond(rpcId: string, value: unknown): Promise<unknown>
    defaultWorkspaceDir: string
  }
}

export function getBridge(): Bridge {
  const globalThis_ = globalThis as Partial<ElectronBridgeGlobal>
  if (globalThis_.efferent != null) {
    return globalThis_.efferent
  }
  return createFixtureBridge()
}

/** fixture 播放器：语料按 30ms/帧重放（纯浏览器 dev 用）。 */
function createFixtureBridge(): Bridge {
  const listeners: Array<(f: unknown) => void> = []
  let started = false

  const start = async (): Promise<void> => {
    if (started) return
    started = true
    const { default: corpus } = await import('./fixtures/events.json')
    for (const frame of corpus as unknown[]) {
      await new Promise(r => setTimeout(r, 30))
      for (const cb of listeners) cb(frame)
    }
  }

  return {
    async rpc(method) {
      void start()
      return { ok: true, method, items: [] }
    },
    onFrame(cb) {
      listeners.push(cb)
      void start()
    },
    subscribeSession() { /* fixture 单会话 */ },
    async respond() { return { accepted: true } },
    defaultWorkspaceDir: '.',
  }
}
