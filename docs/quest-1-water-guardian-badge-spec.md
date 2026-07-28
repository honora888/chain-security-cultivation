# Quest 1 Water Guardian Badge v1

## 目的与边界

“水系守护者”是 Quest 1 的本地学习奖励视觉。它将噬灵回环兽的断环、状态玉扣与递归回路转化为一枚修行认证徽记：学习者通过 Checks-Effects-Interactions（CEI）封闭回调入口，而非获得另一只妖兽头像。

该徽记不代表链上铸造、`completed=true`、ERC-1155 余额或任何 Monad Testnet 写入结果。链上登记和勋章余额仍只由 ACT6 的只读核验面板说明。

## 锁定视觉结构

- 深海蓝湿润玉质外层断环，右下保留缺口；
- 中央方形状态玉扣；
- 玉扣两侧的双叶状态闸片；
- 玉扣中的三层嵌套方框，依次表示 Checks、Effects、Interactions；
- 贯穿中心的垂直递归封印线；
- 冷青水脉与克制的水元素流线。

徽记不包含完整兽首、角色肖像、通用盾锁、水滴、区块链六边形、钱币或平台标记。

## 资产

| 角色 | 设计源 | 生产资源 | 状态 |
| --- | --- | --- | --- |
| 解锁彩色徽记 | `design-sources/quest-1/water-guardian-badge-v1.png` | `web/public/assets/quest-1/rewards/water-guardian-badge-v1.webp` | 本地奖励已解锁时显示 |
| 未解锁单色剪影 | `design-sources/quest-1/water-guardian-badge-silhouette-v1.png` | `web/public/assets/quest-1/rewards/water-guardian-badge-silhouette-v1.webp` | 未来未解锁奖励槽位显示 |

两张生产资源均为 1024 × 1024、RGBA WebP。完整尺寸、哈希、透明度和审查图见 [奖励资产清单](quest-1-reward-asset-manifest.md)。

## 奖励状态映射

`web/src/components/quest-1/quest-1-reward-visuals.ts` 将视觉资源显式映射为 `locked` 与 `unlocked`：

- `locked`：显示低饱和单色剪影。页面文字应写明“尚未获得”，不能仅靠颜色表达状态。
- `unlocked`：显示彩色徽记。当前 `RewardSequence` 仅在既有本地结算流程已开始时传入该视觉状态；图片本身不参与奖励资格判断。

ACT6 现有卡片文案继续写为“本地奖励展示 · 已解锁”，以避免将本地徽记混同于 Monad Testnet 勋章余额。

## 一次性解锁动效

正式基线为 **Water Guardian Badge v1**。彩色徽记只在本页面会话的首次本地奖励结算中播放一次；既有奖励卡在 `badgeDelay`（1820ms）后出现，随后开始下面的 1700ms 徽记视觉节奏：

| 相对徽记出现时间 | 表现 |
| --- | --- |
| 0–306ms | 单色剪影稳定可见，建立断环轮廓。 |
| 306–612ms | 剪影淡出、彩色徽记淡入；交叠只覆盖短暂过渡，不维持双重轮廓。 |
| 612–1054ms | 彩色徽记短暂获得冷青强调光，三层 CEI 方框作为正式图形的一部分清晰显现。 |
| 1054–1700ms | 光效收束为静态彩色徽记。 |
| 1700ms 后 | 完全静止，无循环、浮动、旋转、呼吸或闪烁。 |

组件在动画结束事件与清理过的备用 timer 之间做幂等收敛，避免重复完成。模块级页面会话标记防止 React 普通重渲染、链上只读刷新、打开或关闭异兽志、返回 ACT6、以及刷新恢复 ACT6 时重播。该标记仅控制视觉，不改变 Quest reducer、持久化 schema 或本地结算数据。

## Reduced Motion

当 `prefers-reduced-motion: reduce` 生效时，组件不创建动画 timer，不播放淡入、发光或交叠，直接显示静态彩色 `unlocked` 徽记；`locked` 则直接显示静态剪影。两种模式都保留同等状态文字与本地奖励语义。

## 可访问性与布局

- 徽记图的语义文本为“本地奖励展示：水系守护者徽记，不代表 Monad 链上凭证”。
- `locked` / `unlocked` 需要同步文字，不只依赖颜色、亮度或动效。
- 徽记使用 `next/image` 的固定 1024 × 1024 内在尺寸与 `object-fit: contain`，奖励卡在窄屏缩至 88px，不裁切断环缺口、玉扣或双叶闸片。
- 徽记根节点仅承接一次完成信号；子图层的 CSS 动画不会冒充完成事件。

## 审查资源

以下文件仅用于设计审查，均不进入 `web/public`：

- `design-sources/quest-1/badge-checks/badge-color-vs-silhouette.png`
- `design-sources/quest-1/badge-checks/badge-structure-review.png`
- `design-sources/quest-1/badge-checks/badge-size-review.png`
- `design-sources/quest-1/badge-checks/reward-card-badge-preview.png`

其中尺寸审查图保留 256px、128px、64px、32px 的原尺寸预览：64px 及以上可辨认断环、中心方扣与 CEI 层级；32px 仍保留断环缺口与中心方扣轮廓，但不承担阅读三层 CEI 细节的职责。因此生产 UI 的正式展示下限为 48px，当前奖励卡使用 88–92px。

## 当前限制

本版本只完成 Quest 1 本地奖励徽记；没有新增领取、铸造、钱包、签名、交易或 Monad API 能力。未来若在异兽志或关卡大厅展示 `locked` 徽记，应复用既有视觉映射并由实际业务状态提供 `state`。
