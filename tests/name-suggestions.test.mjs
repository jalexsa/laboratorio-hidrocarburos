import assert from "node:assert/strict";
import test from "node:test";

import {
  findCommonNameSuggestion,
  levenshteinDistance,
} from "../app/name-suggestions.ts";
import { getVisibleBondInteractionHintActions } from "../app/bond-interaction-hints.ts";

test("suggests close spellings from the common molecule catalog in both languages", () => {
  assert.deepEqual(findCommonNameSuggestion("fenool", "es"), { id: "phenol", name: "fenol" });
  assert.deepEqual(findCommonNameSuggestion("benzeno", "en"), { id: "benzene", name: "benzene" });
  assert.deepEqual(findCommonNameSuggestion("ciclohexno", "es"), { id: "cyclohexane", name: "ciclohexano" });
  assert.deepEqual(findCommonNameSuggestion("ethnol", "en"), { id: "ethanol", name: "ethanol" });
});

test("includes the ten requested common molecule families", () => {
  for (const [input, id] of [
    ["bencenoo", "benzene"],
    ["fenool", "phenol"],
    ["ciclohexno", "cyclohexane"],
    ["etanlo", "ethanol"],
    ["propanlo", "propanol"],
    ["butanlo", "butanol"],
    ["hexnao", "hexane"],
    ["hexenoo", "hexene"],
    ["propenno", "propene"],
    ["butenoo", "butene"],
  ]) {
    assert.equal(findCommonNameSuggestion(input, "es")?.id, id, input);
  }
});

test("does not offer broad suggestions for unrelated or exact input", () => {
  assert.equal(findCommonNameSuggestion("glucosa", "es"), null);
  assert.equal(findCommonNameSuggestion("benceno", "es"), null);
  assert.equal(findCommonNameSuggestion("xy", "es"), null);
});

test("calculates standard edit distance after normalizing accents and punctuation", () => {
  assert.equal(levenshteinDistance("ácido", "acido"), 0);
  assert.equal(levenshteinDistance("hex-1-eno", "hexeno"), 1);
});

test("hides only the E/Z canvas hint while stereochemistry is off", () => {
  const actions = ["change-order", "switch-ez"];
  assert.deepEqual(getVisibleBondInteractionHintActions(actions, false), ["change-order"]);
  assert.deepEqual(getVisibleBondInteractionHintActions(actions, true), actions);
});
