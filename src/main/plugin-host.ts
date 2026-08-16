import { join } from 'node:path'

/**
 * 插件宿主（SPEC-0002 插件架构增补）：
 * 壳不认识任何具体前端，只认识「插件」——扫描 plugins/ 目录、解析 manifest、
 * 解析入口绝对路径。装载动作（loadFile）由 windows 层执行。
 * 对应 DSH 侧：cordis 容器之于 dsh-web-app / client-plugin。
 */

export interface PluginManifest {
  id: string
  name: string
  version: string
  /** workbench = 独占主窗的完整前端；panel = 面板位贡献（v2.1 面板位协议） */
  kind: 'workbench' | 'panel'
  /** 相对插件目录的入口文件路径（HTML） */
  entry: string
}

export interface Plugin extends PluginManifest {
  /** 入口绝对路径（解析产物） */
  entryPath: string
}

export interface PluginIssue {
  dir: string
  reason: string
}

export interface PluginFs {
  readdir(dir: string): Promise<string[]>
  readFile(file: string): Promise<string>
}

const KINDS: readonly PluginManifest['kind'][] = ['workbench', 'panel']

/** 解析单个 manifest JSON；非法返回 null（不抛出——坏插件不拖垮宿主）。 */
export function parseManifest(json: string): PluginManifest | null {
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    return null
  }
  if (typeof raw !== 'object' || raw === null) return null
  const m = raw as Record<string, unknown>
  if (typeof m['id'] !== 'string' || m['id'].length === 0) return null
  if (typeof m['name'] !== 'string' || m['name'].length === 0) return null
  if (typeof m['version'] !== 'string' || m['version'].length === 0) return null
  if (typeof m['entry'] !== 'string' || m['entry'].length === 0) return null
  if (typeof m['kind'] !== 'string' || !KINDS.includes(m['kind'] as PluginManifest['kind'])) return null
  return { id: m['id'], name: m['name'], version: m['version'], kind: m['kind'] as PluginManifest['kind'], entry: m['entry'] }
}

/** 扫描插件根目录：确定性顺序（目录名排序），坏 manifest 收集诊断后跳过，id 冲突保留先到者。 */
export async function discoverPlugins(pluginsRoot: string, fs: PluginFs): Promise<{ plugins: Plugin[]; issues: PluginIssue[] }> {
  const issues: PluginIssue[] = []
  const plugins: Plugin[] = []
  const seen = new Set<string>()

  let dirs: string[]
  try {
    dirs = (await fs.readdir(pluginsRoot)).slice().sort()
  } catch {
    return { plugins, issues }
  }

  for (const dir of dirs) {
    const manifestPath = join(pluginsRoot, dir, 'plugin.json')
    let json: string
    try {
      json = await fs.readFile(manifestPath)
    } catch {
      continue // 无 manifest 的目录不是插件（可能是缓存/构建产物）
    }
    const manifest = parseManifest(json)
    if (manifest == null) {
      issues.push({ dir, reason: 'manifest 非法（JSON 解析失败或缺 id/name/version/kind/entry）' })
      continue
    }
    if (seen.has(manifest.id)) {
      issues.push({ dir, reason: `id 冲突：${manifest.id} 已被先序插件占用` })
      continue
    }
    seen.add(manifest.id)
    plugins.push({ ...manifest, entryPath: join(pluginsRoot, dir, manifest.entry) })
  }
  return { plugins, issues }
}

/** 主窗装载目标：清单序第一个 workbench 插件。 */
export function selectWorkbench(plugins: Plugin[]): Plugin | null {
  return plugins.find(p => p.kind === 'workbench') ?? null
}
