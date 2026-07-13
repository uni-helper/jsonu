import { describe, expect, it } from 'vitest'
import { COMMON, parse } from '../src'
import { jsonu } from './fixtures'

describe('common 平台无关配置', () => {
  it('set 用 COMMON 写入无 condition 的通用配置', () => {
    const doc = parse(jsonu)
    doc.set(COMMON, { globalStyle: { navigationBarTitleText: '通用全局' } })
    expect(doc.evaluate('H5')).toEqual({
      pages: [
        { path: 'pages/index', style: { navigationBarTitleText: '默认' } },
        { path: 'pages/about', style: { navigationBarTitleText: '关于' } },
      ],
      globalStyle: { navigationBarTitleText: '通用全局' },
    })
    expect(doc.evaluate('MP-WEIXIN')).toEqual({
      pages: [
        { path: 'pages/index', style: { navigationBarTitleText: '默认' } },
        { path: 'pages/wx', style: { navigationBarTitleText: '微信' } },
        { path: 'pages/about', style: { navigationBarTitleText: '关于' } },
      ],
      globalStyle: { navigationBarTitleText: '通用全局' },
    })
  })

  it('set 用 COMMON 覆盖已有通用配置（不误删平台条件节点）', () => {
    const doc = parse(jsonu)
    doc.set(COMMON, { globalStyle: { navigationBarTitleText: '通用' } })
    doc.set(COMMON, { globalStyle: { navigationBarTitleText: '新的通用' } })
    // 第二次 set 应清掉第一次的通用 globalStyle，但不影响 pages 数组里的 MP-WEIXIN 条件块
    expect(doc.evaluate('MP-WEIXIN')).toEqual({
      pages: [
        { path: 'pages/index', style: { navigationBarTitleText: '默认' } },
        { path: 'pages/wx', style: { navigationBarTitleText: '微信' } },
        { path: 'pages/about', style: { navigationBarTitleText: '关于' } },
      ],
      globalStyle: { navigationBarTitleText: '新的通用' },
    })
  })

  it('merge 用 COMMON 往数组追加无条件元素', () => {
    const doc = parse(jsonu)
    doc.merge(COMMON, [{ path: 'pages/common' }], 'pages')
    expect(doc.evaluate('H5')).toEqual({
      pages: [
        { path: 'pages/index', style: { navigationBarTitleText: '默认' } },
        { path: 'pages/about', style: { navigationBarTitleText: '关于' } },
        { path: 'pages/common' },
      ],
    })
  })

  it('stringify 用 COMMON 写入的节点不带条件注释', () => {
    const doc = parse(`{ "pages": [] }`)
    doc.set(COMMON, { globalStyle: { navigationBarTitleText: '通用' } })
    expect(doc.stringify()).toBe(`{
  "pages": [],
  "globalStyle": {
    "navigationBarTitleText": "通用"
  }
}`)
  })

  it('delete 用 COMMON 移除所有通用节点', () => {
    const doc = parse(jsonu)
    doc.set(COMMON, { globalStyle: { navigationBarTitleText: '通用' } })
    doc.delete(COMMON)
    // 全删无 condition 的 member（包括原 pages 和新增的 globalStyle）
    expect(doc.evaluate('MP-WEIXIN')).toEqual({})
  })

  it('common 不影响 platform 字段为 "*" 的真实条件块', () => {
    // 极端情况：源文件里真有 #ifdef * 的条件块（实际不会出现，但保护性测试）
    const doc = parse(`{
      "pages": [
        // #ifdef *
        { "path": "pages/star" }
        // #endif
      ]
    }`)
    // delete COMMON 不应误删这个条件块
    doc.delete(COMMON, 'pages')
    expect(doc.evaluate('*')).toEqual({
      pages: [{ path: 'pages/star' }],
    })
  })
})
