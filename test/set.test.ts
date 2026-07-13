import { describe, expect, it } from 'vitest'
import { parse } from '../src'
import { jsonu } from './fixtures'

describe('set', () => {
  it('在根级覆盖平台数据', () => {
    const doc = parse(jsonu)
    doc.set('MP-WEIXIN', { globalStyle: { navigationBarTitleText: '微信全局' } })
    expect(doc.evaluate('MP-WEIXIN')).toEqual({
      pages: [
        { path: 'pages/index', style: { navigationBarTitleText: '默认' } },
        { path: 'pages/wx', style: { navigationBarTitleText: '微信' } },
        { path: 'pages/about', style: { navigationBarTitleText: '关于' } },
      ],
      globalStyle: { navigationBarTitleText: '微信全局' },
    })
    expect(doc.evaluate('H5')).toEqual({
      pages: [
        { path: 'pages/index', style: { navigationBarTitleText: '默认' } },
        { path: 'pages/about', style: { navigationBarTitleText: '关于' } },
      ],
    })
  })

  it('在嵌套路径覆盖', () => {
    const doc = parse(jsonu)
    doc.set('MP-WEIXIN', { navigationBarTitleText: '微信标题' }, ['pages', 0, 'style'])
    expect(doc.evaluate('MP-WEIXIN')).toEqual({
      pages: [
        { path: 'pages/index', style: { navigationBarTitleText: '微信标题' } },
        { path: 'pages/wx', style: { navigationBarTitleText: '微信' } },
        { path: 'pages/about', style: { navigationBarTitleText: '关于' } },
      ],
    })
    expect(doc.evaluate('H5')).toEqual({
      pages: [
        { path: 'pages/index', style: { navigationBarTitleText: '默认' } },
        { path: 'pages/about', style: { navigationBarTitleText: '关于' } },
      ],
    })
  })

  it('set 后 stringify 输出带条件注释', () => {
    const doc = parse(jsonu)
    doc.set('MP-WEIXIN', { globalStyle: { navigationBarTitleText: '微信' } })
    expect(doc.stringify()).toBe(`{
  "pages": [
    {
      "path": "pages/index",
      "style": {
        "navigationBarTitleText": "默认"
      }
    },
    // #ifdef MP-WEIXIN
    {
      "path": "pages/wx",
      "style": {
        "navigationBarTitleText": "微信"
      }
    },
    // #endif
    {
      "path": "pages/about",
      "style": {
        "navigationBarTitleText": "关于"
      }
    }
  ],
  // #ifdef MP-WEIXIN
  "globalStyle": {
    "navigationBarTitleText": "微信"
  }
  // #endif
}`)
  })
})
