import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { createServer } from "vite";

import { buildHydrocarbonFromIupacName } from "../app/name-to-molecule.ts";
import { moleculeFromSmiles } from "../app/openchemlib-adapter.ts";

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

test("an alkane only shows the parent-chain step", () => {
  const result = buildHydrocarbonFromIupacName("butano");
  assert.equal(result.ok, true, result.ok ? undefined : result.error);
  const analysis = analyzeMolecule(result.molecule);
  const steps = buildIupacReasoningSteps(result.molecule, analysis);
  assert.deepEqual(steps.map((step) => step.number), ["02"]);
  assert.equal(steps[0].title, "Cadena principal");
});

test("functional priority appears before the parent and substituent rules", () => {
  const result = moleculeFromSmiles("CC(C)C(=O)O");
  assert.equal(result.ok, true, result.ok ? undefined : result.error);
  const analysis = analyzeMolecule(result.molecule);
  const steps = buildIupacReasoningSteps(result.molecule, analysis);
  assert.deepEqual(steps.map((step) => step.number), ["01", "02", "04"]);
  assert.match(steps[0].explanation, /ácido carboxílico/i);
  assert.match(steps[0].explanation, /localizador 1/i);
});

test("different substituents add locant and alphabetical-order steps", () => {
  const result = buildHydrocarbonFromIupacName("3-etil-2-metilhexano");
  assert.equal(result.ok, true, result.ok ? undefined : result.error);
  const analysis = analyzeMolecule(result.molecule);
  const steps = buildIupacReasoningSteps(result.molecule, analysis);
  assert.deepEqual(steps.map((step) => step.number), ["02", "04", "05"]);
  assert.match(steps.find((step) => step.number === "05").explanation, /etil → metil/i);
});

test("an E alkene adds multiple-bond and CIP stereochemistry steps", () => {
  const molecule = makeHex3EneE();
  const analysis = analyzeMolecule(molecule);
  const steps = buildIupacReasoningSteps(molecule, analysis);
  assert.deepEqual(steps.map((step) => step.number), ["02", "03", "06"]);
  assert.match(steps.find((step) => step.number === "03").explanation, /doble enlace.*C3/i);
  assert.match(steps.find((step) => step.number === "06").explanation, /3E.*lados opuestos/i);
});
