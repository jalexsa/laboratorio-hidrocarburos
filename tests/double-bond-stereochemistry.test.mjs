import assert from "node:assert/strict";
import test from "node:test";

import {
  formatStereochemicalName,
  getAromaticStereochemicalNameOptions,
  getMainChainStereoDescriptors,
  inspectDoubleBondStereochemistry,
  toggleDoubleBondGeometry,
} from "../app/double-bond-stereochemistry.ts";
import { getBondInteractionHintActions } from "../app/bond-interaction-hints.ts";
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

test("excludes aromatic Kekulé C=C bonds from E/Z inspection and canvas hints", () => {
  const aromaticCases = [
    ["benceno", "c1ccccc1"],
    ["fenol", "Oc1ccccc1"],
    ["benceno-1,3,5-triol", "Oc1cc(O)cc(O)c1"],
    ["ácido 3-hidroxibenzoico", "O=C(O)c1cccc(O)c1"],
  ];

  for (const [name, smiles] of aromaticCases) {
    const converted = moleculeFromSmiles(smiles);
    assert.equal(converted.ok, true, `${name}: ${converted.ok ? "" : converted.error}`);
    if (!converted.ok) continue;
    const aromaticDoubleBond = converted.molecule.bonds.find(([leftAtomId, rightAtomId, order = 1]) =>
      order === 2 && converted.molecule.rings?.some(
        (ring) => ring.kind === "aromatic"
          && ring.atomIds.includes(leftAtomId)
          && ring.atomIds.includes(rightAtomId),
      ),
    );
    assert.ok(aromaticDoubleBond, `${name}: expected an aromatic Kekulé C=C bond`);
    assert.equal(
      inspectDoubleBondStereochemistry(
        converted.molecule,
        aromaticDoubleBond[0],
        aromaticDoubleBond[1],
      ).stereogenic,
      false,
      `${name}: aromatic C=C must not be an E/Z center`,
    );
    assert.equal(
      getBondInteractionHintActions(converted.molecule).includes("switch-ez"),
      false,
      `${name}: canvas must not advertise an E/Z switch`,
    );
  }
});

test("keeps E/Z hints available for valid acyclic alkenes", () => {
  for (const [name, smiles] of [
    ["hex-2-eno", "CC=CCCC"],
    ["hex-3-en-2-ona", "CC(=O)C=CCC"],
  ]) {
    const converted = moleculeFromSmiles(smiles);
    assert.equal(converted.ok, true, `${name}: ${converted.ok ? "" : converted.error}`);
    if (!converted.ok) continue;
    assert.equal(
      getBondInteractionHintActions(converted.molecule).includes("switch-ez"),
      true,
      `${name}: canvas must keep its E/Z switch`,
    );
  }
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

test("offers a clean default and a technical E/Z view for aromatic names", () => {
  assert.deepEqual(
    getAromaticStereochemicalNameOptions(
      "(1E,3E,5E)-benceno-1,3,5-triol",
      "aromatic",
    ),
    {
      standardName: "benceno-1,3,5-triol",
      technicalName: "(1E,3E,5E)-benceno-1,3,5-triol",
      descriptors: ["1E", "3E", "5E"],
    },
  );
});

test("does not hide E/Z descriptors from non-aromatic alkenes", () => {
  assert.equal(
    getAromaticStereochemicalNameOptions("(3E)-hex-3-eno", "acyclic"),
    null,
  );
});
