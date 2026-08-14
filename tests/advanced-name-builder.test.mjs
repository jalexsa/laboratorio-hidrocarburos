import assert from "node:assert/strict";
import test from "node:test";

import {
  getOpsinNameCandidates,
  translateSpanishIupacToOpsin,
} from "../app/iupac-name-normalization.ts";
import { moleculeFromSmiles } from "../app/openchemlib-adapter.ts";

test("translates Spanish functional-group names into OPSIN candidates", () => {
  assert.equal(
    translateSpanishIupacToOpsin("ácido 2-metilpropanoico"),
    "2-methylpropanoic acid",
  );
  assert.equal(
    translateSpanishIupacToOpsin("etanoato de metilo"),
    "methyl ethanoate",
  );
  assert.equal(
    translateSpanishIupacToOpsin("benceno-1,3,5-triol"),
    "benzene-1,3,5-triol",
  );
  assert.equal(translateSpanishIupacToOpsin("butan-2-ona"), "butan-2-one");
});

test("keeps both translated and original OPSIN candidates", () => {
  assert.deepEqual(getOpsinNameCandidates("Etanamida"), ["ethanamide", "etanamida"]);
  assert.deepEqual(getOpsinNameCandidates("propan-2-ol"), ["propan-2-ol"]);
});

test("OpenChemLib turns functional-group SMILES into editable canvas atoms", () => {
  const acid = moleculeFromSmiles("CC(C)C(=O)O");
  assert.equal(acid.ok, true, acid.ok ? undefined : acid.error);
  assert.equal(acid.molecule.atoms.filter((atom) => atom.element === "O").length, 2);
  assert.ok(acid.molecule.bonds.some((bond) => bond[2] === 2));

  const amide = moleculeFromSmiles("CC(=O)N");
  assert.equal(amide.ok, true, amide.ok ? undefined : amide.error);
  assert.equal(amide.molecule.atoms.filter((atom) => atom.element === "N").length, 1);
});

test("OpenChemLib preserves an aromatic carbon ring for the simulator", () => {
  const triol = moleculeFromSmiles("Oc1cc(O)cc(O)c1");
  assert.equal(triol.ok, true, triol.ok ? undefined : triol.error);
  assert.equal(triol.molecule.rings?.[0].kind, "aromatic");
  assert.equal(triol.molecule.rings?.[0].atomIds.length, 6);
  assert.equal(triol.molecule.atoms.filter((atom) => atom.element === "O").length, 3);
});

