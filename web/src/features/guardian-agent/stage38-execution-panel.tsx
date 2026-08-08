import { STAGE38_EXECUTION_EVIDENCE as evidence } from "@/data/stage38-execution-evidence";

import styles from "./stage38-execution-panel.module.css";

function compactAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function Stage38ExecutionPanel() {
  return (
    <section className={styles.panel} aria-labelledby="stage38-execution-title">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Moss Agent Execution</p>
          <h2 id="stage38-execution-title">链上行录</h2>
          <p className={styles.subtitle}>Agent 链上执行记录</p>
        </div>
        <p className={styles.successMark}>REAL EXECUTION · SUCCESS</p>
      </header>

      <p className={styles.explanation}>
        Agent 先模拟，授权后执行，并通过 Monad 状态回读确认实际结果。
      </p>

      <div className={styles.evidenceGrid}>
        <div className={styles.primaryEvidence}>
          <p className={styles.sectionLabel}>链上状态变化</p>
          <div className={styles.stateFlow} aria-label="链上状态从零增加 0.000001 MON，最终为 0.000001 MON">
            <div className={styles.flowValue}>
              <span>Before</span>
              <strong>0 MON</strong>
            </div>
            <div className={styles.flowStep} aria-hidden="true">
              <span>↓</span>
              <b>+{evidence.fundedAmountMon} MON</b>
            </div>
            <div className={styles.flowValue}>
              <span>After</span>
              <strong>{evidence.fundedAmountMon} MON</strong>
            </div>
          </div>
          <p className={styles.verifiedDelta}>
            <span aria-hidden="true">✓</span>
            <span>Verified Delta</span>
            <strong>+{evidence.fundedAmountMon} MON · EXACT MATCH</strong>
          </p>
        </div>

        <dl className={styles.metadata}>
          <div>
            <dt>Action</dt>
            <dd><code>{evidence.action}</code></dd>
          </div>
          <div>
            <dt>Network</dt>
            <dd>{evidence.network} · {evidence.chainId}</dd>
          </div>
          <div>
            <dt>GuardianQuest</dt>
            <dd><code>{compactAddress(evidence.contractAddress)}</code></dd>
          </div>
        </dl>
      </div>

      <div className={styles.transactionEvidence}>
        <div className={styles.hashRow}>
          <span>Transaction</span>
          <code>{evidence.transactionHash}</code>
        </div>
        <dl className={styles.receiptGrid}>
          <div>
            <dt>Receipt</dt>
            <dd>{evidence.receiptStatus}</dd>
          </div>
          <div>
            <dt>Block</dt>
            <dd>{evidence.blockNumber}</dd>
          </div>
        </dl>
      </div>

      <ol className={styles.lifecycle} aria-label="Moss 执行生命周期">
        {evidence.lifecycle.map((step) => (
          <li key={step}>
            <span>{step}</span>
            <b aria-label="完成">✓</b>
          </li>
        ))}
      </ol>
    </section>
  );
}

