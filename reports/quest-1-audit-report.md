# Quest 1 审计报告：噬灵回环兽

## 一、报告信息

- 项目：链安修仙录
- Quest ID：1
- 妖兽名称：噬灵回环兽
- 境界：金丹期
- 五行属性：水
- 漏洞类型：经典重入漏洞
- 风险等级：High
- 学习勋章：水系守护者
- 测试网络：Monad Testnet
- GuardianQuest：0x131DEbd042208A327841128e5800dd4a833032ab

## 二、漏洞摘要

`VulnerableCharityVault.withdraw()` 在向外部地址转账后，才将用户余额清零。

攻击合约收到资金时会触发 `receive()`，并在余额尚未清零的情况下再次调用 `withdraw()`，从而重复提取资金。

## 三、漏洞代码

```solidity
(bool success, ) = msg.sender.call{value: amount}("");
require(success, "Transfer failed");

balances[msg.sender] = 0;
```

危险执行顺序：

```text
读取用户余额
→ 向用户转账
→ 用户回调进入 withdraw()
→ 再次读取尚未清零的余额
→ 重复提款
```

## 四、影响

攻击者只需存入少量初始资金，即可反复提款，直到公益金库中的原生代币被抽空。

可能造成：

- 金库资金损失；
- 用户账本与实际资产不一致；
- 公益资助无法正常兑付；
- 链下事件系统记录错误。

## 五、攻击验证

Foundry 测试：

```text
testVulnerableVaultCanBeDrained()
```

测试结果：

- 攻击者存入 1 ETH；
- 漏洞金库原有 10 ETH；
- 攻击完成后金库余额变为 0；
- 攻击合约最终持有 11 ETH；
- 重入次数大于 1。

结论：漏洞可以被真实触发。

## 六、修复方案

采用 Checks-Effects-Interactions 模式：

```solidity
uint256 amount = balances[msg.sender];

require(amount > 0, "No balance to withdraw");

// Effects：先修改内部状态
balances[msg.sender] = 0;

// Interactions：最后执行外部调用
(bool success, ) = msg.sender.call{value: amount}("");
require(success, "Transfer failed");
```

修复后的顺序：

```text
检查余额
→ 将余额清零
→ 最后向外部地址转账
```

## 七、修复验证

已完成以下真实测试：

1. `testFixedVaultBlocksReentrancy()`  
   修复版阻止攻击，攻击交易回滚。

2. `testFixedVaultAllowsNormalWithdrawal()`  
   普通用户仍然可以正常存款和提款。

3. `invariant_VaultBalanceAlwaysMatchesAccounting()`  
   执行 64 轮不变量测试，共生成 2,048 次随机调用，0 次异常回滚。

不变量要求：

```text
金库实际资产
=
所有用户账面余额之和
=
测试 Handler 独立记录的预期余额
```

## 八、静态分析

Slither 对漏洞版报告：

```text
Detector: reentrancy-eth
```

检测到：

- 外部调用发生在余额清零之前；
- `balances[msg.sender]` 在外部调用之后更新；
- 存在跨函数重入风险。

修复版没有被 `reentrancy-eth` 检测器报告为资金盗取型重入漏洞。

## 九、审计结论

漏洞版本不应部署或接收真实资金。

修复版本通过：

- 攻击场景测试；
- 正常功能测试；
- 不变量测试；
- Slither 静态分析对照。

本报告仅用于安全教学和 Monad Testnet 演示，不构成正式生产合约审计。

## 十、通关结算

- 通关状态：通过
- 修为奖励：120 EXP
- 五行熟练度：水属性 +1
- 解锁勋章：水系守护者
- 收录图鉴：《漏洞异兽志·噬灵回环兽》