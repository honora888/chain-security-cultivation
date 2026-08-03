import test from "node:test";
import assert from "node:assert/strict";

import {
  ChainStatusClientError,
  getChainDataSourceLabel,
  getChainStatusFreshness,
  normalizeLearnerAddress,
  parseChainStatusResponse,
  QUEST_ONE_CHAIN_CLIENT_TIMEOUT_MS,
  QUEST_ONE_CHAIN_STALE_AFTER_MS,
  requestQuestOneChainStatus,
} from "../src/lib/quest-1-chain-panel.ts";

const learner = "0x0A31d11Fd14029c12Ef07c2c200085aE622c1541";
const contract = "0x131DEbd042208A327841128e5800dd4a833032ab";
const reportHash = `0x${"ab".repeat(32)}`;

function success(completed, overrides = {}) {
  return {
    ok: true,
    schemaVersion: "quest-1-chain-status-v1",
    dataSource: "monad-testnet-rpc",
    queriedAt: "2026-08-01T21:27:30.070Z",
    network: { name: "Monad Testnet", chainId: 10143 },
    contract: { address: contract },
    query: { address: learner, questId: 1 },
    status: {
      completed,
      reportHash: completed ? reportHash : `0x${"0".repeat(64)}`,
      badgeBalance: completed ? "1" : "0",
    },
    blockNumber: "50063287",
    ...overrides,
  };
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("trimmed valid address is queried without changing its case", async () => {
  let requestedUrl = "";
  const result = await requestQuestOneChainStatus(`  ${learner}\n`, {
    fetcher: async (url) => {
      requestedUrl = String(url);
      return jsonResponse(success(true));
    },
  });

  assert.equal(normalizeLearnerAddress(`  ${learner}\n`), learner);
  assert.match(requestedUrl, new RegExp(encodeURIComponent(learner), "i"));
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.query.address, learner);
});

test("invalid address is rejected before fetch", async () => {
  let calls = 0;
  await assert.rejects(
    requestQuestOneChainStatus("0x123", {
      fetcher: async () => {
        calls += 1;
        return jsonResponse(success(false));
      },
    }),
    (error) =>
      error instanceof ChainStatusClientError &&
      error.kind === "invalid-address",
  );
  assert.equal(calls, 0);
});

test("completed true and completed false remain successful chain results", () => {
  const completed = parseChainStatusResponse(success(true));
  const notCompleted = parseChainStatusResponse(success(false));

  assert.equal(completed.ok && completed.status.completed, true);
  assert.equal(notCompleted.ok && notCompleted.status.completed, false);
  assert.equal(notCompleted.ok && notCompleted.status.badgeBalance, "0");
});

test("API failure cannot be parsed as completed false", async () => {
  const result = await requestQuestOneChainStatus(learner, {
    fetcher: async () =>
      jsonResponse(
        {
          ok: false,
          error: { code: "RPC_UNAVAILABLE", message: "safe public message" },
        },
        502,
      ),
  });

  assert.equal(result.ok, false);
  assert.equal("status" in result, false);

  await assert.rejects(
    requestQuestOneChainStatus(learner, {
      fetcher: async () => {
        throw new Error("private upstream detail");
      },
    }),
    (error) =>
      error instanceof ChainStatusClientError && error.kind === "network",
  );
});

test("refresh and requery replace the complete response", async () => {
  let calls = 0;
  const fetcher = async () => {
    calls += 1;
    return jsonResponse(
      success(calls === 1, {
        blockNumber: calls === 1 ? "50063287" : "50063288",
      }),
    );
  };

  const first = await requestQuestOneChainStatus(learner, { fetcher });
  const refreshed = await requestQuestOneChainStatus(learner, { fetcher });

  assert.equal(calls, 2);
  assert.equal(first.ok && first.blockNumber, "50063287");
  assert.equal(refreshed.ok && refreshed.blockNumber, "50063288");
  assert.equal(refreshed.ok && refreshed.status.completed, false);
});

test("client timeout is distinct from caller abort", async () => {
  const pendingFetch = (_url, init) =>
    new Promise((_resolve, reject) => {
      init.signal.addEventListener(
        "abort",
        () => reject(new DOMException("aborted", "AbortError")),
        { once: true },
      );
    });

  await assert.rejects(
    requestQuestOneChainStatus(learner, {
      fetcher: pendingFetch,
      timeoutMs: 5,
    }),
    (error) =>
      error instanceof ChainStatusClientError && error.kind === "timeout",
  );

  const controller = new AbortController();
  const request = requestQuestOneChainStatus(learner, {
    fetcher: pendingFetch,
    signal: controller.signal,
    timeoutMs: 100,
  });
  controller.abort();
  await assert.rejects(
    request,
    (error) =>
      error instanceof ChainStatusClientError && error.kind === "aborted",
  );
  assert.equal(QUEST_ONE_CHAIN_CLIENT_TIMEOUT_MS, 12_000);
});

test("freshness becomes stale at the centralized five-minute threshold", () => {
  const queriedAt = "2026-08-01T21:27:30.000Z";
  const queriedAtMs = Date.parse(queriedAt);

  assert.equal(QUEST_ONE_CHAIN_STALE_AFTER_MS, 300_000);
  assert.deepEqual(
    getChainStatusFreshness(queriedAt, queriedAtMs + 299_999),
    {
      isStale: false,
      label: "刚刚查询",
      staleAt: queriedAtMs + 300_000,
    },
  );
  assert.equal(
    getChainStatusFreshness(queriedAt, queriedAtMs + 300_000).isStale,
    true,
  );
  assert.equal(getChainDataSourceLabel("monad-testnet-rpc"), "Monad Testnet RPC");
});

test("malformed success payload is rejected instead of becoming not-completed", () => {
  assert.throws(
    () => parseChainStatusResponse({ ok: true, status: { completed: false } }),
    (error) =>
      error instanceof ChainStatusClientError && error.kind === "response",
  );
});
