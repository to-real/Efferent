import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const pexecFile = promisify(execFile)

export interface OrphanDeps {
  listProcesses(): Promise<Array<{ pid: number; commandLine: string }>>
  treeKill(pid: number): Promise<void>
}

export interface OrphanCleaner {
  /** 清理命令行含 marker 的残留引擎进程；返回被杀的 pid 列表。 */
  clean(excludePids?: Set<number>): Promise<number[]>
}

/**
 * 孤儿引擎清理：断电/强杀后残留的引擎进程在下次启动时按「命令行含本应用
 * 引擎入口路径」识别——绝对路径天然限定在本应用安装目录，不会误伤用户
 * 自己跑的 CLI 版 DSH（其路径在 npx 缓存或全局目录）。
 */
export function createOrphanCleaner(marker: string, deps: OrphanDeps): OrphanCleaner {
  return {
    async clean(excludePids = new Set<number>()): Promise<number[]> {
      const killed: number[] = []
      for (const proc of await deps.listProcesses()) {
        if (excludePids.has(proc.pid) || proc.pid === process.pid) continue
        if (!proc.commandLine.includes(marker)) continue
        try {
          await deps.treeKill(proc.pid)
          killed.push(proc.pid)
        } catch {
          // 杀不掉的（权限等）记录后继续；若端口未被占用则不影响本次启动
        }
      }
      return killed
    },
  }
}

/** 真实进程枚举（PowerShell CIM，Windows）。 */
export function realListProcesses(): Promise<Array<{ pid: number; commandLine: string }>> {
  return pexecFile('powershell', [
    '-NoProfile', '-Command',
    'Get-CimInstance Win32_Process | Where-Object CommandLine | Select-Object ProcessId,CommandLine | ConvertTo-Json -Compress',
  ], { maxBuffer: 32 * 1024 * 1024 }).then(({ stdout }) => {
    const parsed = JSON.parse(stdout.trim() || '[]') as unknown
    const rows = Array.isArray(parsed) ? parsed : [parsed]
    return rows
      .filter((r): r is { ProcessId: number; CommandLine: string } =>
        typeof r === 'object' && r !== null && typeof (r as { ProcessId?: unknown }).ProcessId === 'number')
      .map(r => ({ pid: r.ProcessId, commandLine: r.CommandLine ?? '' }))
  })
}

export function realTreeKill(pid: number): Promise<void> {
  return pexecFile('taskkill', ['/PID', String(pid), '/T', '/F']).then(() => {})
}
