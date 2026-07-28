# Quest 1 Motion Reference Specification

## Reference Video

| 项目 | 记录 |
| --- | --- |
| 文件 | `C:\\Users\\吴昕卓\\Desktop\\340fbfd15eee4c1cdc680885e4ee820a_raw.mp4` |
| 时长 | 10 秒 |
| 分辨率 | 960 × 720 px |
| 帧率 | 24 fps |
| 用途 | 仅作为「噬灵回环兽」的动作参考，不是正式生产资产 |

该参考视频不进入 `web/public`，不作为 Quest 页面媒体资源，也不作为角色解剖、断环方向或状态玉扣结构的依据。正式角色身份始终以 Canonical Clean Master、Reference Board 和 `docs/quest-1-beast-asset-manifest.md` 为准。

## Reusable Motion Beats

从参考视频的既定动作方向中，仅继承以下低动态语言：

1. 低伏头部先于身体进入警觉。
2. 冷青眼睛由暗至微亮。
3. 三片额甲与局部水脉短暂点亮。
4. 角色由收束潜伏进入轻微警觉，而非攻击姿态。
5. 外环水流出现一次短促回流。
6. 动作结束后回到稳定、未闭合的断环姿态。

## Rejected Motion

以下内容不进入网页动效，也不作为后续生产视频的动作基准：

- 长颈蛇形抬升、大幅盘旋或身体甩动。
- 右下断环缺口闭合、翻转或移动。
- 方形状态玉扣、双叶状态闸片消失或改变形状。
- 与母体不一致的龙、蛇或水兽轮廓。
- 大范围镜头推进、旋转、无限循环和持续浮动。
- 参考视频中的水印、深色不透明背景及任何生成瑕疵。

## Web Integration

### Beast Awakening Intro

#### Approved ACT1 Motion Baseline v2

| 项目 | 实施规格 |
| --- | --- |
| 播放位置 | Quest 1 首次进入 ACT1 的 Boss 舞台 |
| 初始帧 | `dormant-1` |
| 动作 | 眼睛与局部水脉短暂增强，随后 `dormant-1` crossfade 至 `dormant-2` |
| 总时长 | 3000 ms |
| 最终帧 | `dormant-2` 静态图 |
| 循环 | 不循环；结束后无浮动、缩放或持续帧切换 |
| ACT2 | 使用 `dormant-2` 静态图，不自动播放现身动效 |
| ACT3–ACT6 | 不使用现身动效 |

| 时间 | 可见状态 |
| --- | --- |
| 0–650 ms | 仅 D1，完全静止的潜伏状态 |
| 650–1300 ms | D1 仍为主帧；冷青眼睛与局部水脉渐亮 |
| 1000–2200 ms | D1→D2 的 1200 ms crossfade；使用快速穿越中点的缓动，避免长时间重影 |
| 1800–2500 ms | D2 成为主帧，冷青光效平缓收束 |
| 2500–3000 ms | 仅 D2 的稳定停驻，无新增运动 |
| 3000 ms 后 | 永久静态 D2 |

延长的 1500 ms 分配给 D1 潜伏、冷青苏醒和 D2 收束；不会把两帧的近 50% opacity 重叠等比例拉长。该动效使用 CSS 的一次性 `animation` 与 `animationend` 收尾，不使用 JavaScript Timer。组件级 session guard 会阻止普通 React 重渲染，以及页面流程内再次返回 ACT1 时重复播放；浏览器刷新后才允许作为一次新的正式进入重新播放。

### Reduced Motion

`prefers-reduced-motion` 或产品内「减少动态」模式下，ACT1 直接显示 `dormant-2` 静态图：不播放 3000 ms 现身动效、不播放眼部亮起、不进行 crossfade，也不创建任何计时器或持续动画。

## Future Video Preview

本轮不实现 `BeastMotionPreview`。未来若有无水印、透明或可控背景的正式视频，可在异兽志详情中以用户主动触发的预览组件接入：

- `muted`
- `playsInline`
- `controls`
- `loop={false}`
- `autoplay={false}`
- 使用 `reentry-devourer-master.webp` 作为 poster
- Reduced Motion 下仅显示 poster

正式视频在接入前必须逐帧核对 Locked Anatomy，尤其是低扁楔形头部、三片额甲、中央方形状态玉扣、双叶闸片与右下断环缺口。

## Review Boundary

本次本地环境只能安全读取视频文件的元数据；动作语言与拒绝项依据本任务提供的参考视频说明及现有角色基线整理。该限制不影响网页动效的实现边界：网页只使用已审核的 `dormant-1` 和 `dormant-2` 生产素材。
