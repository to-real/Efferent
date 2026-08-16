import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import net from 'node:net'
import { createEngineProcess, createRealEngineDeps } from '../../src/main/engine-process.js'
import { pickFreePort, listenProbe } from '../../src/main/port-picker.js'

const RES = join(process.cwd(), 'resources')
const PATHS = {
  nodeExe: join(RES, 'runtime', 'node.exe'),
  engineEntry: join(RES, 'engine', 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js'),
  // 冒烟测试使用独立数据目录，绝不触碰用户 ~/.dsh
  dshHome: join(RES, '..', 'tests', '.smoke-dsh-home'),
}

const staged = existsSync(PATHS.nodeExe) && existsSync(PATHS.engineEntry)

describe.skipIf(!staged)('真引擎冒烟（staged 运行时）', () => {
  it('启动→健康→boot 图→停止无残留', { timeout: 180_000 }, async () => {
    const port = await pickFreePort({ isFree: listenProbe() })
    const engine = createEngineProcess(PATHS, port, createRealEngineDeps())

    const { baseUrl } = await engine.start()
    expect(engine.state()).toBe('healthy')

    const html = await fetch(baseUrl).then(r => r.text())
    expect(html).toContain('__DSH_BOOT__')            // 引擎真实服务中（首屏含 boot 图）
    expect(html).toMatch(/@deepseek-ai\/dsh-[\w-]+/)  // 引导图含真实客户端插件条目（web 档组合成功）

    await engine.stop()
    expect(engine.state()).toBe('stopped')

    // 停止后端口应释放（无进程监听）
    const freed = await new Promise<boolean>(resolve => {
      const srv = net.createServer()
      srv.once('error', () => resolve(false))
      srv.listen(port, '127.0.0.1', () => { srv.close(() => resolve(true)) })
    })
    expect(freed).toBe(true)
  }, 240_000)
})
