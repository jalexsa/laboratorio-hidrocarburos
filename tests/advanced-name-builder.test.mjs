import assert from "node:assert/strict";
import test from "node:test";

import {
  getOpsinNameCandidates,
  translateSpanishIupacToOpsin,
} from "../app/iupac-name-normalization.ts";
import { moleculeFromSmiles } from "../app/openchemlib-adapter.ts";
import { resolveNameWithOpsin } from "../app/opsin-name-resolver.ts";

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
  assert.equal(
    translateSpanishIupacToOpsin("(2E)-2-etil-3-metilhex-2-enal"),
    "(2E)-2-ethyl-3-methylhex-2-enal",
  );
  assert.equal(
    translateSpanishIupacToOpsin("3-(2-oxopropil)ciclohexanona"),
    "3-(2-oxopropyl)cyclohexanone",
  );
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

test("the reported complex names become editable OpenChemLib molecules", () => {
  const enal = moleculeFromSmiles("C(C)/C(/C=O)=C(\\CCC)/C");
  assert.equal(enal.ok, true, enal.ok ? undefined : enal.error);
  assert.equal(enal.molecule.atoms.length, 10);
  assert.equal(enal.molecule.atoms.filter((atom) => atom.element === "O").length, 1);

  const cyclicDiketone = moleculeFromSmiles("O=C(CC1CC(CCC1)=O)C");
  assert.equal(cyclicDiketone.ok, true, cyclicDiketone.ok ? undefined : cyclicDiketone.error);
  assert.equal(cyclicDiketone.molecule.rings?.[0].atomIds.length, 6);
  assert.equal(cyclicDiketone.molecule.atoms.filter((atom) => atom.element === "O").length, 2);
});

test("the browser resolver uses OPSIN directly and preserves stereodescriptors", async () => {
  const requestedUrls = [];
  const result = await resolveNameWithOpsin("(2E)-2-etil-3-metilhex-2-enal", {
    fetchImpl: async (url) => {
      requestedUrls.push(String(url));
      return Response.json({
        status: "SUCCESS",
        smiles: "C(C)/C(/C=O)=C(\\CCC)/C",
        warnings: [],
      });
    },
  });

  assert.equal(result.ok, true);
  assert.match(requestedUrls[0], /\(2E\)-2-ethyl-3-methylhex-2-enal\.json$/);
});

test("known classroom names still resolve when the network is unavailable", async () => {
  const result = await resolveNameWithOpsin("3-(2-oxopropil)ciclohexanona", {
    fetchImpl: async () => {
      throw new TypeError("Failed to fetch");
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.source, "integrated-fallback");
  assert.equal(result.value.smiles, "O=C(CC1CC(CCC1)=O)C");
});
