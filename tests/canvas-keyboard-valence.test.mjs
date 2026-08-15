import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { createServer } from "vite";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
let server;
let findBondValenceViolation;
let findDirectionalNeighborId;
let findMoleculeValenceViolation;
let formatBondValenceError;
let getAtomValenceViolation;

before(async () => {
  server = await createServer({
    root: projectRoot,
    configFile: false,
    logLevel: "error",
    appType: "custom",
    plugins: [react()],
    server: { middlewareMode: true, hmr: false },
  });
  ({
    findBondValenceViolation,
    findDirectionalNeighborId,
    findMoleculeValenceViolation,
    formatBondValenceError,
    getAtomValenceViolation,
  } = await server.ssrLoadModule("/app/page.tsx"));
});

after(async () => {
  await server?.close();
});

test("blocks a triple bond when the selected carbon is already tetravalent", () => {
  const molecule = {
    atoms: [
      { id: 1, x: -1, y: 0 },
      { id: 2, x: 0, y: 0 },
      { id: 3, x: 1, y: 0 },
      { id: 4, x: 0, y: 1 },
    ],
    bonds: [[1, 2, 1], [2, 3, 2], [2, 4, 1]],
  };
  const violation = findBondValenceViolation(molecule, 2, 1, 3, 1);
  assert.ok(violation);
  assert.equal(violation.current, 4);
  assert.equal(
    formatBondValenceError(3, violation),
    "No se puede añadir un enlace triple en el Carbono 2 porque ya tiene 4 enlaces.",
  );
});

test("reports oxygen saturation with its two-link maximum", () => {
  const molecule = {
    atoms: [
      { id: 1, x: -1, y: 0 },
      { id: 2, x: 0, y: 0, element: "O" },
      { id: 3, x: 1, y: 0 },
    ],
    bonds: [[1, 2, 1], [2, 3, 1]],
  };
  const violation = getAtomValenceViolation(molecule, 2, 1);
  assert.ok(violation);
  assert.equal(violation.limit, 2);
  assert.match(formatBondValenceError(1, violation), /Oxígeno 2.*ya tiene 2 enlaces/);
});

test("allows lowering a bond order and detects invalid imported structures", () => {
  const molecule = {
    atoms: [
      { id: 1, x: 0, y: 0 },
      { id: 2, x: 1, y: 0 },
      { id: 3, x: 0, y: 1 },
    ],
    bonds: [[1, 2, 3], [1, 3, 2]],
  };
  assert.equal(findBondValenceViolation(molecule, 1, 2, 1, 3), null);
  const violation = findMoleculeValenceViolation(molecule);
  assert.equal(violation?.atomId, 1);
  assert.equal(violation?.attempted, 5);
});

test("chooses the neighbor that matches each horizontal arrow", () => {
  const molecule = {
    atoms: [
      { id: 1, x: -1, y: 0.1 },
      { id: 2, x: 0, y: 0 },
      { id: 3, x: 1, y: -0.1 },
      { id: 4, x: 0, y: 1 },
    ],
    bonds: [[1, 2, 1], [2, 3, 1], [2, 4, 1]],
  };
  assert.equal(findDirectionalNeighborId(molecule, 2, -1, 0), 1);
  assert.equal(findDirectionalNeighborId(molecule, 2, 1, 0), 3);
});
