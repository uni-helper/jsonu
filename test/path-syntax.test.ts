import { describe, expect, it } from 'vitest'
import { parse } from '../src'

describe('路径字符串语法', () => {
  it('bracket 数字索引等价于数组形式', () => {
    const doc1 = parse(`{ "pages": [{ "style": {} }] }`)
    const doc2 = parse(`{ "pages": [{ "style": {} }] }`)
    doc1.set('MP-WEIXIN', { title: '微信' }, ['pages', 0, 'style'])
    doc2.set('MP-WEIXIN', { title: '微信' }, 'pages[0].style')
    expect(doc1.stringify()).toBe(doc2.stringify())
  })

  it('bracket 数字索引生效', () => {
    const doc = parse(`{ "pages": [{ "style": {} }] }`)
    doc.set('MP-WEIXIN', '微信', 'pages[0].style.title')
    expect(doc.evaluate('MP-WEIXIN')).toEqual({
      pages: [{ style: { title: '微信' } }],
    })
  })

  it('单引号包裹含点号的 key', () => {
    const doc = parse(`{}`)
    doc.set('MP-WEIXIN', 'v', 'a[\'b.c\']')
    expect(doc.evaluate('MP-WEIXIN')).toEqual({ a: { 'b.c': 'v' } })
  })

  it('双引号包裹含点号的 key', () => {
    const doc = parse(`{}`)
    doc.set('MP-WEIXIN', 'v', 'a["b.c"]')
    expect(doc.evaluate('MP-WEIXIN')).toEqual({ a: { 'b.c': 'v' } })
  })

  it('纯 dot 写法向后兼容', () => {
    const doc = parse(`{}`)
    doc.set('MP-WEIXIN', 'v', 'a.b.c')
    expect(doc.evaluate('MP-WEIXIN')).toEqual({ a: { b: { c: 'v' } } })
  })

  it('dot 中纯数字段仍转数组索引', () => {
    const doc = parse(`{ "pages": [{ "style": {} }] }`)
    doc.set('MP-WEIXIN', 'v', 'pages.0.style.title')
    expect(doc.evaluate('MP-WEIXIN')).toEqual({
      pages: [{ style: { title: 'v' } }],
    })
  })

  it('连续 bracket 写法', () => {
    const doc = parse(`{}`)
    doc.set('MP-WEIXIN', 'v', '[\'x\'][\'y\']')
    expect(doc.evaluate('MP-WEIXIN')).toEqual({ x: { y: 'v' } })
  })

  it('混合 dot 与 bracket', () => {
    const doc = parse(`{ "pages": [{ "style": {} }] }`)
    doc.set('MP-WEIXIN', 'v', 'pages[0].style["title"]')
    expect(doc.evaluate('MP-WEIXIN')).toEqual({
      pages: [{ style: { title: 'v' } }],
    })
  })

  it('空字符串路径返回根', () => {
    const doc = parse(`{ "a": 1 }`)
    doc.set('MP-WEIXIN', { b: 2 }, '')
    expect(doc.evaluate('MP-WEIXIN')).toEqual({ a: 1, b: 2 })
  })

  it('数组形式路径不受字符串解析影响', () => {
    const doc = parse(`{}`)
    doc.set('MP-WEIXIN', 'v', ['a', 'b.c', 'd'])
    // 数组形式：每段原样作为 key，'b.c' 不被拆分
    expect(doc.evaluate('MP-WEIXIN')).toEqual({ a: { 'b.c': { d: 'v' } } })
  })
})
