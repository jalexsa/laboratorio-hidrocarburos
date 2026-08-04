"use client";

import { useMemo, useState } from "react";

type CarbonAtom = {
  id: number;
  x: number;
  y: number;
};

type Bond = [number, number];

type Molecule = {
  atoms: CarbonAtom[];
  bonds: Bond[];
};

type ViewMode = "condensed" | "skeletal";

type AlkylTemplate = {
  id: string;
  label: string;
  systematic: string;
  formula: string;
  atoms: { x: number; y: number }[];
  connections: [number, number][];
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
  formula: string;
  mainChain: number[];
  chainName: string;
  substituents: NamedSubstituent[];
  numberedAtoms: Map<number, number>;
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

const makeChain = (length: number): Molecule => ({
  atoms: Array.from({ length }, (_, index) => ({ id: index + 1, x: index, y: 0 })),
  bonds: Array.from({ length: Math.max(0, length - 1) }, (_, index) => [index + 1, index + 2]),
});

const PRESETS: { label: string; molecule: Molecule }[] = [
  { label: "Butano", molecule: makeChain(4) },
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
];

function cloneMolecule(molecule: Molecule): Molecule {
  return {
    atoms: molecule.atoms.map((atom) => ({ ...atom })),
    bonds: molecule.bonds.map(([a, b]) => [a, b]),
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

function analyzeMolecule(molecule: Molecule): Analysis {
  const adjacency = buildAdjacency(molecule);
  const atomIds = molecule.atoms.map((atom) => atom.id);
  let longestPaths: number[][] = atomIds.length === 1 ? [[atomIds[0]]] : [];
  let longestLength = longestPaths[0]?.length ?? 0;

  atomIds.forEach((start, startIndex) => {
    atomIds.slice(startIndex + 1).forEach((end) => {
      const path = pathBetween(start, end, adjacency);
      if (path.length > longestLength) {
        longestLength = path.length;
        longestPaths = [path, [...path].reverse()];
      } else if (path.length === longestLength) {
        longestPaths.push(path, [...path].reverse());
      }
    });
  });

  const candidates = longestPaths.map((path) => {
    const pathSet = new Set(path);
    const substituents: NamedSubstituent[] = [];
    path.forEach((atomId, index) => {
      for (const neighbor of adjacency.get(atomId) ?? []) {
        if (pathSet.has(neighbor)) continue;
        const named = nameSubstituent(neighbor, atomId, adjacency);
        substituents.push({ ...named, locant: index + 1 });
      }
    });
    return { path, substituents };
  });

  candidates.sort((left, right) => {
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
  const chainRoot = alkaneRoots[chosen.path.length];
  const chainName = chainRoot ? `${chainRoot}ano` : `alcano de ${chosen.path.length} carbonos`;
  const substituentParts = formatSubstituentGroups(chosen.substituents);
  const name = substituentParts.length ? `${substituentParts.join("-")}${chainName}` : chainName;
  const numberedAtoms = new Map(chosen.path.map((atomId, index) => [atomId, index + 1]));
  const carbonCount = molecule.atoms.length;

  return {
    name,
    formula: `C${toSubscript(carbonCount)}H${toSubscript(2 * carbonCount + 2)}`,
    mainChain: chosen.path,
    chainName,
    substituents: chosen.substituents,
    numberedAtoms,
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

function getDisplayPosition(atom: CarbonAtom, viewMode: ViewMode) {
  if (viewMode === "condensed") {
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

export default function Home() {
  const [molecule, setMolecule] = useState<Molecule>(() => cloneMolecule(PRESETS[1].molecule));
  const [selectedId, setSelectedId] = useState(2);
  const [history, setHistory] = useState<Molecule[]>([]);
  const [future, setFuture] = useState<Molecule[]>([]);
  const [showHydrogens, setShowHydrogens] = useState(true);
  const [showNumbering, setShowNumbering] = useState(true);
  const [highlightSubstituents, setHighlightSubstituents] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("condensed");
  const [showIupacName, setShowIupacName] = useState(true);
  const [showAlkylPalette, setShowAlkylPalette] = useState(false);
  const [notice, setNotice] = useState("Selecciona un carbono y añade otro en una dirección libre.");

  const adjacency = useMemo(() => buildAdjacency(molecule), [molecule]);
  const analysis = useMemo(() => analyzeMolecule(molecule), [molecule]);
  const selectedAtom = molecule.atoms.find((atom) => atom.id === selectedId) ?? molecule.atoms[0];
  const mainChainSet = useMemo(() => new Set(analysis.mainChain), [analysis.mainChain]);

  const commit = (next: Molecule, message: string) => {
    setHistory((items) => [...items, cloneMolecule(molecule)]);
    setFuture([]);
    setMolecule(next);
    setNotice(message);
  };

  const addCarbon = (dx: number, dy: number) => {
    if ((adjacency.get(selectedAtom.id) ?? []).length >= 4) {
      setNotice("Ese carbono ya tiene cuatro enlaces. Selecciona otro carbono.");
      return;
    }
    const targetX = selectedAtom.x + dx;
    const targetY = selectedAtom.y + dy;
    if (molecule.atoms.some((atom) => atom.x === targetX && atom.y === targetY)) {
      setNotice("Ese espacio ya está ocupado. Prueba otra dirección.");
      return;
    }
    const nextId = Math.max(...molecule.atoms.map((atom) => atom.id)) + 1;
    const next = {
      atoms: [...molecule.atoms, { id: nextId, x: targetX, y: targetY }],
      bonds: [...molecule.bonds, [selectedAtom.id, nextId] as Bond],
    };
    commit(next, "Carbono añadido. El nombre se recalculó automáticamente.");
    setSelectedId(nextId);
  };

  const addAlkylGroup = (template: AlkylTemplate) => {
    if ((adjacency.get(selectedAtom.id) ?? []).length >= 4) {
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
    const next = {
      atoms: [...molecule.atoms, ...addedAtoms],
      bonds: [...molecule.bonds, ...addedBonds],
    };

    commit(next, `${template.label} añadido. La cadena principal y el nombre se recalcularon.`);
    setSelectedId(idMap[0]);
  };

  const removeSelected = () => {
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
    const next = {
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
  };

  const newMolecule = () => {
    const methane = makeChain(1);
    commit(methane, "Molécula nueva: comienza desde un átomo de carbono.");
    setSelectedId(1);
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
    molecule.atoms.map((atom) => [atom.id, getDisplayPosition(atom, viewMode)]),
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
  const selectedHydrogens = 4 - (adjacency.get(selectedAtom.id)?.length ?? 0);

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
        <div className="scope-pill">
          <span className="status-dot" />
          Alcanos acíclicos
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
          <p><strong>Añade</strong> carbonos alrededor</p>
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
              aria-label={`${viewMode === "skeletal" ? "Representación esquelética" : "Representación semidesarrollada"} ${showIupacName ? `de ${analysis.name}` : "de la molécula construida"}`}
              viewBox={`${viewCenterX - viewWidth / 2} ${viewCenterY - viewHeight / 2} ${viewWidth} ${viewHeight}`}
            >
              <defs>
                <pattern id="dotGrid" width="26" height="26" patternUnits="userSpaceOnUse">
                  <circle cx="2" cy="2" r="1.4" fill="#cbd7d3" />
                </pattern>
              </defs>
              <rect
                x={viewCenterX - viewWidth / 2}
                y={viewCenterY - viewHeight / 2}
                width={viewWidth}
                height={viewHeight}
                fill="url(#dotGrid)"
              />

              {molecule.bonds.map(([a, b]) => {
                const positionA = displayPositions.get(a)!;
                const positionB = displayPositions.get(b)!;
                const isMainBond = mainChainSet.has(a) && mainChainSet.has(b);
                return (
                  <line
                    key={`${a}-${b}`}
                    className={`${isMainBond ? "bond main-bond" : "bond branch-bond"} ${viewMode === "skeletal" ? "skeletal-bond" : ""}`}
                    x1={positionA.x}
                    y1={positionA.y}
                    x2={positionB.x}
                    y2={positionB.y}
                  />
                );
              })}

              {molecule.atoms.map((atom) => {
                const degree = adjacency.get(atom.id)?.length ?? 0;
                const hydrogenCount = 4 - degree;
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

            {viewMode === "skeletal" && (
              <div className="skeletal-hint">
                <span aria-hidden="true"><i /><i /></span>
                Cada extremo y vértice representa un C; los H están implícitos.
              </div>
            )}

            <div className="stage-legend" aria-label="Leyenda">
              {highlightSubstituents ? (
                <>
                  <span><i className="main-key" /> Cadena principal</span>
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
                <strong>{selectedHydrogens} H implícito{selectedHydrogens === 1 ? "" : "s"} · {4 - selectedHydrogens} enlace{4 - selectedHydrogens === 1 ? "" : "s"} C–C</strong>
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
                onClick={() => setShowAlkylPalette((visible) => !visible)}
                aria-expanded={showAlkylPalette}
                aria-controls="alkyl-palette"
              >
                <span>+</span>
                Grupos alquilo
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
              <span /> Numerar cadena principal
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
            <p>{showIupacName ? analysis.name : "Respuesta oculta"}</p>
            <button
              title={showIupacName ? "Copiar nombre" : "Muestra el nombre antes de copiarlo"}
              aria-label="Copiar nombre IUPAC"
              disabled={!showIupacName}
              onClick={() => {
                navigator.clipboard?.writeText(analysis.name);
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
                  <strong>Cadena principal</strong>
                  <p>La ruta continua más larga tiene <b>{analysis.mainChain.length} carbonos</b>: {analysis.chainName}.</p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <strong>Numeración</strong>
                  <p>Se escoge el extremo que entrega el conjunto de localizadores más bajo.</p>
                </div>
              </li>
            </ol>
          </div>

          <div className="naming-rule">
            <span aria-hidden="true">✓</span>
            <p><strong>Orden alfabético</strong>Los prefijos di-, tri- y tetra- no se consideran al ordenar.</p>
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
        <p><strong>Alcance actual:</strong> hidrocarburos saturados, acíclicos y con enlaces C–C simples.</p>
        <p>Los hidrógenos se completan automáticamente respetando la tetravalencia del carbono.</p>
      </footer>
    </main>
  );
}
