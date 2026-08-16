import { describe, expect, it } from 'vitest'
import { BRAND, appTitle, stripEngineBranding } from '../../src/main/branding.js'

describe('branding', () => {
  it('产品常量：名字与口号', () => {
    expect(BRAND.name).toBe('Efferent')
    expect(BRAND.slogan).toBe('Where cognition becomes action')
  })

  it('窗口标题为产品名', () => {
    expect(appTitle()).toBe('Efferent')
  })

  it('引擎品牌剥离：标题中的引擎名替换为产品名', () => {
    expect(stripEngineBranding('DeepSeek Harness')).toBe('Efferent')
    expect(stripEngineBranding('重构计划 · DeepSeek Harness')).toBe('重构计划 · Efferent')
  })

  it('无引擎字样的标题原样返回', () => {
    expect(stripEngineBranding('某个会话标题')).toBe('某个会话标题')
  })
})
