import { describe, expect, it } from 'vitest'
import { parse } from '../src'

describe('路径自动创建', () => {
  it('set 在不存在的对象路径上自动创建中间对象', () => {
    const doc = parse(`{}`)
    doc.set('MP-WEIXIN', { navigationBarTitleText: '微信' }, ['pages', 0, 'style'])
    expect(doc.evaluate('MP-WEIXIN')).toEqual({
      pages: [{ style: { navigationBarTitleText: '微信' } }],
    })
    // H5 平台 pages 数组 + 中间 style 节点都保留（无 condition 的通用结构）
    expect(doc.evaluate('H5')).toEqual({
      pages: [{ style: {} }],
    })
    expect(doc.stringify()).toMatchInlineSnapshot(`
      "{
        "pages": [
          {
            "style": {
              // #ifdef MP-WEIXIN
              "navigationBarTitleText": "微信"
              // #endif
            }
          }
        ]
      }"
    `)
  })

  it('set 用单段路径自动创建', () => {
    const doc = parse(`{}`)
    doc.set('MP-WEIXIN', { list: [{ pagePath: 'pages/wx' }] }, ['tabBar'])
    expect(doc.evaluate('MP-WEIXIN')).toEqual({
      tabBar: { list: [{ pagePath: 'pages/wx' }] },
    })
  })

  it('merge 在不存在的路径上自动创建并追加', () => {
    const doc = parse(`{}`)
    doc.merge('MP-WEIXIN', [{ path: 'pages/wx' }], ['pages'])
    expect(doc.evaluate('MP-WEIXIN')).toEqual({
      pages: [{ path: 'pages/wx' }],
    })
    expect(doc.evaluate('H5')).toEqual({
      pages: [],
    })
  })

  it('路径中间是数组时正确创建下一级对象', () => {
    const doc = parse(`{ "pages": [] }`)
    // pages 已存在但是空数组，set 应自动创建 pages[0].style
    doc.set('MP-WEIXIN', { navigationBarTitleText: '微信' }, ['pages', 0, 'style'])
    expect(doc.evaluate('MP-WEIXIN')).toEqual({
      pages: [{ style: { navigationBarTitleText: '微信' } }],
    })
  })

  it('common 在不存在的路径上自动创建通用配置', () => {
    const doc = parse(`{}`)
    doc.set('*', { navigationBarTitleText: '通用' }, ['globalStyle'])
    expect(doc.evaluate('H5')).toEqual({
      globalStyle: { navigationBarTitleText: '通用' },
    })
  })

  it('delete 不存在的路径是 no-op', () => {
    const doc = parse(`{ "a": 1 }`)
    // 不存在的路径不应抛错
    doc.delete('MP-WEIXIN', ['notExist', 'deep', 'path'])
    expect(doc.evaluate('MP-WEIXIN')).toEqual({ a: 1 })
  })

  it('数组索引越界（跳过填充）抛错', () => {
    const doc = parse(`{ "pages": [] }`)
    // 空数组，索引 5 远超长度，应抛错而非静默填充
    expect(() => doc.set('MP-WEIXIN', { x: 1 }, ['pages', 5, 'style'])).toThrow(/数组索引越界/)
  })

  it('路径段类型不匹配抛错', () => {
    const doc = parse(`{ "pages": "not array" }`)
    // pages 是字符串，但路径期望它是数组
    expect(() => doc.set('MP-WEIXIN', { x: 1 }, ['pages', 0])).toThrow(/路径期望数组/)
  })

  it('set 到根级时 path 留空覆盖整个根', () => {
    const doc = parse(`{ "old": true }`)
    doc.set('MP-WEIXIN', { newField: '微信' })
    expect(doc.evaluate('MP-WEIXIN')).toEqual({
      old: true,
      newField: '微信',
    })
  })

  it('自动创建的中间节点不带 condition（仅叶子数据按平台条件化）', () => {
    const doc = parse(`{}`)
    doc.set('MP-WEIXIN', { navigationBarTitleText: '微信' }, ['pages', 0, 'style'])
    const str = doc.stringify()
    // 仅最内层的 navigationBarTitleText 带 #ifdef，外层 pages/pages[0]/style 都是通用结构
    expect(str).toBe(`{
  "pages": [
    {
      "style": {
        // #ifdef MP-WEIXIN
        "navigationBarTitleText": "微信"
        // #endif
      }
    }
  ]
}`)
  })
})
