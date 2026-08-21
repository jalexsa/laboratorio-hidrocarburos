import type { AppLanguage } from "./i18n";

export type CommonNameSuggestion = {
  id: string;
  name: string;
};

type CommonMolecule = {
  id: string;
  es: string;
  en: string;
  aliases: string[];
  suggestOnExactFailure?: boolean;
};

const commonMolecules: CommonMolecule[] = [
  { id: "benzene", es: "benceno", en: "benzene", aliases: ["benceno", "benzene"] },
  { id: "phenol", es: "fenol", en: "phenol", aliases: ["fenol", "phenol"] },
  { id: "cyclohexane", es: "ciclohexano", en: "cyclohexane", aliases: ["ciclohexano", "cyclohexane"] },
  { id: "ethanol", es: "etanol", en: "ethanol", aliases: ["etanol", "ethanol"] },
  { id: "propanol", es: "propan-1-ol", en: "propan-1-ol", aliases: ["propanol", "propan-1-ol", "propanol"] },
  { id: "butanol", es: "butan-1-ol", en: "butan-1-ol", aliases: ["butanol", "butan-1-ol", "butanol"] },
  { id: "hexane", es: "hexano", en: "hexane", aliases: ["hexano", "hexane"] },
  { id: "hexene", es: "hex-1-eno", en: "hex-1-ene", aliases: ["hexeno", "hex-1-eno", "hexene", "hex-1-ene"] },
  { id: "propene", es: "prop-1-eno", en: "prop-1-ene", aliases: ["propeno", "prop-1-eno", "propene", "prop-1-ene"] },
  { id: "butene", es: "but-1-eno", en: "but-1-ene", aliases: ["buteno", "but-1-eno", "butene", "but-1-ene"] },
  { id: "glucose", es: "glucosa", en: "glucose", aliases: ["glucosa", "glucose"], suggestOnExactFailure: true },
];

function normalizeName(value: string) {
  return value
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export function levenshteinDistance(left: string, right: string) {
  const source = normalizeName(left);
  const target = normalizeName(right);
  const previous = Array.from({ length: target.length + 1 }, (_, index) => index);

  for (let sourceIndex = 1; sourceIndex <= source.length; sourceIndex += 1) {
    let diagonal = previous[0];
    previous[0] = sourceIndex;
    for (let targetIndex = 1; targetIndex <= target.length; targetIndex += 1) {
      const above = previous[targetIndex];
      previous[targetIndex] = Math.min(
        previous[targetIndex] + 1,
        previous[targetIndex - 1] + 1,
        diagonal + Number(source[sourceIndex - 1] !== target[targetIndex - 1]),
      );
      diagonal = above;
    }
  }
  return previous[target.length];
}

/** Finds a conservative spelling suggestion without attempting to parse chemistry. */
export function findCommonNameSuggestion(
  input: string,
  language: AppLanguage,
): CommonNameSuggestion | null {
  const normalizedInput = normalizeName(input);
  if (normalizedInput.length < 3) return null;

  let closest: { molecule: CommonMolecule; distance: number } | null = null;
  commonMolecules.forEach((molecule) => {
    const distance = Math.min(...molecule.aliases.map((alias) => levenshteinDistance(input, alias)));
    if (!closest || distance < closest.distance) closest = { molecule, distance };
  });

  if (!closest) return null;
  const allowedDistance = normalizedInput.length <= 5 ? 1 : Math.max(2, Math.floor(normalizedInput.length * 0.28));
  if (closest.distance > allowedDistance) return null;
  if (closest.distance === 0 && !closest.molecule.suggestOnExactFailure) return null;

  return {
    id: closest.molecule.id,
    name: language === "en" ? closest.molecule.en : closest.molecule.es,
  };
}
