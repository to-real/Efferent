/**
 * 下载并解压 Node 24 运行时到 resources/runtime/（仅取 node.exe）。
 * 校验：从同目录 SHASUMS256.txt 取官方 sha256 比对（不硬编码哈希）。
 */
import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

const pexecFile = promisify(execFile)

const DIST = 'https://nodejs.org/dist/latest-v24.x'
const ZIP = 'node-v24.19.0-win-x64.zip'

async function fetchBuffer(url: string, redirects = 5): Promise<Buffer> {
  const res = await fetch(url, { redirect: 'manual' })
  const location = res.headers.get('location')
  if ((res.status >= 300) && (res.status < 400) && location && redirects > 0) {
    return fetchBuffer(new URL(location, url).href, redirects - 1)
  }
  if (!res.ok) throw new Error(`下载失败 ${res.status}: ${url}`)
  return Buffer.from(await res.arrayBuffer())
}

async function main(): Promise<void> {
  const outDir = join(process.cwd(), 'resources', 'runtime')
  await rm(outDir, { recursive: true, force: true })
  await mkdir(outDir, { recursive: true })

  console.log(`[download-node] 拉取 ${DIST}/SHASUMS256.txt …`)
  const sums = (await fetchBuffer(`${DIST}/SHASUMS256.txt`)).toString('utf8')
  const expected = sums.split('\n').find(l => l.endsWith(ZIP))?.split(/\s+/)[0]
  if (!expected) throw new Error(`SHASUMS256.txt 中找不到 ${ZIP}`)

  console.log(`[download-node] 下载 ${ZIP}（sha256 ${expected.slice(0, 12)}…）`)
  const zipPath = join(outDir, `../${ZIP}`)
  await pipeline(Readable.from(await fetchBuffer(`${DIST}/${ZIP}`)), createWriteStream(zipPath))

  const actual = createHash('sha256').update(await readFile(zipPath)).digest('hex')
  if (actual !== expected) throw new Error(`sha256 不匹配：expected ${expected}, got ${actual}`)
  console.log('[download-node] sha256 校验通过')

  console.log('[download-node] 解压 node.exe …')
  const extractDir = join(outDir, '..', '_node_extract')
  await rm(extractDir, { recursive: true, force: true })
  await mkdir(extractDir, { recursive: true })
  await pexecFile('powershell', ['-NoProfile', '-Command',
    `Expand-Archive -LiteralPath "${zipPath}" -DestinationPath "${extractDir}" -Force`])
  await pexecFile('powershell', ['-NoProfile', '-Command',
    `Move-Item -LiteralPath "${extractDir}\\node-v24.19.0-win-x64\\node.exe" -Destination "${outDir}\\node.exe" -Force`])
  await rm(extractDir, { recursive: true, force: true })
  await rm(zipPath, { force: true })
  console.log(`[download-node] 完成 → ${join(outDir, 'node.exe')}`)
}

void main().catch(err => {
  console.error('[download-node] 失败：', err)
  process.exit(1)
})
