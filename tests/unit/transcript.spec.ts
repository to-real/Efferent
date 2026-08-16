import { describe, expect, it } from 'vitest'
import { reduceFrame, createTranscript, type Transcript } from '../../plugins/workbench/src/store/reducer.js'
import type { EventFrame } from '../../src/main/event-stream.js'

const frame = (method: string, payload: Record<string, unknown>): EventFrame =>
  ({ type: 'server-request', rpcId: 'r', method, payload })

const ev = (type: string, data: unknown, seq = 0): EventFrame =>
  frame('session/event', { type: 'session/event', sessionId: 's1', event: { type, seq, time: 0, data } })

describe('transcript reducer（真实事件词汇表）', () => {
  it('user/message → 用户消息', () => {
    const t = createTranscript()
    reduceFrame(t, ev('user/message', { content: [{ type: 'text', text: '你好' }], role: 'user' }))
    expect(t.items).toHaveLength(1)
    expect(t.items[0]).toMatchObject({ kind: 'user', text: '你好' })
  })

  it('流式生命周期：block-start→deltas→assistant/message 定稿', () => {
    const t = createTranscript()
    reduceFrame(t, ev('assistant/chunk', { turn: 1, step: 1, chunk: { type: 'block-start', index: 0, blockType: 'reasoning' } }))
    reduceFrame(t, ev('assistant/chunk', { turn: 1, step: 1, chunk: { type: 'reasoning-delta', index: 0, text: '思考' } }))
    reduceFrame(t, ev('assistant/chunk', { turn: 1, step: 1, chunk: { type: 'block-start', index: 1, blockType: 'text' } }))
    reduceFrame(t, ev('assistant/chunk', { turn: 1, step: 1, chunk: { type: 'text-delta', index: 1, text: '回答' } }))
    expect(t.streaming).toBeDefined()
    expect(t.streaming?.reasoning).toBe('思考')
    expect(t.streaming?.text).toBe('回答')

    reduceFrame(t, ev('assistant/message', { turn: 1, step: 1, message: { role: 'assistant', content: [
      { type: 'reasoning', text: '思考完整' },
      { type: 'text', text: '回答完整' },
    ] } }))
    expect(t.streaming).toBeUndefined()
    expect(t.items.at(-1)).toMatchObject({ kind: 'assistant', reasoning: '思考完整', text: '回答完整' })
  })

  it('tool/call → tool/result 配对成工具卡', () => {
    const t = createTranscript()
    reduceFrame(t, ev('tool/call', { turn: 1, step: 1, callId: 'c1', name: 'pwsh', arguments: '{"command":"echo hi"}' }))
    expect(t.items.at(-1)).toMatchObject({ kind: 'tool', callId: 'c1', name: 'pwsh', pending: true })

    reduceFrame(t, ev('tool/result', { turn: 1, step: 1, message: { source: { kind: 'tool', callId: 'c1' }, content: [
      { type: 'tool-result', toolCallId: 'c1', content: [{ type: 'text', text: 'hi' }] },
    ] } }))
    const tool = t.items.find(i => i.kind === 'tool') as any
    expect(tool.pending).toBe(false)
    expect(tool.result).toBe('hi')
  })

  it('approval/requested（mux 帧）→ 审批卡；resolved 更新结果', () => {
    const t = createTranscript('s1')
    reduceFrame(t, frame('approval/requested', { type: 'approval/requested', sessionId: 's1', approvalId: 'a1', toolName: 'pwsh', reason: '需要提权' }))
    const card = t.items.find(i => i.kind === 'approval') as any
    expect(card).toMatchObject({ approvalId: 'a1', toolName: 'pwsh', reason: '需要提权' })
    expect(card.outcome).toBeUndefined()

    reduceFrame(t, frame('approval/resolved', { type: 'approval/resolved', sessionId: 's1', approvalId: 'a1', outcome: 'allowed-once' }))
    expect((t.items.find(i => i.kind === 'approval') as any).outcome).toBe('allowed-once')
  })

  it('session/queue → 排队计数', () => {
    const t = createTranscript('s1')
    reduceFrame(t, frame('session/queue', { type: 'session/queue', sessionId: 's1', items: [
      { id: 'm1', placement: 'queued', message: { role: 'user', content: [] } },
    ] }))
    expect(t.queued).toBe(1)
    reduceFrame(t, frame('session/queue', { type: 'session/queue', sessionId: 's1', items: [] }))
    expect(t.queued).toBe(0)
  })

  it('会话过滤：他 session 的帧被丢弃', () => {
    const t = createTranscript('s1')
    reduceFrame(t, frame('session/event', { type: 'session/event', sessionId: 'OTHER', event: { type: 'user/message', seq: 1, time: 0, data: { content: [{ type: 'text', text: 'x' }] } } }))
    expect(t.items).toHaveLength(0)
  })
})

describe('行 diff（编辑工具参数推导）', () => {
  it('统一 diff：增删改行各得其所', async () => {
    const { diffLines } = await import('../../plugins/workbench/src/store/diff.js')
    const d = diffLines('a\nb\nc', 'a\nx\nc\nd')
    expect(d).toEqual([
      { kind: 'same', text: 'a' },
      { kind: 'del', text: 'b' },
      { kind: 'add', text: 'x' },
      { kind: 'same', text: 'c' },
      { kind: 'add', text: 'd' },
    ])
  })
})
