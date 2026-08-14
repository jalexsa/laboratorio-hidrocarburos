const commonSpanishNames: Record<string, string> = {
  acetaldehido: "ethanal",
  acetona: "propan-2-one",
  "acido acetico": "acetic acid",
  "acido benzoico": "benzoic acid",
  "acido formico": "formic acid",
  anilina: "aniline",
  benceno: "benzene",
  formaldehido: "methanal",
  fenol: "phenol",
  tolueno: "toluene",
};

function normalizePunctuation(value: string) {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[–—−]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/\s*-\s*/g, "-")
    .toLocaleLowerCase("es");
}

function translateCore(value: string) {
  let translated = value
    .replace(/metoxi/g, "methoxy")
    .replace(/etoxi/g, "ethoxy")
    .replace(/propoxi/g, "propoxy")
    .replace(/butoxi/g, "butoxy")
    .replace(/hidroxi/g, "hydroxy")
    .replace(/benceno/g, "benzene")
    .replace(/fenoxi/g, "phenoxy")
    .replace(/fenil/g, "phenyl")
    .replace(/cloro/g, "chloro")
    .replace(/yodo/g, "iodo")
    .replace(/ciclo/g, "cyclo")
    .replace(/isopropil/g, "propan-2-yl")
    .replace(/isobutil/g, "2-methylpropyl")
    .replace(/terc-butil|tert-butil/g, "tert-butyl")
    .replace(/metilo/g, "methyl")
    .replace(/etilo/g, "ethyl")
    .replace(/propilo/g, "propyl")
    .replace(/butilo/g, "butyl")
    .replace(/metil/g, "methyl")
    .replace(/etil/g, "ethyl")
    .replace(/propil/g, "propyl")
    .replace(/butil/g, "butyl")
    .replace(/oxyet(?=an|en|in)/g, "oxyeth")
    .replace(/\bmet(?=an|en|in)/g, "meth")
    .replace(/\bet(?=an|en|in)/g, "eth");

  translated = translated
    .replace(/carbaldehido$/g, "carbaldehyde")
    .replace(/carboxilico$/g, "carboxylic acid")
    .replace(/nitrilo$/g, "nitrile")
    .replace(/aldehido$/g, "aldehyde")
    .replace(/tetraona$/g, "tetraone")
    .replace(/triona$/g, "trione")
    .replace(/diona$/g, "dione")
    .replace(/ona$/g, "one")
    .replace(/amida$/g, "amide")
    .replace(/amina$/g, "amine")
    .replace(/tiol$/g, "thiol")
    .replace(/oato$/g, "oate")
    .replace(/oico$/g, "oic")
    .replace(/ano(?=-\d)/g, "ane")
    .replace(/eno(?=-\d)/g, "ene")
    .replace(/ino(?=-\d)/g, "yne")
    .replace(/ano$/g, "ane")
    .replace(/eno$/g, "ene")
    .replace(/ino$/g, "yne")
    .replace(/ilo$/g, "yl");

  return translated;
}

/**
 * OPSIN follows English systematic nomenclature. The laboratory UI is Spanish,
 * so we generate a conservative English candidate before trying the original
 * text. This is intentionally a nomenclature bridge, not a structure parser.
 */
export function translateSpanishIupacToOpsin(value: string) {
  const normalized = normalizePunctuation(value);
  if (!normalized) return "";

  const common = commonSpanishNames[normalized];
  if (common) return common;

  const ester = normalized.match(/^(.+?oato)\s+de\s+(.+?(?:ilo|il))$/);
  if (ester) {
    const acidPart = translateCore(ester[1]);
    const alkylPart = translateCore(ester[2]);
    return `${alkylPart} ${acidPart}`;
  }

  const acid = normalized.match(/^acido\s+(.+)$/);
  if (acid) {
    const acidName = translateCore(acid[1]);
    return acidName.endsWith("acid") ? acidName : `${acidName} acid`;
  }

  return translateCore(normalized);
}

export function getOpsinNameCandidates(value: string) {
  const normalized = normalizePunctuation(value);
  const translated = translateSpanishIupacToOpsin(value);
  return [...new Set([translated, normalized].filter(Boolean))];
}
