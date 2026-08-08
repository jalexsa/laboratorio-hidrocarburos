import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { createServer } from "vite";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
let server;
let analyzeMolecule;
let getSingleRingUnsaturationNameOption;

before(async () => {
  server = await createServer({
    root: projectRoot,
    configFile: false,
    logLevel: "error",
    appType: "custom",
    plugins: [react()],
    server: { middlewareMode: true },
  });
  ({ analyzeMolecule, getSingleRingUnsaturationNameOption } = await server.ssrLoadModule("/app/page.tsx"));
});

after(async () => {
  await server?.close();
});

test("ordena isopropil antes que metil cuando se usa el nombre común", () => {
  const molecule = {
    atoms: [
      { id: 1, x: 0, y: -1 },
      { id: 2, x: 1, y: -0.5 },
      { id: 3, x: 1, y: 0.5 },
      { id: 4, x: 0, y: 1 },
      { id: 5, x: -1, y: 0.5 },
      { id: 6, x: -1, y: -0.5 },
      { id: 7, x: 2, y: 0.2 },
      { id: 8, x: 2, y: 0.9 },
      { id: 9, x: -2, y: 0.9 },
      { id: 10, x: -2, y: -0.8 },
      { id: 11, x: -3, y: -1.2 },
      { id: 12, x: -2, y: -1.8 },
    ],
    bonds: [
      [1, 2, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 1],
      [3, 7], [3, 8], [5, 9], [6, 10], [10, 11], [10, 12],
    ],
    rings: [{ id: 1, kind: "cycloalkane", atomIds: [1, 2, 3, 4, 5, 6] }],
  };

  const systematic = analyzeMolecule(molecule);
  const common = analyzeMolecule(molecule, ["1-metiletil"]);

  assert.equal(systematic.name, "3,3,5-trimetil-6-(1-metiletil)ciclohex-1-eno");
  assert.equal(common.name, "6-isopropil-3,3,5-trimetilciclohex-1-eno");
});

test("ordena etil antes que metil e ignora tri- para alfabetizar", () => {
  const molecule = {
    atoms: [
      { id: 1, x: 0, y: 0 }, { id: 2, x: 1, y: 0 },
      { id: 3, x: 2, y: 0 }, { id: 4, x: 3, y: 0 },
      { id: 5, x: 4, y: 0 }, { id: 6, x: 5, y: 0 },
      { id: 7, x: 1, y: -1 }, { id: 8, x: 2, y: 1 },
      { id: 9, x: 2, y: 2 },
    ],
    bonds: [
      [1, 2], [2, 3], [3, 4], [4, 5], [5, 6],
      [2, 7], [3, 8], [8, 9],
    ],
  };

  assert.equal(analyzeMolecule(molecule).name, "3-etil-2-metilhexano");
});

test("mantiene alternable un único sustituyente isopropil en un ciclo", () => {
  const molecule = {
    atoms: [
      { id: 1, x: 0, y: -1 }, { id: 2, x: 1, y: -0.5 },
      { id: 3, x: 1, y: 0.5 }, { id: 4, x: 0, y: 1 },
      { id: 5, x: -1, y: 0.5 }, { id: 6, x: -1, y: -0.5 },
      { id: 7, x: 0, y: -2 }, { id: 8, x: -0.7, y: -2.7 },
      { id: 9, x: 0.7, y: -2.7 },
    ],
    bonds: [
      [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 1],
      [1, 7], [7, 8], [7, 9],
    ],
    rings: [{ id: 1, kind: "cycloalkane", atomIds: [1, 2, 3, 4, 5, 6] }],
  };

  assert.equal(analyzeMolecule(molecule).name, "(1-metiletil)ciclohexano");
  assert.equal(analyzeMolecule(molecule, ["1-metiletil"]).name, "isopropilciclohexano");
});

function makeUnsaturatedRing(bondOrders) {
  const atoms = Array.from({ length: 6 }, (_, index) => ({
    id: index + 1,
    x: Math.cos((index * Math.PI) / 3),
    y: Math.sin((index * Math.PI) / 3),
  }));
  const bonds = atoms.map((atom, index) => [
    atom.id,
    atoms[(index + 1) % atoms.length].id,
    bondOrders[index] ?? 1,
  ]);
  return {
    atoms,
    bonds,
    rings: [{ id: 1, kind: "cycloalkane", atomIds: atoms.map((atom) => atom.id) }],
  };
}

test("permite omitir el localizador 1 en un ciclo con un solo doble enlace", () => {
  const analysis = analyzeMolecule(makeUnsaturatedRing([2, 1, 1, 1, 1, 1]));
  assert.equal(analysis.chainName, "ciclohex-1-eno");
  assert.deepEqual(getSingleRingUnsaturationNameOption(analysis), {
    systematic: "ciclohex-1-eno",
    simplified: "ciclohexeno",
    bondKind: "doble",
  });
});

test("permite omitir el localizador 1 en un ciclo con un solo triple enlace", () => {
  const analysis = analyzeMolecule(makeUnsaturatedRing([3, 1, 1, 1, 1, 1]));
  assert.equal(analysis.chainName, "ciclohex-1-ino");
  assert.deepEqual(getSingleRingUnsaturationNameOption(analysis), {
    systematic: "ciclohex-1-ino",
    simplified: "ciclohexino",
    bondKind: "triple",
  });
});

test("conserva los localizadores cuando el ciclo tiene varias insaturaciones", () => {
  const analysis = analyzeMolecule(makeUnsaturatedRing([2, 1, 2, 1, 1, 1]));
  assert.equal(analysis.chainName, "ciclohexa-1,3-dieno");
  assert.equal(getSingleRingUnsaturationNameOption(analysis), undefined);
});
