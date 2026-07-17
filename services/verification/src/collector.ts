import type {
  EvidenceKind,
  EvidenceSignal,
  VendorCandidate,
} from "@continuim/contracts";
import { fixtureEvidence } from "./fixtures.ts";

export interface EvidenceCollector {
  readonly mode: "fixture" | "live_zero";
  collect(vendor: VendorCandidate): Promise<EvidenceSignal[]>;
}

export function createEvidenceCollector(
  env: NodeJS.ProcessEnv = process.env,
): EvidenceCollector {
  if (env.VERIFICATION_MODE !== "live_zero") {
    return {
      mode: "fixture",
      async collect(vendor) {
        return fixtureEvidence(vendor);
      },
    };
  }

  const url = env.ZERO_EVIDENCE_ADAPTER_URL;
  if (!url) {
    throw new Error(
      "VERIFICATION_MODE=live_zero requires ZERO_EVIDENCE_ADAPTER_URL",
    );
  }
  return new HttpZeroEvidenceCollector(
    url,
    env.ZERO_EVIDENCE_ADAPTER_TOKEN,
    Number(env.ZERO_EVIDENCE_TIMEOUT_MS ?? 45_000),
  );
}

class HttpZeroEvidenceCollector implements EvidenceCollector {
  readonly mode = "live_zero" as const;

  constructor(
    private readonly url: string,
    private readonly token: string | undefined,
    private readonly timeoutMs: number,
  ) {}

  async collect(vendor: VendorCandidate): Promise<EvidenceSignal[]> {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (this.token) headers.authorization = `Bearer ${this.token}`;
    const response = await fetch(this.url, {
      method: "POST",
      headers,
      body: JSON.stringify({ vendor }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!response.ok) {
      throw new Error(`Zero evidence adapter failed with ${response.status}`);
    }
    const value = await response.json() as unknown;
    if (!isEvidenceResponse(value) || value.vendorId !== vendor.id) {
      throw new Error("Zero evidence adapter returned an invalid or mismatched response");
    }
    for (const signal of value.signals) {
      if (signal.source.mode !== "live_zero") {
        throw new Error(`Live evidence signal ${signal.kind} is not labeled live_zero`);
      }
      if (signal.source.costCents > 0 && !signal.source.receiptId) {
        throw new Error(`Paid evidence signal ${signal.kind} has no receipt ID`);
      }
    }
    return value.signals;
  }
}

const evidenceKinds = new Set<EvidenceKind>([
  "company_identity_match",
  "domain_age_days",
  "web_presence",
  "news_presence",
  "contact_reachable",
  "payee_identity_match",
  "typosquat_detected",
]);

function isEvidenceResponse(value: unknown): value is {
  vendorId: string;
  signals: EvidenceSignal[];
} {
  if (!value || typeof value !== "object") return false;
  const response = value as Record<string, unknown>;
  if (typeof response.vendorId !== "string" || !Array.isArray(response.signals)) return false;
  return response.signals.every((item) => {
    if (!item || typeof item !== "object") return false;
    const signal = item as Partial<EvidenceSignal>;
    return (
      typeof signal.kind === "string" && evidenceKinds.has(signal.kind as EvidenceKind) &&
      ["pass", "warn", "fail"].includes(String(signal.outcome)) &&
      typeof signal.detail === "string" &&
      !!signal.source &&
      typeof signal.source.provider === "string" &&
      typeof signal.source.serviceId === "string" &&
      typeof signal.source.costCents === "number" &&
      typeof signal.source.observedAt === "string"
    );
  });
}
