import { describe, expect, it, vi } from 'vitest'
import { createEngineApi, toTaskRows, type SessionSummary, type WorkspaceView } from '../../src/main/engine-api.js'

// ---------- 替身 ----------

function fakePost(handler: (path: string, body: any) => unknown) {
  return vi.fn(async (path: string, body: unknown) => handler(path, body))
}

const SAMPLE_SESSIONS: SessionSummary[] = [
  {
    sessionId: 's1', updatedAt: 1786810000000, running: true, blank: false,
    projections: { asOfSeq: 5, values: { title: '重构计划' } },
  },
  {
    sessionId: 's2', updatedAt: 1786800000000, running: false, blank: false,
    projections: { asOfSeq: 3, values: { title: null } },
  },
  { sessionId: 's3', updatedAt: 1786790000000, running: false, blank: true },
]

const SAMPLE_WORKSPACES: WorkspaceView[] = [
  { workspaceId: 'w1', path: 'E:/dev/Efferent', title: 'Efferent', sessionIds: ['s1'], createdAt: 1, updatedAt: 2 },
  { workspaceId: 'w2', path: 'E:/notes', title: 'notes', sessionIds: ['s2', 's3'], createdAt: 1, updatedAt: 2 },
]

// ---------- 测试 ----------

describe('createEngineApi', () => {
  it('以正确信封调用 session.list 并解析响应', async () => {
    const post = fakePost((_p, _b) => ({
      type: 'server-response', rpcId: 'r1', result: { ok: true, value: { items: SAMPLE_SESSIONS } },
    }))
    const api = createEngineApi('http://127.0.0.1:1', { post })
    const items = await api.listSessions()
    expect(items).toHaveLength(3)
    const [path, body] = (post as ReturnType<typeof vi.fn>).mock.calls[0] as unknown as [string, any]
    expect(path).toBe('/api/session.list')
    expect(body.type).toBe('client-request')
    expect(body.method).toBe('session.list')
    expect(typeof body.rpcId).toBe('string')
    expect(body.payload).toEqual({})
  })

  it('业务错误（ok:false）抛出并带错误信息', async () => {
    const post = fakePost(() => ({
      type: 'server-response', rpcId: 'r1', result: { ok: false, error: 'boom' },
    }))
    const api = createEngineApi('http://127.0.0.1:1', { post })
    await expect(api.listSessions()).rejects.toThrow('boom')
  })

  it('listWorkspaces 调用 workspace.list', async () => {
    const post = fakePost(() => ({
      type: 'server-response', rpcId: 'r', result: { ok: true, value: { items: SAMPLE_WORKSPACES } },
    }))
    const api = createEngineApi('http://127.0.0.1:1', { post })
    expect(await api.listWorkspaces()).toHaveLength(2)
  })
})

describe('toTaskRows', () => {
  it('会话与工作区 join：标题取投影、无标题给占位、运行态透传', () => {
    const rows = toTaskRows(SAMPLE_SESSIONS, SAMPLE_WORKSPACES)
    expect(rows).toEqual([
      { sessionId: 's1', title: '重构计划', workspace: 'Efferent', running: true, updatedAt: 1786810000000 },
      { sessionId: 's2', title: '未命名会话', workspace: 'notes', running: false, updatedAt: 1786800000000 },
      { sessionId: 's3', title: '未命名会话', workspace: 'notes', running: false, updatedAt: 1786790000000 },
    ])
  })

  it('找不到工作区归属的会话标记为「—」', () => {
    const rows = toTaskRows([{ sessionId: 'sx', updatedAt: 1, running: false, blank: false }], [])
    expect(rows[0]!.workspace).toBe('—')
  })

  it('空输入返回空数组', () => {
    expect(toTaskRows([], [])).toEqual([])
  })
})
