"use client";

import {
  FormEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import type {
  ChainStatusErrorCode,
  ChainStatusResponse,
  ChainStatusSuccess,
} from "@/features/quest-1/chain-status-types";

import styles from "./quest-1.module.css";

const EVM_ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;

type PanelState =
  | "idle"
  | "loading"
  | "completed"
  | "not-completed"
  | "invalid-address"
  | "not-configured"
  | "rpc-error"
  | "chain-mismatch";

const PANEL_STATE_BY_ERROR: Partial<Record<
  ChainStatusErrorCode,
  Exclude<PanelState, "idle" | "loading" | "completed" | "not-completed">
>> = {
  INVALID_ADDRESS: "invalid-address",
  CHAIN_NOT_CONFIGURED: "not-configured",
  RPC_UNAVAILABLE: "rpc-error",
  CHAIN_ID_MISMATCH: "chain-mismatch",
  CONTRACT_CALL_FAILED: "rpc-error",
  INTERNAL_ERROR: "rpc-error",
  INVALID_QUERY: "rpc-error",
  RPC_TIMEOUT: "rpc-error",
  RPC_HTTP_ERROR: "rpc-error",
  RPC_CONTENT_TYPE_ERROR: "rpc-error",
  RPC_JSON_PARSE_ERROR: "rpc-error",
  RPC_PROTOCOL_ERROR: "rpc-error",
  RPC_REMOTE_ERROR: "rpc-error",
  CONTRACT_NOT_DEPLOYED: "rpc-error",
  MALFORMED_RESULT: "rpc-error",
  ABI_DECODE_ERROR: "rpc-error",
};

const FALLBACK_MESSAGES: Record<
  Exclude<PanelState, "completed" | "not-completed">,
  string
> = {
  idle: "输入地址后，可核验该地址在 GuardianQuest 中的 Quest 1 状态。",
  loading: "正在通过服务端读取 Monad Testnet……",
  "invalid-address":
    "请输入 0x 开头、包含 40 个十六进制字符的 EVM 地址。",
  "not-configured": "链上验证尚未配置，本地学习结果不受影响。",
  "rpc-error": "链上验证暂时不可用，请稍后手动重试。",
  "chain-mismatch":
    "RPC 返回的网络不是已核验的 Monad Testnet，查询已停止。",
};

export function ChainStatusPanel() {
  const inputId = useId();
  const [address, setAddress] = useState("");
  const [panelState, setPanelState] = useState<PanelState>("idle");
  const [message, setMessage] = useState(FALLBACK_MESSAGES.idle);
  const [result, setResult] = useState<ChainStatusSuccess | null>(
    null,
  );
  const activeRequest = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      activeRequest.current?.abort();
    },
    [],
  );

  function handleAddressChange(value: string) {
    activeRequest.current?.abort();
    activeRequest.current = null;
    setAddress(value);
    setPanelState("idle");
    setMessage(FALLBACK_MESSAGES.idle);
    setResult(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!EVM_ADDRESS_PATTERN.test(address)) {
      setPanelState("invalid-address");
      setMessage(FALLBACK_MESSAGES["invalid-address"]);
      setResult(null);
      return;
    }

    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setPanelState("loading");
    setMessage(FALLBACK_MESSAGES.loading);
    setResult(null);

    try {
      const response = await fetch(
        `/api/quest-1/chain-status?address=${encodeURIComponent(address)}`,
        {
          cache: "no-store",
          headers: { Accept: "application/json" },
          signal: controller.signal,
        },
      );
      const payload = (await response.json()) as ChainStatusResponse;

      if (controller.signal.aborted) {
        return;
      }

      if (!payload.ok) {
        const nextState = PANEL_STATE_BY_ERROR[payload.error.code] ?? "rpc-error";
        setPanelState(nextState);
        setMessage(payload.error.message || FALLBACK_MESSAGES[nextState]);
        setResult(null);
        return;
      }

      const nextState = payload.status.completed
        ? "completed"
        : "not-completed";
      setPanelState(nextState);
      setMessage(
        payload.status.completed
          ? "该地址已在 GuardianQuest 合约中登记 Quest 1 完成状态。"
          : "该地址尚未在 GuardianQuest 合约中登记 Quest 1 完成状态。",
      );
      setResult(payload);
    } catch {
      if (!controller.signal.aborted) {
        setPanelState("rpc-error");
        setMessage(FALLBACK_MESSAGES["rpc-error"]);
        setResult(null);
      }
    } finally {
      if (activeRequest.current === controller) {
        activeRequest.current = null;
      }
    }
  }

  const isLoading = panelState === "loading";
  const resultTitle =
    panelState === "completed"
      ? "链上已登记"
      : panelState === "not-completed"
        ? "链上尚未登记"
        : panelState === "loading"
          ? "正在查询"
          : panelState === "idle"
            ? "等待查询"
            : "查询未完成";

  return (
    <section
      className={styles.chainStatusPanel}
      aria-labelledby="chain-status-title"
    >
      <header className={styles.chainStatusHeader}>
        <div>
          <span>战后只读核验</span>
          <h3 id="chain-status-title">Monad Testnet 链上验证</h3>
        </div>
        <p>
          这是只读查询，不连接钱包、不请求签名、不发送交易。
        </p>
      </header>

      <form
        className={styles.chainStatusForm}
        onSubmit={handleSubmit}
        noValidate
      >
        <div className={styles.chainAddressField}>
          <label htmlFor={inputId}>查询地址</label>
          <input
            id={inputId}
            name="learner-address"
            type="text"
            inputMode="text"
            autoCapitalize="off"
            autoComplete="off"
            spellCheck={false}
            maxLength={42}
            value={address}
            onChange={(event) =>
              handleAddressChange(event.currentTarget.value)
            }
            placeholder="0x0000000000000000000000000000000000000000"
            aria-describedby={`${inputId}-hint ${inputId}-status`}
            aria-invalid={
              panelState === "invalid-address" ? "true" : undefined
            }
          />
          <small id={`${inputId}-hint`}>
            地址仅用于本次查询；页面不会保存查询历史。
          </small>
        </div>
        <button
          className={styles.chainQueryButton}
          type="submit"
          disabled={isLoading}
        >
          {isLoading ? "查询中……" : "查询链上状态"}
        </button>
      </form>

      <div
        id={`${inputId}-status`}
        className={styles.chainStatusResult}
        data-state={panelState}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <div className={styles.chainStatusMessage}>
          <strong>{resultTitle}</strong>
          <p>{message}</p>
        </div>

        {result ? (
          <dl className={styles.chainStatusFacts}>
            <div>
              <dt>查询地址</dt>
              <dd>{result.query.address}</dd>
            </div>
            <div>
              <dt>网络</dt>
              <dd>{result.network.name}</dd>
            </div>
            <div>
              <dt>Chain ID</dt>
              <dd>{result.network.chainId}</dd>
            </div>
            <div>
              <dt>Quest ID</dt>
              <dd>{result.query.questId}</dd>
            </div>
            <div>
              <dt>GuardianQuest 合约</dt>
              <dd>{result.contract.address}</dd>
            </div>
            <div>
              <dt>查询区块高度</dt>
              <dd>{result.blockNumber}</dd>
            </div>
            <div>
              <dt>completed</dt>
              <dd>{result.status.completed ? "true · 已登记" : "false · 尚未登记"}</dd>
            </div>
            <div>
              <dt>reportHash</dt>
              <dd>{result.status.reportHash}</dd>
            </div>
            <div>
              <dt>Quest 1 勋章余额</dt>
              <dd>{result.status.badgeBalance}</dd>
            </div>
          </dl>
        ) : null}
      </div>

      <p className={styles.chainStatusNote}>
        本地 Quest 已完成不等于该地址已在链上登记；查询结果不会改变
        Boss HP、EXP、水属性熟练度、徽记或异兽志。
      </p>
    </section>
  );
}
