import { describe, expect, it } from 'vitest'
import { parseSseData, parseEventFrame, shouldForward } from '../../src/main/event-stream.js'

describe('parseSseData（SSE 行解析，跨 chunk 安全）', () => {
  it('解析 data: 行为 JSON', () => {
    const out = [...parseSseData('data: {"a":1}\n\n')]
    expect(out).toEqual(['{"a":1}'])
  })

  it('多帧连续解析', () => {
    const raw = 'data: {"a":1}\n\ndata: {"b":2}\n\n'
    expect([...parseSseData(raw)]).toEqual(['{"a":1}', '{"b":2}'])
  })

  it('忽略注释/事件名行，只取 data', () => {
    const raw = ': ping\nevent: session/event\ndata: {"x":1}\n\n'
    expect([...parseSseData(raw)]).toEqual(['{"x":1}'])
  })
})

describe('parseEventFrame（信封校验）', () => {
  it('合法 server-request 帧解析出 method/payload', () => {
    const frame = parseEventFrame('{"type":"server-request","rpcId":"r1","method":"session/event","payload":{"type":"session/event","sessionId":"s1"}}')
    expect(frame?.method).toBe('session/event')
    expect(frame?.payload).toMatchObject({ sessionId: 's1' })
  })

  it('非 JSON 返回 null', () => {
    expect(parseEventFrame('not-json')).toBeNull()
  })

  it('非 server-request 类型返回 null', () => {
    expect(parseEventFrame('{"type":"server-response","rpcId":"r","method":"x","payload":{}}')).toBeNull()
  })

  it('缺 method 返回 null', () => {
    expect(parseEventFrame('{"type":"server-request","rpcId":"r","payload":{}}')).toBeNull()
  })
})

describe('shouldForward（会话过滤）', () => {
  const open = new Set(['s1'])

  it('host/* 帧永远转发', () => {
    expect(shouldForward({ type: 'server-request', rpcId: 'r', method: 'host/session-added', payload: { type: 'host/session-added' } }, open)).toBe(true)
  })

  it('打开的会话帧转发', () => {
    expect(shouldForward({ type: 'server-request', rpcId: 'r', method: 'session/event', payload: { type: 'session/event', sessionId: 's1' } }, open)).toBe(true)
  })

  it('未打开的会话帧不转发', () => {
    expect(shouldForward({ type: 'server-request', rpcId: 'r', method: 'session/event', payload: { type: 'session/event', sessionId: 's9' } }, open)).toBe(false)
  })

  it('无 sessionId 的帧保守转发（协议演进容错）', () => {
    expect(shouldForward({ type: 'server-request', rpcId: 'r', method: 'session/projection', payload: { type: 'session/projection' } }, open)).toBe(true)
  })
})
