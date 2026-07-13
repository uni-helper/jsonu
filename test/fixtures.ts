// 共享的测试 fixture

export const jsonu = /* jsonu */`{
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
  ]
}
`

// ifndef + 块注释测试用例
export const jsonuBlock = /* jsonu */`{
  "pages": [
    {
      "path": "pages/index"
    },
    /* #ifndef H5 */
    {
      "path": "pages/native"
    }
    /* #endif */
  ]
}
`
