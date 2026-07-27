# Quest 1 Vercel Production Deployment

## 上线目标

本记录用于说明《链安修仙录》Quest 1 前端在 Vercel 生产环境的构建配置、公开路由、只读 Monad Testnet API 验收结果，以及首次平台级 404 的排查与修复边界。

生产部署仅开放已有 Quest 1 页面和只读链上状态查询，不增加钱包连接、签名或链上写入能力。

## 生产环境

| 字段 | 值 |
|---|---|
| 稳定生产域名 | `https://chain-security-cultivation-mo.vercel.app` |
| 部署平台 | Vercel Hobby |
| Git 分支 | `main` |
| Next.js | `16.2.12` |
| Vercel Root Directory | `web` |
| 目标网络 | Monad Testnet |
| Chain ID | `10143` |

区块高度来自每次只读查询时的 `eth_blockNumber`，是动态结果，不属于固定生产配置。

## Git 与自动部署

生产项目连接仓库的 `main` 分支。新的提交推送到 `main` 后，Vercel 自动创建新的生产部署。

发布前应确认：

1. 本地工作区干净。
2. 本地 HEAD 与 `origin/main` 一致。
3. `web/package.json`、`web/vercel.json`、App Router 页面和 Route Handler 均已进入目标提交。
4. 本地 `npm run build` 成功并列出预期路由。

## Vercel 构建配置

Vercel 项目的 Root Directory 为：

```text
web
```

为确保平台按 Next.js 项目执行构建，仓库包含 [`web/vercel.json`](../web/vercel.json)：

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "buildCommand": "npm run build"
}
```

该配置：

- 明确指定 Framework Preset 为 `nextjs`。
- 明确执行 `npm run build`。
- 没有配置 `outputDirectory`。
- 没有把 `.next` 写成静态输出目录。
- 没有添加 routes、rewrites 或 redirects。

## 生产路由

| 路由 | 用途 | 验收状态 |
|---|---|---|
| [`/`](https://chain-security-cultivation-mo.vercel.app/) | Quest 1 入口页 | 可访问 |
| [`/quests/1`](https://chain-security-cultivation-mo.vercel.app/quests/1) | Quest 1 六幕 Boss 战 | 可访问 |
| [`/api/quest-1/chain-status?address=0x000000000000000000000000000000000000dEaD`](https://chain-security-cultivation-mo.vercel.app/api/quest-1/chain-status?address=0x000000000000000000000000000000000000dEaD) | GuardianQuest 只读状态查询 | HTTP 200 |

## 服务端环境变量

生产环境需要以下变量名称：

```text
MONAD_RPC_URL
GUARDIAN_QUEST_ADDRESS
MONAD_CHAIN_ID
```

安全约束：

- 三个变量只用于服务端 Route Handler 及其 helper。
- 不使用 `NEXT_PUBLIC_` 前缀，不把 RPC 配置发送到浏览器。
- 本文档不记录 RPC URL、访问凭据或 Vercel 环境变量截图。
- 新增或修改 Vercel 环境变量后，需要创建新部署才能生效。
- 生产 API 成功返回真实 Monad Testnet 结果，表明当前生产环境变量已经正确配置。

本地占位说明见 [`web/.env.example`](../web/.env.example)。

## 生产 API 验收

验收请求：

```text
GET /api/quest-1/chain-status?address=0x000000000000000000000000000000000000dEaD
```

生产环境已经真实返回 HTTP `200`，主要字段为：

```json
{
  "ok": true,
  "network": {
    "name": "Monad Testnet",
    "chainId": 10143
  },
  "contract": {
    "address": "0x131DEbd042208A327841128e5800dd4a833032ab"
  },
  "query": {
    "address": "0x000000000000000000000000000000000000dEaD",
    "questId": 1
  },
  "status": {
    "completed": false,
    "reportHash": "0x0000000000000000000000000000000000000000000000000000000000000000",
    "badgeBalance": "0"
  }
}
```

结果解释：

- API 已连接 Monad Testnet 并读取已部署的 GuardianQuest。
- 该公共测试地址尚未登记 Quest 1 完成状态。
- 该地址的 Quest 1 `reportHash` 为零 bytes32。
- 该地址的 Quest 1 勋章余额为 `0`。
- 返回中的 `blockNumber` 随查询区块变化，不应作为固定生产配置记录。
- 当前真实生产验收只覆盖 `completed=false`。

更完整的 RPC、ABI、selector 与 Mock 验收边界见 [Quest 1 Monad Testnet 只读验收](quest-1-chain-verification.md)。

## 页面验收

生产部署已经确认：

- 首页 `/` 可以访问。
- Quest 1 页面 `/quests/1` 可以访问。
- Quest 页面保留本地六幕流程与 `ACT6_COMPLETE`。
- Route Handler 可以返回真实 Monad Testnet 只读结果。
- 页面与 API 不依赖静态导出目录。

本记录不扩展为移动端、浏览器兼容性或性能专项报告。

## 安全边界

- 生产页面不连接钱包。
- 不请求用户签名。
- 不发送链上写交易。
- 本地 `ACT6_COMPLETE` 不等同于链上 `completed=true`。
- 本地“水系守护者”徽记不等同于链上 ERC-1155 Quest 1 勋章余额。
- 当前真实生产验收只验证了 `completed=false`。
- `completed=true` 仍未使用可信、可公开的已登记地址进行真实验证。
- API 只接受查询地址，不接受用户指定的 RPC URL、合约地址、JSON-RPC method 或 calldata。

## 故障与修复记录

首次 Vercel 部署状态显示为 Ready，但访问生产地址时返回 Vercel 平台级 `404: NOT_FOUND`。

当时的部署证据包括：

1. Resources 中只有 `web/public` 下的图片和 SVG。
2. 没有 Next.js 页面资源。
3. 没有 `/_next/static` 资源。
4. 没有 API Function。
5. 本地 `npm run build` 正常，并列出 `/`、`/quests/1` 和 `/api/quest-1/chain-status`。
6. `origin/main` 中存在 `web/package.json`、首页、根布局和 Route Handler。

因此，问题并非首页缺失、GitHub 前端文件缺失或本地 Next.js 构建失败。

准确的故障结论为：

> 部署证据表明首次部署未执行完整 Next.js 构建，而是仅暴露了 public 静态资源。

这不等同于已经确定 Vercel 内部故障原因。

修复措施：

1. 新增 `web/vercel.json`。
2. 设置 `framework=nextjs`。
3. 设置 `buildCommand=npm run build`。
4. 不配置 `outputDirectory`。
5. 将新提交推送至 `main`。
6. Vercel 自动创建新的生产部署。
7. 新部署中的首页、Quest 页面和 API Route 均可访问。

## 复现与后续部署

发布前在仓库根目录执行：

```powershell
Set-Location web
npm ci
npm run build
```

构建路由应至少包含：

```text
/
/quests/1
/api/quest-1/chain-status
```

后续部署应继续：

1. 使用 `main` 作为生产分支。
2. 保持 Vercel Root Directory 为 `web`。
3. 保留 `web/vercel.json` 的 Next.js Framework 与构建命令。
4. 不设置自定义 Output Directory。
5. 环境变量变更后创建新部署。
6. 部署完成后分别检查首页、Quest 页面和只读 API。

## 当前限制

- 真实生产验收尚未覆盖 `completed=true`。
- 没有可信、可公开的已登记地址用于生产 `completed=true` 验收。
- 区块高度是每次查询时的动态值。
- 本阶段没有验证钱包、签名、链上写入或勋章铸造流程。
- 本文档记录的是 Vercel Hobby 上的当前 Quest 1 生产部署，不代表完整生产级安全审计。
