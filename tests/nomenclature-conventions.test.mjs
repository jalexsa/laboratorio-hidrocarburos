import assert from "node:assert/strict";
import test from "node:test";

import {
  applyNomenclatureConvention,
  nextNomenclatureConvention,
  stripStereochemicalDescriptors,
} from "../app/nomenclature-conventions.ts";
import {
  formatStereochemicalName,
  getMainChainStereoDescriptors,
} from "../app/double-bond-stereochemistry.ts";

function makeAromaticRing() {
  return {
    atoms: [1, 2, 3, 4, 5, 6].map((id) => ({ id, x: id, y: id % 2 })),
    bonds: [[1, 2, 2], [2, 3, 1], [3, 4, 2], [4, 5, 1], [5, 6, 2], [6, 1, 1]],
    rings: [{ id: 1, kind: "aromatic", atomIds: [1, 2, 3, 4, 5, 6] }],
  };
}

function makeHex3Ene() {
  return {
    atoms: [
      { id: 1, x: -2.5, y: 1.4 },
      { id: 2, x: -1.3, y: 0.8 },
      { id: 3, x: 0, y: 0 },
      { id: 4, x: 1.4, y: 0 },
      { id: 5, x: 2.7, y: -0.8 },
      { id: 6, x: 3.9, y: -1.4 },
    ],
    bonds: [[1, 2, 1], [2, 3, 1], [3, 4, 2], [4, 5, 1], [5, 6, 1]],
  };
}

test("formats alkene and alkyne conventions without molecule lookup tables", () => {
  assert.equal(applyNomenclatureConvention("pent-2-ene", "school", "es"), "penta-2-ene");
  assert.equal(applyNomenclatureConvention("pent-2-ene", "traditional", "en"), "2-pentene");
  assert.equal(applyNomenclatureConvention("hex-2-yne", "school", "es"), "hexa-2-yne");
  assert.equal(applyNomenclatureConvention("hex-2-yne", "traditional", "en"), "2-hexyne");
});

test("keeps alcohol, ketone, amine, and acid suffixes systematic", () => {
  assert.equal(applyNomenclatureConvention("propan-2-ol", "school", "es"), "propan-2-ol");
  assert.equal(applyNomenclatureConvention("propan-2-ol", "traditional", "en"), "2-propanol");
  assert.equal(applyNomenclatureConvention("hexan-3-one", "traditional", "en"), "3-hexanone");
  assert.equal(applyNomenclatureConvention("butan-2-amine", "traditional", "en"), "2-butanamine");
  assert.equal(applyNomenclatureConvention("2-methylpropanoic acid", "traditional", "en"), "2-methylpropanoic acid");
});

test("preserves E/Z independently from the nomenclature convention", () => {
  assert.equal(applyNomenclatureConvention("(2E)-pent-2-ene", "school", "es"), "(2E)-penta-2-ene");
  assert.equal(applyNomenclatureConvention("(2E)-pent-2-ene", "traditional", "en"), "(2E)-2-pentene");
  assert.equal(stripStereochemicalDescriptors("(2Z)-pent-2-ene"), "pent-2-ene");
  assert.equal(stripStereochemicalDescriptors("ácido (2E)-hex-2-enoico"), "ácido hex-2-enoico");
});

test("uses the language-specific convention cycle", () => {
  assert.equal(nextNomenclatureConvention("current", "es"), "school");
  assert.equal(nextNomenclatureConvention("school", "es"), "traditional");
  assert.equal(nextNomenclatureConvention("current", "en"), "traditional");
  assert.equal(nextNomenclatureConvention("traditional", "en"), "current");
});

test("never displays E/Z for benzene-derived aromatic rings", () => {
  for (const name of [
    "benceno",
    "fenol",
    "benceno-1,3,5-triol",
    "ácido 3-hidroxibenzoico",
  ]) {
    const molecule = makeAromaticRing();
    assert.deepEqual(getMainChainStereoDescriptors(molecule, [1, 2, 3, 4, 5, 6]), [], name);
    assert.equal(
      formatStereochemicalName(molecule, [1, 2, 3, 4, 5, 6], name),
      name,
      name,
    );
  }
});

test("keeps E/Z available for a valid acyclic alkene", () => {
  const molecule = makeHex3Ene();
  assert.deepEqual(getMainChainStereoDescriptors(molecule, [1, 2, 3, 4, 5, 6]), [
    { atomIds: [3, 4], configuration: "E", locant: 3 },
  ]);
  assert.equal(
    formatStereochemicalName(molecule, [1, 2, 3, 4, 5, 6], "hex-3-eno"),
    "(3E)-hex-3-eno",
  );
});
