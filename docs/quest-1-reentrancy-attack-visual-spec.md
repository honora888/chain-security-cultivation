# Quest 1 ACT4 Reentrancy Attack Replay v1

## Reentrancy Attack State v1

ACT4 的正式攻击态版本为 **Reentrancy Attack State v1**。它是 Canonical Clean Master 的衍生状态，不是 dormant、master 或另一只妖兽的重命名版本。

| 项目 | 记录 |
| --- | --- |
| 设计源文件 | `design-sources/quest-1/reentry-devourer-reentrancy-attack-v1.png` |
| 生产文件 | `web/public/assets/quest-1/beast/reentry-devourer-reentrancy-attack-v1.webp` |
| 像素尺寸 | 1122 × 1402 px |
| 格式 | PNG RGBA（设计源）／WebP RGBA（生产） |
| Alpha | 有效；范围 0–255 |
| 设计源 SHA-256 | `7BC4177A826961AA5E22C2E0C667AF523A71941DEB5F6EA669842F60FDC099BF` |
| 生产文件大小 | 322,814 bytes（约 315.2 KiB） |
| 生产 SHA-256 | `F3C1E073093BC7F5E2120886474A93F80440201A09BB17E6A864D68329AC113D` |
| 衍生母版 | Canonical Clean Master v1 |

### 与 Master 的继承关系

- 保留低扁楔形头部、三片额甲、内卷双层鳍冠、冷青狭长眼、层叠水压瓣膜口部、垂直递归裂口、实体外环、半透明水脉内环、右下断环缺口、方形状态玉扣和双叶状态闸片。
- 保留深海蓝湿润玉甲与冷青水脉材质，不增加翼、足、触手、长颈、额外角或闭合圆环。
- 攻击变化仅限于：眼睛与裂口亮度增强、裂口出现多层嵌套回路、玉扣出现嵌套方框、闸片之间出现短回调光路，以及内环的逆流语义。

### ACT4 五步映射

| 回放步骤 | 攻击态映射 |
| --- | --- |
| 布下诱饵 | 不强制显示攻击图，保持调用与余额证据为焦点。 |
| 首次提款 | 不强制显示攻击图，保持余额检查与“尚未清零”为焦点。 |
| 外部转账 | 攻击态以一次 420ms 淡入出现；外部资金路径仍是主证据。 |
| 回环重入 | 静态攻击态完整显示；裂口位置使用一次 420ms 脉冲，随后停驻。 |
| 金库枯竭 | 攻击态低强度静止显示；视觉焦点转向损失结果与根因。 |

攻击图只作为 `AttackReplay` 阵图中的装饰图层，`aria-hidden` 且空 alt；资金流、余额、调用栈和代码顺序仍提供完整文本与语义信息。

## 教学目标

ACT4 是一段 **Simulation / Educational Replay**：它使用 Quest 1 的 Foundry 教学复现场景解释重入，不读取实时攻击、不调用真实合约，也不代表 Monad Testnet 上正在发生的交易。

用户应无需阅读长篇报告即可看懂：攻击合约先建立余额，`withdraw()` 在清零前执行外部 `call`，`receive()` 再次进入 `withdraw()`，重复提款直至金库枯竭。

## 五步回放

1. **布下诱饵**：攻击合约 `attack() → donate()` 存入 1 ETH；金库从 10 ETH 变为 11 ETH，攻击者账面余额为 1 ETH。
2. **首次提款**：`withdraw()` 读取到 1 ETH，检查通过；状态尚未更新。
3. **外部转账**：`msg.sender.call{value: amount}("")` 先向攻击合约发送 1 ETH，`receive()` 被触发，账面余额仍为 1 ETH。
4. **回环重入**：`receive() → withdraw()` 沿回调路径再次进入；回放最多以四层调用栈表达递归，不生成无限 DOM。
5. **金库枯竭**：金库为 0 ETH、攻击合约为 11 ETH；调用栈回退后才执行 `balances[msg.sender] = 0`。

## 阵图与代码证据

- 左侧阵图使用三条可区分路径：青色普通调用、青色资金外流、朱砂虚线回调。
- 节点持续显示 Vault、Attacker、当前余额、执行方和调用深度。
- 右侧固定显示三行漏洞顺序证据：检查余额 → 外部转账 → 最后清零。外部转账行始终带朱砂风险边界，当前执行行额外高亮。
- 最后一步显示教学结果：金库损失 11 ETH、攻击合约获得 11 ETH、重入次数大于 1。

## 动画舒适性

- 用户使用“上一步 / 下一步 / 重新播放”逐步控制；既有“播放 / 暂停”仅在用户主动点击后运行一次，每步停留 900ms，并在最后一步自动停止。
- 单步路径和数值强调使用既有 450–1200ms 集中时间常量；完成后画面保持稳定。
- 不使用页面震动、镜头旋转、持续水流、背景浮动或无限循环。
- 递归阶段仅使用一次性的朱砂虚线、REENTER 标记和有限调用栈层级。
- 攻击态自身不漂浮、呼吸缩放或循环。仅在用户切换到 `transfer` 或 `loop` 时使用 420ms 的一次性淡入／裂口脉冲；`drained` 保持静止。

## Reduced Motion

Reduced Motion 下不播放资金粒子、路径移动或自动播放。用户仍可用原生按钮查看全部五步；节点、余额、调用栈和漏洞顺序直接切换到该步稳定状态。

攻击态在 `transfer`、`loop` 与 `drained` 中仍可作为静态图出现，但不淡入、不脉冲，信息层级与完整动态一致。

## 视觉接口

`QuestOneBeastVisualState` 为后续状态预留 `dormant`、`awakened`、`reentrancy-attack`、`sealed`、`defeated` 与 `bestiary`；本轮只有 `reentrancy-attack` 绑定正式图片。其余状态不会用错误素材填充。

攻击资产仅替换 ACT4 阵图中的视觉中心，不改变五步数据、用户控制、调用栈、代码证据或 Reduced Motion 信息等价性。
