import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { createServer } from "vite";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
let server;
let analyzeMolecule;
let buildIupacReasoningSteps;

before(async () => {
  server = await createServer({
    root: projectRoot,
    configFile: false,
    logLevel: "error",
    appType: "custom",
    plugins: [react()],
    server: { middlewareMode: true, hmr: false },
  });
  ({ analyzeMolecule, buildIupacReasoningSteps } = await server.ssrLoadModule("/app/page.tsx"));
});

after(async () => {
  await server?.close();
});

test("butanonitrilo is detected as a nitrile and not reduced to butane", () => {
  const molecule = {
    atoms: [
      { id: 1, x: 0, y: 0 },
      { id: 2, x: 1, y: 0 },
      { id: 3, x: 2, y: 0 },
      { id: 4, x: 3, y: 0 },
      { id: 5, x: 4, y: 0, element: "N" },
    ],
    bonds: [[1, 2, 1], [2, 3, 1], [3, 4, 1], [4, 5, 3]],
  };

  const analysis = analyzeMolecule(molecule);
  assert.equal(analysis.name, "butanonitrilo");
  assert.equal(analysis.primaryFunctionalGroup, "nitrile");
  assert.equal(analysis.primaryFunctionalLabel, "Nitrilo");
  assert.ok(analysis.functionalGroups.some((group) => group.kind === "nitrile"));

  const steps = buildIupacReasoningSteps(molecule, analysis);
  assert.match(steps.find((step) => step.number === "01")?.explanation ?? "", /nitrilo/i);
});

test("2-nitropropano is treated as a nitro substituent", () => {
  const molecule = {
    atoms: [
      { id: 1, x: 0, y: 0 },
      { id: 2, x: 1, y: 0 },
      { id: 3, x: 2, y: 0 },
      { id: 4, x: 1, y: 1, element: "N", charge: 1 },
      { id: 5, x: 0.5, y: 2, element: "O" },
      { id: 6, x: 1.5, y: 2, element: "O", charge: -1 },
    ],
    bonds: [[1, 2, 1], [2, 3, 1], [2, 4, 1], [4, 5, 2], [4, 6, 1]],
  };

  const analysis = analyzeMolecule(molecule);
  assert.equal(analysis.name, "2-nitropropano");
  assert.ok(analysis.functionalGroups.some((group) => group.kind === "nitro"));
  assert.ok(analysis.substituents.some((substituent) => substituent.name === "nitro" && substituent.locant === 2));

  const steps = buildIupacReasoningSteps(molecule, analysis);
  assert.match(steps.find((step) => step.number === "04")?.explanation ?? "", /nitro/i);
});


test("2-nitrobutano remains editable and receives the nitro prefix", () => {
  const molecule = {
    atoms: [
      { id: 1, x: 0, y: 0 },
      { id: 2, x: 1, y: 0 },
      { id: 3, x: 2, y: 0 },
      { id: 4, x: 3, y: 0 },
      { id: 5, x: 1, y: 1, element: "N", charge: 1 },
      { id: 6, x: 0.5, y: 2, element: "O" },
      { id: 7, x: 1.5, y: 2, element: "O", charge: -1 },
    ],
    bonds: [[1, 2, 1], [2, 3, 1], [3, 4, 1], [2, 5, 1], [5, 6, 2], [5, 7, 1]],
  };
  const analysis = analyzeMolecule(molecule);
  assert.equal(analysis.name, "2-nitrobutano");
  assert.equal(analysis.functionalGroups.filter((group) => group.kind === "nitro").length, 1);
});

test("pentanodinitrilo keeps both terminal nitriles in the principal chain", () => {
  const molecule = {
    atoms: [
      { id: 1, x: 0, y: 0, element: "N" },
      { id: 2, x: 1, y: 0 },
      { id: 3, x: 2, y: 0 },
      { id: 4, x: 3, y: 0 },
      { id: 5, x: 4, y: 0 },
      { id: 6, x: 5, y: 0 },
      { id: 7, x: 6, y: 0, element: "N" },
    ],
    bonds: [[1, 2, 3], [2, 3, 1], [3, 4, 1], [4, 5, 1], [5, 6, 1], [6, 7, 3]],
  };
  const analysis = analyzeMolecule(molecule);
  assert.equal(analysis.name, "pentanodinitrilo");
  assert.equal(analysis.primaryFunctionalGroup, "nitrile");
  assert.equal(analysis.functionalGroups.filter((group) => group.kind === "nitrile").length, 2);
});

test("4-nitroanilina uses the retained aromatic amine parent and recognizes nitro", () => {
  const atoms = Array.from({ length: 6 }, (_, index) => ({
    id: index + 1,
    x: Math.cos((index * Math.PI) / 3),
    y: Math.sin((index * Math.PI) / 3),
  }));
  atoms.push(
    { id: 7, x: 2, y: 0, element: "N" },
    { id: 8, x: -2, y: 0, element: "N", charge: 1 },
    { id: 9, x: -2.5, y: -1, element: "O" },
    { id: 10, x: -2.5, y: 1, element: "O", charge: -1 },
  );
  const molecule = {
    atoms,
    bonds: [
      [1, 2, 2], [2, 3, 1], [3, 4, 2], [4, 5, 1], [5, 6, 2], [6, 1, 1],
      [1, 7, 1], [4, 8, 1], [8, 9, 2], [8, 10, 1],
    ],
    rings: [{ id: 1, kind: "aromatic", atomIds: [1, 2, 3, 4, 5, 6] }],
  };
  const analysis = analyzeMolecule(molecule);
  assert.equal(analysis.name, "4-nitroanilina");
  assert.equal(analysis.primaryFunctionalGroup, "amine");
  assert.ok(analysis.functionalGroups.some((group) => group.kind === "nitro"));
  assert.ok(analysis.functionalGroups.some((group) => group.kind === "amine"));
});


test("N-substituted anilines keep nitrogen locants in local suggested names", () => {
  const makeAromatic = () => {
    const atoms = Array.from({ length: 6 }, (_, index) => ({
      id: index + 1,
      x: Math.cos((index * Math.PI) / 3),
      y: Math.sin((index * Math.PI) / 3),
    }));
    return {
      atoms,
      bonds: [[1, 2, 2], [2, 3, 1], [3, 4, 2], [4, 5, 1], [5, 6, 2], [6, 1, 1]],
      rings: [{ id: 1, kind: "aromatic", atomIds: [1, 2, 3, 4, 5, 6] }],
    };
  };

  const secondary = makeAromatic();
  secondary.atoms.push({ id: 7, x: 2, y: 0, element: "N" }, { id: 8, x: 3, y: 0 });
  secondary.bonds.push([1, 7, 1], [7, 8, 1]);
  assert.equal(analyzeMolecule(secondary).name, "N-metilanilina");

  const tertiary = makeAromatic();
  tertiary.atoms.push(
    { id: 7, x: 2, y: 0, element: "N" },
    { id: 8, x: 3, y: -0.5 },
    { id: 9, x: 3, y: 0.5 },
  );
  tertiary.bonds.push([1, 7, 1], [7, 8, 1], [7, 9, 1]);
  assert.equal(analyzeMolecule(tertiary).name, "N,N-dimetilanilina");
});

test("nitrile outranks amine and keeps amino as a prefix", () => {
  const molecule = {
    atoms: [
      { id: 1, x: 0, y: 0, element: "N" },
      { id: 2, x: 1, y: 0 },
      { id: 3, x: 2, y: 0 },
      { id: 4, x: 3, y: 0 },
      { id: 5, x: 4, y: 0 },
      { id: 6, x: 3, y: 1, element: "N" },
    ],
    bonds: [[1, 2, 3], [2, 3, 1], [3, 4, 1], [4, 5, 1], [4, 6, 1]],
  };
  const analysis = analyzeMolecule(molecule);
  assert.equal(analysis.name, "3-aminobutanonitrilo");
  assert.equal(analysis.primaryFunctionalGroup, "nitrile");
});
