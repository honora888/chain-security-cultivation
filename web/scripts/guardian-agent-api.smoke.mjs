import assert from "node:assert/strict";

const DEFAULT_BASE_URL = "http://localhost:3000";
const DEFAULT_AMOUNT = "0.001";
const EXPECTED_CHAIN_ID = 10143;
const EXPECTED_CONTRACT = "0x131DEbd042208A327841128e5800dd4a833032ab";
const EXPECTED_VALUE = "0x38d7ea4c68000";

const baseUrl = (process.env.GUARDIAN_BASE_URL ?? DEFAULT_BASE_URL).replace(
  /\/$/,
  "",
);
const account = process.env.GUARDIAN_TEST_ACCOUNT;
const amount = process.env.GUARDIAN_TEST_AMOUNT ?? DEFAULT_AMOUNT;

assert.match(
  account ?? "",
  /^0x[0-9a-fA-F]{40}$/,
  "GUARDIAN_TEST_ACCOUNT must be a valid EVM address",
);
assert.equal(
  amount,
  DEFAULT_AMOUNT,
  "The smoke test currently verifies the default 0.001 MON amount only",
);

async function readJson(response, label) {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  assert.match(contentType, /application\/json|\+json/, `${label} must return JSON`);
  const payload = await response.json();
  assert.equal(response.ok, true, `${label} failed with HTTP ${response.status}`);
  assert.equal(payload.ok, true, `${label} returned a failure envelope`);
  return payload;
}

const questResponse = await fetch(`${baseUrl}/api/guardian/quest`, {
  method: "GET",
  headers: { Accept: "application/json" },
  cache: "no-store",
});
const quest = await readJson(questResponse, "GET guardian quest");

assert.equal(quest.schemaVersion, "guardian-agent-quest-v1");
assert.equal(quest.network?.chainId, EXPECTED_CHAIN_ID);
assert.equal(quest.contract?.address?.toLowerCase(), EXPECTED_CONTRACT.toLowerCase());
assert.equal(quest.quest?.questId, "1");

const prepareResponse = await fetch(`${baseUrl}/api/guardian/prepare`, {
  method: "POST",
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ account, amount }),
  cache: "no-store",
});
const prepared = await readJson(prepareResponse, "POST guardian prepare");

assert.equal(prepared.schemaVersion, "guardian-agent-prepare-v1");
assert.equal(prepared.network?.chainId, EXPECTED_CHAIN_ID);
assert.equal(
  prepared.contract?.address?.toLowerCase(),
  EXPECTED_CONTRACT.toLowerCase(),
);
assert.equal(prepared.simulation?.signAllowed, true);
assert.deepEqual(prepared.simulation?.warnings, []);
assert.equal(
  prepared.transaction?.to?.toLowerCase(),
  EXPECTED_CONTRACT.toLowerCase(),
);
assert.equal(prepared.transaction?.value?.toLowerCase(), EXPECTED_VALUE);

console.log("Guardian Agent API smoke PASS: read and unsigned simulation only.");
