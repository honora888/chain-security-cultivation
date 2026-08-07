import assert from "node:assert/strict";

import {
  createSampleBestiaryDraftName,
  SAMPLE_BESTIARY_NAME_ATTEMPTS,
} from "../src/features/guardian-security/sample-draft-name.ts";

const fingerprint = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const names = Array.from(
  { length: SAMPLE_BESTIARY_NAME_ATTEMPTS },
  (_, attempt) => createSampleBestiaryDraftName("Water", fingerprint, attempt),
);

assert.equal(names[0], "回环噬灵兽·0123456789AB");
assert.equal(new Set(names).size, SAMPLE_BESTIARY_NAME_ATTEMPTS);
assert.ok(names.every((name) => Array.from(name).length <= 40));
assert.ok(names.every((name) => name !== "噬灵回环兽"));
assert.equal(
  createSampleBestiaryDraftName("Water", fingerprint),
  createSampleBestiaryDraftName("Water", fingerprint),
);
assert.notEqual(
  createSampleBestiaryDraftName("Earth", fingerprint),
  createSampleBestiaryDraftName("Water", fingerprint),
);

console.log(`${names.length + 3}/${names.length + 3} sample bestiary naming checks passed`);
