# 链安修仙录 Chain Security Cultivation

一个把智能合约安全学习变成「AI 安全分析 → 修仙闯关 → 社区共建 → Monad 可验证凭证」完整体验的 Web3 安全学习平台。

- 线上体验：[chain-security-cultivation-mo.vercel.app](https://chain-security-cultivation-mo.vercel.app/)
- 当前完整关卡：Quest I「噬灵回环兽」
- 目标网络：Monad Testnet（Chain ID `10143`）

## 项目概述

链安修仙录以东方修仙叙事重新组织智能合约安全学习：学习者识别漏洞、观察攻击、理解修复、完成确定性挑战，并把通过结果转化为可公开核验的 Monad 链上成长记录。同时，贡献者可以提交安全案例，由 Guardian 分析、守阁人审核并沉淀进异兽志。

它不是把课程内容简单搬上链，而是把安全学习拆分为适合链上与链下各自承担的部分，在隐私、成本、可验证性与可持续社区协作之间保持清晰边界。

## 为谁解决什么问题

- 为智能合约初学者提供从漏洞现象到修复原理的完整、可操作学习路径。
- 为 Monad Builder 提供可验证的安全成长记录，而不是一次性的课程完成页面。
- 为安全贡献者建立候选案例、审核反馈、返修、收录与 Merit 声誉闭环。
- 为 Agent 链上操作探索“先模拟、再授权、后回读验证”的安全执行边界。

## 核心体验

1. 在 Quest I 中对抗经典重入漏洞异兽「噬灵回环兽」。
2. 观察真实资金流、识别漏洞类型并学习 Checks-Effects-Interactions 修复。
3. 完成确定性挑战，获得 EXP、五行熟练度与修炼徽记。
4. 核验 GuardianQuest 中的 completion proof、`reportHash` 与 ERC-1155 Soulbound 凭证。
5. 在个人档案查看修炼档案、贡献档案和真实 Stage38 Agent 链上执行证据。

## 核心功能

- Guardian 多层安全分析与 Signed Guardian Draft
- 候选案例贡献、Guardian Draft 确认和异兽志共建
- 守阁人漏洞分类、`changes_requested` 与返修重提
- Merit 贡献声誉与称号
- Quest I 确定性安全挑战及六幕沉浸式流程
- EXP、五行熟练度、境界与徽记
- 修炼档案与贡献档案双栏 Profile
- Monad GuardianQuest ERC-1155 Soulbound Credential
- Stage37 登录后真实链上凭证状态：`LEGACY_CREDENTIAL`、`READY_FOR_ONCHAIN`、`VERIFIED`
- Stage38 Moss 模拟 → 用户授权 → Monad 执行 → 状态回读验证

## Why Monad

链安修仙录围绕 Monad Builder 建立三层价值：

```text
Learn  培养更安全的 Builder
Prove  让安全学习成果成为 Monad 上可验证的成长记录
Act    探索 Agent 在模拟、授权和验证边界下安全操作 Monad
```

长期生态价值：

```text
更安全的 Builder
→ 更安全的应用
→ 更可信的 Agent
→ 更健康的 Monad 生态
```

Monad 在这里承担公共身份、完成证明、Soulbound 凭证和可回读状态的验证层，而不是仅仅用于“把数据放上链”。

## Learn → Prove → Act

| 阶段 | 当前实现 |
|---|---|
| Learn | Guardian 安全分析、漏洞挑战、攻击复现、修复理解、EXP 与五行成长 |
| Prove | GuardianQuest completion proof、`reportHash`、ERC-1155 Soulbound Credential、链上凭证一致性状态 |
| Act | Moss 准备并模拟精确交易，用户通过 EIP-1193 钱包明确授权，执行后独立回读 Monad 合约状态 |

## Monad Integration

### 链下

- Guardian 原始分析与完整证据
- 私有守阁人数据与审核过程
- 学习中间状态
- EXP 与 Merit
- 贡献案例全文和应用会话

### 链上

- Quest identity / registry
- completion proof
- `reportHash`
- ERC-1155 Soulbound Credential
- 公共资助与状态回读验证

链下负责需要隐私、快速迭代或高信息密度的数据；链上负责需要公共可验证性、不可抵赖性和生态可组合性的证明。

## Moss Agent Execution

Moss prepared and simulated the exact GuardianQuest action. The user explicitly authorized the reviewed transaction through an EIP-1193 wallet. After execution on Monad Testnet, the resulting contract state was independently read back and verified.

Moss 没有持有私钥，也没有不受限制的钱包控制权。生产前端仅展示只读证据，不提供 Agent 执行、签名或广播入口。

未来可在同样的“模拟 + 明确授权 + 回读验证”边界下支持自动凭证封印、Quest 运维、社区资助和 Agent 驱动的安全工作流；这些能力目前不声明为已实现。

## Architecture

```text
Browser / Wallet
       │ EIP-1193 identity and explicit authorization
       ▼
Next.js App Router
  ├─ Quest I immersive learning UI
  ├─ Guardian deterministic + optional model analysis
  ├─ Contributor / reviewer / cultivation APIs
  ├─ Stage37 credential consistency derivation
  └─ Stage38 public read-only execution evidence
       │
       ├─ Neon Postgres + Drizzle
       │    private learning, contribution, review, EXP and Merit state
       │
       └─ Monad Testnet RPC
            GuardianQuest registry, proof, reportHash,
            Soulbound credential and public funding state
```

安全合约、Foundry 测试、Invariant、Slither 结果、Quest 内容和审计报告均保存在同一仓库中，形成可复现证据链。

## Tech Stack

- Frontend / API：Next.js 16、React 19、TypeScript、CSS Modules
- Data：Neon Postgres、Drizzle ORM
- Chain：Solidity、Foundry、OpenZeppelin ERC-1155、viem、Monad Testnet
- Security：Foundry unit tests、Invariant、Slither
- Agent / AI：Moss、确定性 Guardian 分析、可选 Gemini hybrid 模式
- Deployment：Vercel

## Getting Started

```bash
git clone --recurse-submodules https://github.com/honora888/chain-security-cultivation.git
cd chain-security-cultivation/web
npm install
cp .env.example .env.local
npm run dev
```

生产校验：

```bash
cd web
npm run lint
npx tsc --noEmit
npm run build
```

合约校验：

```bash
forge fmt --check
forge build
forge test
```

## Environment Variables

变量值只应配置在本地或部署平台，不应提交 `.env.local`。

| 名称 | 用途 | 要求 |
|---|---|---|
| `DATABASE_URL` | 登录会话、贡献、审核、修炼进度、EXP 与 Merit | 完整应用必需 |
| `GUARDIAN_DRAFT_SIGNING_SECRET` | 签署并校验 Guardian Draft | 贡献流程必需 |
| `REVIEWER_WALLET_ADDRESSES` | 守阁人钱包 allowlist | 审核流程必需 |
| `MONAD_RPC_URL` | Monad Testnet 只读 RPC 与 Moss 模拟 | 链上核验必需 |
| `GUARDIAN_QUEST_ADDRESS` | 已部署 GuardianQuest 地址 | 链上核验必需 |
| `MONAD_CHAIN_ID` | 目标链 ID，必须与 Monad Testnet 一致 | 链上核验必需 |
| `GUARDIAN_LLM_MODE` | Guardian 模式：默认关闭外部模型，`hybrid` 时启用模型补充 | 可选 |
| `GEMINI_API_KEY` | Gemini hybrid 模式服务端密钥 | hybrid 模式必需 |
| `GUARDIAN_LLM_MODEL` | 覆盖默认模型名称 | 可选 |
| `DATABASE_URL_UNPOOLED` | Drizzle 迁移使用的非池化连接 | 仅迁移时可选 |

根目录 Foundry 脚本另使用 `MONAD_TESTNET_RPC_URL` 与 `ADMIN_ADDRESS`；它们不属于生产前端运行时配置。

## Smart Contract

`GuardianQuest` 提供：

- Quest 注册、启停与内容 Hash
- 学习完成状态及不可变 `reportHash`
- 验证者角色与完成证明
- ERC-1155 Soulbound 凭证
- Quest 公共资助状态

Quest I：

| 字段 | 值 |
|---|---|
| Quest ID | `1` |
| 异兽 | 噬灵回环兽 |
| 漏洞 | Classic Reentrancy |
| 五行 | Water |
| 徽记 | 水系守护者 |
| Token ID | `1` |

合约与安全证据：[`src/GuardianQuest.sol`](src/GuardianQuest.sol)、[`test/GuardianQuest.t.sol`](test/GuardianQuest.t.sol)、[`reports/quest-1-audit-report.md`](reports/quest-1-audit-report.md)。

## On-chain Evidence

| 字段 | 值 |
|---|---|
| Network | Monad Testnet |
| Chain ID | `10143` |
| GuardianQuest | `0x131debd042208a327841128e5800dd4a833032ab` |
| Historical Quest1 completion tx | `0x3b336c8f9d208e2492309f8db252a889ca9cfe6f61814321f4f48dd4ffdfc5e8` |
| Stage38 Moss execution tx | `0x9858f3cc68f8324afda69be1d7d7dad4a49d9f5c052b53b8ae8bea7c598d2fad` |

Stage38 状态回读：

```text
before:    0 wei
funded:    1000000000000 wei (0.000001 MON)
after:     1000000000000 wei
delta:     1000000000000 wei
read-back: EXACT MATCH
```

完整证据：[`docs/stage38-moss-monad-execution.md`](docs/stage38-moss-monad-execution.md)。仓库未采用未经核验的区块浏览器 URL。

## Demo Flow

1. 从首页进入 Quest I，观察噬灵回环兽与重入资金流。
2. 完成漏洞识别、修复理解与确定性挑战，查看 EXP / 五行成长。
3. 使用 Monad Testnet 钱包签名登录 `/profile`。
4. 查看修炼档案与贡献档案双栏布局。
5. 打开 Stage37 镇兽灵契，解释 Legacy / Ready / Verified 的链上—链下关系。
6. 查看 Stage38「链上行录」，依次说明真实执行成功、Before → Funded → After、Verified Delta、交易回执与 Moss 生命周期。
7. 如需展示社区共建，进入贡献与守阁人审核流程。

## Mock / Known Issues

### Implemented

- Quest I、Guardian 分析、贡献审核、EXP / Merit、双档案、Stage37 凭证和 Stage38 只读执行证据均已实现。

### Mock / Demo Data

- 部分异兽志展示内容与演示账户数据用于叙事和演示；链上交易、回执、合约状态及 Stage38 delta 使用真实 Monad Testnet 数据。

### Known Issues

- 当前仅 Quest I 完整实现。
- 外部模型可用性可能影响 hybrid AI 分析；确定性分析仍可独立工作。
- 早期历史 Quest1 凭证使用旧 `reportHash`，因此相对 Stage36 新 `completionHash` 正确派生为 `LEGACY_CREDENTIAL`，不是错误状态。
- EXP 与 Merit 有意保持链下。
- Stage38 生产面板只读；生产前端不暴露执行授权。

### Future

- 更多漏洞 Quest、自动凭证封印、Quest 运维、社区资助和受模拟/授权边界约束的 Agent 安全工作流。

## Roadmap

- 扩展更多确定性智能合约漏洞关卡。
- 增强跨 Quest 的修炼成长与异兽志检索。
- 在明确模拟、授权与回读边界下研究更多 Monad Agent 操作。
- 完善生产监控、可访问性与公开证据归档。

## Team

**Solo Builder / 独立开发**

产品设计、前端、后端、Solidity、Monad 集成、AI / 安全工作流、测试和 Demo 均由一位 Builder 完成，并使用 AI 辅助开发与调试。

## License

仓库目前尚未添加独立许可证文件。除非另有书面说明，使用或复用前请先联系作者。
