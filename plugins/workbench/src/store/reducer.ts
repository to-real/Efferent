import type { EventFrame } from '../../../../src/main/event-stream.js'

export type TranscriptItem =
  | { kind: 'user'; text: string }
  | { kind: 'assistant'; reasoning?: string; text: string }
  | { kind: 'tool'; callId: string; name: string; args: string; result?: string; pending: boolean }
  | { kind: 'approval'; approvalId: string; toolName: string; reason?: string; outcome?: string; rpcId?: string }
  | { kind: 'notice'; text: string }

export interface StreamingState {
  reasoning: string
  text: string
  toolArgs: Map<number, { name: string; args: string }>
}

export interface Transcript {
  sessionId: string
  items: TranscriptItem[]
  streaming: StreamingState | undefined
  queued: number
  title?: string
}

export function createTranscript(sessionId = ''): Transcript {
  return { sessionId, items: [], streaming: undefined, queued: 0 }
}

interface SessionEventEnvelope {
  type: string
  seq: number
  data: Record<string, unknown>
}

/**
 * 帧归约器（纯逻辑，接缝延续）：把网关帧折叠为 transcript 模型。
 * 词汇表来自实测语料（tests/fixtures/session-events.json）：
 * user/message | assistant/chunk(block-start/reasoning-delta/text-delta/tool-call-delta/block-end)
 * | assistant/message | tool/call | tool/result | approval/asked
 */
export function reduceFrame(t: Transcript, frame: EventFrame): void {
  const payload = frame.payload as Record<string, unknown>
  const sessionId = payload['sessionId']

  // 会话归属过滤：transcript 归属于创建时指定的 session，他域 session/* 帧丢弃
  // （approval/question 帧同样带 sessionId，一并过滤）
  if (t.sessionId !== '' && typeof sessionId === 'string' && sessionId !== t.sessionId) return

  switch (frame.method) {
    case 'session/event':
      reduceSessionEvent(t, payload['event'] as SessionEventEnvelope | undefined)
      return
    case 'approval/requested':
      t.items.push({
        kind: 'approval',
        approvalId: String(payload['approvalId'] ?? ''),
        toolName: String(payload['toolName'] ?? ''),
        reason: typeof payload['reason'] === 'string' ? payload['reason'] : undefined,
        rpcId: frame.rpcId || undefined, // mux 帧的 rpcId 是 /api/respond 回传凭据
      })
      return
    case 'approval/resolved': {
      const id = String(payload['approvalId'] ?? '')
      const card = [...t.items].reverse().find(i => i.kind === 'approval' && i.approvalId === id)
      if (card && card.kind === 'approval') card.outcome = String(payload['outcome'] ?? '')
      return
    }
    case 'session/queue': {
      const items = payload['items']
      t.queued = Array.isArray(items) ? items.length : 0
      return
    }
    default:
      return
  }
}

function reduceSessionEvent(t: Transcript, event: SessionEventEnvelope | undefined): void {
  if (event == null) return
  const data = (event.data ?? {}) as Record<string, unknown>

  switch (event.type) {
    case 'user/message': {
      const content = data['content']
      const text = Array.isArray(content)
        ? content.filter((c): c is { type: string; text: string } => (c as { type?: string })?.type === 'text')
          .map(c => c.text).join('\n')
        : ''
      t.items.push({ kind: 'user', text })
      return
    }
    case 'assistant/chunk':
      reduceChunk(t, data)
      return
    case 'assistant/message': {
      // 定稿：流式态收敛为完整消息（content 块序列）
      const message = data['message'] as { content?: Array<{ type: string; text?: string }> } | undefined
      const blocks = message?.content ?? []
      const reasoning = blocks.filter(b => b.type === 'reasoning').map(b => b.text ?? '').join('')
      const text = blocks.filter(b => b.type === 'text').map(b => b.text ?? '').join('')
      t.items.push({ kind: 'assistant', reasoning: reasoning || undefined, text })
      t.streaming = undefined
      return
    }
    case 'tool/call': {
      t.items.push({
        kind: 'tool',
        callId: String(data['callId'] ?? ''),
        name: String(data['name'] ?? ''),
        args: String(data['arguments'] ?? ''),
        pending: true,
      })
      return
    }
    case 'tool/result': {
      const callId = ((data['message'] as { source?: { callId?: string } })?.source)?.callId
      if (typeof callId !== 'string') return
      const content = (data['message'] as { content?: Array<{ type: string; toolCallId?: string; content?: Array<{ type: string; text?: string }> }> })?.content
      const resultBlock = Array.isArray(content)
        ? content.find(c => c.type === 'tool-result' && c.toolCallId === callId)
        : undefined
      const result = Array.isArray(resultBlock?.content)
        ? resultBlock!.content!.filter(c => c.type === 'text').map(c => c.text ?? '').join('')
        : ''
      const tool = [...t.items].reverse().find(i => i.kind === 'tool' && i.callId === callId)
      if (tool && tool.kind === 'tool') {
        tool.pending = false
        tool.result = result
      }
      return
    }
    case 'approval/asked': {
      // 持久化审批事件：补一条卡（若 mux 帧尚未建过）
      const id = String(data['id'] ?? '')
      const exists = t.items.some(i => i.kind === 'approval' && i.approvalId === id)
      if (!exists) {
        t.items.push({
          kind: 'approval',
          approvalId: id,
          toolName: String(data['toolName'] ?? ''),
          reason: typeof data['reason'] === 'string' ? data['reason'] : undefined,
        })
      }
      return
    }
    case 'session/title':
    case 'session/title-llm-request': {
      const title = data['title']
      if (typeof title === 'string' && title.trim()) t.title = title
      return
    }
    default:
      return
  }
}

function reduceChunk(t: Transcript, data: Record<string, unknown>): void {
  const chunk = data['chunk'] as Record<string, unknown> | undefined
  if (chunk == null) return
  t.streaming ??= { reasoning: '', text: '', toolArgs: new Map() }
  const s = t.streaming

  switch (chunk['type']) {
    case 'reasoning-delta':
      s.reasoning += String(chunk['text'] ?? '')
      return
    case 'text-delta':
      s.text += String(chunk['text'] ?? '')
      return
    case 'tool-call-delta': {
      const index = Number(chunk['index'] ?? 0)
      const entry = s.toolArgs.get(index) ?? { name: String(chunk['name'] ?? ''), args: '' }
      entry.args += String(chunk['argumentsDelta'] ?? '')
      s.toolArgs.set(index, entry)
      return
    }
    default:
      return
  }
}
