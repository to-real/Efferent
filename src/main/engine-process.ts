import { spawn as cpSpawn, execFile, type ChildProcess } from 'node:child_process'
import http from 'node:http'

export type EngineState = 'idle' | 'starting' | 'healthy' | 'crashed' | 'stopped'

/** 子进程抽象（真实=ChildProcess 适配；测试=fake）。 */
export interface EngineChild {
  readonly pid: number
  readonly killed: boolean
  kill(): boolean
  exited: Promise<{ code: number | null }>
  onStderr(cb: (s: string) => void): void
}

export interface EngineDeps {
  spawn(cmd: string, args: readonly string[], env: Record<string, string>): EngineChild
  /** 探测引擎根路径，resolve HTTP 状态码；连接失败 reject。 */
  probe(url: string): Promise<number>
  now(): number
  delay(ms: number): Promise<void>
  /** 按进程树终止（Windows：taskkill /T [\/F]）。force=false 温和关闭。 */
  treeKill(pid: number, force?: boolean): Promise<void>
  /** spawn 时继承的基础环境（默认 process.env）。 */
  envBase?: Record<string, string>
}

export interface EnginePaths {
  nodeExe: string
  engineEntry: string
  dshHome: string
}

export interface EngineProcess {
  start(): Promise<{ port: number; baseUrl: string }>
  stop(): Promise<void>
  state(): EngineState
  onStateChange(cb: (state: EngineState) => void): () => void
}

const PROBE_INTERVAL_MS = 500
const START_TIMEOUT_MS = 120_000
const STDERR_TAIL_CHARS = 2048

export function createEngineProcess(paths: EnginePaths, port: number, deps: EngineDeps): EngineProcess {
  let state: EngineState = 'idle'
  let child: EngineChild | null = null
  const listeners = new Set<(s: EngineState) => void>()

  const setState = (next: EngineState) => {
    state = next
    for (const cb of listeners) cb(next)
  }

  let stderrTail = ''
  const appendStderr = (s: string) => {
    stderrTail = (stderrTail + s).slice(-STDERR_TAIL_CHARS * 2)
  }

  async function start(): Promise<{ port: number; baseUrl: string }> {
    if (state !== 'idle') throw new Error(`引擎不可重复 start（当前状态：${state}）`)
    setState('starting')
    const baseUrl = `http://127.0.0.1:${port}`
    child = deps.spawn(
      paths.nodeExe,
      [paths.engineEntry, 'web', '--host', '127.0.0.1', '--port', String(port)],
      { ...(deps.envBase ?? process.env), DSH_HOME: paths.dshHome },
    )
    child.onStderr(appendStderr)

    return await new Promise<{ port: number; baseUrl: string }>((resolve, reject) => {
      let settled = false
      const settle = (fn: () => void) => {
        if (settled) return
        settled = true
        fn()
      }

      // 竞速一：进程先退出 → crashed
      void child!.exited.then(({ code }) => {
        settle(() => {
          setState('crashed')
          reject(new Error(
            `引擎进程已退出（code=${code ?? 'null'}）\nstderr 尾部：\n${stderrTail.slice(-STDERR_TAIL_CHARS)}`,
          ))
        })
      })

      // 竞速二：健康轮询 → healthy / 超时 → stopped
      void (async () => {
        const startedAt = deps.now()
        for (;;) {
          try {
            const status = await deps.probe(baseUrl)
            if (status === 200) {
              settle(() => {
                setState('healthy')
                resolve({ port, baseUrl })
              })
              return
            }
          } catch {
            // 连接失败视为未就绪，继续轮询
          }
          if (deps.now() - startedAt >= START_TIMEOUT_MS) {
            settle(() => {
              try { child!.kill() } catch { /* 已死 */ }
              setState('stopped')
              reject(new Error(
                `引擎迟迟未就绪（已等待 ${Math.round((deps.now() - startedAt) / 1000)}s），已终止进程。`
                + `stderr 尾部：\n${stderrTail.slice(-STDERR_TAIL_CHARS)}`,
              ))
            })
            return
          }
          await deps.delay(PROBE_INTERVAL_MS)
        }
      })()
    })
  }

  let stopInFlight: Promise<void> | null = null

  async function stop(): Promise<void> {
    if (state === 'idle' || state === 'stopped') return
    if (stopInFlight) return stopInFlight
    const c = child
    if (c == null) { setState('stopped'); return }
    stopInFlight = (async () => {
      // Windows 语义：kill() 只杀主进程，引擎的 worker 子进程会孤儿化；
      // 而 taskkill /T 需要根进程存活才能枚举整树。因此先温和树关、
      // 再等待、最后强制树杀——全程不单独 kill 主进程。
      try { await deps.treeKill(c.pid, false) } catch { /* 树已不存在 */ }
      await Promise.race([
        c.exited.then(() => 'exited' as const),
        deps.delay(5_000).then(() => 'timeout' as const),
      ])
      try { await deps.treeKill(c.pid, true) } catch { /* 已全灭——预期路径 */ }
      setState('stopped')
    })()
    return stopInFlight
  }

  return {
    start,
    stop,
    state: () => state,
    onStateChange(cb) {
      listeners.add(cb)
      return () => { listeners.delete(cb) }
    },
  }
}

// ---------- 真实依赖工厂（Task 7 接线用） ----------

export function realChild(child: ChildProcess): EngineChild {
  const exited = new Promise<{ code: number | null }>(resolve => {
    child.once('exit', code => resolve({ code: code ?? null }))
    // spawn 失败（文件不存在/权限等）发 error 而非 exit：映射为退出，让崩溃分支尽快接管
    child.once('error', err => {
      child.stderr?.emit('data', `spawn error: ${err.message}\n`)
      resolve({ code: -1 })
    })
  })
  return {
    pid: child.pid ?? -1,
    get killed() { return child.killed },
    kill: () => child.kill(),
    exited,
    onStderr(cb) {
      child.stderr?.on('data', (chunk: Buffer) => cb(chunk.toString()))
    },
  }
}

export function createRealEngineDeps(): EngineDeps {
  return {
    spawn: (cmd, args, env) => realChild(cpSpawn(cmd, args, { env: env as NodeJS.ProcessEnv, stdio: ['ignore', 'pipe', 'pipe'] })),
    probe: url => new Promise((resolve, reject) => {
      const req = http.get(url, res => {
        res.resume()
        resolve(res.statusCode ?? 0)
      })
      req.once('error', reject)
      req.setTimeout(2_000, () => { req.destroy(new Error('probe-timeout')) })
    }),
    now: () => Date.now(),
    delay: ms => new Promise(resolve => setTimeout(resolve, ms)),
    treeKill: (pid, force) => new Promise((resolve, reject) => {
      const args = ['/PID', String(pid), '/T', ...(force ? ['/F'] : [])]
      execFile('taskkill', args, err => { err ? reject(err) : resolve() })
    }),
  }
}
