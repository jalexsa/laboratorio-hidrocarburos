import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export async function getDb() {
  // Load the Worker binding only when a request actually needs D1. Keeping the
  // import lazy lets the generated ESM artifact be inspected by Node during
  // Sites validation without trying to resolve the Cloudflare-only protocol.
  const { env } = await import("cloudflare:workers");
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }

  return drizzle(env.DB, { schema });
}
