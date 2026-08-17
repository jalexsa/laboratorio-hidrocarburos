export type SmilesFileRecord = {
  smiles: string;
  label?: string;
  ignoredRecordCount: number;
};

/**
 * Reads the first molecule from a conventional .smi/.smiles text file.
 * A SMILES file commonly stores one molecule per line, optionally followed by
 * whitespace and a label. Empty lines and comment lines are ignored.
 */
export function readSmilesFileRecord(text: string): SmilesFileRecord {
  const records = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));

  if (!records.length) {
    throw new Error("El archivo SMILES está vacío o no contiene una estructura legible.");
  }

  const first = records[0];
  const separator = first.search(/\s/);
  const smiles = separator === -1 ? first : first.slice(0, separator);
  const label = separator === -1 ? "" : first.slice(separator).trim();

  if (!smiles) {
    throw new Error("El archivo SMILES no contiene una cadena molecular válida.");
  }

  return {
    smiles,
    ...(label ? { label } : {}),
    ignoredRecordCount: Math.max(0, records.length - 1),
  };
}
