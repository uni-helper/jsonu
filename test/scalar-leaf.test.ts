import { describe, expect, it } from 'vitest'
import { parse } from '../src'
import { jsonu } from './fixtures'

describe('标量叶子写入', () => {
  it('set 用字符串标量覆盖嵌套 key', () => {
    const doc = parse(jsonu)
    doc.set('MP-WEIXIN', '微信首页', ['pages', 0, 'style', 'navigationBarTitleText'])
    expect(doc.evaluate('MP-WEIXIN')).toEqual({
      pages: [
        { path: 'pages/index', style: { navigationBarTitleText: '微信首页' } },
        { path: 'pages/wx', style: { navigationBarTitleText: '微信' } },
        { path: 'pages/about', style: { navigationBarTitleText: '关于' } },
      ],
    })
    // H5 平台保留原默认值
    expect(doc.evaluate('H5')).toEqual({
      pages: [
        { path: 'pages/index', style: { navigationBarTitleText: '默认' } },
        { path: 'pages/about', style: { navigationBarTitleText: '关于' } },
      ],
    })
  })

  it('set 标量等价于单字段对象写入', () => {
    const doc1 = parse(jsonu)
    const doc2 = parse(jsonu)
    doc1.set('MP-WEIXIN', '微信首页', ['pages', 0, 'style', 'navigationBarTitleText'])
    doc2.set('MP-WEIXIN', { navigationBarTitleText: '微信首页' }, ['pages', 0, 'style'])
    expect(doc1.stringify()).toBe(doc2.stringify())
  })

  it('set 用 COMMON 写入标量通用值', () => {
    const doc = parse(`{}`)
    doc.set('*', '通用标题', 'title')
    expect(doc.evaluate('H5')).toEqual({ title: '通用标题' })
    expect(doc.evaluate('MP-WEIXIN')).toEqual({ title: '通用标题' })
  })

  it('merge 支持数字和布尔标量追加', () => {
    const doc = parse(`{}`)
    doc.merge('MP-WEIXIN', 42, 'count')
    doc.merge('MP-WEIXIN', true, 'enabled')
    expect(doc.evaluate('MP-WEIXIN')).toEqual({ count: 42, enabled: true })
  })

  it('set 同平台二次覆盖（覆盖语义）', () => {
    const doc = parse(`{}`)
    doc.set('MP-WEIXIN', 42, 'count')
    doc.set('MP-WEIXIN', true, 'enabled')
    // set 覆盖：第二次清掉第一次的 MP-WEIXIN 根级 member
    expect(doc.evaluate('MP-WEIXIN')).toEqual({ enabled: true })
  })

  it('set 支持 null 标量', () => {
    const doc = parse(`{}`)
    doc.set('MP-WEIXIN', null, 'value')
    expect(doc.evaluate('MP-WEIXIN')).toEqual({ value: null })
  })

  it('set 标量在不存在路径上自动创建父对象', () => {
    const doc = parse(`{}`)
    doc.set('MP-WEIXIN', '微信', ['pages', 0, 'title'])
    expect(doc.evaluate('MP-WEIXIN')).toEqual({
      pages: [{ title: '微信' }],
    })
  })

  it('merge 标量叶子：不覆盖已有同平台条件', () => {
    const doc = parse(jsonu)
    doc.merge('MP-WEIXIN', '追加值', ['pages', 0, 'style', 'navigationBarTitleText'])
    // merge 不删已有，两个同 key 同平台的 member 并存，后者覆盖前者（uniapp 行为）
    expect(doc.evaluate('MP-WEIXIN')).toEqual({
      pages: [
        { path: 'pages/index', style: { navigationBarTitleText: '追加值' } },
        { path: 'pages/wx', style: { navigationBarTitleText: '微信' } },
        { path: 'pages/about', style: { navigationBarTitleText: '关于' } },
      ],
    })
  })

  it('标量 path 为空时抛错', () => {
    const doc = parse(jsonu)
    expect(() => doc.set('MP-WEIXIN', '值')).toThrow(/需要 path 指定目标 key/)
  })

  it('标量 path 最后一段为数字索引时抛错', () => {
    const doc = parse(`{ "pages": [] }`)
    expect(() => doc.set('MP-WEIXIN', '值', ['pages', 0])).toThrow(/必须是 string key/)
  })
})
