// 事件语料采集：真引擎 + 真 Key 跑一轮带工具调用的会话，录下全部 session/event 帧
// 产物：tests/fixtures/session-events.json（UI 开发与测试的 fixture 语料）
import { createEngineProcess, createRealEngineDeps } from '../src/main/engine-process.js'
import { pickFreePort, listenProbe } from '../src/main/port-picker.js'
import { createGateway } from '../src/main/gateway.js'
import { subscribeEvents } from '../src/main/event-stream.js'
import { realPost } from '../src/main/engine-api.js'
import { join } from 'node:path'
import { mkdirSync, writeFileSync, copyFileSync, existsSync, rmSync } from 'node:fs'

const RES = join(process.cwd(), 'resources')
const SMOKE_HOME = join(process.cwd(), 'tests', '.smoke-dsh-home')
const PATHS = {
  nodeExe: join(RES, 'runtime', 'node.exe'),
  engineEntry: join(RES, 'engine', 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js'),
  dshHome: SMOKE_HOME,
}

// 自洁：残留 profiles 会让引擎的符号链接修复逻辑报错（单测同款教训）
rmSync(SMOKE_HOME, { recursive: true, force: true })

// Key 来源：DSH-Desktop 时代的本机凭据（仅本机复制，用于产品自测）
const KEY_SRC = join(process.env.APPDATA ?? '', 'DSH-Desktop', 'dsh-home', '.credentials.yaml')
if (existsSync(KEY_SRC)) {
  mkdirSync(SMOKE_HOME, { recursive: true })
  copyFileSync(KEY_SRC, join(SMOKE_HOME, '.credentials.yaml'))
  console.log('[capture] Key 已复制到 smoke home')
} else {
  console.log('[capture] 警告：无 Key，流式回复不会发生（仅录控制帧）')
}

const port = await pickFreePort({ isFree: listenProbe() })
const engine = createEngineProcess(PATHS, port, createRealEngineDeps())
const { baseUrl } = await engine.start()
console.log('引擎就绪:', baseUrl)

const captured: unknown[] = []
const gw = createGateway({
  baseUrl,
  post: realPost(baseUrl),
  send: (_ch, payload) => { captured.push(payload) },
  subscribeStream: (path, onFrame, signal) => subscribeEvents(baseUrl, path, onFrame, signal),
})
await gw.start()

const wsDir = join(process.cwd(), 'tests', '.ws-e2e')
mkdirSync(wsDir, { recursive: true })
const ws = await gw.rpc('workspace.create', { path: wsDir }) as any
const created = await gw.rpc('session.create', { workspaceId: ws.workspace.workspaceId }) as any
const sessionId = created.sessionId
console.log('会话:', sessionId)
gw.subscribeSession(sessionId)

// 发一个会触发工具调用与回复的 prompt
await gw.rpc('session.prompt', {
  sessionId,
  mode: 'queue',
  content: [{ type: 'text', text: '请用 bash 执行 echo efferent-capture 然后简短回复你做了什么。' }],
})
console.log('[capture] prompt 已发，录制 75 秒…')

await new Promise(r => setTimeout(r, 75_000))

const out = join(process.cwd(), 'tests', 'fixtures', 'session-events.json')
mkdirSync(join(process.cwd(), 'tests', 'fixtures'), { recursive: true })
writeFileSync(out, JSON.stringify(captured, null, 1), 'utf8')
const sessionFrames = captured.filter((f: any) => f.method === 'session/event') as any[]
const vocab = [...new Set(sessionFrames.map((f: any) => f.payload?.event?.type))]
console.log(`[capture] 共 ${captured.length} 帧，session/event ${sessionFrames.length} 条`)
console.log('[capture] 事件词汇表:', vocab.join(' | '))
console.log('[capture] 写入', out)

gw.stop()
await engine.stop()
process.exit(0)
