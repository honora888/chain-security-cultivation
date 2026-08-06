import assert from "node:assert/strict";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const baseUrl = (process.env.CONTRIBUTION_API_BASE_URL ?? "http://localhost:3000").replace(/\/$/u, "");
const origin = new URL(baseUrl).origin;
const account = privateKeyToAccount(generatePrivateKey());
const suffix = account.address.slice(2, 10).toLowerCase();
const runMarker = `// contribution-smoke-run:${account.address
  .slice(2, 18)
  .toLowerCase()}`;

let stage = "startup";
let lastStatus = null;
let lastCode = null;

const vulnerableSource = `${runMarker}
contract SampleVaultAlpha {
  mapping(address => uint256) internal credits;
  function release() external {
    uint256 amount = credits[msg.sender];
    (bool ok,) = msg.sender.call{value: amount}("");
    require(ok);
    credits[msg.sender] = 0;
  }
}`;
const attackSource = `${runMarker}
contract SampleAttackerAlpha {
  SampleVaultAlpha target;
  receive() external payable { target.release(); }
}`;
const fixedSource = `${runMarker}
contract SampleVaultAlphaFixed {
  mapping(address => uint256) internal credits;
  function release() external {
    uint256 amount = credits[msg.sender];
    credits[msg.sender] = 0;
    (bool ok,) = msg.sender.call{value: amount}("");
    require(ok);
  }
}`;

function assertNoStore(response) {
  assert.equal(response.headers.get("cache-control"), "no-store");
}

async function json(response) {
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

async function auth() {
  stage = "auth nonce";
  const nonceResponse = await request("/api/auth/nonce", {
    method: "POST",
    headers: { Origin: origin },
    body: JSON.stringify({ walletAddress: account.address }),
  });
  const nonce = await json(nonceResponse);
  assert.equal(nonceResponse.status, 200);
  assertNoStore(nonceResponse);
  const signature = await account.signMessage({ message: nonce.message });
  stage = "auth verify";
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
  const verified = await json(verifyResponse);
  assert.equal(verifyResponse.status, 200);
  assertNoStore(verifyResponse);
  assert.equal(verified.authenticated, true);
  const setCookie = verifyResponse.headers.get("set-cookie");
  assert.ok(setCookie);
  return setCookie.split(";", 1)[0];
}

async function main() {
  const cookie = await auth();
  const proposedName = `玄水回环${suffix}`;
  const caseName = `Sample contribution ${suffix}`;
  const payload = {
    caseName,
    proposedBestiaryName: proposedName,
    vulnerableSource,
    attackSource,
    fixedSource,
  };

  stage = "create";
  const createResponse = await request("/api/contributions/cases", {
    method: "POST",
    headers: { Cookie: cookie },
    body: JSON.stringify(payload),
  });
  const created = await json(createResponse);
  assert.equal(createResponse.status, 201);
  assertNoStore(createResponse);
  assert.equal(created.ok, true);
  assert.equal(created.case.formalType, "Classic Reentrancy");
  assert.equal(created.case.status, "pending_review");
  const caseId = created.case.caseId;

  stage = "detail";
  const detailResponse = await request(`/api/contributions/cases/${caseId}`, {
    headers: { Cookie: cookie },
  });
  const detail = await json(detailResponse);
  assert.equal(detailResponse.status, 200);
  assertNoStore(detailResponse);
  assert.equal(detail.case.vulnerableSource, vulnerableSource);
  assert.equal(detail.case.attackSource, attackSource);
  assert.equal(detail.case.fixedSource, fixedSource);
  assert.equal(detail.case.analysisJson.schemaVersion, "guardian-security-analysis-v1");

  stage = "list";
  const listResponse = await request("/api/contributions/cases", {
    headers: { Cookie: cookie },
  });
  const list = await json(listResponse);
  assert.equal(listResponse.status, 200);
  assertNoStore(listResponse);
  assert.ok(list.cases.some((entry) => entry.caseId === caseId));

  stage = "duplicate case hash";
  const duplicateResponse = await request("/api/contributions/cases", {
    method: "POST",
    headers: { Cookie: cookie },
    body: JSON.stringify({ ...payload, caseName: `${caseName} duplicate`, proposedBestiaryName: `玄水重复${suffix}` }),
  });
  const duplicate = await json(duplicateResponse);
  assert.equal(duplicateResponse.status, 409);
  assertNoStore(duplicateResponse);
  assert.equal(duplicate.error.code, "CASE_ALREADY_EXISTS");

  stage = "duplicate name";
  const nameResponse = await request("/api/contributions/cases", {
    method: "POST",
    headers: { Cookie: cookie },
    body: JSON.stringify({ ...payload, caseName: `${caseName} different source`, vulnerableSource: `${vulnerableSource}\n// different` }),
  });
  const nameConflict = await json(nameResponse);
  assert.equal(nameResponse.status, 409);
  assertNoStore(nameResponse);
  assert.equal(nameConflict.error.code, "BESTIARY_NAME_UNAVAILABLE");

  stage = "no cookie";
  const anonymousResponse = await request("/api/contributions/cases");
  const anonymous = await json(anonymousResponse);
  assert.equal(anonymousResponse.status, 401);
  assertNoStore(anonymousResponse);
  assert.equal(anonymous.error.code, "AUTH_REQUIRED");

  stage = "Quest 1 reserved name";
  const questNameResponse = await request("/api/contributions/cases", {
    method: "POST",
    headers: { Cookie: cookie },
    body: JSON.stringify({ ...payload, caseName: `${caseName} quest name`, proposedBestiaryName: "噬灵回环兽", vulnerableSource: `${vulnerableSource}\n// quest-name-check` }),
  });
  const questName = await json(questNameResponse);
  assert.equal(questNameResponse.status, 409);
  assertNoStore(questNameResponse);
  assert.equal(questName.error.code, "BESTIARY_NAME_UNAVAILABLE");

  console.log("Contribution API smoke checks passed.");
}

main().catch((error) => {
  console.error(`Contribution API smoke checks failed. stage=${stage} status=${lastStatus ?? "none"} code=${lastCode ?? "none"}`);
  if (error instanceof Error && !/secret|cookie|token|source|analysis|signature|private/i.test(error.message)) {
    console.error(`reason=${error.message}`);
  }
  process.exitCode = 1;
});
