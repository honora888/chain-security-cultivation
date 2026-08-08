import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const sourceRoot = new URL("../src/", import.meta.url);
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return { shortCircuit: true, url: "data:text/javascript,export%20{}" };
    if (specifier === "next/server") return nextResolve("next/server.js", context);
    if (specifier === "next/headers") return nextResolve("next/headers.js", context);
    if (specifier.startsWith("@/")) {
      const path = specifier.slice(2);
      return { shortCircuit: true, url: new URL(path.endsWith(".ts") ? path : `${path}.ts`, sourceRoot).href };
    }
    if (context.parentURL?.includes("/src/") && specifier.startsWith(".") && !specifier.endsWith(".ts")) {
      return { shortCircuit: true, url: new URL(`${specifier}.ts`, context.parentURL).href };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.endsWith(".ts")) {
      const filename = fileURLToPath(url);
      const output = ts.transpileModule(readFileSync(filename, "utf8"), {
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
        fileName: filename,
      });
      return { format: "module", shortCircuit: true, source: output.outputText };
    }
    return nextLoad(url, context);
  },
});

const { QUEST_ONE } = await import("../src/data/quest-1.ts");
const {
  CULTIVATOR_REALM_THRESHOLDS,
  canChallengeRealm,
  challengeRelationship,
  cultivatorProgression,
} = await import("../src/features/cultivation/progression.ts");
const {
  QUEST_ONE_COMPLETION_EVIDENCE_SCHEMA_VERSION,
} = await import("../src/features/cultivation/contracts.ts");
const { CultivationHttpError } = await import("../src/features/cultivation/errors.ts");
const {
  parseQuestOneCompletionEvidence,
  prepareQuestOneCompletion,
  questOneEvidenceHash,
  validateQuestOneCompletionEvidence,
} = await import("../src/features/cultivation/quest-one-completion.ts");
const {
  getCultivationProfileWithContext,
  persistQuestOneCompletion,
} = await import("../src/features/cultivation/server.ts");
const { battleReducer, createInitialBattleState } = await import("../src/features/quest-1/battle-reducer.ts");

const WALLET = "0x0A31d11Fd14029c12Ef07c2c200085aE622c1541";
const EVIDENCE = {
  schemaVersion: QUEST_ONE_COMPLETION_EVIDENCE_SCHEMA_VERSION,
  selectedCodeLineId: "external-call",
  classification: { vulnerability: "classic-reentrancy", element: "water", risk: "High" },
  viewedReplaySteps: [0, 1, 2, 3, 4],
  repairOrder: ["checks", "effects", "interactions"],
};

const sources = {
  server: readFileSync(new URL("../src/features/cultivation/server.ts", import.meta.url), "utf8"),
  route: readFileSync(new URL("../src/app/api/cultivation/quests/1/complete/route.ts", import.meta.url), "utf8"),
  profileRoute: readFileSync(new URL("../src/app/api/cultivation/me/route.ts", import.meta.url), "utf8"),
  migration: readFileSync(new URL("../drizzle/0002_quest_completions.sql", import.meta.url), "utf8"),
  hub: readFileSync(new URL("../src/features/cultivation/cultivation-quest-hub.tsx", import.meta.url), "utf8"),
  explorer: readFileSync(new URL("../src/features/quest-catalog/quest-realm-explorer.tsx", import.meta.url), "utf8"),
  battle: readFileSync(new URL("../src/components/quest-1/QuestBattleExperience.tsx", import.meta.url), "utf8"),
  reward: readFileSync(new URL("../src/components/quest-1/RewardSequence.tsx", import.meta.url), "utf8"),
  persistence: readFileSync(new URL("../src/features/quest-1/persistence.ts", import.meta.url), "utf8"),
  contracts: readFileSync(new URL("../src/features/cultivation/contracts.ts", import.meta.url), "utf8"),
  questPage: readFileSync(new URL("../src/app/quests/page.tsx", import.meta.url), "utf8"),
  catalogStyles: readFileSync(new URL("../src/features/quest-catalog/quest-catalog.module.css", import.meta.url), "utf8"),
  walletIdentity: readFileSync(new URL("../src/features/wallet-auth/wallet-identity-controls.tsx", import.meta.url), "utf8"),
};

function expectCode(run, code) {
  assert.throws(run, (error) => error instanceof CultivationHttpError && error.code === code);
}

function fakeDatabase() {
  const rows = new Map();
  let sequence = 0;
  return {
    rows,
    async query(query, params) {
      if (query.includes("INSERT INTO quest_completions")) {
        const key = `${params[0]}:${params[1]}`;
        if (rows.has(key)) return [];
        sequence += 1;
        const row = {
          id: `completion-${sequence}`,
          wallet_address: params[0],
          quest_id: params[1],
          exp_awarded: params[2],
          mastery_element: params[3],
          mastery_awarded: params[4],
          badge_key: params[5],
          completion_hash: params[6],
          completed_at: "2026-08-08T00:00:00.000Z",
        };
        rows.set(key, row);
        return [row];
      }
      if (query.includes("COALESCE(SUM(exp_awarded)")) {
        const own = [...rows.values()].filter((row) => row.wallet_address === params[0]);
        const mastery = (element) => own.filter((row) => row.mastery_element === element)
          .reduce((total, row) => total + row.mastery_awarded, 0);
        return [{
          total_exp: own.reduce((total, row) => total + row.exp_awarded, 0),
          completed_quest_count: own.length,
          metal_mastery: mastery("Metal"), wood_mastery: mastery("Wood"),
          water_mastery: mastery("Water"), fire_mastery: mastery("Fire"), earth_mastery: mastery("Earth"),
          badge_keys: [...new Set(own.map((row) => row.badge_key))],
        }];
      }
      if (query.includes("ORDER BY completed_at DESC")) {
        return [...rows.values()].filter((row) => row.wallet_address === params[0]);
      }
      if (query.includes("FROM quest_completions") && query.includes("quest_id = $2")) {
        const row = rows.get(`${params[0]}:${params[1]}`);
        return row ? [row] : [];
      }
      throw new Error("Unexpected test query");
    },
  };
}

const tests = [];
function test(name, run) { tests.push({ name, run }); }

test("Quest1 authoritative EXP remains exactly 120", () => assert.equal(QUEST_ONE.exp, 120));
test("Quest1 mastery remains Water +1", () => assert.deepEqual([QUEST_ONE.elementMachine, QUEST_ONE.mastery], ["Water", 1]));
test("Quest1 badge uses stable key and Chinese label", () => assert.deepEqual([QUEST_ONE.badgeKey, QUEST_ONE.badge], ["water-guardian", "水系守护者徽记"]));
test("Merit is absent from cultivation progression", () => assert.doesNotMatch(sources.server, /merit_ledger|totalMerit/u));
test("new wallet starts at Qi Refining 0 of 1000", () => assert.deepEqual(cultivatorProgression(0), {
  totalExp: 0, realm: "Qi Refining", realmStartExp: 0, nextRealm: "Foundation Establishment",
  nextRealmExp: 1000, expIntoRealm: 0, expToNextRealm: 1000, progressPercent: 0,
}));
test("120 EXP has 880 remaining and 12 percent progress", () => {
  const result = cultivatorProgression(120);
  assert.deepEqual([result.realm, result.expToNextRealm, result.progressPercent], ["Qi Refining", 880, 12]);
});

for (const threshold of CULTIVATOR_REALM_THRESHOLDS) {
  test(`${threshold.realm} exact threshold boundary`, () => {
    assert.deepEqual([cultivatorProgression(threshold.exp).realm, cultivatorProgression(threshold.exp).realmStartExp], [threshold.realm, threshold.exp]);
  });
}

test("Tribulation max realm is handled safely", () => {
  const result = cultivatorProgression(100_000);
  assert.deepEqual([result.realm, result.nextRealm, result.nextRealmExp, result.expToNextRealm, result.progressPercent], ["Tribulation", null, null, 0, 100]);
});
test("progress percent clamps invalid and negative EXP safely", () => {
  assert.equal(cultivatorProgression(-20).progressPercent, 0);
  assert.equal(cultivatorProgression(Number.POSITIVE_INFINITY).totalExp, 0);
});
test("Qi Refining can challenge Core Formation", () => assert.equal(canChallengeRealm("Qi Refining", "Core Formation"), true));
test("Qi Refining cannot challenge Nascent Soul", () => assert.equal(canChallengeRealm("Qi Refining", "Nascent Soul"), false));
test("Quest1 is a two-realm challenge for a new wallet", () => assert.equal(challengeRelationship("Qi Refining", QUEST_ONE.realmMachine), "two-above"));
test("authenticated session wallet is the server authority", () => {
  assert.match(sources.server, /cookies\(\)[\s\S]+readSession\(token\)[\s\S]+walletAddressForDatabase\(session\.walletAddress\)/u);
});
test("walletAddress body injection is rejected", () => expectCode(() => parseQuestOneCompletionEvidence({ ...EVIDENCE, walletAddress: WALLET }), "INVALID_REQUEST"));
test("client cannot submit exp", () => expectCode(() => parseQuestOneCompletionEvidence({ ...EVIDENCE, exp: 999999 }), "INVALID_REQUEST"));
test("client cannot submit mastery", () => expectCode(() => parseQuestOneCompletionEvidence({ ...EVIDENCE, mastery: 999 }), "INVALID_REQUEST"));
test("client cannot choose badge", () => expectCode(() => parseQuestOneCompletionEvidence({ ...EVIDENCE, badgeKey: "admin" }), "INVALID_REQUEST"));
test("unknown request fields are rejected", () => expectCode(() => parseQuestOneCompletionEvidence({ ...EVIDENCE, completed: true }), "INVALID_REQUEST"));
test("wrong vulnerable line is rejected", () => expectCode(() => validateQuestOneCompletionEvidence({ ...EVIDENCE, selectedCodeLineId: "balance-reset" }), "EVIDENCE_INVALID"));
test("wrong classification is rejected", () => expectCode(() => validateQuestOneCompletionEvidence({ ...EVIDENCE, classification: { ...EVIDENCE.classification, risk: "Low" } }), "EVIDENCE_INVALID"));
test("incomplete replay evidence is rejected", () => expectCode(() => validateQuestOneCompletionEvidence({ ...EVIDENCE, viewedReplaySteps: [0, 1, 2] }), "EVIDENCE_INVALID"));
test("wrong repair order is rejected", () => expectCode(() => validateQuestOneCompletionEvidence({ ...EVIDENCE, repairOrder: ["checks", "interactions", "effects"] }), "EVIDENCE_INVALID"));
test("correct evidence is accepted", () => assert.doesNotThrow(() => validateQuestOneCompletionEvidence(EVIDENCE)));
test("server derives 120 EXP itself", async () => {
  const db = fakeDatabase();
  const result = await persistQuestOneCompletion(db, WALLET, EVIDENCE);
  assert.equal(result.row.exp_awarded, 120);
});
test("first valid completion creates exactly one row", async () => {
  const db = fakeDatabase();
  const result = await persistQuestOneCompletion(db, WALLET, EVIDENCE);
  assert.equal(result.alreadyCompleted, false);
  assert.equal(db.rows.size, 1);
});
test("second valid completion is idempotent and adds no row", async () => {
  const db = fakeDatabase();
  const first = await persistQuestOneCompletion(db, WALLET, EVIDENCE);
  const second = await persistQuestOneCompletion(db, WALLET, EVIDENCE);
  assert.equal(second.alreadyCompleted, true);
  assert.equal(second.row.completion_hash, first.row.completion_hash);
  assert.equal(db.rows.size, 1);
});
test("concurrent completion authority is wallet and quest unique", () => {
  assert.match(sources.migration, /CREATE UNIQUE INDEX "quest_completions_wallet_quest_unique"[\s\S]+\("wallet_address", "quest_id"\)/u);
});
test("localStorage reset cannot restore first-clear eligibility", () => {
  assert.doesNotMatch(sources.server, /localStorage/u);
  assert.match(sources.persistence, /removeItem\(PROGRESS_KEY\)/u);
});
test("Quest replay remains available", () => assert.match(sources.battle, /重新修炼/u));
test("cultivation profile sums persisted completion EXP", async () => {
  const db = fakeDatabase();
  await persistQuestOneCompletion(db, WALLET, EVIDENCE);
  assert.equal((await getCultivationProfileWithContext(db, WALLET)).totalExp, 120);
});
test("Water mastery derives from completion rows", async () => {
  const db = fakeDatabase(); await persistQuestOneCompletion(db, WALLET, EVIDENCE);
  assert.equal((await getCultivationProfileWithContext(db, WALLET)).mastery.Water, 1);
});
test("badge derives from completion rows", async () => {
  const db = fakeDatabase(); await persistQuestOneCompletion(db, WALLET, EVIDENCE);
  assert.deepEqual((await getCultivationProfileWithContext(db, WALLET)).badges, [{ key: "water-guardian", label: "水系守护者徽记" }]);
});
test("completed quest count derives correctly", async () => {
  const db = fakeDatabase(); await persistQuestOneCompletion(db, WALLET, EVIDENCE);
  assert.equal((await getCultivationProfileWithContext(db, WALLET)).completedQuestCount, 1);
});
test("current realm derives from EXP only", () => assert.match(sources.server, /cultivatorProgression\(totalExp\)/u));
test("Merit cannot change cultivator realm", () => assert.doesNotMatch(readFileSync(new URL("../src/features/cultivation/progression.ts", import.meta.url), "utf8"), /merit/iu));
test("completion hash is deterministic", () => assert.equal(prepareQuestOneCompletion(WALLET, EVIDENCE).completionHash, prepareQuestOneCompletion(WALLET, EVIDENCE).completionHash));
test("changing evidence changes evidence hash", () => assert.notEqual(questOneEvidenceHash(EVIDENCE), questOneEvidenceHash({ ...EVIDENCE, selectedCodeLineId: "other" })));
test("completion hash includes wallet and quest identity", () => {
  assert.notEqual(prepareQuestOneCompletion(WALLET, EVIDENCE).completionHash, prepareQuestOneCompletion("0x000000000000000000000000000000000000dEaD", EVIDENCE).completionHash);
  assert.equal(prepareQuestOneCompletion(WALLET, EVIDENCE).commitment.questId, 1);
});
test("completion hash cannot be supplied by client", () => expectCode(() => parseQuestOneCompletionEvidence({ ...EVIDENCE, completionHash: `0x${"1".repeat(64)}` }), "INVALID_REQUEST"));
test("public completion DTO contains no raw source or private fields", () => assert.doesNotMatch(sources.server, /vulnerableSource|review_notes|signedDraft|sessionToken/u));
test("quests UI displays current cultivator realm", () => assert.match(sources.hub, /当前境界[\s\S]+cultivationRealmLabel/u));
test("quests UI displays EXP progression", () => assert.match(sources.hub, /修为[\s\S]+progressbar[\s\S]+距离/u));
test("quests UI displays elemental mastery", () => assert.match(sources.hub, /五行熟练度[\s\S]+ELEMENTS\.map/u));
test("quests header retains the shared authenticated wallet identity surface", () => {
  assert.match(sources.questPage, /className=\{styles\.catalogIdentity\}[\s\S]+<WalletIdentityControl \/>/u);
  assert.match(sources.catalogStyles, /\.catalogIdentity[\s\S]+color: #f6ecd4/u);
  assert.match(sources.walletIdentity, /useWalletAuth\(\)[\s\S]+wallet\.authenticated[\s\S]+compactAddress\(wallet\.walletAddress\)/u);
});
test("Quest1 UI displays two-realm challenge", () => assert.match(sources.explorer, /challengeRelationshipLabel\(relationship\)/u));
test("existing RewardSequence remains the post-settlement visual", () => assert.match(sources.battle, /await completeQuestOne[\s\S]+START_REWARD_SEQUENCE[\s\S]+<RewardSequence/u));
test("Quest1 reducer reward sequence remains functional after server settlement", () => {
  const completed = battleReducer(createInitialBattleState(), {
    type: "HYDRATE",
    payload: {
      checkpoint: "ACT5_COMPLETE",
      motionMode: "full",
      classificationAnswers: { vulnerability: "classic-reentrancy", element: "water", risk: "High" },
      replayStep: 4,
      replayStatus: "complete",
      viewedReplaySteps: [0, 1, 2, 3, 4],
      repairOrder: ["checks", "effects", "interactions"],
    },
  });
  const rewarding = battleReducer(completed, { type: "START_REWARD_SEQUENCE" });
  const finished = battleReducer(rewarding, { type: "REWARD_SEQUENCE_FINISHED" });
  assert.deepEqual([rewarding.phase, finished.phase, finished.checkpoint], ["ACT6_REWARDING", "ACT6_COMPLETE", "ACT6_COMPLETE"]);
});
test("settlement pending prevents accidental duplicate click", () => {
  assert.match(sources.battle, /settlementInFlight\.current[\s\S]+settlementInFlight\.current = true/u);
  assert.match(sources.battle, /disabled=\{state\.transitionLocked \|\| settlementStatus === "submitting"\}/u);
});
test("settlement error is visible and retryable", () => assert.match(sources.battle, /settlementError[\s\S]+role="alert"[\s\S]+aria-live="assertive"/u));
test("settlement failure preserves valid battle state", () => {
  const branch = sources.battle.match(/catch \(error\) \{([\s\S]+?)\n    \} finally/u)?.[1] ?? "";
  assert.doesNotMatch(branch, /dispatch|clearBattleProgress|RESET_QUEST/u);
});
test("replay does not claim another 120 EXP", () => {
  assert.match(sources.reward, /replay \? "首通已领取"/u);
  assert.match(sources.reward, /本次不重复增加修为/u);
});
test("existing chain-status component remains mounted", () => assert.match(sources.reward, /<ChainStatusPanel \/>/u));
test("no Monad RPC is required for completion persistence", () => assert.doesNotMatch(sources.server + sources.route, /MONAD_RPC_URL|eth_call|queryQuestOneChainStatus/u));
test("no Gemini call is involved", () => assert.doesNotMatch(sources.server + sources.route, /gemini|runHybridGuardianAnalysis/iu));
test("no Moss call is involved", () => assert.doesNotMatch(sources.server + sources.route, /moss|guardian\.quest/iu));
test("API responses expose no sensitive internal data", () => {
  assert.doesNotMatch(sources.contracts, /sessionToken|cookie|signature|reviewNotes|DATABASE_URL|signedDraft/u);
  assert.match(sources.route, /parseQuestOneCompletionEvidence/u);
});

assert.ok(tests.length >= 53);
let passed = 0;
for (const { name, run } of tests) {
  try {
    await run();
    passed += 1;
    console.log(`PASS ${passed}: ${name}`);
  } catch (error) {
    console.error(`FAIL: ${name}`);
    throw error;
  }
}
console.log(`Cultivation Progression Stage 36: ${passed}/${tests.length} PASS`);
