import { describe, expect, it, vi } from 'vitest'
import { createGateway } from '../../src/main/gateway.js'

function fakeDeps() {
  const frames: unknown[] = []
  let streamController: ((frame: unknown) => void) | null = null
  const deps = {
    baseUrl: 'http://127.0.0.1:1',
    post: vi.fn(async (path: string, body: any) => ({
      type: 'server-response', rpcId: body.rpcId,
      result: { ok: true, value: { ok: true, path } },
    })),
    send: (channel: string, payload: unknown) => { frames.push({ channel, payload }) },
    subscribeStream: vi.fn(async (_path: string, onFrame: (f: any) => void) => {
      streamController = onFrame
    }),
  }
  return {
    deps, frames,
    emit: (f: any) => streamController?.(f),
  }
}

const frame = (method: string, payload: Record<string, unknown> = {}) => ({
  type: 'server-request' as const, rpcId: 'r', method, payload,
})

describe('createGateway', () => {
  it('订阅 mux 与 host 两条流', async () => {
    const { deps } = fakeDeps()
    const gw = createGateway(deps)
    await gw.start()
    expect(deps.subscribeStream).toHaveBeenCalledTimes(2)
    expect((deps.subscribeStream as ReturnType<typeof vi.fn>).mock.calls.map(c => c[0]))
      .toEqual(['/api/events.mux', '/api/events.host'])
  })

  it('rpc 走信封并解包结果', async () => {
    const { deps } = fakeDeps()
    const gw = createGateway(deps)
    const result = await gw.rpc('session.list', {})
    expect(result).toMatchObject({ ok: true, path: '/api/session.list' })
    const body = (deps.post as ReturnType<typeof vi.fn>).mock.calls[0]![1] as any
    expect(body.method).toBe('session.list')
  })

  it('会话过滤：未订阅的会话帧不转发，订阅后转发，退订后停；host 帧恒转发', async () => {
    const f = fakeDeps()
    const gw = createGateway(f.deps)
    await gw.start()

    f.emit(frame('session/event', { sessionId: 's1' }))
    expect(f.frames.length).toBe(0)

    gw.subscribeSession('s1')
    f.emit(frame('session/event', { sessionId: 's1' }))
    expect(f.frames.length).toBe(1)
    expect(f.frames[0]).toMatchObject({ channel: 'engine:frame' })

    gw.unsubscribeSession('s1')
    f.emit(frame('session/event', { sessionId: 's1' }))
    expect(f.frames.length).toBe(1)

    f.emit(frame('host/session-added', {}))
    expect(f.frames.length).toBe(2)
  })

  it('流断开自动重连（退避后重订阅）', async () => {
    vi.useFakeTimers()
    const f = fakeDeps()
    let failures = 0
    const deps = {
      ...f.deps,
      subscribeStream: vi.fn(async () => {
        failures += 1
        if (failures <= 1) throw new Error('断线')
        // 第二次成功挂住
      }),
    }
    const gw = createGateway(deps as typeof f.deps)
    await gw.start()
    // 两条流各一次；mux 流首次失败进入退避
    expect(deps.subscribeStream).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(6_000)
    expect(deps.subscribeStream.mock.calls.length).toBeGreaterThanOrEqual(3)
    vi.useRealTimers()
  })
})
