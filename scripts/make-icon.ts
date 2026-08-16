/**
 * 栅格化品牌图标：assets/icon.svg → assets/icon.png（512x512）。
 * sharp 取自 staged 引擎依赖（resources/engine），需先 npm run stage。
 */
import { createRequire } from 'node:module'
import { join } from 'node:path'

const engineRequire = createRequire(join(process.cwd(), 'resources', 'engine', 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js'))
// 结构化最小类型（仓库不依赖 sharp 包，避免类型解析）
type Sharpish = (src: string, opts?: { density?: number }) => {
  resize(w: number, h: number): { png(): { toFile(p: string): Promise<unknown> } }
}
const sharp = engineRequire('sharp') as Sharpish

const src = join(process.cwd(), 'assets', 'icon.svg')
const out = join(process.cwd(), 'assets', 'icon.png')

await sharp(src, { density: 300 })
  .resize(512, 512)
  .png()
  .toFile(out)

console.log(`[make-icon] ${out} 已生成（512x512）`)
