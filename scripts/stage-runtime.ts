/**
 * 引擎运行时 staging：resources/engine/ 下 npm 安装精确版本的 @deepseek-ai/dsh。
 *
 * 方案评审（SPEC「只参照不照搬」要求，对比过：
 *  ① electron-builder extraResources 直接打包 node_modules —— 需把整个依赖树
 *     提交或先装在仓库内，原生模块易在复制中漏文件；
 *  ② esbuild 打包引擎 —— node-pty/koffi/sharp 原生模块不可打包；
 *  ③ 构建期脚本 staging（本方案，结构思路上参照 anywhere-labs 的 stage-runtime）
 *    —— 可控、可校验、CI/本地同一入口，胜出。
 */
import { execFile } from 'node:child_process'
import { access, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'

const pexecFile = promisify(execFile)

/** DSH 引擎精确版本（SPEC-0001 版本策略：pin + 每周评审 bump + 冒烟门禁）。 */
const DSH_VERSION = '0.1.0-rc.6'

async function exists(path: string): Promise<boolean> {
  try { await access(path); return true } catch { return false }
}

async function main(): Promise<void> {
  const runtimeDir = join(process.cwd(), 'resources', 'runtime')
  const engineDir = join(process.cwd(), 'resources', 'engine')

  if (!await exists(join(runtimeDir, 'node.exe'))) {
    console.log('[stage] resources/runtime/node.exe 不存在，先下载 Node 运行时')
    // Windows 下 npm/npx 是 .cmd，须经 shell 调用（Node 安全策略不允许直接 spawn .cmd）
    await pexecFile('npx tsx scripts/download-node.ts', { shell: true })
  }

  await mkdir(engineDir, { recursive: true })
  await writeFile(join(engineDir, 'package.json'), JSON.stringify({
    name: 'efferent-engine',
    private: true,
    dependencies: { '@deepseek-ai/dsh': DSH_VERSION },
  }, null, 2))

  console.log(`[stage] npm install @deepseek-ai/dsh@${DSH_VERSION} → resources/engine/`)
  await pexecFile('npm install --omit=dev --no-audit --no-fund', { cwd: engineDir, shell: true })

  // 产物清单校验：bin.js 与关键原生模块必须存在
  const checks = [
    join(engineDir, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js'),
    join(engineDir, 'node_modules', '@deepseek-ai', 'dsh-web-frontend', 'dist', 'index.html'),
  ]
  for (const p of checks) {
    if (!await exists(p)) throw new Error(`staging 校验失败：缺少 ${p}`)
  }
  console.log('[stage] 完成。产物清单校验通过：')
  for (const p of checks) console.log(`  ✓ ${p}`)
}

void main().catch(err => {
  console.error('[stage] 失败：', err)
  process.exit(1)
})
