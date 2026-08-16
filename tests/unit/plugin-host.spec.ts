import { describe, expect, it } from 'vitest'
import { discoverPlugins } from '../../src/main/plugin-host.js'

function fakeFs(dirs: Record<string, string[]>, files: Record<string, string>) {
  return {
    readdir: async (dir: string) => dirs[dir.replace(/\\/g, '/')] ?? [],
    readFile: async (file: string) => {
      const key = file.replace(/\\/g, '/')
      if (!(key in files)) throw new Error(`ENOENT ${file}`)
      return files[key]!
    },
  }
}

describe('discoverPlugins（插件宿主：扫描 + manifest 解析）', () => {
  it('空目录或缺失目录返回空清单', async () => {
    const fs = fakeFs({}, {})
    const { plugins, issues } = await discoverPlugins('/plugins', fs)
    expect(plugins).toEqual([])
    expect(issues).toEqual([])
  })

  it('解析合法 manifest 并解析出入口绝对路径', async () => {
    const fs = fakeFs(
      { '/plugins': ['workbench'] },
      { '/plugins/workbench/plugin.json': JSON.stringify({ id: 'workbench', name: '工作台', version: '0.1.0', kind: 'workbench', entry: 'dist/index.html' }) },
    )
    const { plugins, issues } = await discoverPlugins('/plugins', fs)
    expect(issues).toEqual([])
    expect(plugins).toHaveLength(1)
    expect(plugins[0]).toMatchObject({ id: 'workbench', kind: 'workbench' })
    expect(plugins[0]!.entryPath.replace(/\\/g, '/')).toBe('/plugins/workbench/dist/index.html')
  })

  it('坏 JSON / 缺必填字段的 manifest 跳过并收集诊断，不影响其余插件', async () => {
    const fs = fakeFs(
      { '/plugins': ['good', 'bad-json', 'bad-fields'] },
      {
        '/plugins/good/plugin.json': JSON.stringify({ id: 'good', name: '好', version: '1.0.0', kind: 'panel', entry: 'dist/x.html' }),
        '/plugins/bad-json/plugin.json': '{oops',
        '/plugins/bad-fields/plugin.json': JSON.stringify({ id: 'bad-fields', entry: 'dist/x.html' }),
      },
    )
    const { plugins, issues } = await discoverPlugins('/plugins', fs)
    expect(plugins.map(p => p.id)).toEqual(['good'])
    expect(issues).toHaveLength(2)
    expect(issues.map(i => i.dir).sort()).toEqual(['bad-fields', 'bad-json'])
  })

  it('kind 只接受 workbench | panel，其他值跳过', async () => {
    const fs = fakeFs(
      { '/plugins': ['weird'] },
      { '/plugins/weird/plugin.json': JSON.stringify({ id: 'weird', name: '怪', version: '0.0.1', kind: 'theme', entry: 'x.html' }) },
    )
    const { plugins, issues } = await discoverPlugins('/plugins', fs)
    expect(plugins).toHaveLength(0)
    expect(issues).toHaveLength(1)
  })

  it('同名 id 冲突时后者跳过（确定性：按目录名排序）', async () => {
    const fs = fakeFs(
      { '/plugins': ['b-plugin', 'a-plugin'] },
      {
        '/plugins/a-plugin/plugin.json': JSON.stringify({ id: 'dup', name: 'A', version: '1.0.0', kind: 'panel', entry: 'a.html' }),
        '/plugins/b-plugin/plugin.json': JSON.stringify({ id: 'dup', name: 'B', version: '1.0.0', kind: 'panel', entry: 'b.html' }),
      },
    )
    const { plugins, issues } = await discoverPlugins('/plugins', fs)
    expect(plugins).toHaveLength(1)
    expect(plugins[0]!.name).toBe('A')
    expect(issues).toHaveLength(1)
  })

  it('selectWorkbench：多插件时取清单序第一个 workbench，无则 null', async () => {
    const fs = fakeFs(
      { '/plugins': ['w1', 'p1'] },
      {
        '/plugins/w1/plugin.json': JSON.stringify({ id: 'w1', name: '台', version: '1.0.0', kind: 'workbench', entry: 'i.html' }),
        '/plugins/p1/plugin.json': JSON.stringify({ id: 'p1', name: '板', version: '1.0.0', kind: 'panel', entry: 'p.html' }),
      },
    )
    const { plugins } = await discoverPlugins('/plugins', fs)
    const { selectWorkbench } = await import('../../src/main/plugin-host.js')
    expect(selectWorkbench(plugins)?.id).toBe('w1')
    expect(selectWorkbench([])).toBeNull()
  })
})
