# 链安修仙录

> 以东方修仙与妖兽战斗为叙事框架的智能合约安全学习项目。

《链安修仙录》将智能合约漏洞转化为可学习、可验证的“妖兽关卡”。学习者通过识别危险代码、复现攻击、理解修复方式、查看安全证据，并在 Monad Testnet 上核验学习凭证，完成从漏洞理解到链上存证的完整闭环。

## 当前进度

| 模块 | 状态 |
|---|---|
| Quest 1 漏洞合约与攻击演示 | 已完成 |
| Foundry 单元测试与 Invariant | 已完成 |
| Slither 漏洞/修复对照 | 已完成 |
| GuardianQuest 合约 | 已完成 |
| Monad Testnet 部署 | 已完成 |
| Quest 1 注册与报告存证 | 已完成 |
| ERC-1155 不可转让勋章 | 已铸造 |
| 前端视觉与开发规格 | 已完成 |
| Quest 1 Boss 战前端 | 开发准备阶段 |

当前版本聚焦 **Quest 1：噬灵回环兽**。前端只实现这一关，不虚构其他关卡。

## 学习闭环

```text
识别危险代码
→ 判断漏洞类型
→ 复现攻击过程
→ 学习安全修复
→ 验证修复结果
→ 固化审计证据
→ 核验链上完成状态
→ 获得不可转让勋章
```

## Quest 1：噬灵回环兽

| 字段 | 内容 |
|---|---|
| Quest ID | 1 |
| 境界 | 金丹期 |
| 五行 | 水 |
| 漏洞 | 经典重入漏洞 |
| 风险等级 | High |
| 修复原则 | Checks-Effects-Interactions |
| 勋章 | 水系守护者 |
| Token ID | 1 |

关键资料：

- [Quest 原文](quests/1-reentrancy.md)
- [Quest 元数据](metadata/1.json)
- [审计报告](reports/quest-1-audit-report.md)
- [Slither 验证记录](reports/slither-checklist.md)
- [前端开发规格](docs/quest-1-frontend-spec.md)

## 漏洞与修复

### 漏洞版本

`VulnerableCharityVault` 在更新余额前执行外部调用：

```solidity
(bool success,) = msg.sender.call{value: amount}("");
require(success, "Transfer failed");

balances[msg.sender] = 0;
```

接收方可在 `receive()` 中再次调用 `withdraw()`，重复读取尚未清零的余额。

### 修复版本

`FixedCharityVault` 使用 Checks-Effects-Interactions：

```solidity
balances[msg.sender] = 0;
emit Withdrawn(msg.sender, amount);

(bool success,) = msg.sender.call{value: amount}("");
require(success, "Transfer failed");
```

执行顺序变为：

```text
检查余额 → 更新内部状态 → 记录事件 → 执行外部交互
```

## 安全验证

### Foundry

已覆盖：

- 漏洞金库可被重入抽空；
- 修复版本阻止攻击；
- 正常提款不受影响；
- GuardianQuest 注册、验证、勋章、权限和资助流程。

攻击场景：

```text
金库原有：10 ETH
攻击者存入：1 ETH
攻击后金库：0 ETH
攻击合约最终：11 ETH
重入次数：大于 1
```

### Invariant

```text
Runs: 64
Depth: 32
Calls: 2,048
Unexpected reverts: 0
```

验证属性：

```text
FixedCharityVault 实际余额
=
所有用户账面余额之和
```

### Slither

使用 Slither `0.11.5`，启用：

- `reentrancy-eth`
- `reentrancy-events`

| 合约 | reentrancy-eth | reentrancy-events | 结果 |
|---|---:|---:|---:|
| VulnerableCharityVault | 检测到 | 检测到 | 2 |
| FixedCharityVault | 未检测到 | 未检测到 | 0 |

原始结果：

- [漏洞版本扫描](reports/slither-reentrancy.txt)
- [修复版本扫描](reports/slither-fixed.txt)

> Slither 对照只代表当前代码未触发所选检测器，不等同于完整安全审计。

## GuardianQuest

`GuardianQuest` 负责：

- 注册和启停 Quest；
- 保存 Quest 内容 Hash；
- 保存学习者审计报告 Hash；
- 管理验证者角色；
- 记录学习者完成状态；
- 铸造不可转让 ERC-1155 勋章；
- 支持测试公益资金资助与管理员提取。

前端第一版只进行只读查询，不请求钱包签名，也不发送链上交易。

## Monad Testnet

| 字段 | 内容 |
|---|---|
| Network | Monad Testnet |
| Chain ID | 10143 |
| GuardianQuest | `0x131DEbd042208A327841128e5800dd4a833032ab` |
| Demo Learner | `0x0A31d11Fd14029c12Ef07c2c200085aE622c1541` |

交易记录：

| 操作 | Transaction Hash |
|---|---|
| 部署 GuardianQuest | `0x577d17c114c2c22d9b1e467e67649cd82217d7a4ba19f41e4526ba66cc9602e2` |
| 注册 Quest 1 | `0x79596150497251cb506eb25eee28f9b9b5bb3e801da49ebf4dfd4416d283f648` |
| 验证通关并铸造勋章 | `0x3b336c8f9d208e2492309f8db252a889ca9cfe6f61814321f4f48dd4ffdfc5e8` |

详细记录：

- [Monad Testnet 部署](deployments/monad-testnet.md)
- [Quest 1 注册](deployments/quest-1.md)
- [Quest 1 通关](deployments/quest-1-completion.md)

## 可复现证据

### Quest Content Hash

```text
0x1935647cb838b5dd3caa4448702b2928cfc4532381fe7a9b1f84481029253f69
```

对应文件：

```text
quests/1-reentrancy.md
```

### Audit Report Hash

```text
0xef3b4f9d8637a0a9b30e5dcba100216506a7844eea31c9ea107c08c29d4f306c
```

对应文件：

```text
reports/quest-1-audit-report.md
```

`.gitattributes` 已固定证据文件的字节与换行规则，确保可从 Git 仓库复现链上 Hash。

## 前端方向

前端采用：

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- ESLint

视觉基线为：

```text
云海伏妖 · 水灵秘境
```

Quest 1 将实现六幕 Boss 战：

```text
妖兽现身
→ 寻出妖气
→ 识破妖法
→ 回环噬灵
→ 布阵封印
→ 战利品与升级
```

数据边界：

| 数据类型 | 内容 |
|---|---|
| 本地学习数据 | Boss HP、EXP、修为、水熟练度、动画、异兽志 |
| 仓库安全证据 | Foundry、Invariant、Slither、Quest、审计报告 |
| Monad 实时数据 | Quest 状态、completed、reportHash、勋章余额、URI |

本地通关不会被描述为链上通关。

## 项目结构

```text
chain-security-cultivation/
├─ src/
│  ├─ VulnerableCharityVault.sol
│  ├─ FixedCharityVault.sol
│  ├─ ReentrancyAttacker.sol
│  └─ GuardianQuest.sol
├─ test/
│  ├─ CharityVault.t.sol
│  ├─ GuardianQuest.t.sol
│  └─ invariant/
├─ script/
│  └─ DeployGuardianQuest.s.sol
├─ quests/
│  └─ 1-reentrancy.md
├─ metadata/
│  └─ 1.json
├─ reports/
├─ deployments/
├─ docs/
│  └─ quest-1-frontend-spec.md
└─ web/
```

## 本地运行

### 1. 克隆仓库

```bash
git clone --recurse-submodules https://github.com/honora888/chain-security-cultivation.git
cd chain-security-cultivation
```

### 2. 合约检查

```bash
forge fmt --check
forge build
forge test
```

### 3. Slither 对照

```bash
slither src/VulnerableCharityVault.sol \
  --detect reentrancy-eth,reentrancy-events

slither src/FixedCharityVault.sol \
  --detect reentrancy-eth,reentrancy-events
```

### 4. 前端

```bash
cd web
npm install
npm run dev
```

正式构建：

```bash
npm run lint
npm run build
```

## 安全声明

- 漏洞合约与攻击合约只用于本地教学和受控测试；
- 不应使用漏洞版本承载真实资产；
- 仓库不保存私钥、助记词或 Keystore 密码；
- 前端第一版只读 Monad Testnet，不请求钱包签名；
- 本项目尚未经过完整生产级安全审计。

## 下一步

1. 实现 Quest 1 入口与妖兽现身；
2. 实现危险代码定位和 Boss HP；
3. 实现重入资金流动画；
4. 实现 CEI 修复封印；
5. 实现 EXP、水属性熟练度和异兽志结算；
6. 接入 Monad Testnet 只读凭证查询；
7. 完成移动端、Reduced Motion 和可访问性验收。
