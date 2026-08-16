import { describe, expect, it, vi } from 'vitest'
import { createOrphanCleaner } from '../../src/main/orphan-cleaner.js'

const PROCS = [
  { pid: 100, commandLine: '"E:\\App\\resources\\runtime\\node.exe" "E:\\App\\resources\\engine\\node_modules\\@deepseek-ai\\dsh\\lib\\bin.js" web --port 12345' },
  { pid: 101, commandLine: '"C:\\Other\\npx\\dsh\\bin.js" web --port 30000' },       // 用户的 CLI 实例：不碰
  { pid: 102, commandLine: 'node server.js' },                                       // 无关进程：不碰
  { pid: 103, commandLine: '"E:\\App\\resources\\engine\\node_modules\\@deepseek-ai\\dsh\\lib\\bin.js" web --port 45678' },
]

describe('createOrphanCleaner', () => {
  it('只杀命令行含本应用引擎路径的进程，排除指定 pid', async () => {
    const treeKill = vi.fn(async () => {})
    const cleaner = createOrphanCleaner('E:\\App\\resources\\engine\\node_modules\\@deepseek-ai\\dsh\\lib\\bin.js', {
      listProcesses: async () => PROCS,
      treeKill,
    })
    const killed = await cleaner.clean(new Set([103]))
    expect(killed).toEqual([100])
    expect(treeKill).toHaveBeenCalledTimes(1)
    expect(treeKill).toHaveBeenCalledWith(100)
  })

  it('treeKill 失败不阻断其余清理', async () => {
    const treeKill = vi.fn(async (pid: number) => { if (pid === 100) throw new Error('拒绝访问') })
    const cleaner = createOrphanCleaner('E:\\App\\resources\\engine', {
      listProcesses: async () => PROCS.map(p => ({ ...p, commandLine: p.commandLine.replace(/E:\\App\\resources\\engine\\node_modules\\@deepseek-ai\\dsh\\lib\\bin\.js/g, 'E:\\App\\resources\\engine') })),
      treeKill,
    })
    const killed = await cleaner.clean()
    expect(killed).toEqual([103])
  })
})
