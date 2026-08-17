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
