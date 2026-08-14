import assert from "node:assert/strict";
import test from "node:test";

import { buildHydrocarbonFromIupacName } from "../app/name-to-molecule.ts";

function build(name) {
  const result = buildHydrocarbonFromIupacName(name);
  assert.equal(result.ok, true, result.ok ? undefined : result.error);
  return result;
}

test("builds a branched alkane from its IUPAC name", () => {
  const result = build("3-etil-2-metilhexano");
  assert.equal(result.molecule.atoms.length, 9);
  assert.equal(result.molecule.bonds.length, 8);
});

test("places a multiple bond at the requested locant", () => {
  const result = build("hex-2-eno");
  assert.deepEqual(
    result.molecule.bonds.find(([left, right]) => left === 2 && right === 3),
    [2, 3, 2],
  );
});

test("builds cyclic and aromatic hydrocarbons", () => {
  const cycloalkane = build("1,4-dimetilciclohexano");
  assert.equal(cycloalkane.molecule.rings?.[0].kind, "cycloalkane");
  assert.equal(cycloalkane.molecule.atoms.length, 8);

  const toluene = build("tolueno");
  assert.equal(toluene.molecule.rings?.[0].kind, "aromatic");
  assert.equal(toluene.molecule.atoms.length, 7);
});

test("recognizes common and systematic branched substituent forms", () => {
  const common = build("4-isopropiloctano");
  const systematic = build("4-(propan-2-il)octano");
  assert.equal(common.molecule.atoms.length, 11);
  assert.equal(systematic.molecule.atoms.length, 11);
  assert.deepEqual(common.enabledAliases, ["1-metiletil"]);
});

test("builds aromatic and acyclic alcohols from their IUPAC names", () => {
  const triol = build("benceno-1,3,5-triol");
  const oxygenAtoms = triol.molecule.atoms.filter((atom) => atom.element === "O");
  assert.equal(triol.molecule.rings?.[0].kind, "aromatic");
  assert.equal(oxygenAtoms.length, 3);
  assert.deepEqual(
    triol.molecule.bonds
      .filter((bond) => oxygenAtoms.some((atom) => bond.includes(atom.id)))
      .map(([carbonId]) => carbonId)
      .sort((left, right) => left - right),
    [1, 3, 5],
  );

  const alcohol = build("propan-2-ol");
  assert.equal(alcohol.molecule.atoms.filter((atom) => atom.element === "O").length, 1);
  assert.ok(alcohol.molecule.bonds.some(([left, right]) => left === 2 && right === 4));
});

test("recognizes phenol as the single-hydroxyl aromatic alias", () => {
  const phenol = build("fenol");
  assert.equal(phenol.molecule.rings?.[0].kind, "aromatic");
  assert.equal(phenol.molecule.atoms.filter((atom) => atom.element === "O").length, 1);
});

test("rejects structures that would exceed carbon valence", () => {
  const result = buildHydrocarbonFromIupacName("2,2,2-trimetilpropano");
  assert.equal(result.ok, false);
  assert.match(result.error, /valencia 4/i);
});
