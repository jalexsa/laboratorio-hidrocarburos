import assert from "node:assert/strict";
import test from "node:test";

import {
  formatStereochemicalName,
  getMainChainStereoDescriptors,
  inspectDoubleBondStereochemistry,
  toggleDoubleBondGeometry,
} from "../app/double-bond-stereochemistry.ts";
import { moleculeFromSmiles } from "../app/openchemlib-adapter.ts";

function makeHex3EneE() {
  return {
    atoms: [
      { id: 1, x: -2.5, y: 1.4 },
      { id: 2, x: -1.3, y: 0.8 },
      { id: 3, x: 0, y: 0 },
      { id: 4, x: 1.4, y: 0 },
      { id: 5, x: 2.7, y: -0.8 },
      { id: 6, x: 3.9, y: -1.4 },
    ],
    bonds: [
      [1, 2, 1],
      [2, 3, 1],
      [3, 4, 2],
      [4, 5, 1],
      [5, 6, 1],
    ],
  };
}

test("identifies and names a main-chain (3E) double bond", () => {
  const molecule = makeHex3EneE();
  const inspection = inspectDoubleBondStereochemistry(molecule, 3, 4);
  assert.equal(inspection.stereogenic, true);
  assert.equal(inspection.configuration, "E");
  assert.deepEqual(getMainChainStereoDescriptors(molecule, [1, 2, 3, 4, 5, 6]), [
    { atomIds: [3, 4], configuration: "E", locant: 3 },
  ]);
  assert.equal(
    formatStereochemicalName(molecule, [1, 2, 3, 4, 5, 6], "hex-3-eno"),
    "(3E)-hex-3-eno",
  );
});

test("clicking the double bond rotates one side and toggles E to Z and back", () => {
  const eMolecule = makeHex3EneE();
  const toZ = toggleDoubleBondGeometry(eMolecule, 3, 4);
  assert.equal(toZ.ok, true, toZ.ok ? undefined : toZ.error);
  assert.equal(toZ.configuration, "Z");
  assert.equal(
    formatStereochemicalName(toZ.molecule, [1, 2, 3, 4, 5, 6], "hex-3-eno"),
    "(3Z)-hex-3-eno",
  );
  assert.notEqual(toZ.molecule.atoms.find((atom) => atom.id === 5).y, -0.8);

  const backToE = toggleDoubleBondGeometry(toZ.molecule, 3, 4);
  assert.equal(backToE.ok, true, backToE.ok ? undefined : backToE.error);
  assert.equal(backToE.configuration, "E");
  assert.equal(
    formatStereochemicalName(backToE.molecule, [1, 2, 3, 4, 5, 6], "hex-3-eno"),
    "(3E)-hex-3-eno",
  );
});

test("does not assign E/Z when one alkene carbon has two equal substituents", () => {
  const propene = {
    atoms: [
      { id: 1, x: 0, y: 0 },
      { id: 2, x: 1.4, y: 0 },
      { id: 3, x: 2.6, y: -0.8 },
    ],
    bonds: [[1, 2, 2], [2, 3, 1]],
  };
  const inspection = inspectDoubleBondStereochemistry(propene, 1, 2);
  assert.equal(inspection.stereogenic, false);
  const toggle = toggleDoubleBondGeometry(propene, 1, 2);
  assert.equal(toggle.ok, false);
  assert.equal(toggle.reason, "not-stereogenic");
});

test("reads the E geometry produced by OPSIN and OpenChemLib", () => {
  const converted = moleculeFromSmiles("C(C)/C(/C=O)=C(\\CCC)/C");
  assert.equal(converted.ok, true, converted.ok ? undefined : converted.error);
  const inspection = inspectDoubleBondStereochemistry(converted.molecule, 3, 6);
  assert.equal(inspection.stereogenic, true);
  assert.equal(inspection.configuration, "E");
});

test("places stereodescriptors after the acid class name", () => {
  const molecule = makeHex3EneE();
  assert.equal(
    formatStereochemicalName(
      molecule,
      [1, 2, 3, 4, 5, 6],
      "ácido hex-3-enoico",
    ),
    "ácido (3E)-hex-3-enoico",
  );
});
