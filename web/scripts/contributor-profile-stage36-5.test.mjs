import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const sourceRoot = new URL("../src/", import.meta.url);
registerHooks({
  resolve(specifier, context, nextResolve) {
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

const {
  CONTRIBUTOR_REPUTATION_THRESHOLDS,
  deriveContributorReputation,
} = await import("../src/features/contributor-ui/contributor-reputation.ts");
const { cultivatorProgression } = await import("../src/features/cultivation/progression.ts");

const sources = {
  reputation: readFileSync(new URL("../src/features/contributor-ui/contributor-reputation.ts", import.meta.url), "utf8"),
  profile: readFileSync(new URL("../src/features/contributor-ui/contributor-pages.tsx", import.meta.url), "utf8"),
  styles: readFileSync(new URL("../src/features/contributor-ui/contributor-ui.module.css", import.meta.url), "utf8"),
};

const tests = [];
function test(name, run) { tests.push({ name, run }); }

test("Merit thresholds remain authoritative", () => assert.deepEqual(
  CONTRIBUTOR_REPUTATION_THRESHOLDS.map(({ title, merit }) => [merit, title]),
  [[0, "初入藏经阁"], [100, "寻卷修士"], [500, "异兽录士"], [1500, "镇卷真人"], [5000, "守阁尊者"]],
));
test("0 Merit maps to 初入藏经阁", () => assert.equal(deriveContributorReputation(0).title, "初入藏经阁"));
test("99 Merit stays 初入藏经阁", () => assert.equal(deriveContributorReputation(99).title, "初入藏经阁"));
test("100 Merit maps to 寻卷修士", () => assert.equal(deriveContributorReputation(100).title, "寻卷修士"));
test("499 Merit stays 寻卷修士", () => assert.equal(deriveContributorReputation(499).title, "寻卷修士"));
test("500 Merit maps to 异兽录士", () => assert.equal(deriveContributorReputation(500).title, "异兽录士"));
test("1500 Merit maps to 镇卷真人", () => assert.equal(deriveContributorReputation(1500).title, "镇卷真人"));
test("5000 Merit maps to 守阁尊者", () => assert.equal(deriveContributorReputation(5000).title, "守阁尊者"));
test("max title is handled safely", () => {
  const result = deriveContributorReputation(50_000);
  assert.deepEqual([result.title, result.nextTitle, result.nextTitleMerit, result.meritToNextTitle, result.progressPercent], ["守阁尊者", null, null, 0, 100]);
});
test("93 Merit needs 7 for the next title", () => {
  const result = deriveContributorReputation(93);
  assert.deepEqual([result.nextTitle, result.meritToNextTitle, result.progressPercent], ["寻卷修士", 7, 93]);
});
test("186 Merit needs 314 for 异兽录士", () => {
  const result = deriveContributorReputation(186);
  assert.deepEqual([result.title, result.nextTitle, result.meritToNextTitle], ["寻卷修士", "异兽录士", 314]);
});
test("invalid Merit clamps safely", () => {
  assert.equal(deriveContributorReputation(-20).totalMerit, 0);
  assert.equal(deriveContributorReputation(Number.POSITIVE_INFINITY).progressPercent, 0);
});
test("Merit does not influence cultivator realm", () => {
  const realmBefore = cultivatorProgression(120).realm;
  deriveContributorReputation(0);
  deriveContributorReputation(5_000);
  assert.equal(cultivatorProgression(120).realm, realmBefore);
  assert.doesNotMatch(sources.reputation, /cultivator|totalExp|realmStartExp/u);
});
test("EXP does not influence contributor title", () => {
  const titleBefore = deriveContributorReputation(93).title;
  cultivatorProgression(0);
  cultivatorProgression(60_000);
  assert.equal(deriveContributorReputation(93).title, titleBefore);
});
test("profile loads cultivation and contribution data from existing APIs", () => {
  assert.match(sources.profile, /Promise\.all\(\[[\s\S]+getContributions[\s\S]+getMerit[\s\S]+getCultivationProfile/u);
});
test("cultivation card contains realm EXP mastery and badges", () => {
  assert.match(sources.profile, /修炼档案[\s\S]+当前境界[\s\S]+修为[\s\S]+五行熟练度[\s\S]+修炼徽记/u);
});
test("contribution card contains Merit title and unchanged statuses", () => {
  assert.match(sources.profile, /贡献档案[\s\S]+当前贡献称号[\s\S]+累计功德[\s\S]+已收录贡献[\s\S]+待守阁人审核[\s\S]+待返修[\s\S]+未通过/u);
});
test("shared authenticated wallet identity remains visible", () => {
  assert.match(sources.profile, /ProfileIdentityHeader[\s\S]+compactAddress\(walletAddress\)[\s\S]+AUTH_CHAIN_NAME/u);
  assert.match(sources.profile, /useWalletAuth\(\)/u);
});
test("desktop uses two profile columns and mobile stacks them", () => {
  assert.match(sources.styles, /\.dualProfileGrid\s*\{[\s\S]+grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/u);
  assert.match(sources.styles, /@media \(max-width: 760px\)[\s\S]+\.dualProfileGrid[\s\S]+grid-template-columns: minmax\(0,1fr\)/u);
  assert.match(sources.styles, /\.page\s*\{[\s\S]+overflow-x: clip/u);
});
test("Stage36.5 introduces no persistence or reviewer authorization", () => {
  assert.doesNotMatch(sources.reputation + sources.profile, /INSERT INTO|UPDATE merit_ledger|VERIFIER_ROLE|reviewerAllowlist/u);
});

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
console.log(`Contributor Profile Stage 36.5: ${passed}/${tests.length} PASS`);
