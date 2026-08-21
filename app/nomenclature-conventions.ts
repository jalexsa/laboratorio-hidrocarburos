import type { AppLanguage } from "./i18n";

export type NomenclatureConvention = "current" | "school" | "traditional";

type ConventionCycle = readonly NomenclatureConvention[];

const conventionCycles: Record<AppLanguage, ConventionCycle> = {
  es: ["current", "school", "traditional"],
  en: ["current", "traditional"],
};

const functionalSuffixes = "ene|yne|eno|ino|ol|one|ona|amine|amina";
const locantedSuffix = new RegExp(
  `([a-záéíóúñ]+)-(\\d+)-(${functionalSuffixes})(?=$|[^a-záéíóúñ])`,
  "i",
);
const unsaturatedSuffix = /^(ene|yne|eno|ino)$/i;
const stereoPrefix = /^(\((?:\d+[EZ](?:,\d+[EZ])*)\)-)(.+)$/;

/** Removes only the displayed alkene E/Z prefix; the structural model is untouched. */
export function stripStereochemicalDescriptors(name: string) {
  const directMatch = name.match(stereoPrefix);
  if (directMatch) return directMatch[2];

  const acidMatch = name.match(/^(ácido |acid )(\((?:\d+[EZ](?:,\d+[EZ])*)\)-)(.+)$/i);
  if (acidMatch) return `${acidMatch[1]}${acidMatch[3]}`;
  return name;
}

function splitStereochemicalPrefix(name: string) {
  const directMatch = name.match(stereoPrefix);
  if (directMatch) return { prefix: directMatch[1], baseName: directMatch[2] };

  const acidMatch = name.match(/^(ácido |acid )(\((?:\d+[EZ](?:,\d+[EZ])*)\)-)(.+)$/i);
  if (acidMatch) return { prefix: `${acidMatch[1]}${acidMatch[2]}`, baseName: acidMatch[3] };
  return { prefix: "", baseName: name };
}

function addSchoolBaseVowel(baseName: string) {
  return baseName.replace(locantedSuffix, (match, parent: string, locant: string, suffix: string) => (
    unsaturatedSuffix.test(suffix) ? `${parent}a-${locant}-${suffix}` : match
  ));
}

function moveFunctionalLocantToFront(baseName: string) {
  const match = locantedSuffix.exec(baseName);
  if (!match) return baseName;

  const [matched, parent, locant, suffix] = match;
  const parentName = `${parent}${suffix}`;
  return `${locant}-${baseName.replace(matched, parentName)}`;
}

/**
 * Applies only display conventions to a localized PIN. It deliberately does
 * not parse or identify a molecule, so OPSIN/OpenChemLib naming remains the
 * canonical source of the underlying name.
 */
export function applyNomenclatureConvention(
  name: string,
  convention: NomenclatureConvention,
  language: AppLanguage,
) {
  const activeConvention = language === "en" && convention === "school"
    ? "current"
    : convention;
  const { prefix, baseName } = splitStereochemicalPrefix(name);
  const formattedName = activeConvention === "school"
    ? addSchoolBaseVowel(baseName)
    : activeConvention === "traditional"
      ? moveFunctionalLocantToFront(baseName)
      : baseName;
  return `${prefix}${formattedName}`;
}

export function nextNomenclatureConvention(
  current: NomenclatureConvention,
  language: AppLanguage,
): NomenclatureConvention {
  const cycle = conventionCycles[language];
  const currentIndex = cycle.indexOf(current);
  return cycle[(currentIndex + 1) % cycle.length];
}

export function nomenclatureConventionLabel(
  convention: NomenclatureConvention,
  language: AppLanguage,
) {
  if (language === "en") return convention === "traditional" ? "Traditional" : "IUPAC Preferred";
  if (convention === "school") return "PAES/Escolar";
  return convention === "traditional" ? "Tradicional" : "IUPAC Actual";
}
