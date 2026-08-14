import { getOpsinNameCandidates } from "./iupac-name-normalization.ts";

const OPSIN_ENDPOINT = "https://www.ebi.ac.uk/opsin/ws";

type OpsinResponse = {
  message?: string;
  smiles?: string;
  status?: string;
  warnings?: string[];
};

export type NameStructureResolution = {
  interpretedName: string;
  originalName: string;
  smiles: string;
  source: "OPSIN" | "integrated-fallback";
  warnings: string[];
};

export type NameStructureResolutionResult =
  | { ok: true; value: NameStructureResolution }
  | {
      ok: false;
      detail: string;
      error: string;
      serviceReached: boolean;
    };

const embeddedSmilesFallback: Record<string, string> = {
  "(2E)-2-ethyl-3-methylhex-2-enal": "C(C)/C(/C=O)=C(\\CCC)/C",
  "2-methylpropanoic acid": "CC(C)C(=O)O",
  "3-(2-oxopropyl)cyclohexanone": "O=C(CC1CC(CCC1)=O)C",
  "benzene-1,3,5-triol": "Oc1cc(O)cc(O)c1",
  "butan-2-one": "CC(=O)CC",
  "chloroethane": "CCCl",
  "ethanamide": "CC(=O)N",
  "ethanamine": "CCN",
  "ethanal": "CC=O",
  "ethanoic acid": "CC(=O)O",
  "ethanol": "CCO",
  "methoxyethane": "COCC",
  "methyl ethanoate": "CC(=O)OC",
  "phenol": "Oc1ccccc1",
  "propan-2-ol": "CC(O)C",
  "propan-2-one": "CC(=O)C",
};

function embeddedFallback(candidate: string, originalName: string): NameStructureResolution | null {
  const smiles = embeddedSmilesFallback[candidate];
  return smiles
    ? {
        interpretedName: candidate,
        originalName,
        smiles,
        source: "integrated-fallback",
        warnings: [],
      }
    : null;
}

type ResolverOptions = {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

/**
 * Resolves a Spanish or English IUPAC name through the public OPSIN service.
 * OPSIN explicitly enables browser CORS, so GitHub Pages can use this function
 * without depending on an authenticated Sites API. Known classroom examples
 * retain an embedded SMILES fallback for temporary network outages.
 */
export async function resolveNameWithOpsin(
  originalName: string,
  options: ResolverOptions = {},
): Promise<NameStructureResolutionResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const candidates = getOpsinNameCandidates(originalName);
  let serviceReached = false;
  let lastMessage = "OPSIN no reconoció ese nombre.";

  for (const candidate of candidates) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 9_000);
    try {
      const response = await fetchImpl(
        `${OPSIN_ENDPOINT}/${encodeURIComponent(candidate)}.json`,
        {
          credentials: "omit",
          headers: { accept: "application/json" },
          signal: controller.signal,
        },
      );
      serviceReached = true;

      let data: OpsinResponse = {};
      try {
        data = await response.json() as OpsinResponse;
      } catch {
        lastMessage = "OPSIN devolvió una respuesta que no se pudo leer.";
      }

      if (response.ok && data.status === "SUCCESS" && data.smiles) {
        return {
          ok: true,
          value: {
            interpretedName: candidate,
            originalName,
            smiles: data.smiles,
            source: "OPSIN",
            warnings: data.warnings ?? [],
          },
        };
      }

      if (data.message) lastMessage = data.message;
      const fallback = embeddedFallback(candidate, originalName);
      if (fallback) return { ok: true, value: fallback };
    } catch {
      const fallback = embeddedFallback(candidate, originalName);
      if (fallback) return { ok: true, value: fallback };
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    ok: false,
    serviceReached,
    error: serviceReached
      ? "El motor químico no pudo interpretar ese nombre IUPAC. Revisa localizadores, paréntesis, guiones y sufijos."
      : "No fue posible conectar con OPSIN. Revisa tu conexión y vuelve a intentarlo; el constructor local seguirá disponible.",
    detail: lastMessage,
  };
}
