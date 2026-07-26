# Quest 1：噬灵回环兽

## 基本信息

- Quest ID：1
- 妖兽名称：噬灵回环兽
- 修仙境界：金丹期
- 五行属性：水
- 漏洞类型：经典重入漏洞
- 风险等级：High
- 勋章：水系守护者
- 五行熟练度奖励：水属性 +1
- 基础修为：120 EXP
- 额外奖励：最高 30 EXP

## 通俗解释

噬灵回环兽会在金库转出资金、但账本还没有更新时，再次闯入提款函数。

就像柜台已经把钱交给取款人，却还没有在账本上写下“余额已清零”。取款人便可以趁这个间隙反复取款，直到金库被抽干。

## 漏洞代码

```solidity
(bool success, ) = msg.sender.call{value: amount}("");
require(success, "Transfer failed");

balances[msg.sender] = 0;
