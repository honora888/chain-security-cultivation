# 链安修仙录

《链安修仙录》是一个以东方修仙、妖兽战斗和境界成长为叙事框架的智能合约安全学习项目。

学习者通过识别危险代码、复现攻击、理解漏洞机理、完成修复和查看安全验证证据，击败由智能合约漏洞化成的妖兽，并获得测试网上的不可转让学习勋章。

> 当前状态：Quest 1 的合约、安全测试、审计报告存证、Monad Testnet 注册与勋章铸造已经完成；前端视觉基线与开发规格已经确定，Boss 战网页正在进入实现阶段。

## 核心学习闭环

```text
识别危险代码
→ 判断漏洞类型
→ 复现攻击过程
→ 学习安全修复
→ 验证修复结果
→ 提交审计报告
→ 核验链上完成状态
→ 获得不可转让勋章
Quest 1：噬灵回环兽
字段	内容
Quest ID	1
妖兽	噬灵回环兽
境界	金丹期
五行属性	水
漏洞	经典重入漏洞
风险等级	High
修复方式	Checks-Effects-Interactions
勋章	水系守护者
Token ID	1

相关资料：

Quest 原文
Quest 元数据
Quest 审计报告
Slither 对照记录
前端开发规格
安全教学合约
VulnerableCharityVault

故意保留经典重入漏洞：

(bool success,) = msg.sender.call{value: amount}("");
require(success, "Transfer failed");

balances[msg.sender] = 0;

外部调用发生时，用户余额尚未清零。攻击合约可以在 receive() 回调中再次进入 withdraw()。

FixedCharityVault

使用 Checks-Effects-Interactions 修复：

balances[msg.sender] = 0;
emit Withdrawn(msg.sender, amount);

(bool success,) = msg.sender.call{value: amount}("");
require(success, "Transfer failed");

先更新内部状态，再执行外部交互。

GuardianQuest

GuardianQuest 提供：

Quest 注册与启停；
Quest 内容 Hash 存证；
审计报告 Hash 存证；
验证者角色管理；
学习者完成状态；
不可转让 ERC-1155 勋章；
测试公益资金资助与管理员提取。

当前版本只用于教学、测试网和项目演示。

Foundry 验证结果
重入攻击测试
testVulnerableVaultCanBeDrained
漏洞金库初始持有 10 ETH；
攻击者存入 1 ETH；
攻击后金库余额为 0；
攻击合约最终持有 11 ETH；
重入次数大于 1。
testFixedVaultBlocksReentrancy
修复版本阻止重入攻击。
testFixedVaultAllowsNormalWithdrawal
正常用户提款功能不受影响。
GuardianQuest 测试

覆盖：

Quest 注册；
报告 Hash 存证；
勋章铸造；
重复完成保护；
验证者权限；
勋章不可转让；
Quest 资助与提款；
Quest 停用状态。
Invariant
Runs: 64
Depth: 32
Total calls: 2,048
Unexpected reverts: 0

验证属性：

FixedCharityVault 实际余额
=
所有用户账面余额之和
Slither 对照结果

使用 Slither 0.11.5，启用：

reentrancy-eth
reentrancy-events
合约	reentrancy-eth	reentrancy-events	总结果数
VulnerableCharityVault	检测到	检测到	2
FixedCharityVault	未检测到	未检测到	0

原始扫描结果：

漏洞版本
修复版本

该结果只代表当前代码没有触发所选检测器，不等同于完整安全审计。

Monad Testnet 部署
字段	内容
Network	Monad Testnet
Chain ID	10143
GuardianQuest	0x131DEbd042208A327841128e5800dd4a833032ab
Admin / Demo Learner	0x0A31d11Fd14029c12Ef07c2c200085aE622c1541
部署交易
0x577d17c114c2c22d9b1e467e67649cd82217d7a4ba19f41e4526ba66cc9602e2
Quest 1 注册交易
0x79596150497251cb506eb25eee28f9b9b5bb3e801da49ebf4dfd4416d283f648
Quest 1 通关与勋章交易
0x3b336c8f9d208e2492309f8db252a889ca9cfe6f61814321f4f48dd4ffdfc5e8

详细记录：

Monad Testnet 部署
Quest 1 注册
Quest 1 通关
链上证据
Quest Content Hash
0x1935647cb838b5dd3caa4448702b2928cfc4532381fe7a9b1f84481029253f69

对应：

quests/1-reentrancy.md
Audit Report Hash
0xef3b4f9d8637a0a9b30e5dcba100216506a7844eea31c9ea107c08c29d4f306c

对应：

reports/quest-1-audit-report.md

.gitattributes 已保护上述证据文件的原始字节与换行规则，以便从 Git 仓库复现链上 Hash。

项目结构
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
本地运行合约测试
环境要求
Git
Foundry
Python 与 Slither（仅静态分析需要）

克隆仓库：

git clone --recurse-submodules https://github.com/honora888/chain-security-cultivation.git
cd chain-security-cultivation

格式、构建和测试：

forge fmt --check
forge build
forge test

运行指定重入检测器：

slither src/VulnerableCharityVault.sol \
  --detect reentrancy-eth,reentrancy-events

slither src/FixedCharityVault.sol \
  --detect reentrancy-eth,reentrancy-events
前端

前端位于：

web/

当前技术栈：

Next.js App Router
React
TypeScript
Tailwind CSS
ESLint

运行：

cd web
npm install
npm run dev

检查：

npm run lint
npm run build

当前前端状态：

Quest 1 视觉基线已确定；
六幕 Boss 战开发规格已完成；
Next.js 基础项目已创建；
正式 Boss 战 UI、动画和 Monad RPC 只读查询尚在实现阶段。
数据边界

项目严格区分三类数据：

本地学习数据
Boss HP；
EXP；
修为进度；
水属性熟练度；
战斗动画；
《漏洞异兽志》解锁。
仓库安全证据
Foundry 测试结果；
Invariant 结果；
Slither 输出；
Quest 原文；
审计报告；
部署与交易记录。
Monad Testnet 数据
Quest 注册状态；
completed；
reportHashes；
ERC-1155 勋章余额；
Token URI。

本地完成状态不会被描述成链上完成状态。

安全声明
漏洞合约与攻击合约仅用于本地教学和受控测试。
不应部署漏洞合约承载真实资金。
仓库不保存私钥、助记词或 Keystore 密码。
前端第一版只进行 Monad Testnet 只读查询，不请求钱包签名。
本项目尚未经过完整生产级安全审计。
当前路线
实现 Quest 1 入口与妖兽现身；
实现危险代码定位与 Boss HP；
实现攻击资金流回放；
实现 CEI 修复封印；
实现 EXP、熟练度和异兽志结算；
接入 Monad Testnet 只读凭证查询；
完成移动端、Reduced Motion 和可访问性验收。