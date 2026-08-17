import assert from "node:assert/strict";
import test from "node:test";

import { readSmilesFileRecord } from "../app/smiles-file.ts";

test("reads a plain one-line SMILES file", () => {
  const record = readSmilesFileRecord("CCO\n");
  assert.equal(record.smiles, "CCO");
  assert.equal(record.label, undefined);
  assert.equal(record.ignoredRecordCount, 0);
});

test("accepts a conventional .smi record with a trailing molecule label", () => {
  const record = readSmilesFileRecord("CC(=O)O acetic acid\n");
  assert.equal(record.smiles, "CC(=O)O");
  assert.equal(record.label, "acetic acid");
});

test("ignores comments and reports additional records", () => {
  const record = readSmilesFileRecord("# exported list\nCCO ethanol\nCCN ethylamine\n");
  assert.equal(record.smiles, "CCO");
  assert.equal(record.ignoredRecordCount, 1);
});

test("rejects an empty SMILES file", () => {
  assert.throws(() => readSmilesFileRecord("\n# only a comment\n"), /SMILES/);
});
