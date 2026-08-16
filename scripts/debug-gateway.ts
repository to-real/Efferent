// M1 网关 E2E：真引擎上验证 RPC + SSE 事件流 + 帧解析全链路
import { createEngineProcess, createRealEngineDeps } from '../src/main/engine-process.js'
import { pickFreePort, listenProbe } from '../src/main/port-picker.js'
import { createGateway } from '../src/main/gateway.js'
import { subscribeEvents } from '../src/main/event-stream.js'
import { realPost } from '../src/main/engine-api.js'
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'

const RES = join(process.cwd(), 'resources')
const PATHS = {
  nodeExe: join(RES, 'runtime', 'node.exe'),
  engineEntry: join(RES, 'engine', 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js'),
  dshHome: join(process.cwd(), 'tests', '.smoke-dsh-home'),
}

const port = await pickFreePort({ isFree: listenProbe() })
const engine = createEngineProcess(PATHS, port, createRealEngineDeps())
const { baseUrl } = await engine.start()
console.log('引擎就绪:', baseUrl)

const frames: Array<{ method: string }> = []
const gw = createGateway({
  baseUrl,
  post: realPost(baseUrl),
  send: (_ch, payload) => { frames.push(payload as { method: string }) },
  subscribeStream: (path, onFrame, signal) => subscribeEvents(baseUrl, path, onFrame, signal),
})
await gw.start()

// RPC：建工作区（须已存在的目录）→ 建会话 → 列会话
const wsDir = join(process.cwd(), 'tests', '.ws-e2e')
mkdirSync(wsDir, { recursive: true })
const ws = await gw.rpc('workspace.create', { path: wsDir }) as any
const workspaceId = ws?.workspace?.workspaceId
console.log('workspace.create →', workspaceId)
const created = await gw.rpc('session.create', { workspaceId }) as any
console.log('session.create →', created?.session?.sessionId ?? JSON.stringify(created).slice(0, 120))
const listed = await gw.rpc('session.list', {}) as any
console.log('session.list →', listed?.items?.length, '个会话')

// 等事件帧到达（host/session-added 或 session/projection）
await new Promise(r => setTimeout(r, 3_000))
console.log(`收到事件帧 ${frames.length} 条，方法域：`, [...new Set(frames.map(f => f.method))].join(', '))
if (frames.length === 0) throw new Error('未收到任何事件帧')

gw.stop()
await engine.stop()
console.log('M1 网关 E2E 通过')
process.exit(0)
