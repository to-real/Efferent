import { describe, expect, it, vi } from 'vitest'
import { pickFreePort } from '../../src/main/port-picker.js'

describe('pickFreePort', () => {
  it('返回 20000-60000 之间且 isFree 为真的端口', async () => {
    const isFree = vi.fn(async (p: number) => p !== 30000)
    const seen: number[] = []
    for (let i = 0; i < 20; i++) seen.push(await pickFreePort({ isFree }))
    expect(seen.every(p => p >= 20000 && p < 60000 && p !== 30000)).toBe(true)
  })

  it('重试次数内全部不可用时抛错', async () => {
    const isFree = vi.fn(async () => false)
    await expect(pickFreePort({ isFree, attempts: 3 })).rejects.toThrow(/无可用端口/)
    expect(isFree).toHaveBeenCalledTimes(3)
  })
})
