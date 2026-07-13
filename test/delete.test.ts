import { describe, expect, it } from 'vitest'
import { parse } from '../src'
import { jsonu } from './fixtures'

describe('delete', () => {
  it('移除指定平台的条件数据', () => {
    const doc = parse(jsonu)
    doc.delete('MP-WEIXIN', 'pages')
    expect(doc.evaluate('MP-WEIXIN')).toEqual({
      pages: [
        { path: 'pages/index', style: { navigationBarTitleText: '默认' } },
        { path: 'pages/about', style: { navigationBarTitleText: '关于' } },
      ],
    })
  })

  it('不误删 ifndef 等非目标平台的条件块', () => {
    const doc = parse(`{
      "pages": [
        { "path": "pages/index" },
        // #ifndef H5
        { "path": "pages/native" }
        // #endif
      ]
    }`)
    doc.delete('MP-WEIXIN', 'pages')
    // ifndef H5 块应保留（它的 platform 字段是 'H5'，不是 'MP-WEIXIN'）
    expect(doc.evaluate('MP-WEIXIN')).toEqual({
      pages: [
        { path: 'pages/index' },
        { path: 'pages/native' },
      ],
    })
    // 再 delete('H5') 才会移除 ifndef H5 块
    doc.delete('H5', 'pages')
    expect(doc.evaluate('MP-WEIXIN')).toEqual({
      pages: [{ path: 'pages/index' }],
    })
  })
})
