# Quest 1 ACT5 CEI Seal State v1

## 教学目标

ACT5 的视觉叙事不是击败或杀死妖兽，而是让学习者看见错误的递归入口被正确的 Checks-Effects-Interactions（CEI）顺序关闭：先检查余额与权限，再更新内部余额，最后才执行外部转账。攻击者即使在 `receive()` 中回调，旧余额也已经失效。

## 正式资产

| 项目 | 记录 |
| --- | --- |
| 版本 | CEI Seal State v1 |
| 设计源 | `design-sources/quest-1/reentry-devourer-cei-sealed-v1.png` |
| 生产资源 | `web/public/assets/quest-1/beast/reentry-devourer-cei-sealed-v1.webp` |
| 设计源尺寸 / 格式 | 1122 × 1402 px / PNG RGBA |
| 生产尺寸 / 格式 | 1122 × 1402 px / WebP RGBA |
| 生产文件大小 | 334,072 bytes（约 326.2 KiB） |
| 生产 SHA-256 | `F20B4137944A9923F6730BC0B749ADAFE179466A474E497F3F3CD229C34E8228` |
| Alpha | 有效；范围 0–255 |
| 衍生基线 | Canonical Clean Master v1 |

该图是 ACT5 的唯一正式封印态；不得用 dormant、master、ACT4 attack 或未来 defeated / bestiary 图代替。

## 与母版和攻击态的继承关系

保留低扁楔形头部、三片水晶额甲、内卷回流鳍冠、狭长冷青双眼、水压阀式口部、外层实体断环、内层水脉、右下断环缺口、方形状态玉扣、双叶状态闸片与深海蓝湿润玉甲。没有新增翅膀、四肢、触手、长颈、角或完整闭合圆环。

与 ACT4 的区别仅表达状态修复：垂直递归裂口从展开的回调通道收束为细小封印缝；玉扣内的嵌套方框从失控递归转为有序锁定；双叶闸片关闭其间的回调光路；水脉由双向逆流变为受约束的单向稳定流。妖兽仍保持警觉，不表达死亡、受伤或战败。

## ACT5 教学映射

| 阶段 | 代码与教学重点 | 封印视觉 |
| --- | --- | --- |
| Checks | 读取并验证 `balances[msg.sender]` | 玉扣外层先亮起；条件成立后才允许继续。 |
| Effects | `balances[msg.sender] = 0` 在外部调用前执行 | 玉扣第二层锁定，递归裂口开始收束。 |
| Interactions | 最后执行 `msg.sender.call{value: amount}("")` | 双叶闸片闭合，回调光路在入口处终止。 |
| Seal Complete | 状态已先更新，无法再次提取 | 显示静态 `reentry-devourer-cei-sealed-v1.webp` 与三项 CEI 结论。 |

代码展示仍使用仓库中的教学 Diff；本阶段没有修改 Solidity 合约或 Foundry 测试。

## 页面接入与动效

`SealFormationResult` 通过统一的 `QuestOneBeastVisualState` 资产映射读取 `sealed`。封印进行时，现有的 CEI 三印按顺序亮起，封印态在 720ms 后以一次 560ms 的低对比显现作为辅助背景；它不改变主流程的 `QUEST_ONE_SEAL_TIMING.sequence` 2400ms 完成信号。ACT5 完成后图片与结论均保持静止。

完整动态模式仅在正确提交后发生一次：根封印序列为 2400ms，三印 stagger 为 360ms，Diff 既有移动时长为 650ms，新增封印态显现为 560ms。没有浮动、呼吸缩放、循环水流、镜头旋转或持续闪烁。

## Reduced Motion

`prefers-reduced-motion` 启用时，不播放封印根序列、线路绘制、三印显现或封印态显现；页面直接显示对应静态信息和 sealed 图。CEI 文本、代码 Diff、结论与完成状态不因关闭动态而缺失。

## 审查图

以下图仅存在于设计源目录，不在网页中加载：

- `design-sources/quest-1/seal-state-checks/attack-vs-sealed-contact-sheet.png`
- `design-sources/quest-1/seal-state-checks/attack-vs-sealed-overlay.png`
- `design-sources/quest-1/seal-state-checks/sealed-state-structure-review.png`

它们分别检查攻击态与封印态的身份连续性、头部 / 玉扣 / 外环中心 / 右下缺口的对齐，以及封印态的锁定解剖结构。
