import { describe, expect, it, vi } from 'vitest'
import { createEngineProcess, type EngineChild, type EngineDeps } from '../../src/main/engine-process.js'

// ---------- 测试替身 ----------

interface FakeChild extends EngineChild {
  exit(code: number | null): void
  emitStderr(s: string): void
}

function fakeChild(pid = 4242): FakeChild {
  let exitResolve!: (v: { code: number | null }) => void
  const exited = new Promise<{ code: number | null }>(resolve => { exitResolve = resolve })
  let stderrCb: ((s: string) => void) | null = null
  return {
    pid,
    get killed() { return killed },
    kill() { killed = true; return true },
    exited,
    onStderr(cb) { stderrCb = cb },
    exit(code) { exitResolve({ code }) },
    emitStderr(s) { stderrCb?.(s) },
  }
  var killed = false
}

interface SpawnRecord { cmd: string; args: string[]; env: Record<string, string>; child: FakeChild }

function makeDeps(childFactory: () => FakeChild = fakeChild) {
  const spawns: SpawnRecord[] = []
  const treeKills: Array<{ pid: number; force?: boolean }> = []
  let nowMs = 0
  const deps: EngineDeps = {
    spawn: (cmd, args, env) => {
      const child = childFactory()
      spawns.push({ cmd, args: [...args], env, child })
      return child
    },
    probe: vi.fn(async () => 200),
    now: () => nowMs,
    delay: async (ms: number) => { nowMs += ms },
    treeKill: async (pid: number, force?: boolean) => { treeKills.push({ pid, force }) },
  }
  return { deps, spawns, treeKills, tick: (ms: number) => { nowMs += ms } }
}

const PATHS = { nodeExe: 'N:/node.exe', engineEntry: 'E:/bin.js', dshHome: 'H:/dsh-home' }

// ---------- 测试 ----------

describe('EngineProcess', () => {
  it('以正确命令行与环境启动引擎并就绪', async () => {
    const { deps, spawns } = makeDeps()
    const engine = createEngineProcess(PATHS, 45678, deps)
    const ready = engine.start()
    await ready
    const s = spawns[0]!
    expect(s.cmd).toBe('N:/node.exe')
    expect(s.args).toEqual(['E:/bin.js', 'web', '--host', '127.0.0.1', '--port', '45678'])
    expect(s.env.DSH_HOME).toBe('H:/dsh-home')
  })

  it('健康前轮询，就绪后 resolve 且状态流转 idle→starting→healthy', async () => {
    const { deps } = makeDeps()
    const refused = Object.assign(new Error('ECONNREFUSED'), { code: 'ECONNREFUSED' })
    ;(deps.probe as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(refused)
      .mockRejectedValueOnce(refused)
      .mockResolvedValueOnce(200)
    const engine = createEngineProcess(PATHS, 45678, deps)
    const states: string[] = []
    engine.onStateChange(s => states.push(s))
    const { baseUrl } = await engine.start()
    expect(baseUrl).toBe('http://127.0.0.1:45678')
    expect(engine.state()).toBe('healthy')
    expect(states).toEqual(['starting', 'healthy'])
    expect(deps.probe).toHaveBeenCalledTimes(3)
  })

  it('进程先死于健康检查：reject 且诊断含退出码与 stderr 尾部', async () => {
    const child = fakeChild()
    const { deps } = makeDeps(() => child)
    ;(deps.probe as ReturnType<typeof vi.fn>).mockImplementation(() => new Promise<number>(() => {}))
    const engine = createEngineProcess(PATHS, 45678, deps)
    const ready = engine.start()
    child.emitStderr('line1\n')
    child.emitStderr('FATAL: boom\n')
    child.exit(1)
    await expect(ready).rejects.toThrow(/进程已退出.*code=1/s)
    await expect(ready).rejects.toThrow(/FATAL: boom/)
    expect(engine.state()).toBe('crashed')
  })

  it('健康检查总超时：reject 诊断「迟迟未就绪」，kill 子进程，状态 stopped', async () => {
    const child = fakeChild()
    const { deps } = makeDeps(() => child)
    ;(deps.probe as ReturnType<typeof vi.fn>).mockRejectedValue(Object.assign(new Error('ECONNREFUSED'), { code: 'ECONNREFUSED' }))
    const engine = createEngineProcess(PATHS, 45678, deps)
    const ready = engine.start()
    await expect(ready).rejects.toThrow(/迟迟未就绪/)
    expect(child.killed).toBe(true)
    expect(engine.state()).toBe('stopped')
  })

  it('probe 收到非 200 状态码视为未就绪继续轮询', async () => {
    const { deps } = makeDeps()
    ;(deps.probe as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(503)
      .mockResolvedValueOnce(200)
    const engine = createEngineProcess(PATHS, 45678, deps)
    await engine.start()
    expect(deps.probe).toHaveBeenCalledTimes(2)
  })

  // ---------- Task 4：停止与强杀 ----------

  it('优雅停止：kill 后进程退出 → stopped，树杀兜底仍执行（Windows 孤儿防护）', async () => {
    const child = fakeChild()
    const { deps, treeKills } = makeDeps(() => child)
    const engine = createEngineProcess(PATHS, 45678, deps)
    await engine.start()
    const stopping = engine.stop()
    child.exit(0)
    await stopping
    expect(engine.state()).toBe('stopped')
    expect(treeKills).toEqual([{ pid: 4242, force: false }, { pid: 4242, force: true }])
  })

  it('5 秒不退则 taskkill 树杀', async () => {
    const child = fakeChild()
    const { deps, treeKills } = makeDeps(() => child)
    const engine = createEngineProcess(PATHS, 45678, deps)
    await engine.start()
    await engine.stop()   // fake delay 每次推进虚拟时钟，5s 超时分支触发
    expect(treeKills).toEqual([{ pid: 4242, force: false }, { pid: 4242, force: true }])
    expect(engine.state()).toBe('stopped')
  })

  it('重复 stop 幂等', async () => {
    const child = fakeChild()
    const { deps, treeKills } = makeDeps(() => child)
    const engine = createEngineProcess(PATHS, 45678, deps)
    await engine.start()
    child.exit(0)
    await engine.stop()
    const killsAfterFirst = treeKills.length
    await engine.stop()
    expect(treeKills.length).toBe(killsAfterFirst)
    expect(engine.state()).toBe('stopped')
  })

  it('idle 状态 stop 是无操作', async () => {
    const { deps } = makeDeps()
    const engine = createEngineProcess(PATHS, 45678, deps)
    await engine.stop()
    expect(engine.state()).toBe('idle')
  })
})
