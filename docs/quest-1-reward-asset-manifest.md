# Quest 1 Reward Asset Manifest

## 范围

本清单记录 Quest 1 本地学习结算使用的奖励视觉资产。它不替代 [噬灵回环兽资产清单](quest-1-beast-asset-manifest.md)：徽记仅继承断环、玉扣和 CEI 回路的视觉语言，不是妖兽母体或其衍生状态。

## Water Guardian Badge v1

| 资源 | 路径 | 尺寸 / 格式 | 大小 | SHA-256 | Alpha | 用途 |
| --- | --- | --- | ---: | --- | --- | --- |
| 彩色设计源 | `design-sources/quest-1/water-guardian-badge-v1.png` | 1024 × 1024 PNG RGBA | 1,279,967 B | `245C0593F1B4CA4DA27093D637BFD9AB6B2E29718F5C1AFD98A181FCE2026919` | 有效（0–255） | 归档、后续生产导出 |
| 彩色生产资源 | `web/public/assets/quest-1/rewards/water-guardian-badge-v1.webp` | 1024 × 1024 WebP RGBA | 230,882 B | `9D698711B61384444ED22E82650A9DCF9444670CA81562FA6AC7014AD4D0C30D` | 有效（0–255） | `unlocked` 本地奖励徽记 |
| 单色设计源 | `design-sources/quest-1/water-guardian-badge-silhouette-v1.png` | 1024 × 1024 PNG RGBA | 651,582 B | `8CA1B70697A59072A145AB80682242650D9745377CF704280FB0C8A6CFC783C0` | 有效（0–255） | 归档、后续生产导出 |
| 单色生产资源 | `web/public/assets/quest-1/rewards/water-guardian-badge-silhouette-v1.webp` | 1024 × 1024 WebP RGBA | 168,646 B | `CE6237AEC6B7A158EABD0F77E6D188C70B10F63FBE00B6C219925B33021559F4` | 有效（0–255） | `locked` 未解锁剪影 |

两张生产 WebP 都低于 300KiB 目标，且保留透明背景；页面不使用未经压缩的大型 PNG。

## 结构与来源

Water Guardian Badge v1 从 Quest 1 已锁定的噬灵回环兽视觉语言提取以下不变量：

1. 外层断环与右下缺口；
2. 中央方形状态玉扣；
3. 左右双叶状态闸片；
4. 深海蓝湿润玉质与冷青水脉；
5. 垂直递归封印线；
6. 三层有序 CEI 嵌套方框。

该资产不反向定义或替代 `master-v1`、Dormant、Reentrancy Attack、CEI Sealed、Defeated 或 Bestiary Portrait。

## UI 映射

| 视觉状态 | 生产资源 | 当前 / 未来位置 | 业务边界 |
| --- | --- | --- | --- |
| `locked` | `water-guardian-badge-silhouette-v1.webp` | 预留给未解锁奖励槽位 | 由真实页面业务状态决定，显示“尚未获得”文字 |
| `unlocked` | `water-guardian-badge-v1.webp` | `RewardSequence` 的 ACT6 本地结算卡片 | 当前结算流程已开始时展示；不等于链上勋章 |

映射实现位于 `web/src/components/quest-1/quest-1-reward-visuals.ts`，展示组件为 `WaterGuardianBadge.tsx`。不使用图像存在与否来判定奖励资格。

## 设计审查图

| 文件 | 用途 |
| --- | --- |
| `design-sources/quest-1/badge-checks/badge-color-vs-silhouette.png` | 比较彩色与单色剪影的轮廓一致性 |
| `design-sources/quest-1/badge-checks/badge-structure-review.png` | 审查断环、玉扣、双叶闸片、CEI 层级与封印线 |
| `design-sources/quest-1/badge-checks/badge-size-review.png` | 256 / 128 / 64 / 32px 真尺寸可读性检查 |
| `design-sources/quest-1/badge-checks/reward-card-badge-preview.png` | 奖励卡中的桌面与窄屏摆放审查 |

审查图不属于生产页面资源，不放入 `web/public`。

## 版本与限制

- 版本：**Water Guardian Badge v1**。
- 展示语义：Quest 1 本地学习奖励；不等于 Monad Testnet `completed`、`reportHash` 或 ERC-1155 `badgeBalance`。
- 本清单没有包含私钥、助记词、RPC URL、API Key 或用户隐私地址。
