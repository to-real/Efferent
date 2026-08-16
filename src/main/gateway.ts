import { shouldForward, subscribeEvents, type EventFrame } from './event-stream.js'

export type StreamPath = '/api/events.mux' | '/api/events.host'

export interface GatewayDeps {
  baseUrl: string
  /** RPC 通道（信封由网关构造）。 */
  post(path: string, body: unknown): Promise<unknown>
  /** 过滤后的帧转发（IPC 到 renderer）。 */
  send(channel: string, payload: unknown): void
  /** 流订阅（注入以便测试；真实实现为 subscribeEvents）。 */
  subscribeStream(path: StreamPath, onFrame: (frame: EventFrame) => void, signal: AbortSignal): Promise<void>
}

export interface Gateway {
  start(): Promise<void>
  stop(): void
  rpc(method: string, payload: Record<string, unknown>): Promise<unknown>
  subscribeSession(sessionId: string): void
  unsubscribeSession(sessionId: string): void
}

let rpcSeq = 0

/**
 * 引擎网关：RPC + 双流订阅 + 会话过滤转发 + 断线重连。
 * renderer 永不感知 HTTP/SSE 细节（顺着内核：状态以事件流为单一事实源）。
 */
export function createGateway(deps: GatewayDeps): Gateway {
  const openSessions = new Set<string>()
  const controller = new AbortController()
  let backoffMs = 1_000
  const running = new Set<Promise<void>>()

  const pump = (path: StreamPath): Promise<void> => {
    const loop = async (): Promise<void> => {
      for (;;) {
        try {
          await deps.subscribeStream(path, frame => {
            if (shouldForward(frame, openSessions)) deps.send('engine:frame', frame)
          }, controller.signal)
          // 正常返回（流关闭）也进入重连
        } catch (err) {
          if (controller.signal.aborted) return
          // 引擎重启期间的断线是预期路径
        }
        if (controller.signal.aborted) return
        await new Promise(resolve => setTimeout(resolve, backoffMs))
        backoffMs = Math.min(backoffMs * 2, 30_000)
      }
    }
    const p = loop()
    running.add(p)
    return p
  }

  return {
    async start() {
      // 点火不等待：泵循环永不结束（断线自愈），await 会永久挂起
      void pump('/api/events.mux')
      void pump('/api/events.host')
    },
    stop() {
      controller.abort()
    },
    async rpc(method, payload) {
      const raw = await deps.post(`/api/${method}`, {
        type: 'client-request',
        rpcId: `efferent-gw-${++rpcSeq}`,
        method,
        payload,
      }) as { type: string; result?: { ok: boolean; value?: unknown; error?: string } }
      if (!raw || raw.type !== 'server-response' || !raw.result) {
        throw new Error(`引擎响应形状异常（${method}）`)
      }
      if (!raw.result.ok) {
        const err = raw.result.error
        const detail = err === undefined ? '' : typeof err === 'string' ? err : JSON.stringify(err)
        throw new Error(detail || `引擎调用失败（${method}）`)
      }
      return raw.result.value
    },
    subscribeSession(sessionId) {
      openSessions.add(sessionId)
      backoffMs = 1_000
    },
    unsubscribeSession(sessionId) {
      openSessions.delete(sessionId)
    },
  }
}

export { subscribeEvents }
