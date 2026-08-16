/**
 * 引擎事件流：WebSocket 下行订阅、帧解析、会话过滤（网关的数据面）。
 * 协议事实（docs/notes/engine-api.md + 源码 websocket-downlink.ts/rpc.ts/connection/index.ts:150-155）：
 * - 下行通道 /api/events.mux（全会话）与 /api/events.host（宿主级）
 * - HTTP GET 被路由层 426 逼向 WebSocket（SSE 仅供进程内 fetch 形态）——线上必须走 WS
 * - 帧信封：{type:'server-request', rpcId, method:<帧类型>, payload:<帧本体，payload.type===method>}
 * - method 域：session/* | approval/* | question/* | stream/error（mux）；host/*（host 流）
 */

export interface EventFrame {
  type: 'server-request'
  rpcId: string
  method: string
  payload: Record<string, unknown>
}

/**
 * 从 SSE 文本块中产出 data 负载字符串（进程内/诊断场景的解析工具，保留备用）。
 */
export function parseSseData(input: string): IterableIterator<string> {
  const lines = input.split('\n')
  const out: string[] = []
  for (const line of lines) {
    if (line.startsWith('data:')) {
      out.push(line.slice(5).replace(/^ /, ''))
    }
    // 注释（:）与 event:/id:/retry: 行忽略
  }
  return out[Symbol.iterator]()
}

/** 解析并校验一条事件帧；非法输入返回 null（容错：坏帧丢弃不致命）。 */
export function parseEventFrame(raw: string): EventFrame | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) return null
  const frame = parsed as Record<string, unknown>
  if (frame['type'] !== 'server-request') return null
  if (typeof frame['method'] !== 'string' || frame['method'].length === 0) return null
  return {
    type: 'server-request',
    rpcId: typeof frame['rpcId'] === 'string' ? frame['rpcId'] : '',
    method: frame['method'],
    payload: (typeof frame['payload'] === 'object' && frame['payload'] !== null
      ? frame['payload']
      : {}) as Record<string, unknown>,
  }
}

/**
 * 会话过滤：host/* 恒转发；session 域帧按打开的会话集合过滤；
 * 无 sessionId 字段的帧保守转发（协议演进期不丢信息）。
 */
export function shouldForward(frame: EventFrame, openSessions: ReadonlySet<string>): boolean {
  if (frame.method.startsWith('host/')) return true
  const sessionId = frame.payload['sessionId']
  if (typeof sessionId !== 'string') return true
  return openSessions.has(sessionId)
}

/** 真实事件流订阅：WebSocket 下行（Node 22+ 原生 WebSocket）。 */
export function subscribeEvents(
  baseUrl: string,
  path: '/api/events.mux' | '/api/events.host',
  onFrame: (frame: EventFrame) => void,
  signal?: AbortSignal,
): Promise<void> {
  const wsUrl = `${baseUrl.replace(/^http/, 'ws')}${path}`
  return new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(wsUrl)
    let settled = false
    const onAbort = () => { try { ws.close() } catch { /* 已关 */ } }
    signal?.addEventListener('abort', onAbort, { once: true })
    ws.onmessage = (event: MessageEvent) => {
      const raw = typeof event.data === 'string' ? event.data : ''
      const frame = parseEventFrame(raw)
      if (frame != null) onFrame(frame)
    }
    ws.onerror = () => {
      if (settled) return
      settled = true
      signal?.removeEventListener('abort', onAbort)
      reject(new Error(`事件流连接失败 ${path}`))
    }
    ws.onclose = () => {
      if (settled) return
      settled = true
      signal?.removeEventListener('abort', onAbort)
      resolve() // 泵循环负责重连
    }
  })
}
