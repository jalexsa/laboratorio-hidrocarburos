import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const page = fs.readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("display controls are visible again", () => {
  const displayBlock = css.match(/\.display-options\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.match(displayBlock, /display:\s*flex;/);
  assert.doesNotMatch(displayBlock, /display:\s*none;/);
});

test("implicit-H toggle remains enabled in skeletal view", () => {
  assert.match(page, /const showHydrogenOnLabel = showHydrogens;/);
  assert.match(page, /checked=\{showHydrogens\} onChange=/);
  assert.doesNotMatch(page, /checked=\{showHydrogens\} disabled=\{viewMode === "skeletal"\}/);
});

test("numbering and substituent-highlight controls remain present", () => {
  assert.match(page, /setShowNumbering\(event\.target\.checked\)/);
  assert.match(page, /setHighlightSubstituents\(enabled\)/);
});
