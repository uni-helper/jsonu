<img src="./banner.svg" alt="banner" width="100%"/>

<div style="display: flex; justify-content: center; align-items: center; gap: 8px;">
  <a href="https://github.com/uni-helper/jsonu/stargazers"><img src="https://img.shields.io/github/stars/uni-helper/jsonu?colorA=005947&colorB=eee&style=for-the-badge" alt="stars"></a>
  <a href="https://www.npmjs.com/package/@uni-helper/jsonu"><img src="https://img.shields.io/npm/dm/@uni-helper/jsonu?colorA=005947&colorB=eee&style=for-the-badge" alt="downloads"></a>
  <a href="https://www.npmjs.com/package/@uni-helper/jsonu"><img src="https://img.shields.io/npm/v/@uni-helper/jsonu?colorA=005947&colorB=eee&style=for-the-badge" alt="npm"></a>
</div>

<div style="display: flex; justify-content: center; align-items: center; gap: 8px;">
  <a href="https://deepwiki.com/uni-helper/jsonu"><img src="https://deepwiki.com/badge.svg" alt="Ask DeepWiki"></a>
</div>

uniapp 条件编译的 json 解析工具。

支持 `pages.json` 等 json 文件中的 `#ifdef` / `#ifndef` / `#endif` 条件编译注释，提供解析、按平台裁剪、按平台增删条件数据、往返回写等能力。

## 安装

```bash
pnpm add @uni-helper/jsonu
```

## API

### parse(jsonu)

解析 jsonu 字符串，返回 `JsonuDocument`。

```ts
import { parse } from '@uni-helper/jsonu'

const doc = parse(`{
  "pages": [
    { "path": "pages/index" },
    // #ifdef MP-WEIXIN
    { "path": "pages/wx" }
    // #endif
  ]
}`)
```

支持两种注释格式：


```js
// #ifdef MP-WEIXIN
/* #ifdef MP-WEIXIN */
```

### doc.evaluate(platform)

按平台裁剪，返回普通 JS 对象（条件注释全部消除）。

```ts
doc.evaluate('H5')
// { pages: [{ path: 'pages/index' }] }

doc.evaluate('MP-WEIXIN')
// { pages: [{ path: 'pages/index' }, { path: 'pages/wx' }] }
```

平台名与 uniapp 条件编译平台一致：`H5`、`MP-WEIXIN`、`APP-PLUS` 等。`#ifndef H5` 表示非 H5 平台均保留。多平台用 `||` 连接，如 `H5 || MP-WEIXIN`。

### doc.set(platform, data, path?)

覆盖写入：先移除该位置该平台已有的条件数据，再写入新的。`path` 可选，省略时操作根级。

```ts
// 根级
doc.set('MP-WEIXIN', { globalStyle: { navigationBarTitleText: '微信' } })

// 嵌套路径（数组形式，数字为数组索引）
doc.set('MP-WEIXIN', { navigationBarTitleText: '微信' }, ['pages', 0, 'style'])

// 嵌套路径（字符串形式）
doc.set('MP-WEIXIN', { navigationBarTitleText: '微信' }, 'pages.0.style')
```

### doc.merge(platform, data, path?)

增量写入：不移除已有条件数据。对象 → 合并字段，数组 → 追加元素。

```ts
doc.merge('MP-WEIXIN', [{ path: 'pages/wx2' }], 'pages')
```

### doc.delete(platform, path?)

删除该位置该平台的条件数据。

```ts
doc.delete('MP-WEIXIN', 'pages')
```

### 与平台无关的配置（COMMON）

如果写入的配置不依赖任何平台（即不带条件编译注释），可传 `COMMON` 作为 platform：

```ts
import { COMMON, parse } from '@uni-helper/jsonu'

// 在根级写入通用 globalStyle（不带 #ifdef 包裹）
doc.set(COMMON, { globalStyle: { navigationBarTitleText: '通用标题' } })

// 在嵌套路径写入通用字段
doc.set(COMMON, { navigationBarTitleText: '通用' }, ['pages', 0, 'style'])

// 往数组追加通用元素
doc.merge(COMMON, [{ path: 'pages/common' }], 'pages')

// 删除该位置所有无条件节点（注意：会清掉同容器下所有通用数据，谨慎使用）
doc.delete(COMMON, 'pages')
```

`COMMON` 是导出的常量，值为 `'*'`。语义说明：

- `set(COMMON, data, path?)`：按 key 覆盖容器中无 condition 的同 key member（数组则全删无 condition 元素再追加）。不会误清同容器内其他 key 的通用配置。
- `merge(COMMON, data, path?)`：直接追加无 condition 数据。
- `delete(COMMON, path?)`：删除该位置所有无 condition 的 member/element。⚠️ 这是全删操作，等同 `delete('MP-WEIXIN', path)` 会删该位置所有 MP-WEIXIN 节点。
- `evaluate` 对无 condition 节点所有平台均保留。

### doc.stringify(indent?)

往返回写为带条件编译注释的 jsonu 字符串。`indent` 默认 `2`。

```ts
doc.stringify()
```

## 完整示例

```ts
import { parse } from '@uni-helper/jsonu'

const doc = parse(`{
  "pages": [
    { "path": "pages/index", "style": { "navigationBarTitleText": "默认" } }
  ]
}`)

// 给微信小程序添加专属页面
doc.merge('MP-WEIXIN', [{ path: 'pages/wx', style: { navigationBarTitleText: '微信' } }], 'pages')

// 给微信小程序覆盖首页标题（在 style 对象内追加条件 member，同 key 覆盖）
doc.set('MP-WEIXIN', { navigationBarTitleText: '微信首页' }, ['pages', 0, 'style'])

// 输出带条件编译的 jsonu
console.log(doc.stringify())
// {
//   "pages": [
//     {
//       "path": "pages/index",
//       "style": {
//         "navigationBarTitleText": "默认",
//         // #ifdef MP-WEIXIN
//         "navigationBarTitleText": "微信首页"
//         // #endif
//       }
//     },
//     // #ifdef MP-WEIXIN
//     {
//       "path": "pages/wx",
//       "style": {
//         "navigationBarTitleText": "微信"
//       }
//     }
//     // #endif
//   ]
// }

// 按平台裁剪
doc.evaluate('H5')
// { pages: [{ path: 'pages/index', style: { navigationBarTitleText: '默认' } }] }

doc.evaluate('MP-WEIXIN')
// { pages: [
//   { path: 'pages/index', style: { navigationBarTitleText: '微信首页' } },
//   { path: 'pages/wx', style: { navigationBarTitleText: '微信' } }
// ] }
```

## 注意事项

- 逗号策略：仅剔除条件节点，不自动修正逗号。输入需保证编译前后都合法（贴合 uniapp 官方约束）。
- `evaluate` 中同 key 后出现的 member 覆盖前者（uniapp 行为）。
- `stringify` 统一输出 `//` 风格注释，即使输入是 `/* */`。

## License

[MIT](./LICENSE) License © [uni-helper](https://github.com/uni-helper)

