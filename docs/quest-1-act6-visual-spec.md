# Quest 1 ACT6 Visual Specification

本文档锁定 Quest 1 第六幕「战利品与升级」的正式视觉基线：

- Dynamic Defeated Sequence v1
- Defeated State v1
- Bestiary Portrait v1

本轮视觉只表达 CEI 修复后的本地战败与收录结果，不改变 Quest reducer、持久化、奖励数值、HP 或 Monad Testnet 只读核验逻辑。

## 叙事目标

战败不是死亡或血腥受伤，而是重入入口被 CEI 顺序关闭后，噬灵回环兽失去继续抽取资金的能力：

1. CEI 封印完成。
2. 递归光纹逐层熄灭。
3. 回调水路断开。
4. 妖兽低头收势。
5. 方形状态玉扣保持三层锁定。
6. 水脉恢复低强度单向流动。
7. 最终进入可长期展示的受控静态战败态。

## 三个战败关键帧

| 关键帧 | 视觉状态 | 保持不变的识别结构 |
| --- | --- | --- |
| `defeated-frame-1` | 封印余波。接近 CEI sealed 状态，递归封印纹仍有少量冷青余光，逆流已经停止。 | 楔形头部、三片额甲、实体外环、方形状态玉扣、双叶闸片、右下断环 |
| `defeated-frame-2` | 收势。头部略微降低，眼睛减亮，口器趋向闭合，水脉恢复低强度稳定流。 | 玉扣中心、外环中心、右下断环与闸片轴线保持同一画布基准 |
| `defeated` | 最终战败态。妖兽低伏、安静、受控，冷青双眼保持微光，递归裂口收束为有序封印纹。 | 不闭眼死亡，不闭合断环，不删除玉扣或闸片 |

三张战败帧以及 ACT5 sealed 图均为 `1122 × 1402` 画布。网页使用同一绝对定位层、`object-fit: contain` 和 `object-position: center center`，不通过移动、缩放或旋转整张图制造动作。

## 时间轴

总时长为 `3000ms`：

| 时间 | 显示状态 |
| --- | --- |
| `0–400ms` | 保持 ACT5 sealed 静态帧，确认封印完成。 |
| `400–900ms` | sealed 与 `defeated-frame-1` 进行 500ms 互补淡入淡出。 |
| `900–1100ms` | `defeated-frame-1` 短暂停驻。 |
| `1100–1600ms` | `defeated-frame-1` 与 `defeated-frame-2` 进行 500ms 互补淡入淡出。 |
| `1600–1800ms` | `defeated-frame-2` 短暂停驻。 |
| `1800–2300ms` | `defeated-frame-2` 与 `defeated-v1` 进行 500ms 互补淡入淡出。 |
| `2300–3000ms` | 只显示 `defeated-v1`，建立静态稳定感。 |
| `3000ms` 后 | 组件只保留 `defeated-v1`，不再运行帧动画。 |

所有交叉淡入使用 `cubic-bezier(0.65, 0, 0.35, 1)`。相邻帧只在 500ms 过渡区间互补显示，避免长时间双头、双玉扣或全部透明的闪白帧。

## 防重播方式

`DynamicDefeatedSequence` 只负责视觉帧与播放结束状态：

- 仅在 `ACT6_REWARDING` 首次挂载、完整动态启用、且本次页面会话未播放过时进入播放。
- 使用模块级页面会话标记阻止 React 重渲染、奖励完成、链上查询刷新、异兽志打开或关闭导致重播。
- 从持久化的 `ACT6_COMPLETE` 直接恢复时，`shouldPlay=false`，立即显示最终静态帧。
- 根元素的单次 CSS 动画提供 `animationend` 完成信号。
- 另设 `3100ms` fallback timer；timer 有 cleanup，并通过完成锁避免重复结束。
- 不使用 `setInterval`，不向 reducer 或 localStorage 写入视觉帧状态。

## 动画舒适性

- 无容器级位移、缩放、旋转、抖动或持续漂浮。
- 无无限循环、呼吸动画和持续闪烁。
- 每段过渡完成后留出静态停驻。
- 动画结束后只渲染最终战败帧。
- 奖励、技术结论与 Monad 只读核验保持正常文档流，不被妖兽覆盖。

## Reduced Motion

当实际动效偏好为 Reduced Motion：

- 不启动三帧播放。
- 不运行 fallback timer。
- 不播放交叉淡入或局部光效。
- 直接显示 `reentry-devourer-defeated-v1.webp`。
- 奖励、异兽志和链上核验信息保持完整。

## Bestiary Portrait

`Bestiary Portrait v1` 是独立的 `1024 × 1024` 透明头像，不通过 CSS 裁切完整 defeated 图获得。

构图识别中心：

- 低扁楔形头部与三片额甲。
- 冷青狭长双眼。
- 方形状态玉扣。
- 部分断环与封印纹。

头像已按真实 `256 × 256`、`128 × 128`、`64 × 64` 尺寸生成审查图。`64 × 64` 仍可辨认楔形头部、额甲、眼睛与断环／玉扣特征。

## ACT6 页面映射

1. ACT5 完成时仍显示正式 sealed 状态和技术修复结果。
2. 用户进入 ACT6 后，`DynamicDefeatedSequence` 播放一次 3 秒收服演出。
3. 演出结束后保持静态 defeated，奖励卡片、修炼结论和链上核验成为阅读重点。
4. 异兽志弹窗使用正式 bestiary portrait。
5. 关闭弹窗后返回静态 defeated，不重播战败演出。

## 技术胜利与链上状态

以下状态必须继续分开表达：

- CEI 修复完成：本地教学与代码修复结论。
- EXP、水属性熟练度和本地徽记：本地学习结算。
- `completed`、`reportHash`、ERC-1155 balance：Monad Testnet 只读核验。

战败演出结束不代表链上 `completed=true`，也不代表链上勋章已铸造。

## 生产资产

| 标识 | 生产路径 | 尺寸 / 格式 | 大小 | SHA-256 | Alpha |
| --- | --- | --- | --- | --- | --- |
| `defeated-frame-1` | `web/public/assets/quest-1/beast/reentry-devourer-defeated-frame-1.webp` | 1122 × 1402，WebP RGBA | 404,456 bytes | `595DF70CC7A306D5E28C7220A5C0DDF784042AE80E2D74885B4600393E380EB5` | 0–255 |
| `defeated-frame-2` | `web/public/assets/quest-1/beast/reentry-devourer-defeated-frame-2.webp` | 1122 × 1402，WebP RGBA | 412,010 bytes | `3C49F201DE7E7F1948166D0731459BF2FC0797E9FF93A901D30433CB33F71C6B` | 0–255 |
| `defeated` | `web/public/assets/quest-1/beast/reentry-devourer-defeated-v1.webp` | 1122 × 1402，WebP RGBA | 376,884 bytes | `2225AE05CBF0DEB8DCEB2A197D75AFBF2EC1C596BB46FEA3D147105B5E609DDF` | 0–255 |
| `bestiary` | `web/public/assets/quest-1/beast/reentry-devourer-bestiary-portrait-v1.webp` | 1024 × 1024，WebP RGBA | 372,960 bytes | `ED1B0B180E8FE3BE2C4A3459B0BB2ED1E47968BBFBC5AAAA60E9BEC55CD40754` | 0–255 |

设计源：

- `design-sources/quest-1/reentry-devourer-defeated-frame-1.png`
- `design-sources/quest-1/reentry-devourer-defeated-frame-2.png`
- `design-sources/quest-1/reentry-devourer-defeated-v1.png`
- `design-sources/quest-1/reentry-devourer-bestiary-portrait-v1.png`

审查图位于 `design-sources/quest-1/act6-state-checks/`，不进入 `web/public`。