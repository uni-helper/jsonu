import { describe, expect, it } from 'vitest'
import { parse } from '../src'

describe('delete semantic 语义删除', () => {
  it('默认精确匹配：复合表达式条件块不被删', () => {
    const doc = parse(`{
      "pages": [
        { "path": "pages/index" },
        // #ifdef H5 || MP-WEIXIN
        { "path": "pages/both" }
        // #endif
      ]
    }`)
    doc.delete('MP-WEIXIN', 'pages')
    // 精确匹配：'H5 || MP-WEIXIN' !== 'MP-WEIXIN'，块保留
    expect(doc.evaluate('MP-WEIXIN')).toEqual({
      pages: [
        { path: 'pages/index' },
        { path: 'pages/both' },
      ],
    })
  })

  it('semantic=true 删除复合表达式命中的条件块', () => {
    const doc = parse(`{
      "pages": [
        { "path": "pages/index" },
        // #ifdef H5 || MP-WEIXIN
        { "path": "pages/both" }
        // #endif
      ]
    }`)
    doc.delete('MP-WEIXIN', 'pages', { semantic: true })
    // 语义匹配：'H5 || MP-WEIXIN' 在 MP-WEIXIN 平台生效，块被删
    expect(doc.evaluate('MP-WEIXIN')).toEqual({
      pages: [{ path: 'pages/index' }],
    })
    // H5 平台也命中同一表达式，evaluate 后该块也消失
    expect(doc.evaluate('H5')).toEqual({
      pages: [{ path: 'pages/index' }],
    })
  })

  it('semantic=true 删除 ifndef 命中块', () => {
    const doc = parse(`{
      "pages": [
        { "path": "pages/index" },
        // #ifndef H5
        { "path": "pages/native" }
        // #endif
      ]
    }`)
    // MP-WEIXIN 平台下 ifndef H5 生效，semantic 删除应移除该块
    doc.delete('MP-WEIXIN', 'pages', { semantic: true })
    expect(doc.evaluate('MP-WEIXIN')).toEqual({
      pages: [{ path: 'pages/index' }],
    })
  })

  it('semantic=true 不删除未命中的条件块', () => {
    const doc = parse(`{
      "pages": [
        { "path": "pages/index" },
        // #ifdef H5
        { "path": "pages/h5" }
        // #endif
      ]
    }`)
    // H5 块在 MP-WEIXIN 平台不生效，semantic 删除不应移除
    doc.delete('MP-WEIXIN', 'pages', { semantic: true })
    expect(doc.evaluate('MP-WEIXIN')).toEqual({
      pages: [{ path: 'pages/index' }],
    })
    expect(doc.evaluate('H5')).toEqual({
      pages: [
        { path: 'pages/index' },
        { path: 'pages/h5' },
      ],
    })
  })

  it('semantic 不影响 COMMON 删除（始终删无 condition 节点）', () => {
    const doc = parse(`{
      "pages": [
        { "path": "pages/index" },
        // #ifdef H5
        { "path": "pages/h5" }
        // #endif
      ],
      "globalStyle": { "title": "默认" }
    }`)
    doc.delete('*', undefined, { semantic: true })
    // COMMON 删无 condition 节点：pages（无 condition 的元素）和 globalStyle 被清
    expect(doc.evaluate('H5')).toEqual({})
  })

  it('set 不受 semantic 影响（始终精确匹配）', () => {
    const doc = parse(`{
      // #ifdef H5 || MP-WEIXIN
      "a": 1
      // #endif
    }`)
    // set 用精确匹配删同平台块：'H5 || MP-WEIXIN' !== 'MP-WEIXIN'，不删，会追加新的 MP-WEIXIN 块
    doc.set('MP-WEIXIN', { b: 2 })
    expect(doc.evaluate('MP-WEIXIN')).toEqual({ a: 1, b: 2 })
  })
})
