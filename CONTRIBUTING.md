# 参与贡献

感谢你对 `@uni-helper/jsonu` 的关注。本文档说明仓库结构、本地开发流程、测试方式，以及提交 PR 前的检查项。

## 前置条件

- Node.js 22 / 24 / 26：CI 在这三个版本上跑，仓库没有固定版本文件（无 `.node-version`、无 `engines`）
- pnpm 12.18.0：`package.json` 的 `packageManager` 字段已固定版本，用 corepack 或 `pnpm self-update` 对齐
- Git

`pnpm install` 会执行 `prepare`，用 `skills-npm` 把依赖自带的 skill 以软链接铺到 `skills/` 和各 AI 工具的目录，并写一份 `skills-npm-lock.json`。这些都是生成物，删掉后重新 install 即可恢复，不要提交。仓库没有配置 git 钩子，提交前请自己跑下面「测试与检查」里的命令。

## 仓库结构

```
jsonu/
├── .github/
│   └── workflows/
│       ├── ci.yml          # 三系统 × Node 22 / 24 / 26，依次 build、lint、test、typecheck
│       └── release.yml     # push v* tag 触发，复用 sxzz/workflows 发布
├── .vscode/                # 关闭 Prettier，保存时交给 eslint 自动修复
├── src/
│   ├── index.ts            # 入口：parse、JsonuDocument（evaluate / set / merge / delete / stringify）
│   ├── conditions.ts       # 注释指令正则、条件区间、平台匹配
│   ├── tree.ts             # momoa AST → 条件树，条件树 → 值 / 文本
│   └── types.ts            # Condition / TreeNode / Path 等类型与 COMMON 常量
├── test/                   # 10 个测试文件，fixtures.ts 放共享的 jsonu 文本
├── dist/                   # tsdown 产物，发布到 npm，已 gitignore
├── banner.svg              # README 头图
├── logo.svg                # README 徽标
├── pnpm-workspace.yaml     # 只有 catalog 和 allowBuilds，没有实际工作区成员
├── tsdown.config.ts        # 构建配置：esm + dts，开启 publint 校验
├── tsconfig.json           # TypeScript 配置：strict，noEmit
├── eslint.config.js        # @antfu/eslint-config（type: 'lib'）
├── AGENTS.md               # 给 AI 编码代理的项目说明
├── CONTRIBUTING.md
├── LICENSE
├── README.md
└── package.json
```

## 本地开发

```bash
pnpm install      # 安装依赖
pnpm run build    # 生成 dist/（tsdown，esm + dts）
pnpm run dev      # tsdown 监听模式，改 src/ 自动重建
```

所有依赖版本写在 `pnpm-workspace.yaml` 的 `catalog:` 里，`package.json` 直接用 `catalog:cli` 这类协议引用。升级依赖改 catalog，改完跑一次 `pnpm install` 更新 lockfile。

临时验证行为：写一个 `test/scratch.test.ts`，用 `pnpm exec vitest run test/scratch.test.ts` 跑。测试直接读 `src/`，不用先 build。

## 测试与检查

```bash
pnpm run test      # 先 build 再跑 vitest
pnpm run lint      # eslint（含 markdown、json、yaml）
pnpm run lint:fix  # eslint --fix
pnpm run typecheck # tsc --noEmit
```

单跑一个测试文件：

```bash
pnpm exec vitest run test/evaluate.test.ts
```

### 测试说明

- 测试直接 `import { parse } from '../src'`，跑的是源码。`pnpm run test` 仍然先 build 一次，为的是顺带验证入口、类型声明和 `publint` 校验。
- 用例都是「给定 jsonu 文本 → 断言具体值」，没有快照。期望值按 uni-app 的行为手写；测试红了先判断是代码错还是期望值错，`-u` 在这里不解决问题。
- 共享的输入文本放在 `test/fixtures.ts`，新场景优先在对应测试文件里写内联文本，方便看清条件块的位置。

## 代码架构

从文本到结果的主流程：

1. `parse` 用 `@humanwhocodes/momoa` 以 jsonc 模式解析，拿到 AST、token 和 range。
2. `parseConditions` 扫注释 token，靠偏移量配出 `#ifdef` / `#endif` 区间。
3. `buildTree` 把 AST 转成条件树，条件只挂在具体的 member 或 element 上。
4. `evaluateTree` / `stringifyTree` 从条件树生成普通对象或带注释的文本。

`JsonuDocument` 的写操作统一走 `navigate` 定位容器，再按 `platform` 增删容器里的成员。`COMMON` 分支的删除范围与平台分支不同，改这块前先看 `removeCommonForSet`。

## 提交规范

1. Fork 本仓库并克隆到本地。
2. 基于 `main` 创建分支：`feat/xxx`、`fix/xxx`、`docs/xxx`。
3. 提交信息用 [Conventional Commits](https://www.conventionalcommits.org/)，例如 `feat: 支持语义删除`，破坏性变更写 `feat!:`。
4. 提交前跑：

   ```bash
   pnpm run lint
   pnpm run typecheck
   pnpm run test
   ```

5. 推送到远端后发起 Pull Request。

仓库没有配置 git 钩子，上面三条记得自己跑；CI 只做最后一道校验。

## Pull Request 指南

- 一个 PR 解决一个问题，不要顺手改无关的文件。
- 新增或修改行为时，同步更新 `README.md` 的对应小节；指令格式、`COMMON` 语义、错误行为都有专节。
- 补充测试，覆盖到新行为的边界（`test/` 下的文件按能力划分，别塞进 `common.test.ts`）。
- 确保 CI 通过：在 ubuntu / macos / windows × Node 22 / 24 / 26 上依次跑 build、lint、test、typecheck。
- 方案有争议时先开 Issue 讨论，别直接写完整实现。

## 发布

维护者执行：

```bash
pnpm run release   # bumpp 改版本号、提交、打 tag
```

push tag 后 `release.yml` 触发，由 `sxzz/workflows` 的发布流程生成 GitHub Release 并发布到 npm。不要手动 `npm publish`。

## 行为准则

参与本项目请遵守 [uni-helper 行为准则](https://github.com/uni-helper/.github/blob/main/CODE_OF_CONDUCT.md)。

遇到问题请到 [Issues](https://github.com/uni-helper/jsonu/issues) 交流。
