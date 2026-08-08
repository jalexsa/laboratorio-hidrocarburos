"use client";

import { useEffect, useMemo, useState } from "react";

type CarbonAtom = {
  id: number;
  x: number;
  y: number;
};

type BondOrder = 1 | 2 | 3;

type Bond = [number, number, BondOrder?];

type RingKind = "cycloalkane" | "aromatic";

type RingInfo = {
  id: number;
  kind: RingKind;
  atomIds: number[];
};

type Molecule = {
  atoms: CarbonAtom[];
  bonds: Bond[];
  rings?: RingInfo[];
};

type ViewMode = "condensed" | "skeletal";
type ThemePreference = "auto" | "light" | "dark";
type RingInsertMode = "replace" | "attach";

type AlkylTemplate = {
  id: string;
  label: string;
  systematic: string;
  formula: string;
  atoms: { x: number; y: number }[];
  connections: [number, number][];
};

type RingTemplate = {
  id: string;
  label: string;
  formula: string;
  detail: string;
  size: number;
  kind: RingKind;
  molecule: Molecule;
};

type NamedSubstituent = {
  locant: number;
  name: string;
  sortName: string;
  complex: boolean;
  atomIds: number[];
};

type Analysis = {
  name: string;
  commonName?: string;
  formula: string;
  family: "acyclic" | RingKind | "polycyclic";
  mainChain: number[];
  chainName: string;
  substituents: NamedSubstituent[];
  numberedAtoms: Map<number, number>;
  doubleBondLocants: number[];
  tripleBondLocants: number[];
};

const alkaneRoots = [
  "",
  "met",
  "et",
  "prop",
  "but",
  "pent",
  "hex",
  "hept",
  "oct",
  "non",
  "dec",
  "undec",
  "dodec",
  "tridec",
  "tetradec",
  "pentadec",
  "hexadec",
  "heptadec",
  "octadec",
  "nonadec",
  "eicos",
];

const alkylNames = [
  "",
  "metil",
  "etil",
  "propil",
  "butil",
  "pentil",
  "hexil",
  "heptil",
  "octil",
  "nonil",
  "decil",
  "undecil",
  "dodecil",
  "tridecil",
  "tetradecil",
  "pentadecil",
  "hexadecil",
  "heptadecil",
  "octadecil",
  "nonadecil",
  "eicosil",
];

const simplePrefixes = ["", "", "di", "tri", "tetra", "penta", "hexa", "hepta", "octa"];
const complexPrefixes = ["", "", "bis", "tris", "tetrakis", "pentakis", "hexakis"];

const commonAlkylAliases = {
  "1-metiletil": "isopropil",
  "2-metilpropil": "isobutil",
  "1-metilpropil": "sec-butil",
  "1,1-dimetiletil": "terc-butil",
} as const;

const simpleAliasPrefixes: Record<string, string> = {
  bis: "di",
  tris: "tri",
  tetrakis: "tetra",
  pentakis: "penta",
  hexakis: "hexa",
};

type InteractiveNamePart = {
  text: string;
  systematic?: keyof typeof commonAlkylAliases;
  common?: string;
  active?: boolean;
};

function getInteractiveNameParts(
  name: string,
  enabledAliases: readonly string[],
): InteractiveNamePart[] {
  const aliasNames = Object.keys(commonAlkylAliases)
    .map((item) => item.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  const pattern = new RegExp(
    `((bis|tris|tetrakis|pentakis|hexakis)?\\((${aliasNames})\\))`,
    "g",
  );
  const enabled = new Set(enabledAliases);
  const parts: InteractiveNamePart[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(name)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: name.slice(lastIndex, match.index) });
    }
    const systematic = match[3] as keyof typeof commonAlkylAliases;
    const common = commonAlkylAliases[systematic];
    const active = enabled.has(systematic);
    const prefix = match[2] ? simpleAliasPrefixes[match[2]] ?? "" : "";
    parts.push({
      text: active ? `${prefix}${common}` : match[0],
      systematic,
      common,
      active,
    });
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < name.length) parts.push({ text: name.slice(lastIndex) });
  return parts.length ? parts : [{ text: name }];
}

const subscriptDigits: Record<string, string> = {
  "0": "₀",
  "1": "₁",
  "2": "₂",
  "3": "₃",
  "4": "₄",
  "5": "₅",
  "6": "₆",
  "7": "₇",
  "8": "₈",
  "9": "₉",
};

const toSubscript = (value: number) =>
  String(value)
    .split("")
    .map((digit) => subscriptDigits[digit])
    .join("");

const getBondOrder = (bond: Bond): BondOrder => bond[2] ?? 1;

const getBondOrderLabel = (order: BondOrder) =>
  order === 1 ? "simple" : order === 2 ? "doble" : "triple";

const bondKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

const getValenceUsed = (atomId: number, molecule: Molecule) =>
  molecule.bonds.reduce(
    (total, bond) => total + (bond[0] === atomId || bond[1] === atomId ? getBondOrder(bond) : 0),
    0,
  );

const makeChain = (length: number): Molecule => ({
  atoms: Array.from({ length }, (_, index) => ({ id: index + 1, x: index, y: 0 })),
  bonds: Array.from({ length: Math.max(0, length - 1) }, (_, index) => [index + 1, index + 2]),
});

function makeRing(size: number, kind: RingKind): Molecule {
  const atomIds = Array.from({ length: size }, (_, index) => index + 1);
  const atoms = atomIds.map((id, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / size;
    return {
      id,
      x: Math.cos(angle) * 1.35,
      y: Math.sin(angle) * 1.65,
    };
  });
  const bonds = atomIds.map((atomId, index) => {
    const nextId = atomIds[(index + 1) % size];
    const order: BondOrder = kind === "aromatic" && index % 2 === 0 ? 2 : 1;
    return [atomId, nextId, order] as Bond;
  });
  return { atoms, bonds, rings: [{ id: 1, kind, atomIds }] };
}

function makeSubstitutedRing(
  kind: RingKind,
  substitutions: { ringIndex: number; length: number }[],
): Molecule {
  const molecule = makeRing(6, kind);
  let nextId = 7;

  substitutions.forEach(({ ringIndex, length }) => {
    const ringAtom = molecule.atoms[ringIndex];
    let previousId = ringAtom.id;
    for (let index = 0; index < length; index += 1) {
      const scale = 1 + 0.65 * (index + 1);
      const atom = { id: nextId, x: ringAtom.x * scale, y: ringAtom.y * scale };
      molecule.atoms.push(atom);
      molecule.bonds.push([previousId, nextId, 1]);
      previousId = nextId;
      nextId += 1;
    }
  });

  return molecule;
}

function ringContainingAtom(molecule: Molecule, atomId: number) {
  return molecule.rings?.find((ring) => ring.atomIds.includes(atomId));
}

function attachRingToMolecule(
  molecule: Molecule,
  selectedId: number,
  size: number,
  kind: RingKind,
): { molecule: Molecule; attachmentId: number } | null {
  const selectedAtom = molecule.atoms.find((atom) => atom.id === selectedId);
  if (!selectedAtom || getValenceUsed(selectedId, molecule) >= 4) return null;

  const selectedScreen = { x: selectedAtom.x * 130, y: selectedAtom.y * 106 };
  const sourceRing = ringContainingAtom(molecule, selectedId);
  const referenceAtoms = sourceRing
    ? molecule.atoms.filter((atom) => sourceRing.atomIds.includes(atom.id))
    : molecule.atoms;
  const referenceCenter = referenceAtoms.reduce(
    (total, atom) => ({
      x: total.x + (atom.x * 130) / referenceAtoms.length,
      y: total.y + (atom.y * 106) / referenceAtoms.length,
    }),
    { x: 0, y: 0 },
  );
  const outwardLength = Math.hypot(
    selectedScreen.x - referenceCenter.x,
    selectedScreen.y - referenceCenter.y,
  ) || 1;
  const outward = {
    x: (selectedScreen.x - referenceCenter.x) / outwardLength,
    y: (selectedScreen.y - referenceCenter.y) / outwardLength,
  };
  const directions = [
    { x: 1, y: 0 },
    { x: Math.SQRT1_2, y: Math.SQRT1_2 },
    { x: 0, y: 1 },
    { x: -Math.SQRT1_2, y: Math.SQRT1_2 },
    { x: -1, y: 0 },
    { x: -Math.SQRT1_2, y: -Math.SQRT1_2 },
    { x: 0, y: -1 },
    { x: Math.SQRT1_2, y: -Math.SQRT1_2 },
  ].sort(
    (left, right) => right.x * outward.x + right.y * outward.y - (left.x * outward.x + left.y * outward.y),
  );

  const occupied = molecule.atoms.map((atom) => ({ x: atom.x * 130, y: atom.y * 106 }));
  const radius = 175;
  const centerDistance = 285;
  let placement: { x: number; y: number }[] | null = null;

  for (const direction of directions) {
    const center = {
      x: selectedScreen.x + direction.x * centerDistance,
      y: selectedScreen.y + direction.y * centerDistance,
    };
    const facingAngle = Math.atan2(-direction.y, -direction.x);
    const candidate = Array.from({ length: size }, (_, index) => {
      const angle = facingAngle + (index * Math.PI * 2) / size;
      return {
        x: center.x + Math.cos(angle) * radius,
        y: center.y + Math.sin(angle) * radius,
      };
    });
    const clear = candidate.every((point) =>
      occupied.every((other) => Math.hypot(point.x - other.x, point.y - other.y) >= 78),
    );
    if (clear) {
      placement = candidate;
      break;
    }
  }

  if (!placement) return null;

  const firstId = Math.max(...molecule.atoms.map((atom) => atom.id)) + 1;
  const atomIds = placement.map((_, index) => firstId + index);
  const atoms = placement.map((point, index) => ({
    id: atomIds[index],
    x: point.x / 130,
    y: point.y / 106,
  }));
  const ringBonds = atomIds.map((atomId, index) => {
    const nextId = atomIds[(index + 1) % atomIds.length];
    const order: BondOrder = kind === "aromatic" && index % 2 === 0 ? 2 : 1;
    return [atomId, nextId, order] as Bond;
  });
  const ringId = Math.max(0, ...(molecule.rings ?? []).map((ring) => ring.id)) + 1;
  const next: Molecule = {
    ...molecule,
    atoms: [...molecule.atoms, ...atoms],
    bonds: [...molecule.bonds, ...ringBonds, [selectedId, atomIds[0], 1]],
    rings: [...(molecule.rings ?? []), { id: ringId, kind, atomIds }],
  };
  return { molecule: next, attachmentId: atomIds[0] };
}

function makeLinkedRings(firstKind: RingKind, secondKind: RingKind) {
  const first = makeRing(6, firstKind);
  const rightmost = [...first.atoms].sort((left, right) => right.x - left.x)[0];
  return attachRingToMolecule(first, rightmost.id, 6, secondKind)?.molecule ?? first;
}

function makeIsopropylOctane(): Molecule {
  const molecule = makeChain(8);
  molecule.atoms.push(
    { id: 9, x: 3, y: -1 },
    { id: 10, x: 2, y: -2 },
    { id: 11, x: 4, y: -2 },
  );
  molecule.bonds.push([4, 9], [9, 10], [9, 11]);
  return molecule;
}

const CYCLE_TEMPLATES: RingTemplate[] = [3, 4, 5, 6, 7, 8].map((size) => ({
  id: `cyclo-${size}`,
  label: `Ciclo${alkaneRoots[size]}ano`,
  formula: `C${toSubscript(size)}H${toSubscript(size * 2)}`,
  detail: `anillo de ${size} carbonos`,
  size,
  kind: "cycloalkane",
  molecule: makeRing(size, "cycloalkane"),
}));

const AROMATIC_TEMPLATES: RingTemplate[] = [
  {
    id: "benzene",
    label: "Benceno",
    formula: "C₆H₆",
    detail: "anillo aromático",
    size: 6,
    kind: "aromatic",
    molecule: makeRing(6, "aromatic"),
  },
  {
    id: "toluene",
    label: "Tolueno",
    formula: "C₇H₈",
    detail: "metilbenceno",
    size: 6,
    kind: "aromatic",
    molecule: makeSubstitutedRing("aromatic", [{ ringIndex: 0, length: 1 }]),
  },
  {
    id: "ethylbenzene",
    label: "Etilbenceno",
    formula: "C₈H₁₀",
    detail: "un sustituyente etil",
    size: 6,
    kind: "aromatic",
    molecule: makeSubstitutedRing("aromatic", [{ ringIndex: 0, length: 2 }]),
  },
  {
    id: "ortho-xylene",
    label: "o-Xileno",
    formula: "C₈H₁₀",
    detail: "1,2-dimetilbenceno",
    size: 6,
    kind: "aromatic",
    molecule: makeSubstitutedRing("aromatic", [
      { ringIndex: 0, length: 1 },
      { ringIndex: 1, length: 1 },
    ]),
  },
  {
    id: "meta-xylene",
    label: "m-Xileno",
    formula: "C₈H₁₀",
    detail: "1,3-dimetilbenceno",
    size: 6,
    kind: "aromatic",
    molecule: makeSubstitutedRing("aromatic", [
      { ringIndex: 0, length: 1 },
      { ringIndex: 2, length: 1 },
    ]),
  },
  {
    id: "para-xylene",
    label: "p-Xileno",
    formula: "C₈H₁₀",
    detail: "1,4-dimetilbenceno",
    size: 6,
    kind: "aromatic",
    molecule: makeSubstitutedRing("aromatic", [
      { ringIndex: 0, length: 1 },
      { ringIndex: 3, length: 1 },
    ]),
  },
];

const PRESETS: { label: string; molecule: Molecule }[] = [
  { label: "Butano", molecule: makeChain(4) },
  {
    label: "Eteno",
    molecule: {
      atoms: [
        { id: 1, x: 0, y: 0 },
        { id: 2, x: 1, y: 0 },
      ],
      bonds: [[1, 2, 2]],
    },
  },
  {
    label: "2-metilpropeno",
    molecule: {
      atoms: [
        { id: 1, x: 0, y: 0 },
        { id: 2, x: 1, y: 0 },
        { id: 3, x: 2, y: 0 },
        { id: 4, x: 1, y: -1 },
      ],
      bonds: [[1, 2, 2], [2, 3], [2, 4]],
    },
  },
  {
    label: "Etino",
    molecule: {
      atoms: [
        { id: 1, x: 0, y: 0 },
        { id: 2, x: 1, y: 0 },
      ],
      bonds: [[1, 2, 3]],
    },
  },
  {
    label: "2-metilpropano",
    molecule: {
      atoms: [
        { id: 1, x: 0, y: 0 },
        { id: 2, x: 1, y: 0 },
        { id: 3, x: 2, y: 0 },
        { id: 4, x: 1, y: -1 },
      ],
      bonds: [[1, 2], [2, 3], [2, 4]],
    },
  },
  {
    label: "2,3-dimetilbutano",
    molecule: {
      atoms: [
        { id: 1, x: 0, y: 0 },
        { id: 2, x: 1, y: 0 },
        { id: 3, x: 2, y: 0 },
        { id: 4, x: 3, y: 0 },
        { id: 5, x: 1, y: -1 },
        { id: 6, x: 2, y: 1 },
      ],
      bonds: [[1, 2], [2, 3], [3, 4], [2, 5], [3, 6]],
    },
  },
  {
    label: "3-etil-2-metilhexano",
    molecule: {
      atoms: [
        { id: 1, x: 0, y: 0 },
        { id: 2, x: 1, y: 0 },
        { id: 3, x: 2, y: 0 },
        { id: 4, x: 3, y: 0 },
        { id: 5, x: 4, y: 0 },
        { id: 6, x: 5, y: 0 },
        { id: 7, x: 1, y: -1 },
        { id: 8, x: 2, y: 1 },
        { id: 9, x: 2, y: 2 },
      ],
      bonds: [[1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [2, 7], [3, 8], [8, 9]],
    },
  },
  {
    label: "2,2,4-trimetilpentano",
    molecule: {
      atoms: [
        { id: 1, x: 0, y: 0 },
        { id: 2, x: 1, y: 0 },
        { id: 3, x: 2, y: 0 },
        { id: 4, x: 3, y: 0 },
        { id: 5, x: 4, y: 0 },
        { id: 6, x: 1, y: -1 },
        { id: 7, x: 1, y: 1 },
        { id: 8, x: 3, y: -1 },
      ],
      bonds: [[1, 2], [2, 3], [3, 4], [4, 5], [2, 6], [2, 7], [4, 8]],
    },
  },
  { label: "4-isopropiloctano", molecule: makeIsopropylOctane() },
  { label: "Ciclohexano", molecule: makeRing(6, "cycloalkane") },
  {
    label: "Metilciclohexano",
    molecule: makeSubstitutedRing("cycloalkane", [{ ringIndex: 0, length: 1 }]),
  },
  { label: "Benceno", molecule: makeRing(6, "aromatic") },
  {
    label: "Tolueno",
    molecule: makeSubstitutedRing("aromatic", [{ ringIndex: 0, length: 1 }]),
  },
  {
    label: "p-Xileno",
    molecule: makeSubstitutedRing("aromatic", [
      { ringIndex: 0, length: 1 },
      { ringIndex: 3, length: 1 },
    ]),
  },
  { label: "Bifenilo", molecule: makeLinkedRings("aromatic", "aromatic") },
  { label: "Ciclohexilciclohexano", molecule: makeLinkedRings("cycloalkane", "cycloalkane") },
];

function cloneMolecule(molecule: Molecule): Molecule {
  return {
    atoms: molecule.atoms.map((atom) => ({ ...atom })),
    bonds: molecule.bonds.map((bond) => [...bond] as Bond),
    rings: molecule.rings
      ? molecule.rings.map((ring) => ({ id: ring.id, kind: ring.kind, atomIds: [...ring.atomIds] }))
      : undefined,
  };
}

function buildAdjacency(molecule: Molecule) {
  const adjacency = new Map<number, number[]>();
  molecule.atoms.forEach((atom) => adjacency.set(atom.id, []));
  molecule.bonds.forEach(([a, b]) => {
    adjacency.get(a)?.push(b);
    adjacency.get(b)?.push(a);
  });
  return adjacency;
}

function pathBetween(start: number, end: number, adjacency: Map<number, number[]>) {
  const queue = [start];
  const previous = new Map<number, number | null>([[start, null]]);

  while (queue.length) {
    const current = queue.shift()!;
    if (current === end) break;
    for (const neighbor of adjacency.get(current) ?? []) {
      if (!previous.has(neighbor)) {
        previous.set(neighbor, current);
        queue.push(neighbor);
      }
    }
  }

  const path: number[] = [];
  let cursor: number | null | undefined = end;
  while (cursor != null) {
    path.unshift(cursor);
    cursor = previous.get(cursor);
  }
  return path;
}

function compareNumberLists(a: number[], b: number[]) {
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const left = a[index] ?? Number.POSITIVE_INFINITY;
    const right = b[index] ?? Number.POSITIVE_INFINITY;
    if (left !== right) return left - right;
  }
  return 0;
}

function stripForAlphabetizing(name: string) {
  return name
    .replace(/[0-9,()\-]/g, "")
    .replace(/^(di|tri|tetra|penta|hexa|bis|tris|tetrakis)/, "");
}

function formatSubstituentGroups(substituents: NamedSubstituent[]) {
  const groups = new Map<string, NamedSubstituent[]>();
  substituents.forEach((substituent) => {
    const current = groups.get(substituent.name) ?? [];
    current.push(substituent);
    groups.set(substituent.name, current);
  });

  return [...groups.values()]
    .sort((left, right) => left[0].sortName.localeCompare(right[0].sortName, "es"))
    .map((group) => {
      const locants = group.map((item) => item.locant).sort((a, b) => a - b).join(",");
      const { name, complex } = group[0];
      if (group.length === 1) {
        return complex ? `${locants}-(${name})` : `${locants}-${name}`;
      }
      if (complex) {
        const prefix = complexPrefixes[group.length] ?? `${group.length}×`;
        return `${locants}-${prefix}(${name})`;
      }
      const prefix = simplePrefixes[group.length] ?? `${group.length}×`;
      return `${locants}-${prefix}${name}`;
    });
}

function collectSubtree(root: number, blocked: Set<number>, adjacency: Map<number, number[]>) {
  const result: number[] = [];
  const stack = [root];
  const seen = new Set(blocked);
  while (stack.length) {
    const current = stack.pop()!;
    if (seen.has(current)) continue;
    seen.add(current);
    result.push(current);
    for (const neighbor of adjacency.get(current) ?? []) stack.push(neighbor);
  }
  return result;
}

function nameSubstituent(root: number, parent: number, adjacency: Map<number, number[]>): Omit<NamedSubstituent, "locant"> {
  const component = collectSubtree(root, new Set([parent]), adjacency);
  const componentSet = new Set(component);
  const rootPaths: number[][] = [];

  const walk = (current: number, previous: number | null, path: number[]) => {
    const children = (adjacency.get(current) ?? []).filter(
      (neighbor) => neighbor !== previous && componentSet.has(neighbor),
    );
    if (!children.length) {
      rootPaths.push(path);
      return;
    }
    children.forEach((child) => walk(child, current, [...path, child]));
  };
  walk(root, null, [root]);

  const maxLength = Math.max(...rootPaths.map((path) => path.length));
  const candidates = rootPaths
    .filter((path) => path.length === maxLength)
    .map((path) => {
      const pathSet = new Set(path);
      const branches: NamedSubstituent[] = [];
      path.forEach((atomId, index) => {
        for (const neighbor of adjacency.get(atomId) ?? []) {
          if (!componentSet.has(neighbor) || pathSet.has(neighbor)) continue;
          const named = nameSubstituent(neighbor, atomId, adjacency);
          branches.push({ ...named, locant: index + 1 });
        }
      });
      return { path, branches };
    })
    .sort((left, right) => {
      if (left.branches.length !== right.branches.length) return right.branches.length - left.branches.length;
      const leftLocants = left.branches.map((branch) => branch.locant).sort((a, b) => a - b);
      const rightLocants = right.branches.map((branch) => branch.locant).sort((a, b) => a - b);
      return compareNumberLists(leftLocants, rightLocants);
    });

  const chosen = candidates[0];
  const parentName = alkylNames[chosen.path.length] ?? `alquilo de ${chosen.path.length} carbonos`;
  const branchParts = formatSubstituentGroups(chosen.branches);
  const name = branchParts.length ? `${branchParts.join("-")}${parentName}` : parentName;

  return {
    name,
    sortName: stripForAlphabetizing(name),
    complex: branchParts.length > 0,
    atomIds: component,
  };
}

function makeChainName(length: number, doubleLocants: number[], tripleLocants: number[]) {
  const root = alkaneRoots[length];
  if (!root) return `hidrocarburo de ${length} carbonos`;
  if (!doubleLocants.length && !tripleLocants.length) return `${root}ano`;

  const unsaturationPrefix = (count: number) => simplePrefixes[count] ?? `${count}`;
  if (doubleLocants.length && !tripleLocants.length) {
    if (doubleLocants.length === 1) {
      return length <= 3 ? `${root}eno` : `${root}-${doubleLocants[0]}-eno`;
    }
    return `${root}a-${doubleLocants.join(",")}-${unsaturationPrefix(doubleLocants.length)}eno`;
  }
  if (tripleLocants.length && !doubleLocants.length) {
    if (tripleLocants.length === 1) {
      return length <= 3 ? `${root}ino` : `${root}-${tripleLocants[0]}-ino`;
    }
    return `${root}a-${tripleLocants.join(",")}-${unsaturationPrefix(tripleLocants.length)}ino`;
  }

  const alkenePart = doubleLocants.length === 1
    ? `${doubleLocants[0]}-en`
    : `${doubleLocants.join(",")}-${unsaturationPrefix(doubleLocants.length)}en`;
  const alkynePart = tripleLocants.length === 1
    ? `${tripleLocants[0]}-ino`
    : `${tripleLocants.join(",")}-${unsaturationPrefix(tripleLocants.length)}ino`;
  return `${root}-${alkenePart}-${alkynePart}`;
}

function molecularFormula(molecule: Molecule) {
  const carbonCount = molecule.atoms.length;
  const hydrogenCount = molecule.atoms.reduce(
    (total, atom) => total + Math.max(0, 4 - getValenceUsed(atom.id, molecule)),
    0,
  );
  return `C${toSubscript(carbonCount)}H${toSubscript(hydrogenCount)}`;
}

function aromaticCommonName(substituents: NamedSubstituent[]) {
  if (substituents.length === 1 && substituents[0].name === "metil") return "tolueno";
  if (substituents.length !== 2 || substituents.some((item) => item.name !== "metil")) return undefined;

  const locants = substituents.map((item) => item.locant).sort((a, b) => a - b).join(",");
  if (locants === "1,2") return "o-xileno";
  if (locants === "1,3") return "m-xileno";
  if (locants === "1,4") return "p-xileno";
  return undefined;
}

function ringBaseName(ring: RingInfo) {
  const root = alkaneRoots[ring.atomIds.length];
  if (ring.kind === "aromatic") return ring.atomIds.length === 6 ? "benceno" : "aromático";
  return root ? `ciclo${root}ano` : `cicloalcano de ${ring.atomIds.length} carbonos`;
}

function unsaturatedRingBaseName(
  ring: RingInfo,
  doubleBondLocants: number[],
  tripleBondLocants: number[],
) {
  if (ring.kind === "aromatic" || (!doubleBondLocants.length && !tripleBondLocants.length)) {
    return ringBaseName(ring);
  }
  return `ciclo${makeChainName(
    ring.atomIds.length,
    doubleBondLocants,
    tripleBondLocants,
  )}`;
}

function ringSubstituentName(ring: RingInfo) {
  if (ring.kind === "aromatic") return ring.atomIds.length === 6 ? "fenil" : "aril";
  const root = alkaneRoots[ring.atomIds.length];
  return root ? `ciclo${root}il` : `cicloalquilo de ${ring.atomIds.length} carbonos`;
}

function orientedRingPaths(ring: RingInfo) {
  const paths: number[][] = [];
  ring.atomIds.forEach((_, startIndex) => {
    ([1, -1] as const).forEach((direction) => {
      paths.push(
        Array.from({ length: ring.atomIds.length }, (__, offset) => {
          const index = (startIndex + direction * offset + ring.atomIds.length) % ring.atomIds.length;
          return ring.atomIds[index];
        }),
      );
    });
  });
  return paths;
}

function ringCandidates(molecule: Molecule, ring: RingInfo) {
  const adjacency = buildAdjacency(molecule);
  const bondOrders = new Map(
    molecule.bonds.map((bond) => [bondKey(bond[0], bond[1]), getBondOrder(bond)]),
  );
  const ringSet = new Set(ring.atomIds);
  const candidates = orientedRingPaths(ring).map((path) => {
    const substituents: NamedSubstituent[] = [];
    const doubleBondLocants: number[] = [];
    const tripleBondLocants: number[] = [];

    if (ring.kind === "cycloalkane") {
      path.forEach((atomId, index) => {
        const nextAtomId = path[(index + 1) % path.length];
        const order = bondOrders.get(bondKey(atomId, nextAtomId)) ?? 1;
        if (order === 2) doubleBondLocants.push(index + 1);
        if (order === 3) tripleBondLocants.push(index + 1);
      });
    }

    path.forEach((atomId, index) => {
      for (const neighbor of adjacency.get(atomId) ?? []) {
        if (ringSet.has(neighbor)) continue;
        const neighboringRing = molecule.rings?.find(
          (candidateRing) => candidateRing.id !== ring.id && candidateRing.atomIds.includes(neighbor),
        );
        if (neighboringRing) {
          const name = ringSubstituentName(neighboringRing);
          substituents.push({
            locant: index + 1,
            name,
            sortName: name,
            complex: false,
            atomIds: neighboringRing.atomIds,
          });
          continue;
        }

        const component = collectSubtree(neighbor, new Set([atomId]), adjacency);
        const reachesAnotherRing = molecule.rings?.some(
          (candidateRing) => candidateRing.id !== ring.id
            && candidateRing.atomIds.some((ringAtomId) => component.includes(ringAtomId)),
        );
        const named = reachesAnotherRing
          ? {
              name: "grupo policíclico",
              sortName: "grupo policíclico",
              complex: true,
              atomIds: component,
            }
          : nameSubstituent(neighbor, atomId, adjacency);
        substituents.push({ ...named, locant: index + 1 });
      }
    });
    return { path, substituents, doubleBondLocants, tripleBondLocants };
  });

  candidates.sort((left, right) => {
    const leftMultipleLocants = [...left.doubleBondLocants, ...left.tripleBondLocants]
      .sort((a, b) => a - b);
    const rightMultipleLocants = [...right.doubleBondLocants, ...right.tripleBondLocants]
      .sort((a, b) => a - b);
    const multipleComparison = compareNumberLists(leftMultipleLocants, rightMultipleLocants);
    if (multipleComparison !== 0) return multipleComparison;

    const doubleComparison = compareNumberLists(
      [...left.doubleBondLocants].sort((a, b) => a - b),
      [...right.doubleBondLocants].sort((a, b) => a - b),
    );
    if (doubleComparison !== 0) return doubleComparison;

    const leftLocants = left.substituents.map((item) => item.locant).sort((a, b) => a - b);
    const rightLocants = right.substituents.map((item) => item.locant).sort((a, b) => a - b);
    const locantComparison = compareNumberLists(leftLocants, rightLocants);
    if (locantComparison !== 0) return locantComparison;

    const leftAlphabetical = [...left.substituents]
      .sort((a, b) => a.sortName.localeCompare(b.sortName, "es"))
      .map((item) => item.locant);
    const rightAlphabetical = [...right.substituents]
      .sort((a, b) => a.sortName.localeCompare(b.sortName, "es"))
      .map((item) => item.locant);
    return compareNumberLists(leftAlphabetical, rightAlphabetical);
  });

  return candidates;
}

function buildRingAnalysis(
  molecule: Molecule,
  ring: RingInfo,
  family: RingKind | "polycyclic",
): Analysis {
  const chosen = ringCandidates(molecule, ring)[0];
  const chainName = unsaturatedRingBaseName(
    ring,
    chosen.doubleBondLocants,
    chosen.tripleBondLocants,
  );
  const substituentParts = formatSubstituentGroups(chosen.substituents);
  let name = chosen.substituents.length === 1
    ? `${chosen.substituents[0].complex ? `(${chosen.substituents[0].name})` : chosen.substituents[0].name}${chainName}`
    : substituentParts.length
      ? `${substituentParts.join("-")}${chainName}`
      : chainName;

  const rings = molecule.rings ?? [];
  const allAtomsBelongToRings = molecule.atoms.every((atom) =>
    rings.some((candidateRing) => candidateRing.atomIds.includes(atom.id)),
  );
  if (
    rings.length === 2
    && rings.every((candidateRing) => candidateRing.kind === "aromatic" && candidateRing.atomIds.length === 6)
    && allAtomsBelongToRings
  ) {
    name = "bifenilo";
  }

  return {
    name,
    commonName: rings.length === 1 && ring.kind === "aromatic"
      ? aromaticCommonName(chosen.substituents)
      : undefined,
    formula: molecularFormula(molecule),
    family,
    mainChain: chosen.path,
    chainName,
    substituents: chosen.substituents,
    numberedAtoms: new Map(chosen.path.map((atomId, index) => [atomId, index + 1])),
    doubleBondLocants: chosen.doubleBondLocants,
    tripleBondLocants: chosen.tripleBondLocants,
  };
}

function analyzeRingMolecule(molecule: Molecule): Analysis {
  const ring = molecule.rings![0];
  return buildRingAnalysis(molecule, ring, ring.kind);
}

function analyzeMultiRingMolecule(molecule: Molecule): Analysis {
  const rings = molecule.rings!;
  const adjacency = buildAdjacency(molecule);
  const ranked = [...rings].sort((left, right) => {
    const linkedRingCount = (ring: RingInfo) => {
      const linked = new Set<number>();
      ring.atomIds.forEach((atomId) => {
        for (const neighbor of adjacency.get(atomId) ?? []) {
          const other = rings.find(
            (candidateRing) => candidateRing.id !== ring.id && candidateRing.atomIds.includes(neighbor),
          );
          if (other) linked.add(other.id);
        }
      });
      return linked.size;
    };
    const linkDifference = linkedRingCount(right) - linkedRingCount(left);
    if (linkDifference !== 0) return linkDifference;
    if (left.kind !== right.kind) return left.kind === "aromatic" ? -1 : 1;
    return right.atomIds.length - left.atomIds.length;
  });
  return buildRingAnalysis(molecule, ranked[0], "polycyclic");
}

function analyzeMolecule(molecule: Molecule): Analysis {
  if ((molecule.rings?.length ?? 0) > 1) return analyzeMultiRingMolecule(molecule);
  if (molecule.rings?.length === 1) return analyzeRingMolecule(molecule);

  const adjacency = buildAdjacency(molecule);
  const bondOrders = new Map(
    molecule.bonds.map((bond) => [bondKey(bond[0], bond[1]), getBondOrder(bond)]),
  );
  const atomIds = molecule.atoms.map((atom) => atom.id);
  const orientedPaths: number[][] = atomIds.length === 1 ? [[atomIds[0]]] : [];

  atomIds.forEach((start, startIndex) => {
    atomIds.slice(startIndex + 1).forEach((end) => {
      const path = pathBetween(start, end, adjacency);
      orientedPaths.push(path, [...path].reverse());
    });
  });

  const candidates = orientedPaths.map((path) => {
    const pathSet = new Set(path);
    const substituents: NamedSubstituent[] = [];
    const doubleBondLocants: number[] = [];
    const tripleBondLocants: number[] = [];

    path.slice(0, -1).forEach((atomId, index) => {
      const order = bondOrders.get(bondKey(atomId, path[index + 1])) ?? 1;
      if (order === 2) doubleBondLocants.push(index + 1);
      if (order === 3) tripleBondLocants.push(index + 1);
    });

    path.forEach((atomId, index) => {
      for (const neighbor of adjacency.get(atomId) ?? []) {
        if (pathSet.has(neighbor)) continue;
        const named = nameSubstituent(neighbor, atomId, adjacency);
        substituents.push({ ...named, locant: index + 1 });
      }
    });

    return {
      path,
      substituents,
      doubleBondLocants,
      tripleBondLocants,
      multipleBondCount: doubleBondLocants.length + tripleBondLocants.length,
    };
  });

  candidates.sort((left, right) => {
    if (left.multipleBondCount !== right.multipleBondCount) {
      return right.multipleBondCount - left.multipleBondCount;
    }
    if (left.path.length !== right.path.length) return right.path.length - left.path.length;

    const leftMultipleLocants = [...left.doubleBondLocants, ...left.tripleBondLocants].sort((a, b) => a - b);
    const rightMultipleLocants = [...right.doubleBondLocants, ...right.tripleBondLocants].sort((a, b) => a - b);
    const multipleComparison = compareNumberLists(leftMultipleLocants, rightMultipleLocants);
    if (multipleComparison !== 0) return multipleComparison;

    const doubleComparison = compareNumberLists(left.doubleBondLocants, right.doubleBondLocants);
    if (doubleComparison !== 0) return doubleComparison;

    if (left.substituents.length !== right.substituents.length) {
      return right.substituents.length - left.substituents.length;
    }
    const leftLocants = left.substituents.map((item) => item.locant).sort((a, b) => a - b);
    const rightLocants = right.substituents.map((item) => item.locant).sort((a, b) => a - b);
    const locantComparison = compareNumberLists(leftLocants, rightLocants);
    if (locantComparison !== 0) return locantComparison;

    const leftAlphabetical = [...left.substituents]
      .sort((a, b) => a.sortName.localeCompare(b.sortName, "es"))
      .map((item) => item.locant);
    const rightAlphabetical = [...right.substituents]
      .sort((a, b) => a.sortName.localeCompare(b.sortName, "es"))
      .map((item) => item.locant);
    return compareNumberLists(leftAlphabetical, rightAlphabetical);
  });

  const chosen = candidates[0];
  const chainName = makeChainName(
    chosen.path.length,
    chosen.doubleBondLocants,
    chosen.tripleBondLocants,
  );
  const substituentParts = formatSubstituentGroups(chosen.substituents);
  const name = substituentParts.length ? `${substituentParts.join("-")}${chainName}` : chainName;
  const numberedAtoms = new Map(chosen.path.map((atomId, index) => [atomId, index + 1]));

  return {
    name,
    formula: molecularFormula(molecule),
    family: "acyclic",
    mainChain: chosen.path,
    chainName,
    substituents: chosen.substituents,
    numberedAtoms,
    doubleBondLocants: chosen.doubleBondLocants,
    tripleBondLocants: chosen.tripleBondLocants,
  };
}

const directionOptions = [
  { label: "Arriba", symbol: "↑", dx: 0, dy: -1, className: "north" },
  { label: "Izquierda", symbol: "←", dx: -1, dy: 0, className: "west" },
  { label: "Derecha", symbol: "→", dx: 1, dy: 0, className: "east" },
  { label: "Abajo", symbol: "↓", dx: 0, dy: 1, className: "south" },
];

const ALKYL_TEMPLATES: AlkylTemplate[] = [
  {
    id: "methyl",
    label: "Metil",
    systematic: "metil",
    formula: "–CH₃",
    atoms: [{ x: 1, y: 0 }],
    connections: [[-1, 0]],
  },
  {
    id: "ethyl",
    label: "Etil",
    systematic: "etil",
    formula: "–CH₂CH₃",
    atoms: [{ x: 1, y: 0 }, { x: 2, y: 0 }],
    connections: [[-1, 0], [0, 1]],
  },
  {
    id: "propyl",
    label: "Propil",
    systematic: "propan-1-il",
    formula: "–(CH₂)₂CH₃",
    atoms: [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }],
    connections: [[-1, 0], [0, 1], [1, 2]],
  },
  {
    id: "butyl",
    label: "Butil",
    systematic: "butan-1-il",
    formula: "–(CH₂)₃CH₃",
    atoms: [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }],
    connections: [[-1, 0], [0, 1], [1, 2], [2, 3]],
  },
  {
    id: "isopropyl",
    label: "Isopropil",
    systematic: "1-metiletil · propan-2-il",
    formula: "–CH(CH₃)₂",
    atoms: [{ x: 1, y: 0 }, { x: 2, y: -1 }, { x: 2, y: 1 }],
    connections: [[-1, 0], [0, 1], [0, 2]],
  },
  {
    id: "isobutyl",
    label: "Isobutil",
    systematic: "2-metilpropil",
    formula: "–CH₂CH(CH₃)₂",
    atoms: [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: -1 }, { x: 3, y: 1 }],
    connections: [[-1, 0], [0, 1], [1, 2], [1, 3]],
  },
  {
    id: "sec-butyl",
    label: "Sec-butil",
    systematic: "butan-2-il",
    formula: "–CH(CH₃)CH₂CH₃",
    atoms: [{ x: 1, y: 0 }, { x: 2, y: -1 }, { x: 2, y: 1 }, { x: 3, y: 1 }],
    connections: [[-1, 0], [0, 1], [0, 2], [2, 3]],
  },
  {
    id: "tert-butyl",
    label: "Terc-butil",
    systematic: "1,1-dimetiletil",
    formula: "–C(CH₃)₃",
    atoms: [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 1, y: -1 }, { x: 1, y: 1 }],
    connections: [[-1, 0], [0, 1], [0, 2], [0, 3]],
  },
];

function getDisplayPosition(atom: CarbonAtom, viewMode: ViewMode, preserveGeometry = false) {
  if (viewMode === "condensed" || preserveGeometry) {
    return { x: atom.x * 130, y: atom.y * 106 };
  }

  // Alternar ambos ejes convierte las cadenas rectas de la cuadrícula de
  // construcción en el zigzag convencional de una fórmula esquelética.
  const horizontalZigzag = Math.abs(atom.x) % 2 === 0 ? 32 : -32;
  const verticalZigzag = Math.abs(atom.y) % 2 === 0 ? -28 : 28;
  return {
    x: atom.x * 130 + verticalZigzag,
    y: atom.y * 106 + horizontalZigzag,
  };
}

function ringIconPoints(size: number) {
  return Array.from({ length: size }, (_, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / size;
    return `${24 + Math.cos(angle) * 16},${24 + Math.sin(angle) * 16}`;
  }).join(" ");
}

export default function Home() {
  const [molecule, setMolecule] = useState<Molecule>(() =>
    cloneMolecule(PRESETS.find((preset) => preset.label === "2-metilpropano")!.molecule),
  );
  const [selectedId, setSelectedId] = useState(2);
  const [history, setHistory] = useState<Molecule[]>([]);
  const [future, setFuture] = useState<Molecule[]>([]);
  const [showHydrogens, setShowHydrogens] = useState(true);
  const [showNumbering, setShowNumbering] = useState(true);
  const [highlightSubstituents, setHighlightSubstituents] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("condensed");
  const [newBondOrder, setNewBondOrder] = useState<BondOrder>(1);
  const [showIupacName, setShowIupacName] = useState(true);
  const [showAlkylPalette, setShowAlkylPalette] = useState(false);
  const [showRingPalette, setShowRingPalette] = useState(false);
  const [ringInsertMode, setRingInsertMode] = useState<RingInsertMode>("replace");
  const [commonAlkylNameSelections, setCommonAlkylNameSelections] = useState<string[]>([]);
  const [themePreference, setThemePreference] = useState<ThemePreference>("auto");
  const [automaticDark, setAutomaticDark] = useState(false);
  const [showCreatorCredit, setShowCreatorCredit] = useState(false);
  const [notice, setNotice] = useState("Selecciona un carbono para añadir otro o toca un enlace para cambiar su orden.");

  const adjacency = useMemo(() => buildAdjacency(molecule), [molecule]);
  const analysis = useMemo(() => analyzeMolecule(molecule), [molecule]);
  const selectedAtom = molecule.atoms.find((atom) => atom.id === selectedId) ?? molecule.atoms[0];
  const mainChainSet = useMemo(() => new Set(analysis.mainChain), [analysis.mainChain]);
  const interactiveNameParts = useMemo(
    () => getInteractiveNameParts(analysis.name, commonAlkylNameSelections),
    [analysis.name, commonAlkylNameSelections],
  );
  const displayedIupacName = interactiveNameParts.map((part) => part.text).join("");
  const hasInteractiveAlkylName = interactiveNameParts.some((part) => part.systematic);
  const isDarkTheme = themePreference === "dark" || (themePreference === "auto" && automaticDark);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem("hydrocarbon-theme");
    if (storedTheme === "auto" || storedTheme === "light" || storedTheme === "dark") {
      const restoreTheme = window.setTimeout(() => setThemePreference(storedTheme), 0);
      return () => window.clearTimeout(restoreTheme);
    }
  }, []);

  useEffect(() => {
    const systemPreference = window.matchMedia("(prefers-color-scheme: dark)");
    const updateAutomaticTheme = () => {
      const hour = new Date().getHours();
      setAutomaticDark(systemPreference.matches || hour >= 19 || hour < 7);
    };
    updateAutomaticTheme();
    systemPreference.addEventListener("change", updateAutomaticTheme);
    const clock = window.setInterval(updateAutomaticTheme, 60_000);
    return () => {
      systemPreference.removeEventListener("change", updateAutomaticTheme);
      window.clearInterval(clock);
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = isDarkTheme ? "dark" : "light";
    document.documentElement.style.colorScheme = isDarkTheme ? "dark" : "light";
  }, [isDarkTheme]);

  const commit = (next: Molecule, message: string) => {
    setHistory((items) => [...items, cloneMolecule(molecule)]);
    setFuture([]);
    setMolecule(next);
    setNotice(message);
  };

  const cycleTheme = () => {
    const nextPreference: ThemePreference = themePreference === "auto"
      ? "light"
      : themePreference === "light"
        ? "dark"
        : "auto";
    setThemePreference(nextPreference);
    window.localStorage.setItem("hydrocarbon-theme", nextPreference);
    setNotice(
      nextPreference === "auto"
        ? "Tema automático: sigue el dispositivo y activa la vista oscura entre las 19:00 y las 07:00."
        : `Tema ${nextPreference === "dark" ? "oscuro" : "claro"} fijado manualmente.`,
    );
  };

  const toggleCommonAlkylName = (
    systematic: keyof typeof commonAlkylAliases,
    common: string,
    currentlyActive: boolean,
  ) => {
    setCommonAlkylNameSelections((items) =>
      currentlyActive
        ? items.filter((item) => item !== systematic)
        : [...new Set([...items, systematic])],
    );
    setNotice(
      currentlyActive
        ? `${common} volvió a mostrarse como (${systematic}).`
        : `(${systematic}) ahora se muestra como ${common}. Pulsa nuevamente el nombre para volver a la forma sistemática.`,
    );
  };

  const addCarbon = (dx: number, dy: number) => {
    if (molecule.rings?.length && newBondOrder !== 1) {
      setNotice("En los ciclos de esta etapa, los sustituyentes se conectan al anillo con enlaces simples.");
      return;
    }
    const selectedValence = getValenceUsed(selectedAtom.id, molecule);
    if (selectedValence + newBondOrder > 4) {
      setNotice(
        `No se puede añadir un enlace ${getBondOrderLabel(newBondOrder)}: ese carbono superaría su tetravalencia.`,
      );
      return;
    }
    const targetX = selectedAtom.x + dx;
    const targetY = selectedAtom.y + dy;
    if (molecule.atoms.some((atom) => atom.x === targetX && atom.y === targetY)) {
      setNotice("Ese espacio ya está ocupado. Prueba otra dirección.");
      return;
    }
    const nextId = Math.max(...molecule.atoms.map((atom) => atom.id)) + 1;
    const next: Molecule = {
      ...molecule,
      atoms: [...molecule.atoms, { id: nextId, x: targetX, y: targetY }],
      bonds: [...molecule.bonds, [selectedAtom.id, nextId, newBondOrder] as Bond],
    };
    commit(
      next,
      `Carbono añadido con enlace ${getBondOrderLabel(newBondOrder)}. El nombre se recalculó automáticamente.`,
    );
    setSelectedId(nextId);
  };

  const cycleBondOrder = (a: number, b: number) => {
    const containingRing = molecule.rings?.find(
      (ring) => ring.atomIds.includes(a) && ring.atomIds.includes(b),
    );
    if (containingRing?.kind === "aromatic") {
      setNotice(
        "Los enlaces internos del benceno están fijados para conservar su aromaticidad.",
      );
      return;
    }
    if (molecule.rings?.length && !containingRing) {
      setNotice(
        "Los enlaces que unen un anillo con un sustituyente u otro anillo se mantienen simples; toca un enlace interno del ciclo para cambiarlo.",
      );
      return;
    }
    const bondIndex = molecule.bonds.findIndex(
      (bond) => (bond[0] === a && bond[1] === b) || (bond[0] === b && bond[1] === a),
    );
    if (bondIndex < 0) return;

    const currentOrder = getBondOrder(molecule.bonds[bondIndex]);
    const nextOrder = (currentOrder === 3 ? 1 : currentOrder + 1) as BondOrder;
    const extraValence = nextOrder - currentOrder;
    if (
      extraValence > 0
      && (getValenceUsed(a, molecule) + extraValence > 4
        || getValenceUsed(b, molecule) + extraValence > 4)
    ) {
      const attemptedValence = Math.max(
        getValenceUsed(a, molecule) + extraValence,
        getValenceUsed(b, molecule) + extraValence,
      );
      setNotice(
        `Cambio imposible: el enlace ${getBondOrderLabel(nextOrder)} haría que un carbono alcanzara valencia ${attemptedValence}; el máximo permitido es 4.`,
      );
      return;
    }

    const nextBonds = molecule.bonds.map((bond, index) =>
      index === bondIndex ? [bond[0], bond[1], nextOrder] as Bond : [...bond] as Bond,
    );
    commit(
      { ...molecule, bonds: nextBonds },
      `Enlace actualizado: ${getBondOrderLabel(currentOrder)} → ${getBondOrderLabel(nextOrder)}. Fórmula y nombre recalculados.`,
    );
  };

  const addAlkylGroup = (template: AlkylTemplate) => {
    if (getValenceUsed(selectedAtom.id, molecule) + 1 > 4) {
      setNotice("Ese carbono ya tiene cuatro enlaces. Selecciona otro para añadir el grupo alquilo.");
      return;
    }

    const occupied = new Set(molecule.atoms.map((atom) => `${atom.x},${atom.y}`));
    const orientations = [
      { dx: 1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: -1 },
    ];
    const selectedRing = ringContainingAtom(molecule, selectedAtom.id);
    if (selectedRing) {
      const ringAtoms = molecule.atoms.filter((atom) => selectedRing.atomIds.includes(atom.id));
      const center = ringAtoms.reduce(
        (total, atom) => ({ x: total.x + atom.x / ringAtoms.length, y: total.y + atom.y / ringAtoms.length }),
        { x: 0, y: 0 },
      );
      const outward = { x: selectedAtom.x - center.x, y: selectedAtom.y - center.y };
      orientations.sort(
        (left, right) => right.dx * outward.x + right.dy * outward.y - (left.dx * outward.x + left.dy * outward.y),
      );
    }
    let placement: { x: number; y: number }[] | null = null;

    for (const orientation of orientations) {
      for (const mirror of [1, -1]) {
        const candidate = template.atoms.map((atom) => ({
          x: selectedAtom.x + atom.x * orientation.dx - atom.y * orientation.dy * mirror,
          y: selectedAtom.y + atom.x * orientation.dy + atom.y * orientation.dx * mirror,
        }));
        const candidateKeys = candidate.map((atom) => `${atom.x},${atom.y}`);
        if (
          candidateKeys.every((key) => !occupied.has(key))
          && new Set(candidateKeys).size === candidateKeys.length
        ) {
          placement = candidate;
          break;
        }
      }
      if (placement) break;
    }

    if (!placement) {
      setNotice("No hay espacio libre para ese grupo. Selecciona otro carbono o retira una ramificación.");
      return;
    }

    const firstId = Math.max(...molecule.atoms.map((atom) => atom.id)) + 1;
    const idMap = placement.map((_, index) => firstId + index);
    const addedAtoms = placement.map((atom, index) => ({ ...atom, id: idMap[index] }));
    const addedBonds = template.connections.map(([from, to]) => [
      from === -1 ? selectedAtom.id : idMap[from],
      idMap[to],
    ] as Bond);
    const next: Molecule = {
      ...molecule,
      atoms: [...molecule.atoms, ...addedAtoms],
      bonds: [...molecule.bonds, ...addedBonds],
    };

    commit(next, `${template.label} añadido. La cadena principal y el nombre se recalcularon.`);
    setSelectedId(idMap[0]);
  };

  const removeSelected = () => {
    if (ringContainingAtom(molecule, selectedAtom.id)) {
      setNotice("El carbono seleccionado forma parte del anillo y no puede retirarse. Elige un sustituyente terminal.");
      return;
    }
    const degree = (adjacency.get(selectedAtom.id) ?? []).length;
    if (molecule.atoms.length === 1) {
      setNotice("La molécula debe conservar al menos un carbono.");
      return;
    }
    if (degree > 1) {
      setNotice("Solo puedes retirar un carbono terminal para no cortar la molécula en dos.");
      return;
    }
    const neighbor = adjacency.get(selectedAtom.id)?.[0];
    const next: Molecule = {
      ...molecule,
      atoms: molecule.atoms.filter((atom) => atom.id !== selectedAtom.id),
      bonds: molecule.bonds.filter(([a, b]) => a !== selectedAtom.id && b !== selectedAtom.id),
    };
    commit(next, "Carbono terminal retirado.");
    setSelectedId(neighbor ?? next.atoms[0].id);
  };

  const undo = () => {
    const previous = history.at(-1);
    if (!previous) return;
    setFuture((items) => [cloneMolecule(molecule), ...items]);
    setHistory((items) => items.slice(0, -1));
    setMolecule(cloneMolecule(previous));
    setSelectedId(previous.atoms[0].id);
    setNotice("Último cambio deshecho.");
  };

  const redo = () => {
    const next = future[0];
    if (!next) return;
    setHistory((items) => [...items, cloneMolecule(molecule)]);
    setFuture((items) => items.slice(1));
    setMolecule(cloneMolecule(next));
    setSelectedId(next.atoms[0].id);
    setNotice("Cambio rehecho.");
  };

  const loadPreset = (preset: (typeof PRESETS)[number]) => {
    commit(cloneMolecule(preset.molecule), `Ejemplo cargado: ${preset.label}.`);
    setSelectedId(preset.molecule.atoms[0].id);
    setShowAlkylPalette(false);
    setShowRingPalette(false);
  };

  const loadRingTemplate = (template: RingTemplate) => {
    if (ringInsertMode === "attach") {
      if (template.molecule.atoms.length !== template.size) {
        setNotice(
          `${template.label} es un ejemplo completo. Para añadir otro núcleo aromático, elige Benceno.`,
        );
        return;
      }
      const attached = attachRingToMolecule(
        molecule,
        selectedAtom.id,
        template.size,
        template.kind,
      );
      if (!attached) {
        setNotice(
          selectedValence >= 4
            ? "Ese carbono ya tiene valencia 4. Selecciona otro carbono antes de unir el anillo."
            : "No hay espacio suficiente alrededor del carbono seleccionado para colocar ese anillo.",
        );
        return;
      }
      const ringCount = (attached.molecule.rings?.length ?? 0);
      commit(
        attached.molecule,
        `${template.label} unido mediante un enlace simple. La estructura ahora contiene ${ringCount} anillos.`,
      );
      setSelectedId(attached.attachmentId);
      setShowRingPalette(false);
      setShowAlkylPalette(false);
      return;
    }

    commit(
      cloneMolecule(template.molecule),
      `${template.label} cargado. Selecciona un carbono y vuelve a Anillos para unir otro.`,
    );
    setSelectedId(template.molecule.rings?.[0].atomIds[0] ?? template.molecule.atoms[0].id);
    setRingInsertMode("attach");
    setShowRingPalette(false);
    setShowAlkylPalette(false);
  };

  const newMolecule = () => {
    const methane = makeChain(1);
    commit(methane, "Molécula nueva: comienza desde un átomo de carbono.");
    setSelectedId(1);
    setRingInsertMode("replace");
    setShowRingPalette(false);
  };

  const changeViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    setNotice(
      mode === "skeletal"
        ? "Vista esquelética activada: cada extremo y cada vértice representa un carbono."
        : "Vista semidesarrollada activada: se muestran los carbonos y sus hidrógenos implícitos.",
    );
  };

  const displayPositions = new Map(
    molecule.atoms.map((atom) => [atom.id, getDisplayPosition(atom, viewMode, Boolean(molecule.rings?.length))]),
  );
  const coordinates = [...displayPositions.values()];
  const minX = Math.min(...coordinates.map((point) => point.x));
  const maxX = Math.max(...coordinates.map((point) => point.x));
  const minY = Math.min(...coordinates.map((point) => point.y));
  const maxY = Math.max(...coordinates.map((point) => point.y));
  const viewWidth = Math.max(720, maxX - minX + 260);
  const viewHeight = Math.max(390, maxY - minY + 220);
  const viewCenterX = (minX + maxX) / 2;
  const viewCenterY = (minY + maxY) / 2;
  const selectedValence = getValenceUsed(selectedAtom.id, molecule);
  const selectedHydrogens = 4 - selectedValence;
  const hasMultipleBonds = analysis.doubleBondLocants.length > 0 || analysis.tripleBondLocants.length > 0;
  const isRingStructure = analysis.family !== "acyclic";
  const structureFamilyLabel = analysis.family === "aromatic"
    ? "Aromático"
    : analysis.family === "polycyclic"
      ? `${molecule.rings?.length ?? 0} anillos`
    : analysis.family === "cycloalkane"
      ? analysis.doubleBondLocants.length && analysis.tripleBondLocants.length
        ? "Cicloalquenino"
        : analysis.doubleBondLocants.length
          ? "Cicloalqueno"
          : analysis.tripleBondLocants.length
            ? "Cicloalquino"
            : "Cicloalcano"
      : hasMultipleBonds
        ? "Insaturado"
        : "Alcano";
  const themeModeLabel = themePreference === "auto"
    ? `Auto · ${isDarkTheme ? "oscuro" : "claro"}`
    : themePreference === "dark"
      ? "Oscuro"
      : "Claro";
  const multipleBondSummary = [
    analysis.doubleBondLocants.length
      ? `${analysis.doubleBondLocants.length === 1 ? "doble" : "dobles"} en ${analysis.doubleBondLocants.join(",")}`
      : "",
    analysis.tripleBondLocants.length
      ? `${analysis.tripleBondLocants.length === 1 ? "triple" : "triples"} en ${analysis.tripleBondLocants.join(",")}`
      : "",
  ].filter(Boolean).join(" y ");
  const primaryStructureTitle = analysis.family === "aromatic"
    ? "Núcleo aromático"
    : analysis.family === "polycyclic"
      ? "Sistema de anillos"
    : analysis.family === "cycloalkane"
      ? "Anillo principal"
      : "Cadena principal";
  const primaryStructureExplanation = analysis.family === "aromatic"
    ? "El anillo de seis carbonos con tres enlaces alternados se reconoce como el núcleo benceno."
    : analysis.family === "polycyclic"
      ? `La estructura contiene ${molecule.rings?.length ?? 0} anillos. Se toma como principal el que reúne más conexiones y aporta el nombre base: ${analysis.chainName}.`
    : analysis.family === "cycloalkane"
      ? `El ciclo contiene ${analysis.mainChain.length} carbonos${hasMultipleBonds ? ` e incluye enlaces ${multipleBondSummary}` : ""}; aporta el nombre base: ${analysis.chainName}.`
      : `La cadena elegida tiene ${analysis.mainChain.length} carbonos${hasMultipleBonds ? ` e incluye enlaces ${multipleBondSummary}` : ""}: ${analysis.chainName}.`;
  const numberingExplanation = isRingStructure
    ? hasMultipleBonds
      ? "El anillo se numera desde un enlace múltiple y en el sentido que entrega los localizadores más bajos a dobles y triples enlaces."
      : analysis.substituents.length
        ? "Se inicia en un carbono sustituido y se recorre el anillo en el sentido que produce el conjunto de localizadores más bajo."
        : "Sin sustituyentes, todos los carbonos del anillo son equivalentes; la numeración mostrada sirve como referencia."
    : hasMultipleBonds
      ? "Se numera desde el extremo que entrega los localizadores más bajos a los enlaces múltiples."
      : "Se escoge el extremo que entrega el conjunto de localizadores más bajo.";
  const namingRuleTitle = analysis.family === "aromatic"
    ? "Aromaticidad"
    : analysis.family === "polycyclic"
      ? "Anillos como sustituyentes"
    : analysis.family === "cycloalkane"
      ? hasMultipleBonds ? "Insaturación del ciclo" : "Prefijo ciclo-"
      : hasMultipleBonds
        ? "Prioridad de insaturación"
        : "Orden alfabético";
  const namingRuleExplanation = analysis.family === "aromatic"
    ? "Los enlaces alternados representan los seis electrones π deslocalizados del anillo de benceno."
    : analysis.family === "polycyclic"
      ? "Un benceno unido como sustituyente se denomina fenil; un cicloalcano unido se nombra cicloalquil."
    : analysis.family === "cycloalkane"
      ? hasMultipleBonds
        ? "Los enlaces múltiples reciben los localizadores más bajos y cambian la terminación a -eno o -ino."
        : "El nombre del alcano con igual número de carbonos recibe el prefijo ciclo-."
      : hasMultipleBonds
        ? "La cadena principal conserva el mayor número posible de enlaces dobles y triples."
        : "Los prefijos di-, tri- y tetra- no se consideran al ordenar.";

  return (
    <main className="app-shell">
      <header className="site-header">
        <div className="brand-mark" aria-hidden="true">
          <span>C</span>
          <i />
          <span>C</span>
        </div>
        <div className="brand-copy">
          <p>Laboratorio interactivo</p>
          <h1>Constructor de hidrocarburos</h1>
        </div>
        <div className="header-actions">
          <button
            className="theme-control"
            onClick={cycleTheme}
            aria-label={`Tema ${themeModeLabel}. Cambiar modo de color`}
            title="Alternar entre automático, claro y oscuro"
          >
            <span className="theme-icon" aria-hidden="true">{isDarkTheme ? "☾" : "☀"}</span>
            <span>Tema <strong>{themeModeLabel}</strong></span>
          </button>
          <div className="scope-pill">
            <span className="status-dot" />
            Acíclicos · cíclicos · aromáticos
          </div>
        </div>
      </header>

      <section className="intro-strip" aria-label="Instrucciones breves">
        <div>
          <span className="step-number">1</span>
          <p><strong>Selecciona</strong> un carbono</p>
        </div>
        <div className="step-line" />
        <div>
          <span className="step-number">2</span>
          <p><strong>Añade</strong> carbonos y toca enlaces</p>
        </div>
        <div className="step-line" />
        <div>
          <span className="step-number">3</span>
          <p><strong>Analiza</strong> el nombre IUPAC</p>
        </div>
      </section>

      <div className="workspace-grid">
        <section className="builder-card">
          <div className="card-heading">
            <div>
              <p className="eyebrow">Estructura molecular</p>
              <h2>Construye el esqueleto de carbonos</h2>
            </div>
            <div className="heading-actions">
              <div className="view-mode-switch" role="group" aria-label="Tipo de representación molecular">
                <button
                  className={viewMode === "condensed" ? "active" : ""}
                  onClick={() => changeViewMode("condensed")}
                  aria-pressed={viewMode === "condensed"}
                  title="Vista semidesarrollada"
                >
                  <span className="condensed-icon" aria-hidden="true">CH₃</span>
                  <span className="mode-label">Semides.</span>
                </button>
                <button
                  className={viewMode === "skeletal" ? "active" : ""}
                  onClick={() => changeViewMode("skeletal")}
                  aria-pressed={viewMode === "skeletal"}
                  title="Vista esquelética o de líneas"
                >
                  <span className="line-angle-icon" aria-hidden="true"><i /><i /></span>
                  <span className="mode-label">Esquelética</span>
                </button>
              </div>
              <div className="history-controls" aria-label="Historial de cambios">
                <button onClick={undo} disabled={!history.length} title="Deshacer">↶</button>
                <button onClick={redo} disabled={!future.length} title="Rehacer">↷</button>
                <button className="new-button" onClick={newMolecule}>Nueva</button>
              </div>
            </div>
          </div>

          <div className={`molecule-stage ${viewMode === "skeletal" ? "skeletal-view" : "condensed-view"} ${highlightSubstituents ? "" : "uniform-colors"}`}>
            <svg
              role="img"
              aria-label={`${viewMode === "skeletal" ? "Representación esquelética" : "Representación semidesarrollada"} ${showIupacName ? `de ${displayedIupacName}` : "de la molécula construida"}`}
              viewBox={`${viewCenterX - viewWidth / 2} ${viewCenterY - viewHeight / 2} ${viewWidth} ${viewHeight}`}
            >
              <defs>
                <pattern id="dotGrid" width="26" height="26" patternUnits="userSpaceOnUse">
                  <circle cx="2" cy="2" r="1.4" fill="var(--grid-dot)" />
                </pattern>
              </defs>
              <rect
                x={viewCenterX - viewWidth / 2}
                y={viewCenterY - viewHeight / 2}
                width={viewWidth}
                height={viewHeight}
                fill="url(#dotGrid)"
              />

              {molecule.bonds.map((bond) => {
                const [a, b] = bond;
                const order = getBondOrder(bond);
                const positionA = displayPositions.get(a)!;
                const positionB = displayPositions.get(b)!;
                const isMainBond = mainChainSet.has(a) && mainChainSet.has(b);
                const deltaX = positionB.x - positionA.x;
                const deltaY = positionB.y - positionA.y;
                const bondLength = Math.hypot(deltaX, deltaY) || 1;
                const normalX = -deltaY / bondLength;
                const normalY = deltaX / bondLength;
                const offsets = order === 1 ? [0] : order === 2 ? [-5, 5] : [-8, 0, 8];
                const containingRing = molecule.rings?.find(
                  (ring) => ring.atomIds.includes(a) && ring.atomIds.includes(b),
                );
                const lockedBond = containingRing?.kind === "aromatic"
                  || Boolean(molecule.rings?.length && !containingRing);
                return (
                  <g
                    key={`${a}-${b}`}
                    className={`bond-control bond-order-${order} ${lockedBond ? "locked-bond" : ""}`}
                    onClick={() => cycleBondOrder(a, b)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        cycleBondOrder(a, b);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={lockedBond
                      ? `Enlace ${getBondOrderLabel(order)} fijado para conservar la estructura cíclica`
                      : `Enlace ${getBondOrderLabel(order)}. Activar para cambiar a ${getBondOrderLabel(order === 3 ? 1 : (order + 1) as BondOrder)}`}
                  >
                    <line
                      className="bond-hit-target"
                      x1={positionA.x}
                      y1={positionA.y}
                      x2={positionB.x}
                      y2={positionB.y}
                    />
                    {offsets.map((offset, index) => (
                      <line
                        key={index}
                        className={`${isMainBond ? "bond main-bond" : "bond branch-bond"} ${viewMode === "skeletal" ? "skeletal-bond" : ""}`}
                        x1={positionA.x + normalX * offset}
                        y1={positionA.y + normalY * offset}
                        x2={positionB.x + normalX * offset}
                        y2={positionB.y + normalY * offset}
                      />
                    ))}
                  </g>
                );
              })}

              {molecule.atoms.map((atom) => {
                const hydrogenCount = 4 - getValenceUsed(atom.id, molecule);
                const isSelected = atom.id === selectedAtom.id;
                const chainNumber = analysis.numberedAtoms.get(atom.id);
                const position = displayPositions.get(atom.id)!;
                const atomLabel = showHydrogens
                  ? hydrogenCount === 0
                    ? "C"
                    : hydrogenCount === 1
                      ? "CH"
                      : `CH${toSubscript(hydrogenCount)}`
                  : "C";
                return (
                  <g
                    key={atom.id}
                    className={`carbon-node ${viewMode === "skeletal" ? "skeletal-node" : "condensed-node"} ${isSelected ? "selected" : ""} ${mainChainSet.has(atom.id) ? "on-main-chain" : "on-branch"}`}
                    transform={`translate(${position.x} ${position.y})`}
                    onClick={() => {
                      setSelectedId(atom.id);
                      setNotice(`Carbono ${chainNumber ?? "sustituyente"} seleccionado.`);
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`Seleccionar carbono ${chainNumber ?? atom.id}`}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") setSelectedId(atom.id);
                    }}
                  >
                    {viewMode === "skeletal" ? (
                      <>
                        <circle className="skeletal-hit-target" r="31" />
                        {isSelected && <circle className="skeletal-selection-ring" r="22" />}
                        <circle className="skeletal-anchor" r="3.2" />
                        {molecule.atoms.length === 1 && (
                          <g className="methane-marker">
                            <circle r="28" />
                            <text textAnchor="middle" dominantBaseline="central">CH₄</text>
                          </g>
                        )}
                        {showNumbering && chainNumber && molecule.atoms.length > 1 && (
                          <g className="skeletal-number" transform="translate(20 -22)">
                            <circle className="number-circle" r="12" />
                            <text className="number-label" textAnchor="middle" dominantBaseline="central">{chainNumber}</text>
                          </g>
                        )}
                      </>
                    ) : (
                      <>
                        {isSelected && <circle className="selection-ring" r="39" />}
                        <circle className="atom-circle" r="28" />
                        <text className="atom-label" textAnchor="middle" dominantBaseline="central">{atomLabel}</text>
                        {showNumbering && chainNumber && (
                          <g transform="translate(25 -27)">
                            <circle className="number-circle" r="12" />
                            <text className="number-label" textAnchor="middle" dominantBaseline="central">{chainNumber}</text>
                          </g>
                        )}
                      </>
                    )}
                  </g>
                );
              })}
            </svg>

            <div className={`structure-family-badge family-${analysis.family}`}>
              {analysis.family === "aromatic" && <span aria-hidden="true">⌬</span>}
              {analysis.family === "cycloalkane" && <span aria-hidden="true">⬡</span>}
              {analysis.family === "polycyclic" && <span aria-hidden="true">⬡–⬡</span>}
              {structureFamilyLabel}
            </div>

            <div className="bond-touch-hint" aria-hidden="true">
              <span>↻</span>
              <strong>Toca un enlace</strong>
              <small>simple → doble → triple</small>
            </div>

            {viewMode === "skeletal" && (
              <div className="skeletal-hint">
                <span aria-hidden="true"><i /><i /></span>
                Cada extremo y vértice representa un C; los H están implícitos.
              </div>
            )}

            <div className="stage-legend" aria-label="Leyenda">
              {highlightSubstituents ? (
                <>
                  <span><i className="main-key" /> {isRingStructure ? "Anillo principal" : "Cadena principal"}</span>
                  <span><i className="branch-key" /> Sustituyente</span>
                </>
              ) : (
                <span><i className="main-key" /> Estructura uniforme</span>
              )}
            </div>
          </div>

          <div className="builder-toolbar">
            <div className="selection-summary">
              <span className="selection-icon">C</span>
              <div>
                <p>Carbono seleccionado</p>
                <strong>{selectedHydrogens} H implícito{selectedHydrogens === 1 ? "" : "s"} · valencia C–C {selectedValence}/4</strong>
              </div>
            </div>

            <div className="bond-order-picker" role="group" aria-label="Orden del próximo enlace">
              <span>Próximo enlace</span>
              <div>
                {([1, 2, 3] as BondOrder[]).map((order) => (
                  <button
                    key={order}
                    className={newBondOrder === order ? "active" : ""}
                    onClick={() => {
                      setNewBondOrder(order);
                      setNotice(
                        `Enlace ${getBondOrderLabel(order)} seleccionado. Añade un carbono o pulsa un enlace dibujado para cambiarlo.`,
                      );
                    }}
                    aria-pressed={newBondOrder === order}
                    title={`Crear enlace ${getBondOrderLabel(order)}`}
                  >
                    <span aria-hidden="true">{order === 1 ? "C–C" : order === 2 ? "C=C" : "C≡C"}</span>
                    <small>{getBondOrderLabel(order)}</small>
                  </button>
                ))}
              </div>
            </div>

            <div className="direction-pad" aria-label="Añadir carbono">
              <span className="pad-label">Añadir C</span>
              {directionOptions.map((option) => (
                <button
                  key={option.label}
                  className={option.className}
                  onClick={() => addCarbon(option.dx, option.dy)}
                  aria-label={`Añadir carbono hacia ${option.label.toLowerCase()}`}
                  title={`Añadir hacia ${option.label.toLowerCase()}`}
                >
                  {option.symbol}
                </button>
              ))}
              <span className="pad-center">+</span>
            </div>

            <div className="structure-actions">
              <button
                className={`alkyl-button ${showAlkylPalette ? "active" : ""}`}
                onClick={() => {
                  setShowAlkylPalette(!showAlkylPalette);
                  if (!showAlkylPalette) setShowRingPalette(false);
                }}
                aria-expanded={showAlkylPalette}
                aria-controls="alkyl-palette"
              >
                <span>+</span>
                Grupos alquilo
              </button>
              <button
                className={`ring-button ${showRingPalette ? "active" : ""}`}
                onClick={() => {
                  const nextVisible = !showRingPalette;
                  setShowRingPalette(nextVisible);
                  if (nextVisible) {
                    setShowAlkylPalette(false);
                    setRingInsertMode(molecule.rings?.length ? "attach" : "replace");
                  }
                }}
                aria-expanded={showRingPalette}
                aria-controls="ring-palette"
              >
                <span aria-hidden="true">⬡</span>
                Anillos
              </button>
              <button className="remove-button" onClick={removeSelected}>
                <span>−</span>
                Retirar terminal
              </button>
            </div>
          </div>

          {showAlkylPalette && (
            <div className="alkyl-palette" id="alkyl-palette">
              <div className="alkyl-palette-heading">
                <div>
                  <strong>Añadir al carbono seleccionado</strong>
                  <p>Elige un grupo completo; se colocará automáticamente en un espacio libre.</p>
                </div>
                <button onClick={() => setShowAlkylPalette(false)} aria-label="Cerrar grupos alquilo">×</button>
              </div>
              <div className="alkyl-grid">
                {ALKYL_TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    className="alkyl-option"
                    onClick={() => addAlkylGroup(template)}
                    title={`Añadir ${template.label.toLowerCase()}: ${template.systematic}`}
                  >
                    <span className="alkyl-formula">{template.formula}</span>
                    <span className="alkyl-copy">
                      <strong>{template.label}</strong>
                      <small>{template.systematic}</small>
                    </span>
                  </button>
                ))}
              </div>
              <p className="alkyl-note">
                Al buscar la cadena más larga, parte del grupo añadido puede convertirse en cadena principal.
              </p>
            </div>
          )}

          {showRingPalette && (
            <div className="alkyl-palette ring-palette" id="ring-palette">
              <div className="alkyl-palette-heading">
                <div>
                  <strong>Biblioteca de anillos</strong>
                  <p>
                    {ringInsertMode === "attach"
                      ? "El nuevo anillo se unirá mediante un enlace simple al carbono seleccionado."
                      : "El anillo elegido reemplazará la estructura actual y comenzará una molécula nueva."}
                  </p>
                </div>
                <button onClick={() => setShowRingPalette(false)} aria-label="Cerrar biblioteca de anillos">×</button>
              </div>

              <div className="ring-mode-switch" role="group" aria-label="Forma de insertar el anillo">
                <button
                  className={ringInsertMode === "replace" ? "active" : ""}
                  onClick={() => setRingInsertMode("replace")}
                  aria-pressed={ringInsertMode === "replace"}
                >
                  <span aria-hidden="true">↻</span>
                  Nueva molécula
                </button>
                <button
                  className={ringInsertMode === "attach" ? "active" : ""}
                  onClick={() => setRingInsertMode("attach")}
                  aria-pressed={ringInsertMode === "attach"}
                  disabled={selectedValence >= 4}
                  title={selectedValence >= 4 ? "Selecciona un carbono con una valencia libre" : undefined}
                >
                  <span aria-hidden="true">＋</span>
                  Unir al C seleccionado
                </button>
                <small>
                  {ringInsertMode === "attach"
                    ? `${molecule.rings?.length ?? 0} anillo${molecule.rings?.length === 1 ? "" : "s"} actualmente`
                    : "Reinicia solo la estructura"}
                </small>
              </div>

              <div className="ring-section">
                <div className="ring-section-heading">
                  <strong>Cicloalcanos</strong>
                  <span>CₙH₂ₙ · enlaces simples</span>
                </div>
                <div className="ring-grid cycle-ring-grid">
                  {CYCLE_TEMPLATES.map((template) => (
                    <button
                      key={template.id}
                      className="ring-option"
                      onClick={() => loadRingTemplate(template)}
                      title={`${ringInsertMode === "attach" ? "Unir" : "Cargar"} ${template.label.toLowerCase()}`}
                    >
                      <span className="ring-preview" aria-hidden="true">
                        <svg viewBox="0 0 48 48">
                          <polygon points={ringIconPoints(template.size)} />
                        </svg>
                      </span>
                      <span className="ring-option-copy">
                        <strong>{template.label}</strong>
                        <small>{template.formula} · {template.detail}</small>
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="ring-section aromatic-section">
                <div className="ring-section-heading">
                  <strong>Aromáticos monocíclicos</strong>
                  <span>Benceno y derivados alquilados</span>
                </div>
                <div className="ring-grid aromatic-ring-grid">
                  {AROMATIC_TEMPLATES.map((template) => {
                    const unavailable = ringInsertMode === "attach"
                      && template.molecule.atoms.length !== template.size;
                    return (
                      <button
                        key={template.id}
                        className={`ring-option aromatic-option ${unavailable ? "unavailable" : ""}`}
                        onClick={() => loadRingTemplate(template)}
                        title={unavailable
                          ? "Este derivado se carga como ejemplo completo; usa Benceno para unir otro anillo"
                          : `${ringInsertMode === "attach" ? "Unir" : "Cargar"} ${template.label.toLowerCase()}`}
                        disabled={unavailable}
                      >
                        <span className="ring-preview aromatic-preview" aria-hidden="true">
                          <svg viewBox="0 0 48 48">
                            <polygon points={ringIconPoints(6)} />
                            <circle cx="24" cy="24" r="9" />
                          </svg>
                        </span>
                        <span className="ring-option-copy">
                          <strong>{template.label}</strong>
                          <small>{template.formula} · {template.detail}</small>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <p className="alkyl-note ring-note">
                Puedes repetir “Unir al C seleccionado” para construir moléculas con varios anillos. Los anillos quedan conectados por enlaces simples; no se fusionan ni comparten carbonos.
              </p>
            </div>
          )}

          <div className="notice" role="status">
            <span>i</span>
            {notice}
          </div>

          <div className="display-options">
            <label className={viewMode === "skeletal" ? "option-disabled" : ""} title={viewMode === "skeletal" ? "Disponible en la vista semidesarrollada" : undefined}>
              <input type="checkbox" checked={showHydrogens} disabled={viewMode === "skeletal"} onChange={(event) => setShowHydrogens(event.target.checked)} />
              <span /> Mostrar H implícitos
            </label>
            <label>
              <input type="checkbox" checked={showNumbering} onChange={(event) => setShowNumbering(event.target.checked)} />
              <span /> Numerar {isRingStructure ? "anillo" : "cadena principal"}
            </label>
            <label>
              <input
                type="checkbox"
                checked={highlightSubstituents}
                onChange={(event) => {
                  const enabled = event.target.checked;
                  setHighlightSubstituents(enabled);
                  setNotice(
                    enabled
                      ? "Sustituyentes resaltados en amarillo para diferenciarlos de la cadena principal."
                      : "Color uniforme activado: cadena principal y sustituyentes comparten el mismo color.",
                  );
                }}
              />
              <span /> Resaltar sustituyentes
            </label>
          </div>
        </section>

        <aside className="analysis-card">
          <div className="analysis-heading">
            <div>
              <p className="eyebrow">Análisis en tiempo real</p>
              <h2>Nombre IUPAC sugerido</h2>
            </div>
            <div className="analysis-status">
              <span className="valid-badge">Estructura válida</span>
              <button
                className="name-visibility-button"
                onClick={() => {
                  setShowIupacName((visible) => !visible);
                  setNotice(
                    showIupacName
                      ? "Nombre IUPAC oculto: formula tu respuesta antes de mostrarlo."
                      : "Nombre IUPAC visible nuevamente.",
                  );
                }}
                aria-pressed={!showIupacName}
              >
                {showIupacName ? "Ocultar" : "Mostrar"}
              </button>
            </div>
          </div>

          <div className={`name-result ${showIupacName ? "" : "concealed"}`} aria-live="polite">
            <div className="name-copy">
              <p>
                {showIupacName
                  ? interactiveNameParts.map((part, index) =>
                      part.systematic && part.common ? (
                        <button
                          className={`alkyl-name-toggle ${part.active ? "common-active" : ""}`}
                          key={`${part.systematic}-${index}`}
                          type="button"
                          aria-pressed={Boolean(part.active)}
                          aria-label={part.active
                            ? `Volver de ${part.common} a ${part.systematic}`
                            : `Cambiar ${part.systematic} a ${part.common}`}
                          title={part.active
                            ? `Volver a (${part.systematic})`
                            : `Mostrar como ${part.common}`}
                          onClick={() => toggleCommonAlkylName(
                            part.systematic!,
                            part.common!,
                            Boolean(part.active),
                          )}
                        >
                          {part.text}
                        </button>
                      ) : (
                        <span key={`name-part-${index}`}>{part.text}</span>
                      ),
                    )
                  : "Respuesta oculta"}
              </p>
              {showIupacName && hasInteractiveAlkylName && (
                <small className="alkyl-name-help">
                  Pulsa el sustituyente destacado para alternar entre el nombre sistemático y el nombre alquilo.
                </small>
              )}
              {showIupacName && analysis.commonName && (
                <small>Nombre tradicional: <strong>{analysis.commonName}</strong></small>
              )}
            </div>
            <button
              title={showIupacName ? "Copiar nombre" : "Muestra el nombre antes de copiarlo"}
              aria-label="Copiar nombre IUPAC"
              disabled={!showIupacName}
              onClick={() => {
                navigator.clipboard?.writeText(displayedIupacName);
                setNotice("Nombre copiado al portapapeles.");
              }}
            >
              ⧉
            </button>
          </div>

          <div className="formula-row">
            <div>
              <span>Fórmula molecular</span>
              <strong>{analysis.formula}</strong>
            </div>
            <div>
              <span>Carbonos totales</span>
              <strong>{molecule.atoms.length}</strong>
            </div>
          </div>

          <div className="reasoning-section">
            <h3>Cómo se obtiene</h3>
            <ol>
              <li>
                <span>01</span>
                <div>
                  <strong>{primaryStructureTitle}</strong>
                  <p>{primaryStructureExplanation}</p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <strong>Numeración</strong>
                  <p>{numberingExplanation}</p>
                </div>
              </li>
            </ol>
          </div>

          <div className="naming-rule">
            <span aria-hidden="true">✓</span>
            <p>
              <strong>{namingRuleTitle}</strong>
              {namingRuleExplanation}
            </p>
          </div>
        </aside>
      </div>

      <section className="examples-card">
        <div>
          <p className="eyebrow">Explora estructuras conocidas</p>
          <h2>Ejemplos rápidos</h2>
        </div>
        <div className="preset-list">
          {PRESETS.map((preset) => (
            <button key={preset.label} onClick={() => loadPreset(preset)}>
              <span className="preset-structure">{preset.molecule.atoms.length} C</span>
              <span>{preset.label}</span>
              <i>→</i>
            </button>
          ))}
        </div>
      </section>

      <footer>
        <p><strong>Alcance actual:</strong> hidrocarburos acíclicos y estructuras con uno o varios anillos conectados.</p>
        <p className="footer-note">
          Los hidrógenos se completan automáticamente respetando la tetravalencia del carbono.
          <button
            className="credit-trigger"
            onClick={() => setShowCreatorCredit((visible) => !visible)}
            aria-expanded={showCreatorCredit}
            aria-controls="creator-credit"
            aria-label="Descubrir crédito del autor"
            title="Hay algo escondido aquí"
          >
            ✦
          </button>
        </p>
        <div
          className={`creator-credit ${showCreatorCredit ? "revealed" : ""}`}
          id="creator-credit"
          aria-hidden={!showCreatorCredit}
        >
          <span>Una experiencia creada por</span>
          <strong>Profe Alex Sáez</strong>
          <small>Química que se construye.</small>
        </div>
      </footer>
    </main>
  );
}
