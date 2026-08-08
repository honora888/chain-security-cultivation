# 链安修仙录 · Chain Security Cultivation

一个把智能合约安全学习组织成「AI 安全分析 → 修仙闯关 → 社区共建 → Monad 可验证凭证」完整体验的 Web3 安全学习平台。

- 在线体验：[chain-security-cultivation.vercel.app](https://chain-security-cultivation.vercel.app/)
- 当前完整关卡：Quest I「噬灵回环兽」
- 目标网络：Monad Testnet（Chain ID `10143`）

## 项目概览

链安修仙录以东方修仙叙事重新组织智能合约安全学习：学习者识别漏洞、观察攻击、理解修复并完成确定性挑战；贡献者提交真实安全案例，由 Guardian 整理证据、守阁人审核，再沉淀为可公开学习的《异兽志》档案。

项目不是把课程内容简单搬上链。隐私数据、学习进度、EXP 与 Merit 保留在链下；Quest 身份、完成凭证和关键协议状态由 Monad 提供公开可验证层。当前完整产品包括可玩的 Quest I、Guardian 分析与 Signed Draft、贡献与审核闭环、双线成长档案、Monad 链上修炼凭证，以及 Moss × Monad 安全执行验证。

## 世界观：从识兽、镇兽到守阁

智能合约世界中的漏洞，被具象化为「异兽」。每个叙事角色都对应一个真实的安全职责：

| 世界观概念 | 真实含义 |
|---|---|
| 异兽 | 一个经过结构化描述的智能合约安全漏洞案例 |
| 《异兽志》 | 经过人工审核、可以公开学习的安全案例档案 |
| 秘境 | 从异兽志案例继续完成教学设计、证据冻结与验证流程后形成的交互式安全挑战 |
| 修士 | 学习智能合约安全的 Builder |
| 异兽献策者 | 提交真实案例、攻击证据与修复方案的 Contributor |
| 守阁人 | 对案例能否正式收录作最终判断的人类 Reviewer |
| Guardian | 识别漏洞、整理证据并生成结构化分析和候选异兽档案的 Security Agent |
| Monad | 为关键 Quest 身份、完成凭证与协议状态提供公开可验证层 |
| Moss | 在链上动作中承担 Action 构造、Simulation、Warning，以及用户授权后的可验证执行流程 |

> 天下漏洞皆可入《异兽志》；但只有经过证据、审核与教学制作的案例，才能进一步化为供修士挑战的「秘境」。

项目的社区安全知识飞轮是：

```text
真实漏洞
→ Guardian 鉴定
→ 人工审核
→ 收录《异兽志》
→ 转化为秘境
→ 更多 Builder 学习
→ Builder 提交新的真实案例
→ 《异兽志》继续增长
```

### 两条互相促进、积分完全独立的成长线

学习线：

```text
进入秘境 → 定位危险代码 → 判断漏洞 → 理解攻击 → 完成修复
→ 验证通关 → EXP / 五行熟练度 / 徽记 → 提升修炼境界
→ Monad 镇兽灵契
```

贡献线：

```text
发现真实案例 → 异兽献策 → Guardian 鉴定 → Signed Draft
→ 守阁人审核 → 收录《异兽志》 → Merit → 提升藏经阁称号
→ 有价值案例进一步转化为新的秘境
```

这两个循环共同扩展知识库，但 EXP 与 Merit 不互换、不合并，也不会因 Quest 资助而变化。

## 成长体系

### 修炼线：EXP / 修炼境界

这条线回答：“我完成了多少安全学习与验证挑战？”

EXP 只来自经过服务端验证的 Quest 完成记录。Player Realm（玩家境界）由累计 EXP 推导：

| EXP 起点 | 修炼境界 | Canonical name |
|---:|---|---|
| 0 | 练气期 | Qi Refining |
| 1,000 | 筑基期 | Foundation Establishment |
| 3,000 | 金丹期 | Core Formation |
| 7,000 | 元婴期 | Nascent Soul |
| 15,000 | 化神期 | Spirit Transformation |
| 30,000 | 大乘期 | Mahayana |
| 60,000 | 渡劫期 | Tribulation |

Merit 不会增加玩家境界，Quest 资助也不会增加 EXP。

### 贡献线：Merit / 藏经阁称号

这条线回答：“我为公共安全知识库贡献了多少经过审核的价值？”

| Merit 起点 | 藏经阁称号 |
|---:|---|
| 0 | 初入藏经阁 |
| 100 | 寻卷修士 |
| 500 | 异兽录士 |
| 1,500 | 镇卷真人 |
| 5,000 | 守阁尊者 |

只有人类 Reviewer 判定为 `Approved` 的贡献，才会生成真实 Merit ledger 记录。`Changes Requested` 只记录返修意见，暂不发放 Merit；`Rejected` 不发放 Merit。

Merit 与钱包绑定并持久化，是可审计的贡献声誉账本；它不是 Token、不可提现、不是 EXP，也不受 Quest 资助影响。

### 六种分数各自回答什么

| 系统 | 回答的问题 | 改变什么？ |
|---|---|---|
| EXP | 我学会了多少？ | Player Realm |
| Merit | 我贡献了多少？ | Contributor Title |
| Complexity / Quest Realm | 这个案例有多难学？ | Quest / Beast Realm |
| Severity | 这个漏洞有多危险？ | Risk label |
| Confidence | 证据有多可靠？ | Finding confidence |
| Element Scores | 属于哪些安全知识领域？ | Primary / Secondary Element |

## 玩家境界、Quest 境界与越级挑战

代码中有两个含义不同的 Realm：

- **Player Realm**：由已验证学习记录累计的 EXP 推导。
- **Quest / Beast Realm**：表示理解和完成安全案例所需的学习复杂度。

Quest Realm 不是财务风险、TVL 风险或漏洞 Severity，也不要求玩家已经处于相同境界。当前访问规则允许玩家挑战自己境界及以下的 Quest，也允许最多向上挑战两个境界；高出三阶及以上才显示境界不足。

因此，新注册的练气期（Qi Refining）修士可以挑战金丹期（Core Formation）的 Quest I。这是有意设计的“越二阶挑战”：

```text
挑战更高复杂度的安全问题 ≠ 提前获得更高境界
```

只有完成挑战并通过服务端证据验证后，学习者才会获得 EXP。

## Quest I：噬灵回环兽

当前完整可玩的教学 Quest 是 Classic Reentrancy 案例：

| 字段 | 当前实现 |
|---|---|
| Quest ID | `1` |
| 异兽 | 噬灵回环兽 |
| Formal Type | Classic Reentrancy |
| Quest Realm | 金丹期 / Core Formation |
| Primary Element | 水 / Water |
| 首次通关 EXP | 120 |
| 首次通关熟练度 | Water +1 |
| 徽记 | 水系守护者徽记 |

首次通关时，服务端验证危险代码定位、漏洞分类、攻击回放和 Checks → Effects → Interactions 修复顺序，然后写入钱包绑定的完成记录并一次性结算奖励。重复挑战仍可用于学习和复习，但不会重复发放首次通关奖励。数据库以 `(wallet, questId)` 唯一约束保证结算幂等，`completionHash` 对完成承诺进行不可变绑定。

## 五行：安全学习分类，而非漏洞标准

五行用于组织学习视角，不替代正式安全分类：

| 五行 | 学习领域 | 核心问题 |
|---|---|---|
| 金 · Metal | 权限、身份、控制 | 谁有资格执行敏感操作？ |
| 木 · Wood | 状态、存储、生命周期 | 状态是否沿正确生命周期变化？ |
| 水 · Water | 资金流、外部调用、回调 | 资产如何流动，外部交互能否重新进入系统？ |
| 火 · Fire | 数学、价格、经济机制 | 数值、价格与经济假设是否可靠？ |
| 土 · Earth | 账本、托管、核心业务逻辑 | 内部账本与外部真实状态是否一致？ |

所以 Classic Reentrancy 不会被改名为行业分类中的“Water vulnerability”。系统并列保存：

```text
Formal Type: Classic Reentrancy
Primary Element: Water
Secondary Element: Earth
```

### 当前确定性 Element 计分

规则引擎先匹配安全信号，再按权重累加 Element Scores；最高分成为 Primary Element，除主元素外达到 3 分的元素成为 Secondary Element，并同时生成逐项 rationale。

| 匹配信号 | Element | 分值 |
|---|---|---:|
| 原生资产外部流动 `external-native-value-call` | Water | +2 |
| `receive()` / `fallback()` 回调 `callback-entry` | Water | +3 |
| 回调重入目标函数 `callback-reentry` | Water | +3 |
| 托管资金流 `fund-flow` | Water | +1 |
| 内部余额记账 `accounting-state` | Earth | +2 |
| 外部调用后才更新状态 `state-update-after-external-call` | Earth | +3 |
| 访问控制模式 `access-control` | Metal | +2 |
| 生命周期状态模式 `state-lifecycle` | Wood | +2 |
| 价格、预言机或算术模式 `price-oracle-arithmetic` | Fire | +2 |

Quest I 的冻结证据得到 Water = 9、Earth = 5、Metal = 0、Wood = 0、Fire = 0，因此主元素为 Water，次元素为 Earth。这些权重只是当前确定性 Classic Reentrancy 分类规则，不是通用行业公式；当前实现也不宣称已覆盖所有漏洞家族。

## Quest / Beast 学习复杂度

Complexity Score 回答的是“理解和完成这个案例需要多少层安全推理？”，不是“这个漏洞会损失多少钱？”。当前规则包含以下因子：

| Factor | 当前匹配条件 | 分值 | 代表的学习能力 |
|---|---|---:|---|
| `singleFunction` | 命中提款语义与危险状态顺序 | +1 | 在单一函数内追踪 Checks / Effects / Interactions |
| `multipleFunctions` | 当前 Classic Reentrancy 规则暂不匹配 | +2 | 推理多函数状态机 |
| `crossContract` | 回调能够重入目标函数 | +2 | 跟踪跨合约控制流 |
| `callbackSemantics` | 攻击源码存在 `receive()` / `fallback()` | +2 | 理解回调执行语义 |
| `attackerContract` | 回调能够重入目标函数 | +2 | 理解攻击合约结构 |
| `proofOfConcept` | 冻结内置案例有已验证攻击测试 | +1 | 用 PoC 验证利用路径 |
| `invariantReasoning` | 冻结内置案例有已验证 Invariant | +1 | 用不变量检查账本一致性 |
| `protocolAccounting` | 当前规则暂不匹配 | +2 | 推理协议级记账依赖 |
| `multiTransaction` | 当前规则暂不匹配 | +2 | 推理多笔交易流程 |
| `crossProtocol` | 当前规则暂不匹配 | +3 | 推理跨协议依赖 |
| `crossChainOrMEV` | 当前规则暂不匹配 | +4 | 推理跨链或 MEV 依赖 |

未匹配的 Factor 记 0 分；上表“分值”是匹配时权重。总分映射为：

| Complexity Score | Quest / Beast Realm |
|---:|---|
| 0–2 | 练气期 / Qi Refining |
| 3–5 | 筑基期 / Foundation Establishment |
| 6–10 | 金丹期 / Core Formation |
| 11–14 | 元婴期 / Nascent Soul |
| 15–18 | 化神期 / Spirit Transformation |
| 19–22 | 大乘期 / Mahayana |
| 23 及以上 | 渡劫期 / Tribulation |

Quest I 命中 `singleFunction`、`crossContract`、`callbackSemantics`、`attackerContract`、`proofOfConcept` 与 `invariantReasoning`，总分 9，因此归入金丹期 / Core Formation。

## Severity：风险影响

Severity 与 Realm 分开计算。当前模型声明总分上限为 12：Impact 0–4、Exploitability 0–4、Repeatability 0–2、Privilege Exposure 0–2。

当前 Classic Reentrancy 评分器的实际规则是：

- Impact：同时存在资金流和记账失配为 4；仅有资金流为 2；否则为 1。
- Exploitability：回调、回调重入和记账失配同时存在为 4；仅有失配为 3；仅有回调为 2；否则为 1。
- Repeatability：存在回调重入为 2；仅有回调为 1；否则为 0。
- Privilege Exposure：命中访问控制信号为 1，否则为 0。数据结构预留到 2，但当前规则没有产生 2 分的分支。

| Severity Score | Label |
|---:|---|
| 0–2 | Informational |
| 3–4 | Low |
| 5–7 | Medium |
| 8–10 | High |
| 11–12 | Critical |

Quest I 当前为 4 + 4 + 2 + 0 = 10，即 High。Realm 衡量学习复杂度，Severity 衡量安全影响与可利用风险；高 Severity 不自动等于高 Realm，反之亦然。

## Confidence：证据支持强度

Confidence 表示现有证据对 finding 的支持程度，不表示财务 Severity、学习难度或 Reviewer 是否批准。

确定性分析按证据累加 0–100 分：漏洞源码顺序模式 +15、回调结构 +15、回调重入 +15、修复顺序对照 +15、攻击测试 +10、修复回归 +10、Invariant +5、Slither 对照 +5、冻结 commit 与 Content Hash +5、人工复核结论 +3、Moss 注册内容身份匹配 +2。

| Confidence Score | Label |
|---:|---|
| 0–49 | Low |
| 50–79 | Medium |
| 80–100 | High |

证据阶段按已达到的最高层级表达：`PATTERN_MATCHED` → `ATTACK_STRUCTURE_PRESENT` → `FIX_CONTRAST_PRESENT` → `POC_VERIFIED` → `FIX_VERIFIED` → `HUMAN_REVIEWED`。其中冻结测试、修复回归和最终人工复核只适用于内置冻结案例；`HUMAN_REVIEWED` 还要求 Moss 内容身份已验证。

可选 LLM 候选 finding 同样使用 0–100 与相同分段，但它只是建议置信度，不会覆盖确定性结论或替代人审。

## Guardian、Signed Draft 与人审权威

信任链路如下：

```text
确定性证据
→ Guardian 推荐
→ 可选语义增强（LLM candidate）
→ 与源码 Hash 绑定的 Signed Guardian Draft
→ Human Review
→ 正式异兽分类与《异兽志》发布
```

Guardian 负责分析、证据整理和修复建议；可选模型只能提出语义更丰富的候选内容。LLM 建议不会自动成为正式 finding，也不会自动发布。守阁人仍是发布、正式类型、五行、境界、Severity 与 Confidence 的最终权威。

### Merit 五维评分

Reviewer 对贡献采用当前已实现的五维百分制：

| 维度 | 分值 | 含义 |
|---|---:|---|
| Evidence Completeness | 0–25 | 是否提供足够、可核对的漏洞证据 |
| Reproducibility | 0–25 | 攻击路径是否可以清楚复现 |
| Fix Quality | 0–20 | 修复是否真正阻断相同根因 |
| Educational Value | 0–20 | 是否适合转化为公开安全学习材料 |
| Novelty | 0–10 | 是否补充知识库尚缺少的案例或变体 |
| **Total** | **0–100** | 服务端求和后的 Merit 候选值 |

只有 `Approved` 才会把总分写入唯一、幂等的真实 Merit ledger；返修和驳回不会产生 Merit。

## Monad 链上修炼凭证：镇兽灵契

完成秘境首次通关后，链安修仙录会形成一份可验证的学习完成记录：

```text
Quest 完成
→ 服务端验证
→ EXP / 属性 / 徽记结算
→ completionHash
→ Monad GuardianQuest 状态核验
→ 个人档案中的「镇兽灵契」
```

镇兽灵契把链下验证过的学习完成记录与 Monad Testnet 上公开的 GuardianQuest 状态连接起来。它是学习完成凭证，不是可转让的金融 NFT。GuardianQuest 使用 ERC-1155 风格的 Soulbound completion credential；Profile 读取哈希、合约状态与链上 `reportHash`，并解释 `LEGACY_CREDENTIAL`、`READY_FOR_ONCHAIN`、`VERIFIED` 等一致性状态。

EXP 与 Merit 本身不上链。它们继续由钱包绑定的服务端账本管理；链上哈希和合约状态负责提供公开核验，而不是取代完整学习与审核数据。

## Moss × Monad：从模拟到授权执行

这是 Agent Execution Layer 的真实演示流程：

```text
Discover → Load → Action → Simulate → Warnings / Receipt
→ User Authorization → Execute on Monad Testnet → Read-back Verify
```

Moss prepared and simulated the exact GuardianQuest action. The user explicitly authorized the reviewed transaction through an EIP-1193 wallet. After execution on Monad Testnet, the resulting contract state was independently read back and verified.

Moss 没有持有私钥，也没有不受限制的钱包控制权。AI 不能绕过授权花费资金，网站也没有不受限制的自动交易执行器。生产 UI 只是只读证据面板，不提供执行、签名或广播入口。

## Why Monad：Learn → Prove → Act

| 层级 | 当前实现 |
|---|---|
| Learn | Guardian 安全分析、漏洞挑战、攻击复现、修复理解、EXP 与五行成长 |
| Prove | GuardianQuest completion proof、`reportHash`、ERC-1155 Soulbound Credential、凭证一致性状态 |
| Act | Moss 准备并模拟精确交易，用户通过 EIP-1193 钱包明确授权，执行后独立回读 Monad 合约状态 |

Monad 在这里承担公共身份、完成证明、Soulbound 凭证和可回读协议状态的验证层，而不只是“把数据放上链”。

```text
更安全的 Builder
→ 更安全的应用
→ 更可信的 Agent
→ 更健康的 Monad 生态
```

## 链上与链下边界

### 链下

- Guardian 原始分析与完整证据
- 私有守阁人数据与审核过程
- 学习中间状态
- EXP、Merit 与五行熟练度
- 贡献案例全文和应用会话

### 链上

- Quest identity / registry
- completion proof 与 `reportHash`
- ERC-1155 Soulbound Credential
- 公共资助与可回读协议状态

链下负责隐私、快速迭代和高信息密度数据；链上负责公共可验证性、不可抵赖的完成证明与生态可组合性。

## Architecture

```text
Browser / Wallet
       │ EIP-1193 identity and explicit authorization
       ▼
Next.js App Router
  ├── Quest I immersive learning UI
  ├── Guardian deterministic + optional model analysis
  ├── Contributor / reviewer / cultivation APIs
  ├── Monad credential consistency derivation
  └── Moss × Monad public read-only execution evidence
       │
       ├── Neon Postgres + Drizzle
       │   private learning, contribution, review, EXP and Merit state
       │
       └── Monad Testnet RPC
           GuardianQuest registry, proof, reportHash,
           Soulbound credential and public funding state
```

安全合约、Foundry 测试、Invariant、Slither 结果、Quest 内容和审计报告均保存在同一仓库中，形成可复现证据链。

## 当前产品边界

### 已实现

- Quest I「噬灵回环兽」六幕沉浸式 Classic Reentrancy 教学挑战
- Guardian 确定性分析、可选候选语义增强与 Signed Guardian Draft
- 候选案例贡献、返修状态、守阁人人审、《异兽志》发布与 Merit ledger
- EXP、五行熟练度、修炼境界、徽记，以及修炼 / 贡献双栏 Profile
- Monad 链上修炼凭证及 Legacy / Ready / Verified 状态解释
- Moss × Monad 的真实模拟、用户授权、链上执行和回读证据；生产面板只读

### 成长框架 / 后续扩展

- 当前只有 Quest I 是完整可玩的教学 Quest；七阶修炼梯度与五行分类是可扩展框架，不代表七个境界都已有完整关卡。
- 当前确定性权威重点实现 Classic Reentrancy 规则，不声称已确定性覆盖所有漏洞家族。
- 更多漏洞 Quest、自动凭证封印、Quest 运维、社区资助和受模拟 / 授权边界约束的 Agent 工作流仍属后续方向。

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
| `GUARDIAN_LLM_MODE` | 默认关闭外部模型；精确设置为 `hybrid` 时启用候选补充 | 可选 |
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

合约与安全证据：[`src/GuardianQuest.sol`](src/GuardianQuest.sol)、[`test/GuardianQuest.t.sol`](test/GuardianQuest.t.sol)、[`reports/quest-1-audit-report.md`](reports/quest-1-audit-report.md)。

## On-chain Evidence

| 字段 | 值 |
|---|---|
| Network | Monad Testnet |
| Chain ID | `10143` |
| GuardianQuest | `0x131debd042208a327841128e5800dd4a833032ab` |
| Historical Quest I completion tx | `0x3b336c8f9d208e2492309f8db252a889ca9cfe6f61814321f4f48dd4ffdfc5e8` |
| Moss × Monad execution tx | `0x9858f3cc68f8324afda69be1d7d7dad4a49d9f5c052b53b8ae8bea7c598d2fad` |

Moss × Monad 状态回读：

```text
before:    0 wei
funded:    1000000000000 wei (0.000001 MON)
after:     1000000000000 wei
delta:     1000000000000 wei
read-back: EXACT MATCH
```

仓库未采用未经核验的区块浏览器 URL。

## Demo Flow

1. 从首页进入 Quest I，观察噬灵回环兽与重入资金流。
2. 完成漏洞识别、攻击回放、修复理解与确定性挑战，查看 EXP / 五行成长。
3. 使用 Monad Testnet 钱包签名登录 `/profile`，查看修炼档案与贡献档案。
4. 打开 Monad「镇兽灵契」，理解 Legacy / Ready / Verified 的链上—链下关系。
5. 查看 Moss × Monad「Agent 链上执行记录」，依次说明 Before → Funded → After、Verified Delta、交易回执与完整生命周期。
6. 进入贡献与守阁人审核流程，展示 Guardian、Signed Draft、人审与 Merit 闭环。

## Known Issues

- 当前只有 Quest I 完整实现。
- 外部模型可用性可能影响 hybrid 候选补充；确定性分析仍可独立工作。
- 早期历史 Quest I 凭证使用旧 `reportHash`，因此相对新的 `completionHash` 正确派生为 `LEGACY_CREDENTIAL`；这是历史凭证状态，不是错误。
- EXP 与 Merit 有意保持链下。
- Moss × Monad 生产面板只读，生产前端不暴露执行授权。

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
