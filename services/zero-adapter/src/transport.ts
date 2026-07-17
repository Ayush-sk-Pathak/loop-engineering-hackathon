import type { EvidenceKind, VendorCandidate } from "@continuim/contracts";

/**
 * One settled paid Zero service call. A single call may back several evidence
 * signals; every signal it produces reuses this call's `receiptId` and cost, so
 * the verification policy can deduplicate spend by receipt (see
 * services/verification/src/policy.ts `paidCallCost`). `receiptId` is required
 * whenever `costCents > 0`.
 */
export interface ZeroSignalDraft {
  kind: EvidenceKind;
  value: boolean | number | string;
  outcome: "pass" | "warn" | "fail";
  detail: string;
}

export interface ZeroServiceCall {
  provider: string;
  serviceId: string;
  costCents: number;
  observedAt: string;
  receiptId?: string;
  signals: ZeroSignalDraft[];
}

/** The adapter's only dependency on the live Zero surface — faked in unit tests. */
export interface ZeroTransport {
  gather(vendor: VendorCandidate): Promise<ZeroServiceCall[]>;
}

/**
 * Returns a live Zero transport only when a real Zero session is configured
 * (`ZERO_API_KEY`). With no session it returns `null`, and the adapter answers
 * 503 "Zero session not configured": it must never fabricate fixture-shaped
 * `live_zero` evidence (STRATEGY-LEDGER decision 0010).
 */
export function createZeroTransport(
  env: Record<string, string | undefined> = process.env,
): ZeroTransport | null {
  const apiKey = env.ZERO_API_KEY?.trim();
  if (!apiKey) return null;
  return new LiveZeroTransport(apiKey);
}

/**
 * Real Zero settlement transport. The live service catalog (exact service IDs,
 * prices, receipts) is settled in item A4 against a funded wallet and recorded
 * in config/zero-services.json; until then a configured session refuses to
 * invent evidence rather than settle nothing.
 */
class LiveZeroTransport implements ZeroTransport {
  constructor(private readonly apiKey: string) {}

  async gather(_vendor: VendorCandidate): Promise<ZeroServiceCall[]> {
    void this.apiKey;
    throw new Error(
      "Zero live catalog not settled — record settled services in " +
        "config/zero-services.json (docs/integrations/ZERO.md, item A4) before " +
        "enabling live_zero",
    );
  }
}
