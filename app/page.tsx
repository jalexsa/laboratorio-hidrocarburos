"use client";

import { useEffect, useMemo, useState } from "react";

type CarbonAtom = {
  id: number;
  x: number;
  y: number;
  element?: ChemicalElement;
};

type ChemicalElement = "C" | "O" | "N" | "F" | "Cl" | "Br" | "I";

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

type FunctionalGroupKind =
  | "halogen"
  | "alcohol"
  | "ether"
  | "aldehyde"
  | "ketone"
  | "carboxylicAcid"
  | "ester"
  | "amine"
  | "amide";

type FunctionalGroup = {
  id: string;
  kind: FunctionalGroupKind;
  label: string;
  atomIds: number[];
  carbonIds: number[];
  carbonId: number;
  heteroAtomId: number;
  alkylCarbonId?: number;
};

type FunctionalGroupTemplate = {
  id: string;
  label: string;
  shortFormula: string;
  category: "oxygen" | "nitrogen" | "halogen";
  detail: string;
  kind: FunctionalGroupKind;
  atoms: { element: ChemicalElement; x: number; y: number }[];
  bonds: [number, number, BondOrder][];
  requirement: "open" | "terminal-carbon" | "internal-carbon";
};

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
  functionalGroups: FunctionalGroup[];
  primaryFunctionalGroup?: FunctionalGroupKind;
  primaryFunctionalLabel?: string;
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
  systematic?: AlkylAliasKey;
  common?: string;
  active?: boolean;
  ringSystematic?: string;
  ringSimplified?: string;
  ringActive?: boolean;
};

type AlkylAliasKey = keyof typeof commonAlkylAliases;

type RingUnsaturationNameOption = {
  systematic: string;
  simplified: string;
  bondKind: "doble" | "triple";
};

const escapeRegularExpression = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function getInteractiveNameParts(
  name: string,
  enabledAliases: readonly string[],
  ringOption?: RingUnsaturationNameOption,
  useSimplifiedRingName = false,
): InteractiveNamePart[] {
  const ringTarget = ringOption
    ? useSimplifiedRingName ? ringOption.simplified : ringOption.systematic
    : undefined;
  const displayName = ringOption && ringTarget
    ? name.replace(ringOption.systematic, ringTarget)
    : name;
  const enabled = new Set(enabledAliases);
  const parts: InteractiveNamePart[] = [];
  const simpleMultipliers = simplePrefixes.slice(2).filter(Boolean).join("|");
  const complexMultipliers = Object.keys(simpleAliasPrefixes).join("|");
  const aliases = Object.entries(commonAlkylAliases) as [AlkylAliasKey, string][];
  let cursor = 0;

  while (cursor < displayName.length) {
    let nextMatch:
      | {
          index: number;
          text: string;
          systematic: AlkylAliasKey;
          common: string;
          active: boolean;
        }
      | undefined;

    aliases.forEach(([systematic, common]) => {
      const active = enabled.has(systematic);
      const source = active
        ? `(?:${simpleMultipliers})?${escapeRegularExpression(common)}`
        : `(?:${complexMultipliers})?\\(${escapeRegularExpression(systematic)}\\)`;
      const match = new RegExp(source).exec(displayName.slice(cursor));
      if (!match) return;
      const candidate = {
        index: cursor + match.index,
        text: match[0],
        systematic,
        common,
        active,
      };
      if (
        !nextMatch
        || candidate.index < nextMatch.index
        || (candidate.index === nextMatch.index && candidate.text.length > nextMatch.text.length)
      ) {
        nextMatch = candidate;
      }
    });

    if (!nextMatch) {
      parts.push({ text: displayName.slice(cursor) });
      break;
    }

    if (nextMatch.index > cursor) {
      parts.push({ text: displayName.slice(cursor, nextMatch.index) });
    }
    parts.push({
      text: nextMatch.text,
      systematic: nextMatch.systematic,
      common: nextMatch.common,
      active: nextMatch.active,
    });
    cursor = nextMatch.index + nextMatch.text.length;
  }

  const alkylParts = parts.length ? parts : [{ text: displayName }];
  if (!ringOption || !ringTarget) return alkylParts;

  return alkylParts.flatMap((part) => {
    if (part.systematic) return [part];
    const ringIndex = part.text.indexOf(ringTarget);
    if (ringIndex < 0) return [part];
    return [
      ...(ringIndex > 0 ? [{ text: part.text.slice(0, ringIndex) }] : []),
      {
        text: ringTarget,
        ringSystematic: ringOption.systematic,
        ringSimplified: ringOption.simplified,
        ringActive: useSimplifiedRingName,
      },
      ...(ringIndex + ringTarget.length < part.text.length
        ? [{ text: part.text.slice(ringIndex + ringTarget.length) }]
        : []),
    ];
  });
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

const getElement = (atom: CarbonAtom): ChemicalElement => atom.element ?? "C";

const elementValences: Record<ChemicalElement, number> = {
  C: 4,
  O: 2,
  N: 3,
  F: 1,
  Cl: 1,
  Br: 1,
  I: 1,
};

const elementNames: Record<ChemicalElement, string> = {
  C: "carbono",
  O: "oxígeno",
  N: "nitrógeno",
  F: "flúor",
  Cl: "cloro",
  Br: "bromo",
  I: "yodo",
};

const getAtom = (atomId: number, molecule: Molecule) =>
  molecule.atoms.find((atom) => atom.id === atomId);

const getValenceLimit = (atomId: number, molecule: Molecule) => {
  const atom = getAtom(atomId, molecule);
  return atom ? elementValences[getElement(atom)] : 0;
};

const getValenceUsed = (atomId: number, molecule: Molecule) =>
  molecule.bonds.reduce(
    (total, bond) => total + (bond[0] === atomId || bond[1] === atomId ? getBondOrder(bond) : 0),
    0,
  );

const getImplicitHydrogens = (atomId: number, molecule: Molecule) =>
  Math.max(0, getValenceLimit(atomId, molecule) - getValenceUsed(atomId, molecule));

const isCarbonAtom = (atom: CarbonAtom) => getElement(atom) === "C";

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

const functionalGroupLabels: Record<FunctionalGroupKind, string> = {
  halogen: "Halogenuro",
  alcohol: "Alcohol",
  ether: "Éter",
  aldehyde: "Aldehído",
  ketone: "Cetona",
  carboxylicAcid: "Ácido carboxílico",
  ester: "Éster",
  amine: "Amina",
  amide: "Amida",
};

const functionalGroupPriority: Record<FunctionalGroupKind, number> = {
  carboxylicAcid: 9,
  ester: 8,
  amide: 7,
  aldehyde: 6,
  ketone: 5,
  alcohol: 4,
  amine: 3,
  ether: 1,
  halogen: 1,
};

const FUNCTIONAL_GROUP_TEMPLATES: FunctionalGroupTemplate[] = [
  {
    id: "hydroxyl",
    label: "Alcohol",
    shortFormula: "–OH",
    category: "oxygen",
    detail: "grupo hidroxilo",
    kind: "alcohol",
    atoms: [{ element: "O", x: 1, y: 0 }],
    bonds: [[0, 1, 1]],
    requirement: "open",
  },
  {
    id: "ether-methyl",
    label: "Éter",
    shortFormula: "–O–CH₃",
    category: "oxygen",
    detail: "grupo metoxi",
    kind: "ether",
    atoms: [
      { element: "O", x: 1, y: 0 },
      { element: "C", x: 2, y: 0 },
    ],
    bonds: [[0, 1, 1], [1, 2, 1]],
    requirement: "open",
  },
  {
    id: "aldehyde",
    label: "Aldehído",
    shortFormula: "–CHO",
    category: "oxygen",
    detail: "carbonilo terminal",
    kind: "aldehyde",
    atoms: [{ element: "O", x: 1, y: 0 }],
    bonds: [[0, 1, 2]],
    requirement: "terminal-carbon",
  },
  {
    id: "ketone",
    label: "Cetona",
    shortFormula: ">C=O",
    category: "oxygen",
    detail: "carbonilo interno",
    kind: "ketone",
    atoms: [{ element: "O", x: 0, y: -1 }],
    bonds: [[0, 1, 2]],
    requirement: "internal-carbon",
  },
  {
    id: "carboxylic-acid",
    label: "Ácido carboxílico",
    shortFormula: "–COOH",
    category: "oxygen",
    detail: "carboxilo terminal",
    kind: "carboxylicAcid",
    atoms: [
      { element: "O", x: 0, y: -1 },
      { element: "O", x: 1, y: 0 },
    ],
    bonds: [[0, 1, 2], [0, 2, 1]],
    requirement: "terminal-carbon",
  },
  {
    id: "methyl-ester",
    label: "Éster metílico",
    shortFormula: "–COOCH₃",
    category: "oxygen",
    detail: "éster con metilo",
    kind: "ester",
    atoms: [
      { element: "O", x: 0, y: -1 },
      { element: "O", x: 1, y: 0 },
      { element: "C", x: 2, y: 0 },
    ],
    bonds: [[0, 1, 2], [0, 2, 1], [2, 3, 1]],
    requirement: "terminal-carbon",
  },
  {
    id: "amine",
    label: "Amina",
    shortFormula: "–NH₂",
    category: "nitrogen",
    detail: "amina primaria",
    kind: "amine",
    atoms: [{ element: "N", x: 1, y: 0 }],
    bonds: [[0, 1, 1]],
    requirement: "open",
  },
  {
    id: "amide",
    label: "Amida",
    shortFormula: "–CONH₂",
    category: "nitrogen",
    detail: "carbonilo con amino",
    kind: "amide",
    atoms: [
      { element: "O", x: 0, y: -1 },
      { element: "N", x: 1, y: 0 },
    ],
    bonds: [[0, 1, 2], [0, 2, 1]],
    requirement: "terminal-carbon",
  },
  ...(["F", "Cl", "Br", "I"] as ChemicalElement[]).map((element) => ({
    id: `halo-${element.toLowerCase()}`,
    label: element === "F" ? "Fluoro" : element === "Cl" ? "Cloro" : element === "Br" ? "Bromo" : "Yodo",
    shortFormula: `–${element}`,
    category: "halogen" as const,
    detail: "sustituyente halógeno",
    kind: "halogen" as const,
    atoms: [{ element, x: 1, y: 0 }],
    bonds: [[0, 1, 1] as [number, number, BondOrder]],
    requirement: "open" as const,
  })),
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
  {
    label: "Etanol",
    molecule: {
      atoms: [
        { id: 1, x: 0, y: 0 },
        { id: 2, x: 1, y: 0 },
        { id: 3, x: 2, y: 0, element: "O" },
      ],
      bonds: [[1, 2], [2, 3]],
    },
  },
  {
    label: "Metoxietano",
    molecule: {
      atoms: [
        { id: 1, x: 0, y: 0 },
        { id: 2, x: 1, y: 0 },
        { id: 3, x: 2, y: 0, element: "O" },
        { id: 4, x: 3, y: 0 },
      ],
      bonds: [[1, 2], [2, 3], [3, 4]],
    },
  },
  {
    label: "Etanal",
    molecule: {
      atoms: [
        { id: 1, x: 0, y: 0 },
        { id: 2, x: 1, y: 0 },
        { id: 3, x: 1, y: -1, element: "O" },
      ],
      bonds: [[1, 2], [2, 3, 2]],
    },
  },
  {
    label: "Propan-2-ona",
    molecule: {
      atoms: [
        { id: 1, x: 0, y: 0 },
        { id: 2, x: 1, y: 0 },
        { id: 3, x: 2, y: 0 },
        { id: 4, x: 1, y: -1, element: "O" },
      ],
      bonds: [[1, 2], [2, 3], [2, 4, 2]],
    },
  },
  {
    label: "Ácido etanoico",
    molecule: {
      atoms: [
        { id: 1, x: 0, y: 0 },
        { id: 2, x: 1, y: 0 },
        { id: 3, x: 1, y: -1, element: "O" },
        { id: 4, x: 2, y: 0, element: "O" },
      ],
      bonds: [[1, 2], [2, 3, 2], [2, 4]],
    },
  },
  {
    label: "Etanoato de metilo",
    molecule: {
      atoms: [
        { id: 1, x: 0, y: 0 },
        { id: 2, x: 1, y: 0 },
        { id: 3, x: 1, y: -1, element: "O" },
        { id: 4, x: 2, y: 0, element: "O" },
        { id: 5, x: 3, y: 0 },
      ],
      bonds: [[1, 2], [2, 3, 2], [2, 4], [4, 5]],
    },
  },
  {
    label: "Etanamina",
    molecule: {
      atoms: [
        { id: 1, x: 0, y: 0 },
        { id: 2, x: 1, y: 0 },
        { id: 3, x: 2, y: 0, element: "N" },
      ],
      bonds: [[1, 2], [2, 3]],
    },
  },
  {
    label: "Etanamida",
    molecule: {
      atoms: [
        { id: 1, x: 0, y: 0 },
        { id: 2, x: 1, y: 0 },
        { id: 3, x: 1, y: -1, element: "O" },
        { id: 4, x: 2, y: 0, element: "N" },
      ],
      bonds: [[1, 2], [2, 3, 2], [2, 4]],
    },
  },
  {
    label: "Cloroetano",
    molecule: {
      atoms: [
        { id: 1, x: 0, y: 0 },
        { id: 2, x: 1, y: 0 },
        { id: 3, x: 2, y: 0, element: "Cl" },
      ],
      bonds: [[1, 2], [2, 3]],
    },
  },
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

  if (!previous.has(end)) return [];

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
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .trim()
    .replace(/^(?:(?:\d+(?:,\d+)*|n(?:,n)*)-)+/, "")
    .replace(/[0-9,()\-]/g, "")
    .replace(/^(?:di|tri|tetra|penta|hexa|hepta|octa|bis|tris|tetrakis|pentakis|hexakis)/, "")
    .replace(/^(?:sec|terc|tert)/, "");
}

function compareAlphabeticalNames(left: string, right: string) {
  const keyComparison = stripForAlphabetizing(left).localeCompare(
    stripForAlphabetizing(right),
    "es",
    { sensitivity: "base" },
  );
  return keyComparison || left.localeCompare(right, "es", { sensitivity: "base" });
}

function resolveSubstituentNaming(
  substituent: NamedSubstituent,
  enabledAliases: ReadonlySet<string>,
) {
  const systematic = substituent.name as AlkylAliasKey;
  const common = commonAlkylAliases[systematic];
  if (common && enabledAliases.has(systematic)) {
    return {
      name: common,
      sortName: stripForAlphabetizing(common),
      complex: false,
    };
  }
  return {
    name: substituent.name,
    sortName: stripForAlphabetizing(substituent.name),
    complex: substituent.complex,
  };
}

function compareSubstituentAlphabeticalLocants(
  left: NamedSubstituent[],
  right: NamedSubstituent[],
  enabledAliases: readonly string[] = [],
) {
  const enabled = new Set(enabledAliases);
  const orderedLocants = (items: NamedSubstituent[]) => [...items]
    .sort((a, b) => {
      const leftName = resolveSubstituentNaming(a, enabled);
      const rightName = resolveSubstituentNaming(b, enabled);
      return compareAlphabeticalNames(leftName.sortName, rightName.sortName)
        || a.locant - b.locant;
    })
    .map((item) => item.locant);
  return compareNumberLists(orderedLocants(left), orderedLocants(right));
}

function sortFormattedPrefixParts(prefixParts: string[]) {
  return [...prefixParts].sort(compareAlphabeticalNames);
}

function formatSubstituentGroups(
  substituents: NamedSubstituent[],
  enabledAliases: readonly string[] = [],
) {
  const enabled = new Set(enabledAliases);
  const groups = new Map<string, NamedSubstituent[]>();
  substituents.forEach((substituent) => {
    const current = groups.get(substituent.name) ?? [];
    current.push(substituent);
    groups.set(substituent.name, current);
  });

  return [...groups.values()]
    .sort((left, right) => {
      const leftName = resolveSubstituentNaming(left[0], enabled);
      const rightName = resolveSubstituentNaming(right[0], enabled);
      return compareAlphabeticalNames(leftName.sortName, rightName.sortName);
    })
    .map((group) => {
      const locants = group.map((item) => item.locant).sort((a, b) => a - b).join(",");
      const { name, complex } = resolveSubstituentNaming(group[0], enabled);
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
      const locantComparison = compareNumberLists(leftLocants, rightLocants);
      return locantComparison || compareSubstituentAlphabeticalLocants(left.branches, right.branches);
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
  const counts = new Map<ChemicalElement, number>();
  molecule.atoms.forEach((atom) => {
    const element = getElement(atom);
    counts.set(element, (counts.get(element) ?? 0) + 1);
  });
  const hydrogenCount = molecule.atoms.reduce(
    (total, atom) => total + getImplicitHydrogens(atom.id, molecule),
    0,
  );

  const formatCount = (element: ChemicalElement, alwaysShowCount = false) => {
    const count = counts.get(element) ?? 0;
    if (!count) return "";
    return `${element}${count > 1 || alwaysShowCount ? toSubscript(count) : ""}`;
  };

  return [
    formatCount("C", true),
    hydrogenCount ? `H${toSubscript(hydrogenCount)}` : "",
    formatCount("Br"),
    formatCount("Cl"),
    formatCount("F"),
    formatCount("I"),
    formatCount("N"),
    formatCount("O"),
  ].filter(Boolean).join("");
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

export function getSingleRingUnsaturationNameOption(
  analysis: Analysis,
): RingUnsaturationNameOption | undefined {
  if (
    analysis.family !== "cycloalkane"
    || analysis.functionalGroups.length > 0
    || analysis.primaryFunctionalGroup
  ) {
    return undefined;
  }

  const hasSingleDouble = analysis.doubleBondLocants.length === 1
    && analysis.tripleBondLocants.length === 0;
  const hasSingleTriple = analysis.tripleBondLocants.length === 1
    && analysis.doubleBondLocants.length === 0;
  if (!hasSingleDouble && !hasSingleTriple) return undefined;

  const suffix = hasSingleDouble ? "-1-eno" : "-1-ino";
  if (!analysis.chainName.endsWith(suffix)) return undefined;
  return {
    systematic: analysis.chainName,
    simplified: `${analysis.chainName.slice(0, -suffix.length)}${hasSingleDouble ? "eno" : "ino"}`,
    bondKind: hasSingleDouble ? "doble" : "triple",
  };
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

function ringCandidates(
  molecule: Molecule,
  ring: RingInfo,
  enabledAliases: readonly string[] = [],
) {
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

    return compareSubstituentAlphabeticalLocants(
      left.substituents,
      right.substituents,
      enabledAliases,
    );
  });

  return candidates;
}

function buildRingAnalysis(
  molecule: Molecule,
  ring: RingInfo,
  family: RingKind | "polycyclic",
  enabledAliases: readonly string[] = [],
): Analysis {
  const chosen = ringCandidates(molecule, ring, enabledAliases)[0];
  const chainName = unsaturatedRingBaseName(
    ring,
    chosen.doubleBondLocants,
    chosen.tripleBondLocants,
  );
  const substituentParts = formatSubstituentGroups(chosen.substituents, enabledAliases);
  const singleSubstituent = chosen.substituents.length === 1
    ? resolveSubstituentNaming(chosen.substituents[0], new Set(enabledAliases))
    : undefined;
  let name = singleSubstituent
    ? `${singleSubstituent.complex ? `(${singleSubstituent.name})` : singleSubstituent.name}${chainName}`
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
    functionalGroups: [],
  };
}

function analyzeRingMolecule(molecule: Molecule, enabledAliases: readonly string[] = []): Analysis {
  const ring = molecule.rings![0];
  return buildRingAnalysis(molecule, ring, ring.kind, enabledAliases);
}

function analyzeMultiRingMolecule(molecule: Molecule, enabledAliases: readonly string[] = []): Analysis {
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
  return buildRingAnalysis(molecule, ranked[0], "polycyclic", enabledAliases);
}

function analyzeHydrocarbonMolecule(
  molecule: Molecule,
  enabledAliases: readonly string[] = [],
): Analysis {
  if ((molecule.rings?.length ?? 0) > 1) return analyzeMultiRingMolecule(molecule, enabledAliases);
  if (molecule.rings?.length === 1) return analyzeRingMolecule(molecule, enabledAliases);

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

    return compareSubstituentAlphabeticalLocants(
      left.substituents,
      right.substituents,
      enabledAliases,
    );
  });

  const chosen = candidates[0];
  const chainName = makeChainName(
    chosen.path.length,
    chosen.doubleBondLocants,
    chosen.tripleBondLocants,
  );
  const substituentParts = formatSubstituentGroups(chosen.substituents, enabledAliases);
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
    functionalGroups: [],
  };
}

function carbonSkeleton(molecule: Molecule): Molecule {
  const carbonIds = new Set(
    molecule.atoms.filter(isCarbonAtom).map((atom) => atom.id),
  );
  return {
    atoms: molecule.atoms.filter(isCarbonAtom).map((atom) => ({ ...atom, element: "C" })),
    bonds: molecule.bonds
      .filter(([a, b]) => carbonIds.has(a) && carbonIds.has(b))
      .map((bond) => [...bond] as Bond),
    rings: molecule.rings?.map((ring) => ({ ...ring, atomIds: [...ring.atomIds] })),
  };
}

function atomNeighbors(atomId: number, molecule: Molecule) {
  return molecule.bonds.flatMap((bond) => {
    if (bond[0] === atomId) return [{ atomId: bond[1], order: getBondOrder(bond) }];
    if (bond[1] === atomId) return [{ atomId: bond[0], order: getBondOrder(bond) }];
    return [];
  });
}

function detectFunctionalGroups(molecule: Molecule): FunctionalGroup[] {
  const groups: FunctionalGroup[] = [];
  const claimedHeteroAtoms = new Set<number>();
  const atomsById = new Map(molecule.atoms.map((atom) => [atom.id, atom]));
  const elementAt = (atomId: number) => {
    const atom = atomsById.get(atomId);
    return atom ? getElement(atom) : "C";
  };

  molecule.atoms.filter(isCarbonAtom).forEach((carbon) => {
    const neighbors = atomNeighbors(carbon.id, molecule);
    const doubleOxygen = neighbors.find(
      (neighbor) => elementAt(neighbor.atomId) === "O" && neighbor.order === 2,
    );
    if (!doubleOxygen) return;

    const singleOxygen = neighbors.find(
      (neighbor) => elementAt(neighbor.atomId) === "O" && neighbor.order === 1,
    );
    const singleNitrogen = neighbors.find(
      (neighbor) => elementAt(neighbor.atomId) === "N" && neighbor.order === 1,
    );

    if (singleOxygen) {
      const oxygenCarbonNeighbors = atomNeighbors(singleOxygen.atomId, molecule)
        .filter((neighbor) => neighbor.atomId !== carbon.id && elementAt(neighbor.atomId) === "C");
      const alkylCarbonId = oxygenCarbonNeighbors[0]?.atomId;
      const kind: FunctionalGroupKind = alkylCarbonId ? "ester" : "carboxylicAcid";
      groups.push({
        id: `${kind}-${carbon.id}`,
        kind,
        label: functionalGroupLabels[kind],
        atomIds: [
          carbon.id,
          doubleOxygen.atomId,
          singleOxygen.atomId,
          ...(alkylCarbonId ? [alkylCarbonId] : []),
        ],
        carbonIds: [carbon.id],
        carbonId: carbon.id,
        heteroAtomId: doubleOxygen.atomId,
        alkylCarbonId,
      });
      claimedHeteroAtoms.add(doubleOxygen.atomId);
      claimedHeteroAtoms.add(singleOxygen.atomId);
      return;
    }

    if (singleNitrogen) {
      groups.push({
        id: `amide-${carbon.id}`,
        kind: "amide",
        label: functionalGroupLabels.amide,
        atomIds: [carbon.id, doubleOxygen.atomId, singleNitrogen.atomId],
        carbonIds: [carbon.id],
        carbonId: carbon.id,
        heteroAtomId: singleNitrogen.atomId,
      });
      claimedHeteroAtoms.add(doubleOxygen.atomId);
      claimedHeteroAtoms.add(singleNitrogen.atomId);
      return;
    }

    const kind: FunctionalGroupKind = getImplicitHydrogens(carbon.id, molecule) > 0
      ? "aldehyde"
      : "ketone";
    groups.push({
      id: `${kind}-${carbon.id}`,
      kind,
      label: functionalGroupLabels[kind],
      atomIds: [carbon.id, doubleOxygen.atomId],
      carbonIds: [carbon.id],
      carbonId: carbon.id,
      heteroAtomId: doubleOxygen.atomId,
    });
    claimedHeteroAtoms.add(doubleOxygen.atomId);
  });

  molecule.atoms.forEach((atom) => {
    const element = getElement(atom);
    if (element !== "O" || claimedHeteroAtoms.has(atom.id)) return;
    const carbonNeighbors = atomNeighbors(atom.id, molecule)
      .filter((neighbor) => neighbor.order === 1 && elementAt(neighbor.atomId) === "C")
      .map((neighbor) => neighbor.atomId);
    if (carbonNeighbors.length === 1 && getValenceUsed(atom.id, molecule) === 1) {
      groups.push({
        id: `alcohol-${atom.id}`,
        kind: "alcohol",
        label: functionalGroupLabels.alcohol,
        atomIds: [carbonNeighbors[0], atom.id],
        carbonIds: [carbonNeighbors[0]],
        carbonId: carbonNeighbors[0],
        heteroAtomId: atom.id,
      });
      claimedHeteroAtoms.add(atom.id);
    } else if (carbonNeighbors.length === 2 && getValenceUsed(atom.id, molecule) === 2) {
      groups.push({
        id: `ether-${atom.id}`,
        kind: "ether",
        label: functionalGroupLabels.ether,
        atomIds: [atom.id, ...carbonNeighbors],
        carbonIds: carbonNeighbors,
        carbonId: carbonNeighbors[0],
        heteroAtomId: atom.id,
        alkylCarbonId: carbonNeighbors[1],
      });
      claimedHeteroAtoms.add(atom.id);
    }
  });

  molecule.atoms.forEach((atom) => {
    const element = getElement(atom);
    if (element !== "N" || claimedHeteroAtoms.has(atom.id)) return;
    const carbonNeighbors = atomNeighbors(atom.id, molecule)
      .filter((neighbor) => neighbor.order === 1 && elementAt(neighbor.atomId) === "C")
      .map((neighbor) => neighbor.atomId);
    if (!carbonNeighbors.length) return;
    groups.push({
      id: `amine-${atom.id}`,
      kind: "amine",
      label: functionalGroupLabels.amine,
      atomIds: [atom.id, ...carbonNeighbors],
      carbonIds: carbonNeighbors,
      carbonId: carbonNeighbors[0],
      heteroAtomId: atom.id,
    });
    claimedHeteroAtoms.add(atom.id);
  });

  molecule.atoms.forEach((atom) => {
    const element = getElement(atom);
    if (!(element === "F" || element === "Cl" || element === "Br" || element === "I")) return;
    const carbonNeighbor = atomNeighbors(atom.id, molecule)
      .find((neighbor) => elementAt(neighbor.atomId) === "C");
    if (!carbonNeighbor) return;
    const label = element === "F" ? "Fluoro" : element === "Cl" ? "Cloro" : element === "Br" ? "Bromo" : "Yodo";
    groups.push({
      id: `halogen-${atom.id}`,
      kind: "halogen",
      label,
      atomIds: [carbonNeighbor.atomId, atom.id],
      carbonIds: [carbonNeighbor.atomId],
      carbonId: carbonNeighbor.atomId,
      heteroAtomId: atom.id,
    });
  });

  return groups;
}

const suffixFunctionalGroups = new Set<FunctionalGroupKind>([
  "carboxylicAcid",
  "ester",
  "amide",
  "aldehyde",
  "ketone",
  "alcohol",
  "amine",
]);

function selectPrimaryFunctionalGroup(groups: FunctionalGroup[]) {
  return [...groups]
    .filter((group) => suffixFunctionalGroups.has(group.kind))
    .sort((left, right) => functionalGroupPriority[right.kind] - functionalGroupPriority[left.kind])[0]?.kind;
}

function carbonComponent(startId: number, skeleton: Molecule) {
  const adjacency = buildAdjacency(skeleton);
  const seen = new Set<number>();
  const stack = [startId];
  while (stack.length) {
    const current = stack.pop()!;
    if (seen.has(current)) continue;
    seen.add(current);
    (adjacency.get(current) ?? []).forEach((neighbor) => stack.push(neighbor));
  }
  return [...seen];
}

function simpleAlkylLength(startId: number, skeleton: Molecule) {
  const component = carbonComponent(startId, skeleton);
  const adjacency = buildAdjacency(skeleton);
  const simple = component.every(
    (atomId) => (adjacency.get(atomId) ?? []).filter((neighbor) => component.includes(neighbor)).length <= 2,
  );
  return simple ? component.length : 0;
}

function alkoxyName(startId: number, skeleton: Molecule) {
  const length = simpleAlkylLength(startId, skeleton);
  return length && alkaneRoots[length] ? `${alkaneRoots[length]}oxi` : "alcoxi";
}

function esterAlkylName(startId: number | undefined, skeleton: Molecule) {
  if (!startId) return "alquilo";
  const length = simpleAlkylLength(startId, skeleton);
  const name = alkylNames[length];
  return name ? `${name}o` : "alquilo";
}

function locantForGroup(group: FunctionalGroup, path: number[]) {
  const carbonId = group.carbonIds.find((candidate) => path.includes(candidate));
  return carbonId ? path.indexOf(carbonId) + 1 : undefined;
}

function functionalPrefixSubstituents(
  groups: FunctionalGroup[],
  path: number[],
  primaryKind: FunctionalGroupKind | undefined,
  molecule: Molecule,
  skeleton: Molecule,
): NamedSubstituent[] {
  const prefixes: NamedSubstituent[] = [];
  groups.forEach((group) => {
    const locant = locantForGroup(group, path);
    if (!locant) return;
    let name: string | undefined;
    if (group.kind === "halogen") {
      const element = getElement(getAtom(group.heteroAtomId, molecule)!);
      name = element === "F" ? "fluoro" : element === "Cl" ? "cloro" : element === "Br" ? "bromo" : "yodo";
    } else if (group.kind === "ether") {
      const parentCarbonId = group.carbonIds.find((candidate) => path.includes(candidate));
      const otherCarbonId = group.carbonIds.find((candidate) => candidate !== parentCarbonId);
      if (otherCarbonId) name = alkoxyName(otherCarbonId, skeleton);
    } else if (group.kind !== primaryKind) {
      name = group.kind === "alcohol"
        ? "hidroxi"
        : group.kind === "ketone"
          ? "oxo"
          : group.kind === "amine"
            ? "amino"
            : group.kind === "aldehyde"
              ? "formil"
              : undefined;
    }
    if (!name) return;
    prefixes.push({
      locant,
      name,
      sortName: stripForAlphabetizing(name),
      complex: false,
      atomIds: group.atomIds,
    });
  });
  return prefixes;
}

function makeFunctionalParentName(
  length: number,
  doubleLocants: number[],
  tripleLocants: number[],
  kind: FunctionalGroupKind,
  locants: number[],
  esterAlkyl?: string,
) {
  const hydrocarbonName = makeChainName(length, doubleLocants, tripleLocants);
  const stem = hydrocarbonName.endsWith("o") ? hydrocarbonName.slice(0, -1) : hydrocarbonName;
  const sortedLocants = [...locants].sort((a, b) => a - b);
  const locantText = sortedLocants.join(",");

  if (kind === "carboxylicAcid") return `ácido ${stem}oico`;
  if (kind === "ester") return `${stem}oato de ${esterAlkyl ?? "alquilo"}`;
  if (kind === "amide") return `${stem}amida`;
  if (kind === "aldehyde") return `${stem}al`;

  if (sortedLocants.length > 1) {
    const prefix = simplePrefixes[sortedLocants.length] ?? `${sortedLocants.length}`;
    if (kind === "alcohol") return `${hydrocarbonName}-${locantText}-${prefix}ol`;
    if (kind === "ketone") return `${hydrocarbonName}-${locantText}-${prefix}ona`;
    if (kind === "amine") return `${hydrocarbonName}-${locantText}-${prefix}amina`;
  }

  const locant = sortedLocants[0] ?? 1;
  if (kind === "alcohol") {
    if (!doubleLocants.length && !tripleLocants.length && length <= 2) return `${stem}ol`;
    return `${stem}-${locant}-ol`;
  }
  if (kind === "ketone") return `${stem}-${locant}-ona`;
  if (kind === "amine") {
    if (!doubleLocants.length && !tripleLocants.length && length <= 2) return `${stem}amina`;
    return `${stem}-${locant}-amina`;
  }
  return hydrocarbonName;
}

function combinePrefixAndParent(prefixParts: string[], parentName: string) {
  if (!prefixParts.length) return parentName;
  const prefix = prefixParts.join("-");
  return parentName.startsWith("ácido ")
    ? `ácido ${prefix}${parentName.slice("ácido ".length)}`
    : `${prefix}${parentName}`;
}

function nitrogenSubstituentPrefixes(
  group: FunctionalGroup | undefined,
  parentPath: number[],
  molecule: Molecule,
  skeleton: Molecule,
) {
  if (!group || !(group.kind === "amine" || group.kind === "amide")) return [];
  const extraCarbonIds = atomNeighbors(group.heteroAtomId, molecule)
    .map((neighbor) => neighbor.atomId)
    .filter((atomId) => {
      const atom = getAtom(atomId, molecule);
      if (!atom || !isCarbonAtom(atom)) return false;
      if (group.kind === "amide" && atomId === group.carbonId) return false;
      return !parentPath.includes(atomId);
    });
  const names = extraCarbonIds.map((atomId) => {
    const length = simpleAlkylLength(atomId, skeleton);
    return alkylNames[length] ?? "alquil";
  });
  const counts = new Map<string, number>();
  names.forEach((name) => counts.set(name, (counts.get(name) ?? 0) + 1));
  return [...counts.entries()].map(([name, count]) => {
    if (count === 1) return `N-${name}`;
    const prefix = simplePrefixes[count] ?? `${count}`;
    return `${Array.from({ length: count }, () => "N").join(",")}-${prefix}${name}`;
  });
}

function analyzeFunctionalAcyclic(
  molecule: Molecule,
  skeleton: Molecule,
  groups: FunctionalGroup[],
  primaryKind: FunctionalGroupKind | undefined,
  enabledAliases: readonly string[] = [],
): Analysis {
  const adjacency = buildAdjacency(skeleton);
  const bondOrders = new Map(
    skeleton.bonds.map((bond) => [bondKey(bond[0], bond[1]), getBondOrder(bond)]),
  );
  const atomIds = skeleton.atoms.map((atom) => atom.id);
  const orientedPaths: number[][] = atomIds.map((atomId) => [atomId]);
  atomIds.forEach((start, startIndex) => {
    atomIds.slice(startIndex + 1).forEach((end) => {
      const path = pathBetween(start, end, adjacency);
      if (path.length > 1) orientedPaths.push(path, [...path].reverse());
    });
  });

  const candidates = orientedPaths.map((path) => {
    const pathSet = new Set(path);
    const carbonSubstituents: NamedSubstituent[] = [];
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
        carbonSubstituents.push({ ...named, locant: index + 1 });
      }
    });
    const primaryLocants = primaryKind
      ? groups
          .filter((group) => group.kind === primaryKind)
          .map((group) => locantForGroup(group, path))
          .filter((locant): locant is number => Boolean(locant))
          .sort((a, b) => a - b)
      : [];
    const functionalPrefixes = functionalPrefixSubstituents(
      groups,
      path,
      primaryKind,
      molecule,
      skeleton,
    );
    return {
      path,
      carbonSubstituents,
      functionalPrefixes,
      substituents: [...carbonSubstituents, ...functionalPrefixes],
      doubleBondLocants,
      tripleBondLocants,
      multipleBondCount: doubleBondLocants.length + tripleBondLocants.length,
      primaryLocants,
    };
  });

  candidates.sort((left, right) => {
    if (left.primaryLocants.length !== right.primaryLocants.length) {
      return right.primaryLocants.length - left.primaryLocants.length;
    }
    if (left.multipleBondCount !== right.multipleBondCount) {
      return right.multipleBondCount - left.multipleBondCount;
    }
    if (left.path.length !== right.path.length) return right.path.length - left.path.length;
    const primaryComparison = compareNumberLists(left.primaryLocants, right.primaryLocants);
    if (primaryComparison !== 0) return primaryComparison;
    const multipleComparison = compareNumberLists(
      [...left.doubleBondLocants, ...left.tripleBondLocants].sort((a, b) => a - b),
      [...right.doubleBondLocants, ...right.tripleBondLocants].sort((a, b) => a - b),
    );
    if (multipleComparison !== 0) return multipleComparison;
    const doubleComparison = compareNumberLists(left.doubleBondLocants, right.doubleBondLocants);
    if (doubleComparison !== 0) return doubleComparison;
    const leftLocants = left.substituents.map((item) => item.locant).sort((a, b) => a - b);
    const rightLocants = right.substituents.map((item) => item.locant).sort((a, b) => a - b);
    const locantComparison = compareNumberLists(leftLocants, rightLocants);
    return locantComparison || compareSubstituentAlphabeticalLocants(
      left.substituents,
      right.substituents,
      enabledAliases,
    );
  });

  const chosen = candidates[0];
  const baseHydrocarbonName = makeChainName(
    chosen.path.length,
    chosen.doubleBondLocants,
    chosen.tripleBondLocants,
  );
  const primaryGroup = primaryKind
    ? groups.find((group) => group.kind === primaryKind && locantForGroup(group, chosen.path))
    : undefined;
  const chainName = primaryKind
    ? makeFunctionalParentName(
        chosen.path.length,
        chosen.doubleBondLocants,
        chosen.tripleBondLocants,
        primaryKind,
        chosen.primaryLocants,
        primaryKind === "ester"
          ? esterAlkylName(primaryGroup?.alkylCarbonId, skeleton)
          : undefined,
      )
    : baseHydrocarbonName;
  let substituentParts = formatSubstituentGroups(chosen.substituents, enabledAliases);
  if (
    chosen.path.length <= 2
    && chosen.substituents.length === 1
    && chosen.substituents[0].locant === 1
  ) {
    substituentParts = substituentParts.map((part) => part.replace(/^1-/, ""));
  }
  substituentParts = sortFormattedPrefixParts([
    ...nitrogenSubstituentPrefixes(primaryGroup, chosen.path, molecule, skeleton),
    ...substituentParts,
  ]);
  const name = combinePrefixAndParent(substituentParts, chainName);

  return {
    name,
    commonName: name === "propan-2-ona" ? "acetona" : undefined,
    formula: molecularFormula(molecule),
    family: "acyclic",
    mainChain: chosen.path,
    chainName,
    substituents: chosen.substituents,
    numberedAtoms: new Map(chosen.path.map((atomId, index) => [atomId, index + 1])),
    doubleBondLocants: chosen.doubleBondLocants,
    tripleBondLocants: chosen.tripleBondLocants,
    functionalGroups: groups,
    primaryFunctionalGroup: primaryKind,
    primaryFunctionalLabel: primaryKind ? functionalGroupLabels[primaryKind] : undefined,
  };
}

function ringAnchorLocant(group: FunctionalGroup, path: number[], skeleton: Molecule) {
  const direct = locantForGroup(group, path);
  if (direct) return direct;
  const adjacency = buildAdjacency(skeleton);
  for (const carbonId of group.carbonIds) {
    const anchor = path.find((ringAtomId) => (adjacency.get(ringAtomId) ?? []).includes(carbonId));
    if (anchor) return path.indexOf(anchor) + 1;
  }
  return undefined;
}

function makeRingFunctionalParentName(
  ring: RingInfo,
  primaryKind: FunctionalGroupKind,
  locants: number[],
  group: FunctionalGroup | undefined,
  skeleton: Molecule,
) {
  const aromatic = ring.kind === "aromatic" && ring.atomIds.length === 6;
  const groupOnRing = group ? group.carbonIds.some((carbonId) => ring.atomIds.includes(carbonId)) : false;
  const locant = [...locants].sort((a, b) => a - b)[0] ?? 1;
  const alkyl = esterAlkylName(group?.alkylCarbonId, skeleton);
  if (aromatic) {
    if (primaryKind === "alcohol" && groupOnRing) return "fenol";
    if (primaryKind === "amine" && groupOnRing) return "bencenamina";
    if (primaryKind === "carboxylicAcid") return "ácido benzoico";
    if (primaryKind === "ester") return `benzoato de ${alkyl}`;
    if (primaryKind === "amide") return "benzamida";
    if (primaryKind === "aldehyde") return "benzaldehído";
  }

  const base = ringBaseName(ring);
  const stem = base.endsWith("o") ? base.slice(0, -1) : base;
  if (!groupOnRing) {
    if (primaryKind === "carboxylicAcid") return `ácido ${stem}ocarboxílico`;
    if (primaryKind === "ester") return `${stem}ocarboxilato de ${alkyl}`;
    if (primaryKind === "amide") return `${stem}ocarboxamida`;
    if (primaryKind === "aldehyde") return `${stem}ocarbaldehído`;
  }
  if (primaryKind === "alcohol") return locant === 1 ? `${stem}ol` : `${stem}-${locant}-ol`;
  if (primaryKind === "ketone") return locant === 1 ? `${stem}ona` : `${stem}-${locant}-ona`;
  if (primaryKind === "amine") return `${stem}-${locant}-amina`;
  return base;
}

function analyzeFunctionalRing(
  molecule: Molecule,
  skeleton: Molecule,
  groups: FunctionalGroup[],
  primaryKind: FunctionalGroupKind | undefined,
  baseAnalysis: Analysis,
  enabledAliases: readonly string[] = [],
): Analysis {
  const ring = skeleton.rings?.find(
    (candidate) => candidate.atomIds.some((atomId) => baseAnalysis.mainChain.includes(atomId)),
  );
  if (!ring) return { ...baseAnalysis, formula: molecularFormula(molecule), functionalGroups: groups };
  const candidates = ringCandidates(skeleton, ring, enabledAliases).map((candidate) => {
    const primaryLocants = primaryKind
      ? groups
          .filter((group) => group.kind === primaryKind)
          .map((group) => ringAnchorLocant(group, candidate.path, skeleton))
          .filter((locant): locant is number => Boolean(locant))
          .sort((a, b) => a - b)
      : [];
    const claimedCarbonIds = new Set(groups.flatMap((group) => group.atomIds));
    const carbonSubstituents = candidate.substituents.filter(
      (substituent) => !substituent.atomIds.some((atomId) => claimedCarbonIds.has(atomId)),
    );
    const functionalPrefixes = functionalPrefixSubstituents(
      groups,
      candidate.path,
      primaryKind,
      molecule,
      skeleton,
    );
    return {
      ...candidate,
      primaryLocants,
      substituents: [...carbonSubstituents, ...functionalPrefixes],
    };
  });
  candidates.sort((left, right) => {
    if (left.primaryLocants.length !== right.primaryLocants.length) {
      return right.primaryLocants.length - left.primaryLocants.length;
    }
    const primaryComparison = compareNumberLists(left.primaryLocants, right.primaryLocants);
    if (primaryComparison !== 0) return primaryComparison;
    const multipleComparison = compareNumberLists(
      [...left.doubleBondLocants, ...left.tripleBondLocants].sort((a, b) => a - b),
      [...right.doubleBondLocants, ...right.tripleBondLocants].sort((a, b) => a - b),
    );
    if (multipleComparison !== 0) return multipleComparison;
    const locantComparison = compareNumberLists(
      left.substituents.map((item) => item.locant).sort((a, b) => a - b),
      right.substituents.map((item) => item.locant).sort((a, b) => a - b),
    );
    return locantComparison || compareSubstituentAlphabeticalLocants(
      left.substituents,
      right.substituents,
      enabledAliases,
    );
  });
  const chosen = candidates[0];
  const primaryGroup = primaryKind
    ? groups.find((group) => group.kind === primaryKind)
    : undefined;
  const hydrocarbonBase = unsaturatedRingBaseName(
    ring,
    chosen.doubleBondLocants,
    chosen.tripleBondLocants,
  );
  const chainName = primaryKind
    ? makeRingFunctionalParentName(ring, primaryKind, chosen.primaryLocants, primaryGroup, skeleton)
    : hydrocarbonBase;
  const singleSubstituent = chosen.substituents.length === 1
    ? resolveSubstituentNaming(chosen.substituents[0], new Set(enabledAliases))
    : undefined;
  const ringPrefixParts = !primaryKind && singleSubstituent
    ? [singleSubstituent.complex
        ? `(${singleSubstituent.name})`
        : singleSubstituent.name]
    : formatSubstituentGroups(chosen.substituents, enabledAliases);
  const name = combinePrefixAndParent(ringPrefixParts, chainName);
  const commonName = chainName === "bencenamina" ? "anilina" : baseAnalysis.commonName;

  return {
    ...baseAnalysis,
    name,
    commonName,
    formula: molecularFormula(molecule),
    mainChain: chosen.path,
    chainName,
    substituents: chosen.substituents,
    numberedAtoms: new Map(chosen.path.map((atomId, index) => [atomId, index + 1])),
    doubleBondLocants: chosen.doubleBondLocants,
    tripleBondLocants: chosen.tripleBondLocants,
    functionalGroups: groups,
    primaryFunctionalGroup: primaryKind,
    primaryFunctionalLabel: primaryKind ? functionalGroupLabels[primaryKind] : undefined,
  };
}

export function analyzeMolecule(molecule: Molecule, enabledAliases: readonly string[] = []): Analysis {
  const skeleton = carbonSkeleton(molecule);
  const baseAnalysis = analyzeHydrocarbonMolecule(skeleton, enabledAliases);
  const groups = detectFunctionalGroups(molecule);
  if (!groups.length) {
    return { ...baseAnalysis, formula: molecularFormula(molecule), functionalGroups: [] };
  }
  const primaryKind = selectPrimaryFunctionalGroup(groups);
  if (skeleton.rings?.length) {
    return analyzeFunctionalRing(
      molecule,
      skeleton,
      groups,
      primaryKind,
      baseAnalysis,
      enabledAliases,
    );
  }
  return analyzeFunctionalAcyclic(molecule, skeleton, groups, primaryKind, enabledAliases);
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
  const [showFunctionalPalette, setShowFunctionalPalette] = useState(false);
  const [ringInsertMode, setRingInsertMode] = useState<RingInsertMode>("replace");
  const [commonAlkylNameSelections, setCommonAlkylNameSelections] = useState<string[]>([]);
  const [useSimplifiedRingUnsaturationName, setUseSimplifiedRingUnsaturationName] = useState(false);
  const [themePreference, setThemePreference] = useState<ThemePreference>("auto");
  const [automaticDark, setAutomaticDark] = useState(false);
  const [showCreatorCredit, setShowCreatorCredit] = useState(false);
  const [notice, setNotice] = useState("Selecciona un carbono para añadir otro o toca un enlace para cambiar su orden.");

  const adjacency = useMemo(() => buildAdjacency(molecule), [molecule]);
  const analysis = useMemo(
    () => analyzeMolecule(molecule, commonAlkylNameSelections),
    [molecule, commonAlkylNameSelections],
  );
  const selectedAtom = molecule.atoms.find((atom) => atom.id === selectedId) ?? molecule.atoms[0];
  const mainChainSet = useMemo(() => new Set(analysis.mainChain), [analysis.mainChain]);
  const ringUnsaturationNameOption = useMemo(
    () => getSingleRingUnsaturationNameOption(analysis),
    [analysis],
  );
  const interactiveNameParts = useMemo(
    () => getInteractiveNameParts(
      analysis.name,
      commonAlkylNameSelections,
      ringUnsaturationNameOption,
      useSimplifiedRingUnsaturationName,
    ),
    [
      analysis.name,
      commonAlkylNameSelections,
      ringUnsaturationNameOption,
      useSimplifiedRingUnsaturationName,
    ],
  );
  const displayedIupacName = interactiveNameParts.map((part) => part.text).join("");
  const hasInteractiveAlkylName = interactiveNameParts.some((part) => part.systematic);
  const hasInteractiveRingName = interactiveNameParts.some((part) => part.ringSystematic);
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
        ? `${common} volvió a mostrarse como (${systematic}) y se recalculó el orden alfabético.`
        : `(${systematic}) ahora se muestra como ${common}; el nombre completo se reordenó alfabéticamente.`,
    );
  };

  const toggleRingUnsaturationName = (option: RingUnsaturationNameOption) => {
    setUseSimplifiedRingUnsaturationName((current) => !current);
    setNotice(
      useSimplifiedRingUnsaturationName
        ? `${option.simplified} volvió a mostrarse como ${option.systematic}.`
        : `${option.systematic} ahora se muestra como ${option.simplified}; en un ciclo con una sola insaturación, el localizador 1 puede omitirse.`,
    );
  };

  const addCarbon = (dx: number, dy: number) => {
    if (!isCarbonAtom(selectedAtom) && newBondOrder !== 1) {
      setNotice("En esta etapa, los nuevos enlaces desde O o N se añaden como enlaces simples para conservar un grupo funcional reconocido.");
      return;
    }
    if (molecule.rings?.length && newBondOrder !== 1) {
      setNotice("En los ciclos de esta etapa, los sustituyentes se conectan al anillo con enlaces simples.");
      return;
    }
    const selectedValence = getValenceUsed(selectedAtom.id, molecule);
    const selectedLimit = getValenceLimit(selectedAtom.id, molecule);
    if (selectedValence + newBondOrder > selectedLimit) {
      setNotice(
        `No se puede añadir un enlace ${getBondOrderLabel(newBondOrder)}: el ${elementNames[getElement(selectedAtom)]} seleccionado superaría su valencia ${selectedLimit}.`,
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
      atoms: [...molecule.atoms, { id: nextId, x: targetX, y: targetY, element: "C" }],
      bonds: [...molecule.bonds, [selectedAtom.id, nextId, newBondOrder] as Bond],
    };
    commit(
      next,
      `Carbono añadido al ${elementNames[getElement(selectedAtom)]} con enlace ${getBondOrderLabel(newBondOrder)}. El nombre se recalculó automáticamente.`,
    );
    setSelectedId(nextId);
  };

  const cycleBondOrder = (a: number, b: number) => {
    const atomA = getAtom(a, molecule);
    const atomB = getAtom(b, molecule);
    if ((atomA && !isCarbonAtom(atomA)) || (atomB && !isCarbonAtom(atomB))) {
      setNotice("Los enlaces de O, N y halógenos quedan fijados para conservar el grupo funcional. Retira el átomo terminal y elige otro grupo si deseas cambiarlo.");
      return;
    }
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
      && (getValenceUsed(a, molecule) + extraValence > getValenceLimit(a, molecule)
        || getValenceUsed(b, molecule) + extraValence > getValenceLimit(b, molecule))
    ) {
      setNotice(
        `Cambio imposible: el enlace ${getBondOrderLabel(nextOrder)} superaría la valencia permitida de uno de sus átomos.`,
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
    if (!isCarbonAtom(selectedAtom)) {
      setNotice("Selecciona un carbono para añadir un grupo alquilo.");
      return;
    }
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

  const addFunctionalGroup = (template: FunctionalGroupTemplate) => {
    if (!isCarbonAtom(selectedAtom)) {
      setNotice("Los grupos funcionales de la biblioteca se incorporan desde un carbono seleccionado.");
      return;
    }

    const carbonNeighbors = atomNeighbors(selectedAtom.id, molecule)
      .filter((neighbor) => {
        const atom = getAtom(neighbor.atomId, molecule);
        return atom && isCarbonAtom(atom);
      });
    const heteroNeighbors = atomNeighbors(selectedAtom.id, molecule)
      .filter((neighbor) => {
        const atom = getAtom(neighbor.atomId, molecule);
        return atom && !isCarbonAtom(atom);
      });
    const incomingValence = template.bonds
      .filter(([from]) => from === 0)
      .reduce((total, bond) => total + bond[2], 0);

    if (
      template.requirement === "terminal-carbon"
      && (carbonNeighbors.length > 1
        || carbonNeighbors.some((neighbor) => neighbor.order !== 1)
        || heteroNeighbors.length > 0)
    ) {
      setNotice(`${template.label} requiere un carbono terminal: selecciona un CH₃ del extremo de la cadena.`);
      return;
    }
    if (
      template.requirement === "internal-carbon"
      && (carbonNeighbors.length !== 2
        || carbonNeighbors.some((neighbor) => neighbor.order !== 1)
        || heteroNeighbors.length > 0)
    ) {
      setNotice(`${template.label} requiere un carbono interno unido por enlaces simples a otros dos carbonos.`);
      return;
    }
    if (getValenceUsed(selectedAtom.id, molecule) + incomingValence > 4) {
      setNotice(`No se puede añadir ${template.label.toLowerCase()}: el carbono superaría su tetravalencia.`);
      return;
    }

    const occupied = new Set(molecule.atoms.map((atom) => `${atom.x.toFixed(4)},${atom.y.toFixed(4)}`));
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
        const keys = candidate.map((atom) => `${atom.x.toFixed(4)},${atom.y.toFixed(4)}`);
        if (keys.every((key) => !occupied.has(key)) && new Set(keys).size === keys.length) {
          placement = candidate;
          break;
        }
      }
      if (placement) break;
    }

    if (!placement) {
      setNotice("No hay espacio libre para dibujar ese grupo. Prueba otro carbono o retira una rama cercana.");
      return;
    }

    const firstId = Math.max(...molecule.atoms.map((atom) => atom.id)) + 1;
    const idMap = placement.map((_, index) => firstId + index);
    const addedAtoms = placement.map((position, index) => ({
      ...position,
      id: idMap[index],
      element: template.atoms[index].element,
    }));
    const addedBonds = template.bonds.map(([from, to, order]) => [
      from === 0 ? selectedAtom.id : idMap[from - 1],
      idMap[to - 1],
      order,
    ] as Bond);
    const next: Molecule = {
      ...molecule,
      atoms: [...molecule.atoms, ...addedAtoms],
      bonds: [...molecule.bonds, ...addedBonds],
    };
    commit(
      next,
      `${template.label} añadido (${template.shortFormula}). Fórmula, grupo principal y nombre recalculados.`,
    );
    setSelectedId(idMap[0]);
    setShowFunctionalPalette(false);
  };

  const removeSelected = () => {
    if (ringContainingAtom(molecule, selectedAtom.id)) {
      setNotice("El carbono seleccionado forma parte del anillo y no puede retirarse. Elige un sustituyente terminal.");
      return;
    }
    const degree = (adjacency.get(selectedAtom.id) ?? []).length;
    const carbonCount = molecule.atoms.filter(isCarbonAtom).length;
    if (isCarbonAtom(selectedAtom) && carbonCount === 1) {
      setNotice("La molécula debe conservar al menos un carbono.");
      return;
    }
    if (degree > 1) {
      setNotice("Solo puedes retirar un átomo terminal para no cortar la molécula en dos.");
      return;
    }
    const neighbor = adjacency.get(selectedAtom.id)?.[0];
    const next: Molecule = {
      ...molecule,
      atoms: molecule.atoms.filter((atom) => atom.id !== selectedAtom.id),
      bonds: molecule.bonds.filter(([a, b]) => a !== selectedAtom.id && b !== selectedAtom.id),
    };
    commit(next, `${elementNames[getElement(selectedAtom)]} terminal retirado.`);
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
    setShowFunctionalPalette(false);
  };

  const loadRingTemplate = (template: RingTemplate) => {
    if (ringInsertMode === "attach") {
      if (!isCarbonAtom(selectedAtom)) {
        setNotice("Selecciona un carbono antes de unir un anillo.");
        return;
      }
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
      setShowFunctionalPalette(false);
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
    setShowFunctionalPalette(false);
  };

  const newMolecule = () => {
    const methane = makeChain(1);
    commit(methane, "Molécula nueva: comienza desde un átomo de carbono.");
    setSelectedId(1);
    setRingInsertMode("replace");
    setShowRingPalette(false);
    setShowFunctionalPalette(false);
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
  const selectedHydrogens = getImplicitHydrogens(selectedAtom.id, molecule);
  const selectedElement = getElement(selectedAtom);
  const selectedValenceLimit = getValenceLimit(selectedAtom.id, molecule);
  const carbonCount = molecule.atoms.filter(isCarbonAtom).length;
  const hasMultipleBonds = analysis.doubleBondLocants.length > 0 || analysis.tripleBondLocants.length > 0;
  const isRingStructure = analysis.family !== "acyclic";
  const carbonFamilyLabel = analysis.family === "aromatic"
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
  const structureFamilyLabel = analysis.primaryFunctionalLabel
    ? `${analysis.primaryFunctionalLabel} · ${carbonFamilyLabel}`
    : analysis.functionalGroups.length
      ? `${analysis.functionalGroups[0].label} · ${carbonFamilyLabel}`
      : carbonFamilyLabel;
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
  const primaryStructureTitle = analysis.primaryFunctionalLabel
    ? "Grupo funcional principal"
    : analysis.functionalGroups.length
      ? "Grupo funcional"
    : analysis.family === "aromatic"
    ? "Núcleo aromático"
    : analysis.family === "polycyclic"
      ? "Sistema de anillos"
    : analysis.family === "cycloalkane"
      ? "Anillo principal"
      : "Cadena principal";
  const primaryStructureExplanation = analysis.primaryFunctionalLabel
    ? `Se reconoce ${analysis.primaryFunctionalLabel.toLowerCase()} como el grupo de mayor prioridad. Este grupo determina el nombre base: ${analysis.chainName}.`
    : analysis.functionalGroups.length
      ? `La estructura contiene ${analysis.functionalGroups.map((group) => group.label.toLowerCase()).join(" y ")}; se expresan como prefijos sobre ${analysis.chainName}.`
    : analysis.family === "aromatic"
    ? "El anillo de seis carbonos con tres enlaces alternados se reconoce como el núcleo benceno."
    : analysis.family === "polycyclic"
      ? `La estructura contiene ${molecule.rings?.length ?? 0} anillos. Se toma como principal el que reúne más conexiones y aporta el nombre base: ${analysis.chainName}.`
    : analysis.family === "cycloalkane"
      ? `El ciclo contiene ${analysis.mainChain.length} carbonos${hasMultipleBonds ? ` e incluye enlaces ${multipleBondSummary}` : ""}; aporta el nombre base: ${analysis.chainName}.`
      : `La cadena elegida tiene ${analysis.mainChain.length} carbonos${hasMultipleBonds ? ` e incluye enlaces ${multipleBondSummary}` : ""}: ${analysis.chainName}.`;
  const numberingExplanation = analysis.primaryFunctionalLabel
    ? `La cadena o el anillo se orienta para entregar el localizador más bajo al grupo ${analysis.primaryFunctionalLabel.toLowerCase()}, antes que a enlaces múltiples y sustituyentes.`
    : isRingStructure
    ? hasMultipleBonds
      ? "El anillo se numera desde un enlace múltiple y en el sentido que entrega los localizadores más bajos a dobles y triples enlaces."
      : analysis.substituents.length
        ? "Se inicia en un carbono sustituido y se recorre el anillo en el sentido que produce el conjunto de localizadores más bajo."
        : "Sin sustituyentes, todos los carbonos del anillo son equivalentes; la numeración mostrada sirve como referencia."
    : hasMultipleBonds
      ? "Se numera desde el extremo que entrega los localizadores más bajos a los enlaces múltiples."
      : "Se escoge el extremo que entrega el conjunto de localizadores más bajo.";
  const namingRuleTitle = analysis.primaryFunctionalLabel
    ? "Prioridad funcional"
    : analysis.functionalGroups.length
      ? "Prefijos funcionales"
    : analysis.family === "aromatic"
    ? "Aromaticidad"
    : analysis.family === "polycyclic"
      ? "Anillos como sustituyentes"
    : analysis.family === "cycloalkane"
      ? hasMultipleBonds ? "Insaturación del ciclo" : "Prefijo ciclo-"
      : hasMultipleBonds
        ? "Prioridad de insaturación"
        : "Orden alfabético";
  const namingRuleExplanation = analysis.primaryFunctionalLabel
    ? `El grupo ${analysis.primaryFunctionalLabel.toLowerCase()} aporta el sufijo principal; los grupos de menor prioridad se nombran como prefijos.`
    : analysis.functionalGroups.length
      ? "Los halógenos y grupos alcoxi se indican como sustituyentes con su localizador correspondiente."
    : analysis.family === "aromatic"
    ? "Los enlaces alternados representan los seis electrones π deslocalizados del anillo de benceno."
    : analysis.family === "polycyclic"
      ? "Un benceno unido como sustituyente se denomina fenil; un cicloalcano unido se nombra cicloalquil."
    : analysis.family === "cycloalkane"
      ? hasMultipleBonds
        ? "Los enlaces múltiples reciben los localizadores más bajos y cambian la terminación a -eno o -ino."
        : "El nombre del alcano con igual número de carbonos recibe el prefijo ciclo-."
      : hasMultipleBonds
        ? "La cadena principal conserva el mayor número posible de enlaces dobles y triples."
        : "Los sustituyentes se ordenan por el nombre mostrado; di-, tri- y tetra- no se consideran al alfabetizar.";

  return (
    <main className="app-shell">
      <header className="site-header">
        <div className="brand-mark" aria-hidden="true">
          <span>C</span>
          <i />
          <span>O</span>
        </div>
        <div className="brand-copy">
          <p>Laboratorio interactivo</p>
          <h1>Constructor de química orgánica</h1>
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
            Hidrocarburos · grupos funcionales
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
          <p><strong>Añade</strong> C, enlaces y grupos funcionales</p>
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
              <h2>Construye la estructura orgánica</h2>
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
                const atomA = getAtom(a, molecule)!;
                const atomB = getAtom(b, molecule)!;
                const isFunctionalBond = !isCarbonAtom(atomA) || !isCarbonAtom(atomB);
                const deltaX = positionB.x - positionA.x;
                const deltaY = positionB.y - positionA.y;
                const bondLength = Math.hypot(deltaX, deltaY) || 1;
                const normalX = -deltaY / bondLength;
                const normalY = deltaX / bondLength;
                const offsets = order === 1 ? [0] : order === 2 ? [-5, 5] : [-8, 0, 8];
                const containingRing = molecule.rings?.find(
                  (ring) => ring.atomIds.includes(a) && ring.atomIds.includes(b),
                );
                const lockedBond = isFunctionalBond
                  || containingRing?.kind === "aromatic"
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
                      ? `Enlace ${getBondOrderLabel(order)} fijado para conservar ${isFunctionalBond ? "el grupo funcional" : "la estructura cíclica"}`
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
                        className={`${isMainBond ? "bond main-bond" : "bond branch-bond"} ${isFunctionalBond ? "functional-bond" : ""} ${viewMode === "skeletal" ? "skeletal-bond" : ""}`}
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
                const element = getElement(atom);
                const carbonAtom = isCarbonAtom(atom);
                const hydrogenCount = getImplicitHydrogens(atom.id, molecule);
                const isSelected = atom.id === selectedAtom.id;
                const chainNumber = analysis.numberedAtoms.get(atom.id);
                const position = displayPositions.get(atom.id)!;
                const atomLabel = carbonAtom
                  ? showHydrogens
                    ? hydrogenCount === 0
                      ? "C"
                      : "CH"
                    : "C"
                  : showHydrogens && hydrogenCount
                    ? `${element}H`
                    : element;
                const hydrogenSubscript = showHydrogens && hydrogenCount > 1
                  ? hydrogenCount
                  : undefined;
                return (
                  <g
                    key={atom.id}
                    className={`carbon-node ${carbonAtom ? "carbon-element" : `hetero-node element-${element.toLowerCase()}`} ${viewMode === "skeletal" && carbonAtom ? "skeletal-node" : "condensed-node"} ${isSelected ? "selected" : ""} ${mainChainSet.has(atom.id) ? "on-main-chain" : "on-branch"}`}
                    transform={`translate(${position.x} ${position.y})`}
                    onClick={() => {
                      setSelectedId(atom.id);
                      setNotice(`${elementNames[element][0].toUpperCase()}${elementNames[element].slice(1)} ${chainNumber ?? "del grupo funcional"} seleccionado.`);
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`Seleccionar ${elementNames[element]} ${chainNumber ?? atom.id}`}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") setSelectedId(atom.id);
                    }}
                  >
                    {viewMode === "skeletal" && carbonAtom ? (
                      <>
                        <circle className="skeletal-hit-target" r="31" />
                        {isSelected && <circle className="skeletal-selection-ring" r="22" />}
                        <circle className="skeletal-anchor" r="3.2" />
                        {carbonCount === 1 && molecule.atoms.length === 1 && (
                          <g className="methane-marker">
                            <circle r="28" />
                            <text textAnchor="middle" dominantBaseline="central">
                              <tspan>CH</tspan>
                              <tspan className="hydrogen-subscript" baselineShift="sub">4</tspan>
                            </text>
                          </g>
                        )}
                        {showNumbering && chainNumber && carbonCount > 1 && (
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
                        <text className="atom-label" textAnchor="middle" dominantBaseline="central">
                          <tspan>{atomLabel}</tspan>
                          {hydrogenSubscript && (
                            <tspan className="hydrogen-subscript" baselineShift="sub">
                              {hydrogenSubscript}
                            </tspan>
                          )}
                        </text>
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

            <div className={`structure-family-badge family-${analysis.family} ${analysis.functionalGroups.length ? "has-functional-group" : ""}`}>
              {analysis.functionalGroups.length > 0 && <span aria-hidden="true">⚗</span>}
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
              <span className={`selection-icon selection-${selectedElement.toLowerCase()}`}>{selectedElement}</span>
              <div>
                <p>{elementNames[selectedElement][0].toUpperCase() + elementNames[selectedElement].slice(1)} seleccionado</p>
                <strong>{selectedHydrogens} H implícito{selectedHydrogens === 1 ? "" : "s"} · valencia {selectedValence}/{selectedValenceLimit}</strong>
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
                  if (!showAlkylPalette) {
                    setShowRingPalette(false);
                    setShowFunctionalPalette(false);
                  }
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
                    setShowFunctionalPalette(false);
                    setRingInsertMode(molecule.rings?.length ? "attach" : "replace");
                  }
                }}
                aria-expanded={showRingPalette}
                aria-controls="ring-palette"
              >
                <span aria-hidden="true">⬡</span>
                Anillos
              </button>
              <button
                className={`functional-button ${showFunctionalPalette ? "active" : ""}`}
                onClick={() => {
                  const nextVisible = !showFunctionalPalette;
                  setShowFunctionalPalette(nextVisible);
                  if (nextVisible) {
                    setShowAlkylPalette(false);
                    setShowRingPalette(false);
                  }
                }}
                aria-expanded={showFunctionalPalette}
                aria-controls="functional-palette"
              >
                <span aria-hidden="true">OH</span>
                Grupos funcionales
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
                  disabled={!isCarbonAtom(selectedAtom) || selectedValence >= 4}
                  title={!isCarbonAtom(selectedAtom) || selectedValence >= 4 ? "Selecciona un carbono con una valencia libre" : undefined}
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

          {showFunctionalPalette && (
            <div className="alkyl-palette functional-palette" id="functional-palette">
              <div className="alkyl-palette-heading">
                <div>
                  <strong>Biblioteca de grupos funcionales</strong>
                  <p>Selecciona primero el carbono que llevará el grupo. La valencia y el nombre se validan automáticamente.</p>
                </div>
                <button onClick={() => setShowFunctionalPalette(false)} aria-label="Cerrar grupos funcionales">×</button>
              </div>

              <div className="functional-priority-note">
                <span aria-hidden="true">⇧</span>
                <p><strong>La prioridad importa:</strong> el grupo principal define el sufijo y recibe el localizador más bajo.</p>
              </div>

              {([
                { id: "oxygen", title: "Grupos con oxígeno", detail: "Alcoholes, carbonilos, ácidos y derivados" },
                { id: "nitrogen", title: "Grupos con nitrógeno", detail: "Aminas y amidas" },
                { id: "halogen", title: "Derivados halogenados", detail: "F, Cl, Br e I se nombran como prefijos" },
              ] as const).map((category) => (
                <div className={`functional-section functional-${category.id}`} key={category.id}>
                  <div className="functional-section-heading">
                    <strong>{category.title}</strong>
                    <span>{category.detail}</span>
                  </div>
                  <div className="functional-grid">
                    {FUNCTIONAL_GROUP_TEMPLATES
                      .filter((template) => template.category === category.id)
                      .map((template) => (
                        <button
                          className="functional-option"
                          key={template.id}
                          onClick={() => addFunctionalGroup(template)}
                          title={`Añadir ${template.label.toLowerCase()}: ${template.detail}`}
                        >
                          <span className="functional-formula">{template.shortFormula}</span>
                          <span className="functional-copy">
                            <strong>{template.label}</strong>
                            <small>{template.detail}</small>
                          </span>
                          {template.requirement !== "open" && (
                            <em>{template.requirement === "terminal-carbon" ? "C terminal" : "C interno"}</em>
                          )}
                        </button>
                      ))}
                  </div>
                </div>
              ))}

              <p className="alkyl-note functional-note">
                Para aldehídos, ácidos, ésteres y amidas usa un carbono terminal. Para una cetona, selecciona un carbono interno de la cadena.
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
                      ) : part.ringSystematic && part.ringSimplified && ringUnsaturationNameOption ? (
                        <button
                          className={`alkyl-name-toggle ring-name-toggle ${part.ringActive ? "common-active" : ""}`}
                          key={`ring-name-${index}`}
                          type="button"
                          aria-pressed={Boolean(part.ringActive)}
                          aria-label={part.ringActive
                            ? `Volver de ${part.ringSimplified} a ${part.ringSystematic}`
                            : `Cambiar ${part.ringSystematic} a ${part.ringSimplified}`}
                          title={part.ringActive
                            ? `Mostrar ${part.ringSystematic}`
                            : `Omitir el localizador 1: ${part.ringSimplified}`}
                          onClick={() => toggleRingUnsaturationName(ringUnsaturationNameOption)}
                        >
                          {part.text}
                        </button>
                      ) : (
                        <span key={`name-part-${index}`}>{part.text}</span>
                      ),
                    )
                  : "Respuesta oculta"}
              </p>
              {showIupacName && (hasInteractiveAlkylName || hasInteractiveRingName) && (
                <small className="alkyl-name-help">
                  {hasInteractiveAlkylName && hasInteractiveRingName
                    ? "Pulsa cada fragmento destacado para alternar su forma de nomenclatura."
                    : hasInteractiveRingName
                      ? "Pulsa el nombre del ciclo para mostrar u omitir el localizador 1."
                      : "Pulsa el sustituyente destacado para cambiar su forma; el orden alfabético se recalcula automáticamente."}
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

          {analysis.functionalGroups.length > 0 && (
            <div className="functional-detection" aria-label="Grupos funcionales detectados">
              <span>Detectados</span>
              <div>
                {[...new Map(analysis.functionalGroups.map((group) => [group.label, group])).values()]
                  .map((group) => (
                    <strong key={group.label}>{group.label}</strong>
                  ))}
              </div>
            </div>
          )}

          <div className="formula-row">
            <div>
              <span>Fórmula molecular</span>
              <strong>{analysis.formula}</strong>
            </div>
            <div>
              <span>Carbonos totales</span>
              <strong>{carbonCount}</strong>
            </div>
            <div>
              <span>Grupo principal</span>
              <strong>{analysis.primaryFunctionalLabel ?? (analysis.functionalGroups[0]?.label || "Hidrocarburo")}</strong>
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
              <span className="preset-structure">{preset.molecule.atoms.filter(isCarbonAtom).length} C</span>
              <span>{preset.label}</span>
              <i>→</i>
            </button>
          ))}
        </div>
      </section>

      <footer>
        <p><strong>Alcance actual:</strong> hidrocarburos y nueve familias funcionales con O, N y halógenos.</p>
        <p className="footer-note">
          Los hidrógenos se completan automáticamente respetando las valencias de C, O, N y halógenos.
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
