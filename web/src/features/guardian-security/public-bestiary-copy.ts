export const CLASSIC_REENTRANCY_PUBLIC_COPY = {
  summary:
    "外部价值调用发生在内部记账状态完成之前，攻击者可利用回调重新进入函数并观察旧状态。",
  attackPattern: [
    "建立可领取的内部余额。",
    "调用提款或领取函数。",
    "在状态清零前触发外部价值转账。",
    "攻击合约在 receive/fallback 中重新进入目标函数。",
    "在旧余额仍可见时重复执行。",
  ],
  prerequisites: [
    "目标函数会向调用者控制的地址发送原生资产。",
    "外部价值调用发生在内部余额或领取状态更新之前。",
    "接收方能够在 receive 或 fallback 回调中重新进入目标函数。",
  ],
  impact:
    "重复提款可能导致合约实际余额与内部记账失配，并造成托管资产被耗尽。",
  mitigations: [
    "采用 Checks-Effects-Interactions。",
    "在外部调用前完成内部状态更新。",
    "为正常提款和恶意回调路径增加回归测试。",
    "Reentrancy Guard 只作为补充防护，不替代正确的状态更新顺序。",
  ],
} as const;

export const SAMPLE_PUBLIC_KNOWN_LIMITATIONS = [
  "用户提交的源码文本未经过编译或执行验证。",
  "当前分析未运行攻击 PoC、Foundry、Invariant 或 Slither。",
  "用户样例尚未注册为 Guardian Quest，当前没有可核验的链上 Quest 身份与 Content Hash。",
  "确定性规则只覆盖受支持的 Classic Reentrancy 文本模式，不等同于完整安全审计。",
] as const;

export const QUEST_ONE_PUBLIC_KNOWN_LIMITATIONS = [
  "结论适用于冻结证据中复现的 Classic Reentrancy 路径，不代表对所有潜在漏洞的完整审计。",
  "静态分析结果需要结合 Foundry 回归测试、Invariant 与人工复核共同解释。",
  "Monad Testnet 记录用于核验 Quest 身份与完成证据，不代表主网资产或真实慈善资金。",
] as const;
