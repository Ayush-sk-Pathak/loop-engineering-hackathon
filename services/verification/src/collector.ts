import type { EvidenceSignal, VendorCandidate } from "@continuim/contracts";
import { fixtureEvidence } from "./fixtures.ts";
import { LiveEvidenceCollector } from "./live.ts";

export interface EvidenceCollector {
  readonly mode: "fixture" | "live";
  collect(vendor: VendorCandidate): Promise<EvidenceSignal[]>;
}

export function createEvidenceCollector(
  env: NodeJS.ProcessEnv = process.env,
): EvidenceCollector {
  if (env.VERIFICATION_MODE !== "live") {
    return {
      mode: "fixture",
      async collect(vendor) {
        return fixtureEvidence(vendor);
      },
    };
  }

  const firecrawlKey = env.FIRECRAWL_API_KEY;
  if (!firecrawlKey) {
    throw new Error("VERIFICATION_MODE=live requires FIRECRAWL_API_KEY");
  }
  return new LiveEvidenceCollector(
    firecrawlKey,
    env.LINKUP_API_KEY,
    Number(env.PROVIDER_TIMEOUT_MS ?? 12_000),
    Number(env.EVIDENCE_CACHE_TTL_MS ?? 600_000),
  );
}
