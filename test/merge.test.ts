import { describe, expect, it } from 'vitest'
import { parse } from '../src'
import { jsonu } from './fixtures'

describe('merge', () => {
  it('往 pages 数组追加条件元素', () => {
    const doc = parse(jsonu)
    doc.merge('MP-WEIXIN', [{ path: 'pages/wx2', style: { navigationBarTitleText: '微信2' } }], ['pages'])
    expect(doc.evaluate('MP-WEIXIN')).toEqual({
      pages: [
        { path: 'pages/index', style: { navigationBarTitleText: '默认' } },
        { path: 'pages/wx', style: { navigationBarTitleText: '微信' } },
        { path: 'pages/about', style: { navigationBarTitleText: '关于' } },
        { path: 'pages/wx2', style: { navigationBarTitleText: '微信2' } },
      ],
    })
  })
})
