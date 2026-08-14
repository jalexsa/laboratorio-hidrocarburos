import { getOpsinNameCandidates } from "../../iupac-name-normalization";

const OPSIN_ENDPOINT = "https://www.ebi.ac.uk/opsin/ws";
const corsHeaders = {
  "access-control-allow-headers": "content-type",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-origin": "*",
};

type OpsinResponse = {
  message?: string;
  smiles?: string;
  status?: string;
  warnings?: string[];
};

const embeddedSmilesFallback: Record<string, string> = {
  "2-methylpropanoic acid": "CC(C)C(=O)O",
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

function embeddedFallback(candidate: string, originalName: string) {
  const smiles = embeddedSmilesFallback[candidate];
  return smiles
    ? json({
        interpretedName: candidate,
        originalName,
        smiles,
        source: "integrated-fallback",
        warnings: [],
      })
    : null;
}

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      ...corsHeaders,
      "cache-control": "no-store",
    },
  });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: Request) {
  let payload: { name?: unknown };
  try {
    payload = await request.json() as { name?: unknown };
  } catch {
    return json({ error: "La solicitud no contiene un nombre válido." }, 400);
  }

  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  if (!name) return json({ error: "Escribe un nombre IUPAC." }, 400);
  if (name.length > 220) {
    return json({ error: "El nombre es demasiado largo para este constructor." }, 400);
  }

  const candidates = getOpsinNameCandidates(name);
  let serviceReached = false;
  let lastMessage = "OPSIN no reconoció ese nombre.";

  for (const candidate of candidates) {
    try {
      const response = await fetch(
        `${OPSIN_ENDPOINT}/${encodeURIComponent(candidate)}.json`,
        {
          headers: { accept: "application/json" },
          signal: AbortSignal.timeout(9_000),
        },
      );
      serviceReached = true;
      const data = await response.json() as OpsinResponse;
      if (response.ok && data.status === "SUCCESS" && data.smiles) {
        return json({
          interpretedName: candidate,
          originalName: name,
          smiles: data.smiles,
          source: "OPSIN",
          warnings: data.warnings ?? [],
        });
      }
      if (data.message) lastMessage = data.message;
      const fallback = embeddedFallback(candidate, name);
      if (fallback) return fallback;
    } catch {
      // Try the next normalized candidate. The local constructor remains the
      // final fallback in the client if the public service is unavailable.
      const fallback = embeddedFallback(candidate, name);
      if (fallback) return fallback;
    }
  }

  return json(
    {
      error: serviceReached
        ? "El motor químico no pudo interpretar ese nombre IUPAC. Revisa localizadores, guiones y sufijos."
        : "El motor químico avanzado no respondió. Puedes seguir usando el constructor local.",
      detail: lastMessage,
    },
    serviceReached ? 422 : 503,
  );
}
