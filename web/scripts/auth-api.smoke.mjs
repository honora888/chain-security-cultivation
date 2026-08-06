import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const baseUrl = (
  process.env.CONTRIBUTION_AUTH_BASE_URL ??
  "http://localhost:3000"
).replace(/\/$/, "");

const baseOrigin = new URL(baseUrl).origin;
const account = privateKeyToAccount(generatePrivateKey());
const wrongAccount = privateKeyToAccount(generatePrivateKey());

let stage = "startup";
let lastStatus = null;
let lastErrorCode = null;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function readJson(response) {
  lastStatus = response.status;

  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error("response was not valid JSON");
  }

  assert(body && typeof body === "object", "response body was not an object");

  lastErrorCode =
    typeof body?.error?.code === "string"
      ? body.error.code
      : null;

  return body;
}

async function post(path, body, cookie) {
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    Origin: baseOrigin,
  };

  if (cookie) {
    headers.Cookie = cookie;
  }

  return fetch(new URL(path, `${baseUrl}/`), {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
}

async function getSession(cookie) {
  const headers = {
    Accept: "application/json",
  };

  if (cookie) {
    headers.Cookie = cookie;
  }

  return fetch(new URL("/api/auth/session", `${baseUrl}/`), {
    headers,
    signal: AbortSignal.timeout(15_000),
  });
}

function cookiePair(response) {
  const setCookie = response.headers.get("set-cookie");

  assert(
    typeof setCookie === "string" && setCookie.length > 0,
    "verify response did not include Set-Cookie",
  );

  return setCookie.split(";", 1)[0];
}

function assertNoStore(response) {
  assert(
    response.headers.get("cache-control") === "no-store",
    "Cache-Control was not no-store",
  );
}

async function main() {
  stage = "nonce request";
  const nonceResponse = await post("/api/auth/nonce", {
    walletAddress: account.address,
  });

  stage = "nonce response";
  const nonceBody = await readJson(nonceResponse);

  assert(nonceResponse.status === 200, "nonce request did not return HTTP 200");
  assertNoStore(nonceResponse);
  assert(nonceBody.ok === true, "nonce response was not successful");
  assert(
    typeof nonceBody.message === "string",
    "nonce response did not contain a message",
  );
  assert(
    nonceBody.message.includes(baseOrigin),
    "authentication message origin mismatch",
  );
  assert(
    nonceBody.message.includes(account.address),
    "authentication message wallet mismatch",
  );
  assert(
    nonceBody.message.includes("Chain: Monad Testnet"),
    "authentication message chain name mismatch",
  );
  assert(
    nonceBody.message.includes("Chain ID: 10143"),
    "authentication message chain ID mismatch",
  );
  assert(
    nonceBody.message.includes(nonceBody.nonceId),
    "authentication message nonce ID mismatch",
  );
  assert(
    nonceBody.message.includes(nonceBody.expiresAt),
    "authentication message expiry mismatch",
  );

  stage = "message signing";
  const signature = await account.signMessage({
    message: nonceBody.message,
  });

  stage = "verify request";
  const verifyResponse = await post("/api/auth/verify", {
    walletAddress: account.address,
    nonceId: nonceBody.nonceId,
    nonce: nonceBody.nonce,
    signature,
  });

  stage = "verify response";
  const verifyBody = await readJson(verifyResponse);

  assert(verifyResponse.status === 200, "verify did not return HTTP 200");
  assertNoStore(verifyResponse);
  assert(
    verifyBody.ok === true && verifyBody.authenticated === true,
    "verify response was not authenticated",
  );

  const cookie = cookiePair(verifyResponse);

  stage = "authenticated session request";
  const sessionResponse = await getSession(cookie);

  stage = "authenticated session response";
  const sessionBody = await readJson(sessionResponse);

  assert(sessionResponse.status === 200, "session did not return HTTP 200");
  assertNoStore(sessionResponse);
  assert(
    sessionBody.ok === true && sessionBody.authenticated === true,
    "session was not authenticated",
  );

  stage = "nonce replay request";
  const replayResponse = await post("/api/auth/verify", {
    walletAddress: account.address,
    nonceId: nonceBody.nonceId,
    nonce: nonceBody.nonce,
    signature,
  });

  stage = "nonce replay response";
  const replayBody = await readJson(replayResponse);

  assert(replayResponse.status === 401, "nonce replay did not return HTTP 401");
  assertNoStore(replayResponse);
  assert(
    replayBody?.error?.code === "NONCE_ALREADY_USED",
    "nonce replay returned the wrong error code",
  );

  stage = "logout request";
  const logoutResponse = await fetch(
    new URL("/api/auth/logout", `${baseUrl}/`),
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        Origin: baseOrigin,
        Cookie: cookie,
      },
      signal: AbortSignal.timeout(15_000),
    },
  );

  stage = "logout response";
  const logoutBody = await readJson(logoutResponse);

  assert(logoutResponse.status === 200, "logout did not return HTTP 200");
  assertNoStore(logoutResponse);
  assert(
    logoutBody.ok === true && logoutBody.authenticated === false,
    "logout response remained authenticated",
  );

  stage = "post-logout session request";
  const afterLogoutResponse = await getSession(cookie);

  stage = "post-logout session response";
  const afterLogoutBody = await readJson(afterLogoutResponse);

  assert(
    afterLogoutResponse.status === 200,
    "post-logout session did not return HTTP 200",
  );
  assertNoStore(afterLogoutResponse);
  assert(
    afterLogoutBody.ok === true &&
      afterLogoutBody.authenticated === false,
    "revoked session remained authenticated",
  );

  stage = "invalid-signature nonce request";
  const invalidSignatureNonceResponse = await post("/api/auth/nonce", {
    walletAddress: account.address,
  });

  stage = "invalid-signature nonce response";
  const invalidSignatureNonce = await readJson(
    invalidSignatureNonceResponse,
  );

  assert(
    invalidSignatureNonceResponse.status === 200,
    "invalid-signature nonce request did not return HTTP 200",
  );
  assertNoStore(invalidSignatureNonceResponse);

  stage = "wrong signature creation";
  const wrongSignature = await wrongAccount.signMessage({
    message: invalidSignatureNonce.message,
  });

  stage = "invalid-signature verify request";
  const invalidSignatureResponse = await post("/api/auth/verify", {
    walletAddress: account.address,
    nonceId: invalidSignatureNonce.nonceId,
    nonce: invalidSignatureNonce.nonce,
    signature: wrongSignature,
  });

  stage = "invalid-signature verify response";
  const invalidSignatureBody = await readJson(
    invalidSignatureResponse,
  );

  assert(
    invalidSignatureResponse.status === 401,
    "invalid signature did not return HTTP 401",
  );
  assertNoStore(invalidSignatureResponse);
  assert(
    invalidSignatureBody?.error?.code === "INVALID_SIGNATURE",
    "invalid signature returned the wrong error code",
  );

  console.log("Auth API smoke checks passed.");
}

main().catch((error) => {
  console.error(`Auth API smoke checks failed at stage: ${stage}.`);

  if (lastStatus !== null) {
    console.error(`HTTP status: ${lastStatus}.`);
  }

  if (lastErrorCode) {
    console.error(`Error code: ${lastErrorCode}.`);
  }

  console.error(
    `Failure: ${
      error instanceof Error
        ? error.message
        : "unknown smoke failure"
    }.`,
  );

  process.exitCode = 1;
});