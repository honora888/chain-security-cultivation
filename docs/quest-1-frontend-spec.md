“云海伏妖·水灵秘境”现已锁定为 Quest 1 唯一视觉基线。以下规格可直接交给 Codex 实现；本轮未修改任何仓库文件。

# Quest 1 前端开发规格 v1.0

## 0. 不可变约束

实现必须遵守：

- 不提供其他视觉方向，不回退到黑色科技仪表盘。
- 页面主背景固定为宣纸白、云海青灰、玉白。
- 深色只允许出现在代码卷轴、Diff 和短代码提示中。
- 妖兽、秘境、战斗动画和代码机关是视觉中心。
- 固定六幕：妖兽现身 → 寻出妖气 → 识破妖法 → 回环噬灵 → 布阵封印 → 战利品与升级。
- 每幕只显示一句对白、一个目标、一个主要操作和一句提示。
- HP、EXP、修为、水熟练度、图鉴收录均为本地学习数据。
- 链上凭证只在战后出现，所有合约交互只读。
- 不提供铸造、领取、提交交易或写链按钮。
- 本地“水系守护者”奖励演出与 Monad Testnet 链上铸造结果必须分开。
- Reduced Motion 与标准动画具有等价信息。
- 桌面端与移动端均以已确认的高保真稿为准。

## 1. 页面、路由与尺寸

### 页面结构

| 路由/视图 | 用途 |
|---|---|
| `/` | Quest 1 入口页 |
| `/quests/1` | 六幕 Boss 战主页面 |
| `/bestiary/1` | 《漏洞异兽志·噬灵回环兽》 |
| `ChainCredentialDrawer` | 战后链上凭证覆盖层，不单独路由 |

第一版不得生成其他 Quest 路由或空白关卡卡片。

### 响应式断点

| 模式 | 宽度 |
|---|---:|
| Wide Desktop | `≥1440px` |
| Desktop/Laptop | `1024–1439px` |
| Tablet | `768–1023px` |
| Mobile | `360–767px` |
| 最小支持宽度 | `360px` |

### 全局尺寸

| 组件 | Desktop | Tablet | Mobile |
|---|---:|---:|---:|
| 页面最大宽度 | 1536px | 100% | 100% |
| 页面水平留白 | 32–48px | 24px | 16px |
| Battle HUD | 72px | 64px | 76–88px，两行 |
| 中央战斗区 | `calc(100svh - 200px)`，最小 600px | 最小 540px | 约 36–44svh |
| 底部行动区 | 128px | 112px | 96px + safe-area |
| 主按钮 | 280×56px | 240×54px | 宽度 100%，高度 52px |
| 妖兽卷宗抽屉 | 440px | 420px | 全宽 Bottom Sheet，最大 92dvh |
| 链上凭证抽屉 | 480px | 440px | 全宽 Bottom Sheet，最大 94dvh |
| 最小点击区域 | 44×44px | 44×44px | 48×48px |

### Boss 战布局

桌面：

```text
72px Battle HUD
────────────────────────
中央战斗舞台
妖兽/代码/资金流/Diff 随阶段切换
────────────────────────
128px 对白、目标、主操作、提示
```

不得改成常驻三栏布局。妖兽卷宗通过覆盖式抽屉出现。

移动端：

```text
Boss HUD
当前场景或妖兽
当前阶段机关
一句对白/目标
固定底部主操作
```

### 关键组件尺寸

- Boss 主视觉：桌面最大宽度 760px、高度不超过战斗区 78%；移动端宽度 92vw。
- 代码卷轴：桌面 720–840×420–480px；移动端容器满宽、高度 300–360px，内部代码最小宽度 680px并允许横向滚动。
- Diff 卷轴：桌面最大 900×480px；移动端切换“修复前/修复后”，不压缩双栏。
- HP 条：桌面宽度 520–720px、高度 18px；移动端满宽减 32px、高度 12px。
- 资金流舞台：桌面最小 900×520px；移动端改为纵向六步路径。
- CEI 阵印：桌面直径 128px；移动端 84px，三枚同屏。
- 战利品卷轴：桌面最大 1120×440px；移动端满宽、纵向展开。

## 2. 六幕状态机

### 状态定义

```text
ENTRY

ACT1_APPEARING
ACT1_READY

ACT2_LOCATE
ACT2_WRONG
ACT2_PARTIAL
ACT2_HIT

ACT3_CLASSIFY
ACT3_INCORRECT
ACT3_FORMATION

ACT4_REPLAY
ACT4_PAUSED
ACT4_COMPLETE

ACT5_REPAIR
ACT5_INVALID_ORDER
ACT5_SEALING

ACT6_REWARDING
ACT6_COMPLETE

BESTIARY_OPEN
CHAIN_DRAWER_OPEN
```

### 切换条件

| 当前状态 | 事件/条件 | 下一状态 |
|---|---|---|
| `ENTRY` | 点击“踏入秘境” | `ACT1_APPEARING` |
| `ACT1_APPEARING` | 入场动画结束或跳过 | `ACT1_READY` |
| `ACT1_READY` | 点击“迎战” | `ACT2_LOCATE` |
| `ACT2_LOCATE` | 选中外部调用行 | `ACT2_HIT` |
| `ACT2_LOCATE` | 选中余额清零行 | `ACT2_PARTIAL` |
| `ACT2_LOCATE` | 选中其他行 | `ACT2_WRONG` |
| `ACT2_WRONG/PARTIAL` | 反馈结束 | `ACT2_LOCATE` |
| `ACT2_HIT` | 剑气与 HP 动画结束 | `ACT3_CLASSIFY` |
| `ACT3_CLASSIFY` | 三项全部正确 | `ACT3_FORMATION` |
| `ACT3_CLASSIFY` | 任意错误 | `ACT3_INCORRECT` |
| `ACT3_INCORRECT` | 用户修改答案 | `ACT3_CLASSIFY` |
| `ACT3_FORMATION` | 水阵生成、HP 到 50% | `ACT4_REPLAY` |
| `ACT4_REPLAY` | 播放完五段或逐段查看完毕 | `ACT4_COMPLETE` |
| `ACT4_COMPLETE` | 点击“看破回环” | `ACT5_REPAIR` |
| `ACT5_REPAIR` | 清零行位于外部调用之前 | `ACT5_SEALING` |
| `ACT5_REPAIR` | 顺序仍错误 | `ACT5_INVALID_ORDER` |
| `ACT5_SEALING` | CEI 与封印结束 | `ACT6_REWARDING` |
| `ACT6_REWARDING` | 奖励序列结束 | `ACT6_COMPLETE` |
| `ACT6_COMPLETE` | 点击“展开异兽志” | `BESTIARY_OPEN` |
| `ACT6_COMPLETE` | 点击“查看链上凭证” | `CHAIN_DRAWER_OPEN` |

### 状态恢复

- 仅持久化安全检查点：每幕开始、每幕完成、最终完成。
- 刷新发生在动画中时，从该幕稳定初始状态重新播放。
- 不持久化粒子、HP 插值、代码行中间坐标。
- 提供“重新演练本幕”和“重置 Quest 1”。
- 重置只清理本地学习状态，不触碰链上数据。

## 3. 动画触发与结束状态

| 动画 | 触发 | 时长 | 结束状态 |
|---|---|---:|---|
| 妖兽入场 | 进入 `ACT1_APPEARING` | 2400ms | 妖兽完整显示、HP=100 |
| 水属性阵法 | 三项判断正确 | 900ms | 水阵稳定、HP=50 |
| 代码行选中 | 确认正确代码行 | 180ms | 行抬升并锁定 |
| 代码剑气 | 选中动画结束 | 700ms | 剑气命中妖兽 |
| Boss 受击 | 剑气到达 | 650ms | HP=75 |
| 外部转账 | 回放步骤 2 | 900ms | 金库显示 11 ETH |
| receive 回环 | 回放步骤 4 | 1200ms | 回环水道闭合 |
| 未清零提示 | 回环闭合 | 600ms | 朱砂提示常驻 |
| Diff 行移动 | 正确拖动/点击重排 | 650ms | 清零行位于 `call` 前 |
| CEI 点亮 | 正确修复完成 | 1250ms | 三印全部激活 |
| 妖兽封印 | CEI 完成 | 1800ms | HP=0、封印图显示 |
| EXP 注入 | 进入 `ACT6_REWARDING` | 900ms | +120 EXP 完成 |
| 水灵珠点亮 | EXP 完成 | 700ms | 水熟练度=1 |
| 勋章翻转 | 灵珠完成 | 650ms | 本地奖励勋章正面显示 |
| 异兽志展开 | 点击“展开异兽志” | 1200ms | 已收录卷轴稳定显示 |

所有动画必须支持：

- 跳过当前动画。
- 页面失焦时暂停时间轴。
- 回到页面时从稳定检查点恢复。
- 不因连点重复触发。
- 动画结束后焦点移动到下一交互目标。

### Reduced Motion

当 `prefers-reduced-motion: reduce`：

- 妖兽入场直接显示终态。
- 禁用镜头推进、视差、震屏、粒子循环和 3D 翻转。
- 剑气改为“选中行 → 命中标记”两帧。
- 资金流改为可点击静态分镜。
- Diff 使用前后交叉淡化，≤150ms。
- CEI 三印同时显示已点亮。
- 勋章直接淡入。
- 所有状态、数值和解释保持完整。

## 4. 视觉资产清单

### 必须使用正式插画资产

| 建议资产名 | 用途 |
|---|---|
| `cloud-sea-desktop.webp` | 桌面云海与山崖背景 |
| `cloud-sea-mobile.webp` | 移动端重新构图背景 |
| `treasury-sanctum.webp` | 金库秘境 |
| `reentrant-beast-idle.webp` | 妖兽静止主形态 |
| `reentrant-beast-entry.webp` | 入场形态 |
| `reentrant-beast-hit.webp` | 受击形态 |
| `reentrant-beast-bound.webp` | 封印形态 |
| `reentrant-beast-bestiary.webp` | 异兽志水墨画像 |
| `guardian-badge.webp` | 水系守护者勋章 |
| `water-spirit-orb.webp` | 水灵珠 |
| `bestiary-scroll.webp` | 异兽志卷轴主体 |
| `guide-portrait.webp` | 可选无名“守阵人”头像 |

要求：

- 妖兽素材必须透明背景或具有可分层边缘。
- 不得用 CSS 图形、emoji 或简单圆形替代妖兽、勋章、卷轴。
- 桌面场景与移动端必须分别构图，不能直接裁掉 Boss 头部。
- 正式资产建议 WebP；需要透明边缘时使用 WebP/PNG。

### 可用 SVG 实现

- HP 条及刻度。
- 水阵圆环、CEI 功能阵线。
- 资金流路径与箭头。
- receive 回环路径。
- Diff 移动轨迹。
- 选中/正确/危险状态图标。
- 播放、暂停、重播、复制、外链图标。
- RPC 状态点。
- 朱砂“已收录”印的功能性轮廓；最终印章视觉可使用正式资产。

### 可用 CSS 实现

- 宣纸与玉白内容表面。
- 简单阴影、边框、遮罩和渐变。
- 按钮状态。
- HP 数值插值。
- 轻微视差与位移。
- 勋章单次翻转。
- 卷轴的 clip 展开效果。
- Reduced Motion 淡入。
- 代码行选中、拖拽占位和排序反馈。

不得使用 CSS 拼出妖兽、山崖、金库、灵珠或勋章。

### 已确认视觉参考

- [入口页](C:/Users/吴昕卓/.codex/generated_images/019f9f1d-035f-7c61-9617-bb9c8ffe5abe/call_B3OpTSJfyQDFPC9zcvBtJeFf.png)
- [妖兽现身](C:/Users/吴昕卓/.codex/generated_images/019f9f1d-035f-7c61-9617-bb9c8ffe5abe/call_MZLIWfbp1iIRdgOSGJNRn9j1.png)
- [危险代码定位](C:/Users/吴昕卓/.codex/generated_images/019f9f1d-035f-7c61-9617-bb9c8ffe5abe/call_lVkjzSNixhGEsKHnMYNgRlro.png)
- [攻击回放](C:/Users/吴昕卓/.codex/generated_images/019f9f1d-035f-7c61-9617-bb9c8ffe5abe/call_yhUGNhx97rb8p9qgCoey3V3F.png)
- [修复封印](C:/Users/吴昕卓/.codex/generated_images/019f9f1d-035f-7c61-9617-bb9c8ffe5abe/call_deGkgCYWdWRIVZLBvBSu3xy7.png)
- [通关升级](C:/Users/吴昕卓/.codex/generated_images/019f9f1d-035f-7c61-9617-bb9c8ffe5abe/call_ukVDSZF5L5TZd6pZcbz5yVKy.png)
- [链上凭证](C:/Users/吴昕卓/.codex/generated_images/019f9f1d-035f-7c61-9617-bb9c8ffe5abe/call_Wm8Wh6tWUwps4giDUM5dpoCI.png)
- [移动端](C:/Users/吴昕卓/.codex/generated_images/019f9f1d-035f-7c61-9617-bb9c8ffe5abe/call_8up9mWFGx78qgHHvqeqdNSvd.png)

生成式稿中的小字不作为数据来源；仓库内容与本规格优先。

## 5. 组件数据契约

| 组件 | 主要输入 | 输出事件 |
|---|---|---|
| `QuestEntryPage` | `questDefinition` | `enterQuest`, `openDossier` |
| `QuestBattleShell` | `battleState`, `motionMode` | `dispatchBattleEvent` |
| `BattleHud` | `bossMeta`, `hp`, `act` | 无 |
| `ReentrantBeast` | `pose`, `hp`, `motionMode` | `animationComplete` |
| `DialogueCommandBar` | `dialogue`, `target`, `hint`, `action` | `primaryAction` |
| `CodeLinePuzzle` | `codeLines`, `selectedLineId` | `selectLine`, `confirmLine` |
| `ClassificationPuzzle` | `options`, `answers` | `changeAnswer`, `submitAnswers` |
| `AttackReplay` | `steps`, `currentStep`, `playbackState` | `play`, `pause`, `next`, `previous`, `replay` |
| `RepairDiffPuzzle` | `sourceOrder`, `targetOrder` | `moveLine`, `submitOrder` |
| `CEIFormation` | `activeSeal`, `complete` | `animationComplete` |
| `VictorySequence` | `localRewards`, `sequenceStep` | `sequenceComplete`, `skip` |
| `BestiaryScroll` | `bestiaryEntry`, `unlocked` | `openReview`, `close` |
| `ChainVerificationSummary` | `chainQueryState` | `openChainDrawer` |
| `LearnerAddressSelector` | `mode`, `address` | `changeMode`, `changeAddress`, `query` |
| `ChainCredentialDrawer` | `repositoryEvidence`, `chainSnapshot` | `refresh`, `copy`, `openExplorer`, `close` |
| `ReducedMotionProvider` | 系统偏好、用户覆盖值 | `motionModeChanged` |

组件不得自行读取或合并不同数据源；数据源组合在页面控制层完成。

## 6. 数据结构

### Quest 定义：仓库内容

```ts
QuestDefinition {
  questId: 1
  name: "噬灵回环兽"
  realm: "金丹期"
  element: "水"
  vulnerability: "经典重入漏洞"
  risk: "High"
  baseExp: 120
  bonusExpMax: 30
  bonusExpEnabled: false
  masteryReward: 1
  badgeName: "水系守护者"
  badgeTokenId: 1
}
```

### 本地学习状态

```ts
LocalLearningState {
  version: 1
  questId: 1
  currentAct: 0 | 1 | 2 | 3 | 4 | 5 | 6
  checkpoint: string
  bossHp: 100 | 75 | 50 | 0
  selectedCodeLineId?: string
  classificationAnswers?: {
    vulnerability: string
    element: string
    risk: string
  }
  attackReplayCompleted: boolean
  repairCompleted: boolean
  expEarned: 0 | 120
  cultivationProgress: number
  waterMastery: 0 | 1
  bestiaryUnlocked: boolean
  localBadgeRevealCompleted: boolean
  completedAt?: string
}
```

不得将该对象写入链上或描述为链上数据。

### 仓库证据

```ts
RepositoryEvidence {
  network: "Monad Testnet"
  chainId: 10143
  guardianQuest: "0x131DEbd042208A327841128e5800dd4a833032ab"
  contentHash: "0x1935647cb838b5dd3caa4448702b2928cfc4532381fe7a9b1f84481029253f69"
  reportHash: "0xef3b4f9d8637a0a9b30e5dcba100216506a7844eea31c9ea107c08c29d4f306c"
  registrationTx: "0x79596150497251cb506eb25eee28f9b9b5bb3e801da49ebf4dfd4416d283f648"
  completionTx: "0x3b336c8f9d208e2492309f8db252a889ca9cfe6f61814321f4f48dd4ffdfc5e8"
  recordedLearner: "0x0A31d11Fd14029c12Ef07c2c200085aE622c1541"
  recordedBadgeBalance: 1
  recordedStatus: "Completed and Minted"
  metadataURI: string
}
```

### 链上实时快照

```ts
ChainSnapshot {
  source: "rpc"
  network: "Monad Testnet"
  chainId: 10143
  learnerAddress: string
  quest: {
    contentHash: string
    metadataURI: string
    active: boolean
    totalFunded: bigint
  }
  completed: boolean
  reportHash: string
  badgeBalance: bigint
  tokenId: 1
  uri: string
  syncedAt: string
}
```

### 查询状态

```ts
ChainQueryState {
  learnerMode: "demo" | "manual" | "wallet-future"
  address?: string
  status: "idle" | "loading" | "verified" | "not-completed" |
          "rpc-error" | "wrong-chain" | "invalid-address"
  snapshot?: ChainSnapshot
  errorMessage?: string
}
```

### 状态隔离规则

- 本地通关不能设置 `chainSnapshot.completed=true`。
- 本地勋章演出文案为“本地奖励展示：水系守护者”。
- 仅当 RPC 返回 `completed=true` 且 `balanceOf(address,1)=1` 时显示“链上核验：水系守护者已铸造”。
- RPC 失败时不得根据仓库记录伪造实时核验成功。
- 仓库证据始终显示来源与记录日期。
- 手动地址查询结果不得覆盖演示地址证据。

## 7. Quest 1 正式界面文案

### 入口

- 标题：`云海伏妖 · 水灵秘境`
- 副标题：`Quest 1 · 噬灵回环兽`
- 剧情：`守住金库灵脉，先看穿它的回环妖法。`
- 奖励：`120 EXP · 水属性熟练度 +1`
- 数据说明：`本地学习奖励`
- 主操作：`踏入秘境`
- 次操作：`查看妖兽卷宗`

### 第一幕：妖兽现身

- 对白：`回环妖兽已现，金库灵脉正被它吞噬。`
- 目标：`找出最先打开重入窗口的代码。`
- 主操作：`迎战`
- 提示：`Boss HP 为本地学习表现，不是链上数据。`

### 第二幕：寻出妖气

- 对白：`妖气藏在外部调用与账本更新之间。`
- 目标：`点击最先打开重入窗口的一行。`
- 主操作：`确认剑诀`
- 提示：`留意外部调用发生在余额清零之前。`
- 错误：`妖兽闪避。`
- 部分正确：`已找到关联行，再定位打开窗口的一行。`
- 正确：`重入窗口已锁定。`

### 第三幕：识破妖法

- 对白：`认清妖法，水阵才会回应。`
- 目标：`判断漏洞类型、五行属性和风险等级。`
- 主操作：`显化水阵`
- 提示：`三个判断全部正确后才能继续。`
- 错误：`阵纹未合，再核对三项判断。`

正式答案：

- `经典重入漏洞`
- `水`
- `High`

### 第四幕：回环噬灵

- 对白：`账本未清零，回调沿同一水道再次取款。`
- 目标：`看清 call、receive 与 withdraw 的回环。`
- 主操作：`看破回环`
- 提示：`Foundry 场景复现，不是 Monad 实时攻击。`
- 关键提示：`balances 尚未清零`
- 循环说明：`重入次数 > 1`

### 第五幕：布阵封印

- 对白：`先断账本回环，再放灵力出阵。`
- 目标：`将余额清零移到外部调用之前。`
- 主操作：`落阵封印`
- 提示：`Checks → Effects → Interactions。`
- 错误：`阵序未成：Effects 必须先于 Interactions。`
- 成功：`回环已断，封印成阵。`

### 第六幕：战利品与升级

- 对白：`回环已断，此兽当收入异兽志。`
- 目标：`完成本地学习结算并查看收录结果。`
- 主操作：`展开异兽志`
- 提示：`EXP 与水熟练度不会写入链上。`
- 结算标题：`本地学习结算`
- EXP：`+120 EXP`
- 熟练度：`水属性熟练度 0 → 1`
- 灵珠：`水灵珠已点亮`
- 本地勋章：`本地奖励展示：水系守护者`
- 额外奖励：`最高 30 EXP · 暂不结算`
- 图鉴：`漏洞异兽志 · 噬灵回环兽`
- 状态：`已收录`

### 链上简洁状态

成功：

- `Monad Testnet 已核验`
- `链上核验：水系守护者已铸造`

失败：

- `实时核验暂不可用`
- `可查看仓库已记录证据`

未完成：

- `未发现该地址的链上通关记录`

状态不一致：

- `通关记录存在，勋章余额尚未确认`

### 地址选择器

- `演示地址`
- `手动输入`
- `连接钱包（未来）`
- 输入提示：`输入学习者 EVM 地址`
- 校验错误：`请输入有效的 EVM 地址`
- 查询操作：`核验此地址`

## 8. MVP 验收标准

### 功能

- 仅存在 Quest 1。
- 六幕顺序不可跳乱。
- 危险代码行答案与外部调用一致。
- 余额清零行被视为部分正确，不直接判完全正确。
- 三项判断必须全部正确。
- 资金流严格使用 10 ETH、存入 1 ETH、11 ETH、0 ETH、攻击合约 11 ETH。
- 不展示虚构重入次数。
- 修复结果必须把清零行放在 `call` 前。
- 本地结算只发放 120 EXP 和水属性 +1。
- 30 EXP 不实际发放。
- 链上抽屉只读，不产生钱包签名或交易请求。
- 演示地址、手动地址、未来钱包三种状态完整。
- RPC 与仓库证据来源可明确识别。
- 显示最近同步时间。

### 视觉

- 除代码与 Diff 外，不得出现大面积深色区域。
- 任一战斗幕中，妖兽或当前机关必须占据主要视觉面积。
- 不出现后台三栏布局。
- 主流程不出现表格或连续长文。
- 暖金仅用于通关、升级和勋章。
- 不出现商城、抽卡、充值、战力榜或其他 Quest。

### 动画

- 14 段规定动画均有明确开始与终态。
- 连续点击不会重复结算或重复切幕。
- 动画可跳过。
- Reduced Motion 下可完整通关。
- 静态分镜提供与标准动画相同的信息。

### 可访问性

- 正文、按钮、状态文本达到 WCAG AA 对比度。
- 不能只靠颜色表达正确、错误、High 或 RPC 状态。
- 所有操作支持键盘。
- 代码行可通过键盘选择。
- 动画结果通过 `aria-live` 简短播报。
- 主按钮最小 44×44px，移动端 48×48px。
- 抽屉打开后焦点锁定，关闭后返回触发按钮。
- 资金流每一步具有文字替代说明。
- 屏幕阅读器不得朗读纯装饰云纹和粒子。

### 性能

- 入口首屏图片预算不超过 1.2MB。
- 非当前幕插画延迟加载。
- 单幕新增视觉资源建议不超过 900KB。
- 动画只使用 `transform`、`opacity`、SVG stroke 或 canvas；避免持续触发布局。
- 移动端默认降低粒子数量至少 60%。
- 弱网下优先显示静态终态图，不阻塞主操作。

### 数据安全

- 不请求或保存私钥。
- 不请求交易签名。
- 不把手动输入地址写入远端存储。
- 合约读取固定在 Monad Testnet Chain ID `10143`。
- 地址、哈希和 URI必须支持复制，但不得自动导航。
- 所有外链使用明确的“打开外部页面”提示。

下一步可直接将本规格交给 Codex，先完成资产盘点、技术方案和任务拆分，再进入代码实现。