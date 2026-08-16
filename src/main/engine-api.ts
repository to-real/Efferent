/**
 * 引擎数据通道客户端：经 HTTP RPC（POST /api/<method>）读取会话与工作区。
 * 协议事实见 docs/notes/engine-api.md（信封/信任围栏/响应形状）。
 */

export interface SessionSummary {
  sessionId: string
  updatedAt: number
  running: boolean
  blank: boolean
  projections?: { asOfSeq: number; values: Record<string, unknown> }
}

export interface WorkspaceView {
  workspaceId: string
  path: string
  title: string
  sessionIds: string[]
  createdAt: number
  updatedAt: number
}

export interface TaskRow {
  sessionId: string
  title: string
  workspace: string
  running: boolean
  updatedAt: number
}

export interface EngineApiDeps {
  post(path: string, body: unknown): Promise<unknown>
}

export interface EngineApi {
  listSessions(): Promise<SessionSummary[]>
  listWorkspaces(): Promise<WorkspaceView[]>
}

interface ResponseEnvelope {
  type: 'server-response'
  rpcId: string
  result: { ok: boolean; value?: unknown; error?: string }
}

let rpcSeq = 0

export function createEngineApi(baseUrl: string, deps: EngineApiDeps): EngineApi {
  const call = async <T>(method: string): Promise<T> => {
    const raw = await deps.post(`/api/${method}`, {
      type: 'client-request',
      rpcId: `efferent-${++rpcSeq}`,
      method,
      payload: {},
    }) as ResponseEnvelope
    if (!raw || raw.type !== 'server-response' || !raw.result) {
      throw new Error(`引擎响应形状异常（${method}）`)
    }
    if (!raw.result.ok) {
      throw new Error(raw.result.error ?? `引擎调用失败（${method}）`)
    }
    return raw.result.value as T
  }

  return {
    async listSessions() {
      const value = await call<{ items: SessionSummary[] }>('session.list')
      return value.items ?? []
    },
    async listWorkspaces() {
      const value = await call<{ items: WorkspaceView[] }>('workspace.list')
      return value.items ?? []
    },
  }
}

/** 会话×工作区 join 成任务中心行（标题取投影，缺失给占位）。 */
export function toTaskRows(sessions: SessionSummary[], workspaces: WorkspaceView[]): TaskRow[] {
  const sessionToWorkspace = new Map<string, string>()
  for (const ws of workspaces) {
    for (const sid of ws.sessionIds ?? []) sessionToWorkspace.set(sid, ws.title)
  }
  return sessions.map(s => ({
    sessionId: s.sessionId,
    title: readTitle(s),
    workspace: sessionToWorkspace.get(s.sessionId) ?? '—',
    running: s.running,
    updatedAt: s.updatedAt,
  }))
}

const readTitle = (s: SessionSummary): string => {
  const title = s.projections?.values?.['title']
  return typeof title === 'string' && title.trim().length > 0 ? title : '未命名会话'
}

/** 真实 fetch 依赖（Node 18+ 原生 fetch；loopback + 无 Origin 头满足引擎信任围栏）。 */
export function realPost(baseUrl: string): EngineApiDeps['post'] {
  return async (path, body) => {
    const res = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`引擎 HTTP ${res.status}（${path}）`)
    return await res.json()
  }
}
