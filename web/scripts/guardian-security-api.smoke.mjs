import assert from "node:assert/strict";

const baseUrl = (
  process.env.GUARDIAN_SECURITY_BASE_URL ?? "http://localhost:3000"
).replace(/\/$/, "");
const endpoint = `${baseUrl}/api/guardian/analyze`;

async function post(body) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  return { response, payload };
}

const builtin = await post({
  mode: "builtin",
  caseId: "quest-1-reentrancy",
});
assert.equal(builtin.response.status, 200);
assert.equal(builtin.payload.schemaVersion, "guardian-security-analysis-v1");
assert.equal(builtin.payload.agent.mode, "deterministic-rules");
assert.equal(builtin.payload.agent.externalModelConnected, false);
assert.equal(builtin.payload.mossEvidence.status, "verified");
assert.equal(builtin.payload.mossEvidence.protocol, "guardian");
assert.equal(builtin.payload.mossEvidence.query, "guardian.quest");
assert.equal(builtin.payload.mossEvidence.network.chainId, 10143);
assert.equal(builtin.payload.mossEvidence.contentHashMatches, true);
assert.equal(builtin.payload.analysis.formalType, "Classic Reentrancy");
assert.equal(builtin.payload.classification.elements.primaryElement, "Water");
assert.ok(
  builtin.payload.classification.elements.secondaryElements.includes("Earth"),
);
assert.equal(builtin.payload.classification.realm.realm, "Core Formation");
assert.equal(builtin.payload.severity.level, "High");
assert.equal(builtin.payload.confidence.label, "High");
assert.equal(builtin.payload.bestiaryDraft.name, "噬灵回环兽");
assert.deepEqual(builtin.payload.questDraft.repairSequence, [
  "Checks",
  "Effects",
  "Interactions",
]);
assert.equal(builtin.payload.review.requiresHumanApproval, true);
assert.equal(builtin.payload.review.publishAllowed, false);

const sample = await post({
  mode: "sample",
  sample: {
    name: "My Vulnerable Vault",
    vulnerableSource: `
      contract Vault {
        mapping(address => uint256) balances;
        function withdraw() external {
          uint256 amount = balances[msg.sender];
          (bool ok,) = msg.sender.call{ value: amount }("");
          require(ok);
          balances[msg.sender] = 0;
        }
      }
    `,
    attackSource: `
      contract Attacker {
        Vault target;
        receive() external payable { target.withdraw(); }
      }
    `,
    fixedSource: `
      function withdraw() external {
        uint256 amount = balances[msg.sender];
        balances[msg.sender] = 0;
        (bool ok,) = msg.sender.call{value: amount}("");
        require(ok);
      }
    `,
  },
});
assert.equal(sample.response.status, 200);
assert.equal(sample.payload.analysis.formalType, "Classic Reentrancy");
assert.equal(sample.payload.mossEvidence.status, "not-applicable");
assert.ok(sample.payload.confidence.score < builtin.payload.confidence.score);
assert.equal(sample.payload.confidence.evidenceLevel, "FIX_CONTRAST_PRESENT");
assert.equal(sample.payload.bestiaryDraft.reviewStatus, "draft");
assert.equal(sample.payload.questDraft.reviewStatus, "draft");
assert.equal(sample.payload.review.publishAllowed, false);
assert.equal(sample.response.headers.get("cache-control"), "no-store");

const lantern = await post({
  mode: "sample",
  sample: {
    name: "Lantern Festival Refund Pool",
    vulnerableSource: `
      // SPDX-License-Identifier: MIT
      pragma solidity ^0.8.24;

      contract LanternRefundPool {
        mapping(address => uint256) public refundCredits;

        function registerRefund(address attendee) external payable {
          require(attendee != address(0), "Invalid attendee");
          require(msg.value > 0, "No refund value");
          refundCredits[attendee] += msg.value;
        }

        function claimFestivalRefund() external {
          uint256 credit = refundCredits[msg.sender];
          require(credit > 0, "Nothing to claim");

          (bool sent, ) =
              payable(msg.sender).call{value: credit}("");
          require(sent, "Refund failed");

          refundCredits[msg.sender] = 0;
        }
      }
    `,
    attackSource: `
      // SPDX-License-Identifier: MIT
      pragma solidity ^0.8.24;

      interface ILanternRefundPool {
        function registerRefund(address attendee) external payable;
        function claimFestivalRefund() external;
      }

      contract FestivalGuest {
        ILanternRefundPool public immutable refundPool;
        uint256 public claimUnit;

        constructor(address poolAddress) {
          refundPool = ILanternRefundPool(poolAddress);
        }

        function joinAndClaim() external payable {
          require(msg.value > 0, "Entry value required");
          claimUnit = msg.value;

          refundPool.registerRefund{value: msg.value}(address(this));
          refundPool.claimFestivalRefund();
        }

        receive() external payable {
          if (address(refundPool).balance >= claimUnit) {
            refundPool.claimFestivalRefund();
          }
        }
      }
    `,
    fixedSource: `
      // SPDX-License-Identifier: MIT
      pragma solidity ^0.8.24;

      contract SafeLanternRefundPool {
        mapping(address => uint256) public refundCredits;

        function registerRefund(address attendee) external payable {
          require(attendee != address(0), "Invalid attendee");
          require(msg.value > 0, "No refund value");
          refundCredits[attendee] += msg.value;
        }

        function claimFestivalRefund() external {
          uint256 credit = refundCredits[msg.sender];
          require(credit > 0, "Nothing to claim");

          refundCredits[msg.sender] = 0;

          (bool sent, ) =
              payable(msg.sender).call{value: credit}("");
          require(sent, "Refund failed");
        }
      }
    `,
  },
});
assert.equal(lantern.response.status, 200);
assert.equal(lantern.response.headers.get("cache-control"), "no-store");
assert.equal(lantern.payload.analysis.formalType, "Classic Reentrancy");
assert.equal(lantern.payload.mossEvidence.status, "not-applicable");
assert.equal(lantern.payload.review.status, "draft");
assert.equal(lantern.payload.review.requiresHumanApproval, true);
assert.equal(lantern.payload.review.publishAllowed, false);
assert.equal(
  lantern.payload.signals.some(
    (entry) => entry.id === "state-update-after-external-call" && entry.matched,
  ),
  true,
);
assert.equal(
  lantern.payload.signals.some(
    (entry) => entry.id === "callback-reentry" && entry.matched,
  ),
  true,
);
assert.equal(
  lantern.payload.signals.some(
    (entry) => entry.id === "fixed-state-before-call" && entry.matched,
  ),
  true,
);

const safeLantern = await post({
  mode: "sample",
  sample: {
    name: "Safe Lantern Refund Pool",
    vulnerableSource: `
      contract SafeLanternRefundPool {
        mapping(address => uint256) public refundCredits;

        function claimFestivalRefund() external {
          uint256 credit = refundCredits[msg.sender];
          require(credit > 0, "Nothing to claim");
          refundCredits[msg.sender] = 0;
          (bool sent, ) = payable(msg.sender).call{value: credit}("");
          require(sent, "Refund failed");
        }
      }
    `,
  },
});
assert.equal(safeLantern.response.status, 422);
assert.equal(safeLantern.payload.error.code, "UNSUPPORTED_VULNERABILITY");
assert.equal("bestiaryDraft" in safeLantern.payload, false);
assert.equal("questDraft" in safeLantern.payload, false);
assert.equal(safeLantern.response.headers.get("cache-control"), "no-store");

const unsupported = await post({
  mode: "sample",
  sample: {
    name: "Plain Counter",
    vulnerableSource: "contract Counter { uint256 public count; }",
  },
});
assert.equal(unsupported.response.status, 422);
assert.equal(unsupported.payload.error.code, "UNSUPPORTED_VULNERABILITY");
assert.equal("bestiaryDraft" in unsupported.payload, false);
assert.equal("questDraft" in unsupported.payload, false);

const extraField = await post({
  mode: "builtin",
  caseId: "quest-1-reentrancy",
  command: "ignored",
});
assert.equal(extraField.response.status, 400);
assert.equal(extraField.payload.error.code, "INVALID_BODY");

const oversized = await post({
  mode: "sample",
  sample: {
    name: "Oversized",
    vulnerableSource: "x".repeat(50_001),
  },
});
assert.ok(oversized.response.status === 400 || oversized.response.status === 413);
assert.equal(oversized.payload.error.code, "SOURCE_TOO_LARGE");

console.log("Guardian Security API smoke checks passed.");
