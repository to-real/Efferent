/** 产品品牌常量与去引擎化逻辑（纯函数，接缝 1 可测）。 */
export const BRAND = {
  name: 'Efferent',
  slogan: 'Where cognition becomes action',
} as const

/** 主窗口标题（覆盖引擎页面自带标题）。 */
export function appTitle(): string {
  return BRAND.name
}

/** 把引擎页面标题里的引擎名替换为产品名（会话名等动态部分保留）。 */
export function stripEngineBranding(title: string): string {
  return title.replaceAll('DeepSeek Harness', BRAND.name)
}
