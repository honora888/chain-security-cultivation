import assert from "node:assert/strict";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const baseUrl = (process.env.REVIEW_API_BASE_URL ?? "http://localhost:3000").replace(/\/$/u, "");
const origin = new URL(baseUrl).origin;
const reviewerPrivateKey = process.env.REVIEWER_SMOKE_PRIVATE_KEY;
if (!reviewerPrivateKey) {
  console.error("REVIEWER_SMOKE_PRIVATE_KEY is required");
  process.exitCode = 1;
} else {
  let reviewer;
  try {
    reviewer = privateKeyToAccount(reviewerPrivateKey);
  } catch {
    console.error("Review workflow API smoke checks failed. stage=reviewer-key status=none code=none");
    console.error("reason=invalid reviewer key format");
    process.exitCode = 1;
  }
  if (reviewer) {
  const contributor = privateKeyToAccount(generatePrivateKey());
const suffix = contributor.address.slice(2, 18).toLowerCase();
const runMarker = `// review-smoke-run:${suffix}`;

const vulnerableSource = `${runMarker}
contract ReviewSmokeVault {
  mapping(address => uint256) internal credits;

  function payout() external {
    uint256 amount = credits[msg.sender];
    (bool ok,) = msg.sender.call{value: amount}("");
    require(ok);
    credits[msg.sender] = 0;
  }
}`;

const attackSource = `${runMarker}
contract ReviewSmokeAttacker {
  ReviewSmokeVault target;

  receive() external payable {
    target.payout();
  }
}`;

const fixedSource = `${runMarker}
contract ReviewSmokeVaultFixed {
  mapping(address => uint256) internal credits;

  function payout() external {
    uint256 amount = credits[msg.sender];
    credits[msg.sender] = 0;
    (bool ok,) = msg.sender.call{value: amount}("");
    require(ok);
  }
}`;
  let stage = "startup";
  let lastStatus = null;
  let lastCode = null;

  function assertNoStore(response) {
    assert.equal(response.headers.get("cache-control"), "no-store");
  }

  async function readJson(response) {
    lastStatus = response.status;
    const body = await response.json();
    lastCode = typeof body?.error?.code === "string" ? body.error.code : null;
    return body;
  }

  async function request(path, init = {}) {
    return fetch(new URL(path, `${baseUrl}/`), {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers ?? {}),
      },
      signal: AbortSignal.timeout(15_000),
    });
  }

  async function login(account) {
    const nonceResponse = await request("/api/auth/nonce", {
      method: "POST",
      headers: { Origin: origin },
      body: JSON.stringify({ walletAddress: account.address }),
    });
    const nonce = await readJson(nonceResponse);
    assert.equal(nonceResponse.status, 200);
    assertNoStore(nonceResponse);
    const signature = await account.signMessage({ message: nonce.message });
    const verifyResponse = await request("/api/auth/verify", {
      method: "POST",
      headers: { Origin: origin },
      body: JSON.stringify({
        walletAddress: account.address,
        nonceId: nonce.nonceId,
        nonce: nonce.nonce,
        signature,
      }),
    });
    const verified = await readJson(verifyResponse);
    assert.equal(verifyResponse.status, 200);
    assertNoStore(verifyResponse);
    assert.equal(verified.authenticated, true);
    const setCookie = verifyResponse.headers.get("set-cookie");
    assert.ok(setCookie);
    return setCookie.split(";", 1)[0];
  }

  async function run() {
    stage = "contributor login";
    const contributorCookie = await login(contributor);
    stage = "contribution creation";
    const contributionResponse = await request("/api/contributions/cases", {
      method: "POST",
      headers: { Cookie: contributorCookie },
      body: JSON.stringify({
        caseName: `REVIEW SMOKE · ${suffix}`,
        proposedBestiaryName: `审查回环${suffix}`,
        vulnerableSource,
        attackSource,
        fixedSource,
      }),
    });
    const contribution = await readJson(contributionResponse);
    assert.equal(contributionResponse.status, 201);
    assertNoStore(contributionResponse);
    const caseId = contribution.case.caseId;

    stage = "reviewer login";
    const reviewerCookie = await login(reviewer);
    stage = "review queue";
    const queueResponse = await request("/api/reviews/cases", { headers: { Cookie: reviewerCookie } });
    const queue = await readJson(queueResponse);
    assert.equal(queueResponse.status, 200);
    assertNoStore(queueResponse);
    assert.ok(queue.cases.some((entry) => entry.caseId === caseId));

    stage = "review detail";
    const detailResponse = await request(`/api/reviews/cases/${caseId}`, { headers: { Cookie: reviewerCookie } });
    const detail = await readJson(detailResponse);
    assert.equal(detailResponse.status, 200);
    assertNoStore(detailResponse);
    assert.equal(detail.case.vulnerableSource, vulnerableSource);
    assert.equal(detail.case.analysisJson.schemaVersion, "guardian-security-analysis-v1");

    stage = "approval";
    const decisionResponse = await request(`/api/reviews/cases/${caseId}/decision`, {
      method: "POST",
      headers: { Cookie: reviewerCookie, Origin: origin },
      body: JSON.stringify({
        decision: "approved",
        evidenceQuality: 23,
        reproducibility: 22,
        technicalAccuracy: 18,
        remediationQuality: 17,
        contributionValue: 9,
        reviewSummary: "Deterministic review smoke approval.",
        reviewNotes: "Synthetic smoke case; no external publication action.",
      }),
    });
    const decision = await readJson(decisionResponse);
    assert.equal(decisionResponse.status, 200);
    assertNoStore(decisionResponse);
    assert.equal(decision.status, "approved");
    assert.equal(decision.totalScore, 89);
    assert.equal(decision.meritAmount, 89);
    assert.equal(decision.bestiaryCreated, true);

    stage = "merit query";
    const meritResponse = await request("/api/merit/me", { headers: { Cookie: contributorCookie } });
    const merit = await readJson(meritResponse);
    assert.equal(meritResponse.status, 200);
    assertNoStore(meritResponse);
    assert.ok(merit.entries.some((entry) => entry.caseId === caseId && entry.amount === 89));

    stage = "public bestiary list";
    const bestiaryResponse = await request("/api/bestiary");
    const bestiary = await readJson(bestiaryResponse);
    assert.equal(bestiaryResponse.status, 200);
    assertNoStore(bestiaryResponse);
    assert.ok(bestiary.entries.some((entry) => entry.caseId === caseId && entry.publicationStatus === "published"));

    stage = "public bestiary detail";
    const publicDetailResponse = await request(`/api/bestiary/${caseId}`);
    const publicDetail = await readJson(publicDetailResponse);
    assert.equal(publicDetailResponse.status, 200);
    assertNoStore(publicDetailResponse);
    assert.equal(publicDetail.entry.caseId, caseId);
    assert.equal(publicDetail.entry.publicationStatus, "published");

    stage = "duplicate approval";
    const duplicateResponse = await request(`/api/reviews/cases/${caseId}/decision`, {
      method: "POST",
      headers: { Cookie: reviewerCookie, Origin: origin },
      body: JSON.stringify({
        decision: "approved",
        evidenceQuality: 23,
        reproducibility: 22,
        technicalAccuracy: 18,
        remediationQuality: 17,
        contributionValue: 9,
        reviewSummary: "Duplicate approval should be rejected.",
        reviewNotes: "",
      }),
    });
    const duplicate = await readJson(duplicateResponse);
    assert.equal(duplicateResponse.status, 409);
    assertNoStore(duplicateResponse);
    assert.equal(duplicate.error.code, "CASE_STATE_CONFLICT");

    stage = "non-reviewer queue access";
    const forbiddenResponse = await request("/api/reviews/cases", { headers: { Cookie: contributorCookie } });
    const forbidden = await readJson(forbiddenResponse);
    assert.equal(forbiddenResponse.status, 403);
    assertNoStore(forbiddenResponse);
    assert.equal(forbidden.error.code, "REVIEWER_REQUIRED");

    stage = "anonymous queue access";
    const anonymousResponse = await request("/api/reviews/cases");
    const anonymous = await readJson(anonymousResponse);
    assert.equal(anonymousResponse.status, 401);
    assertNoStore(anonymousResponse);
    assert.equal(anonymous.error.code, "AUTH_REQUIRED");

    console.log("Review workflow API smoke checks passed.");
  }

  run().catch((error) => {
    console.error(`Review workflow API smoke checks failed. stage=${stage} status=${lastStatus ?? "none"} code=${lastCode ?? "none"}`);
    if (error instanceof Error && /timeout|network|status|response|expected/i.test(error.message)) {
      console.error("reason=runtime assertion failed");
    } else {
      console.error("reason=runtime dependency unavailable");
    }
    process.exitCode = 1;
  });
  }
}
