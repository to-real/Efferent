import net from 'node:net'

export interface PortPickerDeps {
  /** 端口是否可用（注入以便测试） */
  isFree: (port: number) => Promise<boolean>
  /** 尝试次数，默认 10 */
  attempts?: number
  /** 随机源，默认 Math.random */
  random?: () => number
}

const MIN_PORT = 20000
const MAX_PORT = 60000

/** 在 [20000, 60000) 内随机挑一个可用端口；全部失败抛错。 */
export async function pickFreePort(deps: PortPickerDeps): Promise<number> {
  const attempts = deps.attempts ?? 10
  const random = deps.random ?? Math.random
  for (let i = 0; i < attempts; i++) {
    const port = MIN_PORT + Math.floor(random() * (MAX_PORT - MIN_PORT))
    if (await deps.isFree(port)) return port
  }
  throw new Error(`无可用端口（已尝试 ${attempts} 次）`)
}

/** 真实可用性探测：bind 成功即视为空闲。 */
export function listenProbe(): (port: number) => Promise<boolean> {
  return port => new Promise(resolve => {
    const server = net.createServer()
    server.once('error', () => resolve(false))
    server.listen(port, '127.0.0.1', () => {
      server.close(() => resolve(true))
    })
  })
}
