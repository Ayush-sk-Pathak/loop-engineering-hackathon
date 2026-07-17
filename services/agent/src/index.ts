import { randomUUID } from "node:crypto";
import type {
  DecisionEvent,
  ProcurementCredential,
  ProcurementResult,
  PurchaseOrderRequest,
  StockoutRiskEvent,
  VendorAttestation,
  VendorCandidate,
  VerificationVerdict,
} from "@stockshield/contracts";
import { SCHEMA_VERSION } from "@stockshield/contracts";

export interface VerificationPort {
  verify(vendor: VendorCandidate): Promise<{
    verdict: VerificationVerdict;
    attestation?: VendorAttestation;
  }>;
}

export interface ProcurementPort {
  submit(
    request: PurchaseOrderRequest,
    credential?: ProcurementCredential,
  ): Promise<ProcurementResult>;
}

export interface CredentialPort {
  forAttestation(attestation: VendorAttestation): Promise<ProcurementCredential>;
}

export interface DecisionSink {
  emit(event: DecisionEvent): Promise<void>;
}

export interface LoopPorts {
  verification: VerificationPort;
  procurement: ProcurementPort;
  credentials: CredentialPort;
  decisions: DecisionSink;
}

export interface LoopResult {
  orderedVendorId?: string;
  blacklistedVendorIds: string[];
  atRiskPoValuePreventedCents: number;
  verificationSpendCents: number;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function runProcurementLoop(
  stockout: StockoutRiskEvent,
  candidates: VendorCandidate[],
  ports: LoopPorts,
  stepDelayMs = 0,
): Promise<LoopResult> {
  const correlationId = stockout.eventId;
  const blacklistedVendorIds: string[] = [];
  let atRiskPoValuePreventedCents = 0;
  let verificationSpendCents = 0;

  const emit = async (
    phase: DecisionEvent["phase"],
    detail: string,
    vendor?: VendorCandidate,
    metadata?: DecisionEvent["metadata"],
  ) => {
    await ports.decisions.emit({
      schemaVersion: SCHEMA_VERSION,
      id: randomUUID(),
      correlationId,
      phase,
      vendorId: vendor?.id,
      vendorName: vendor?.tradingName,
      detail,
      occurredAt: new Date().toISOString(),
      metadata,
    });
    if (stepDelayMs) await wait(stepDelayMs);
  };

  await emit("observed", `Stockout risk received for ${stockout.sku}`, undefined, {
    source: stockout.source,
    requestedQty: stockout.requestedQty,
  });
  await emit(
    "planned",
    "Evaluate the lowest-priced candidate first; require paid evidence before ordering",
  );

  const ranked = [...candidates]
    .filter((vendor) => vendor.quote.availableQty >= stockout.requestedQty)
    .sort((a, b) => a.quote.unitPriceCents - b.quote.unitPriceCents);
  for (const vendor of ranked) {
    await emit(
      "sourced",
      `Candidate quoted ${(vendor.quote.unitPriceCents / 100).toFixed(2)} USD per unit`,
      vendor,
    );
    await emit("verifying", "Collecting independent vendor evidence", vendor);
    const { verdict, attestation } = await ports.verification.verify(vendor);
    verificationSpendCents += verdict.totalCostCents;

    if (verdict.status !== "eligible" || !attestation) {
      await emit(
        "ineligible",
        verdict.reasons.join("; "),
        vendor,
        { riskScore: verdict.riskScore, evidenceMode: verdict.evidenceMode },
      );
      blacklistedVendorIds.push(vendor.id);
      await emit("blacklisted", "Candidate removed from this procurement run", vendor);

      const probeRequest = makePurchaseRequest(vendor, stockout, {
        id: "missing",
        evidenceHash: verdict.evidenceHash,
      });
      const probe = await ports.procurement.submit(probeRequest);
      if (probe.status !== 403) {
        throw new Error(`Policy probe must be denied, received ${probe.status}`);
      }
      const prevented = vendor.quote.unitPriceCents * stockout.requestedQty;
      atRiskPoValuePreventedCents += prevented;
      await emit(
        "policy_probe_denied",
        `Independent policy probe denied before the procurement API (${probe.requestId})`,
        vendor,
        { enforcementPoint: probe.enforcementPoint, preventedValueCents: prevented },
      );
      continue;
    }

    await emit(
      "attested",
      `Evidence policy passed; capability expires ${attestation.expiresAt}`,
      vendor,
      { evidenceHash: attestation.evidenceHash.slice(0, 12) },
    );
    const credential = await ports.credentials.forAttestation(attestation);
    const request = makePurchaseRequest(vendor, stockout, attestation);
    const result = await ports.procurement.submit(request, credential);
    if (result.status !== 201 || !result.order) {
      await emit("failed", result.reason ?? `PO failed with ${result.status}`, vendor);
      continue;
    }

    await emit(
      "ordered",
      `PO ${result.order.id} accepted through ${result.enforcementPoint}`,
      vendor,
      { totalAmountCents: result.order.totalAmountCents },
    );
    await emit(
      "inbound_scheduled",
      `${result.order.quantity} units scheduled inbound; on-hand inventory is unchanged`,
      vendor,
    );
    return {
      orderedVendorId: vendor.id,
      blacklistedVendorIds,
      atRiskPoValuePreventedCents,
      verificationSpendCents,
    };
  }

  await emit("failed", "No eligible vendor could fulfill the requested quantity");
  return {
    blacklistedVendorIds,
    atRiskPoValuePreventedCents,
    verificationSpendCents,
  };
}

function makePurchaseRequest(
  vendor: VendorCandidate,
  stockout: StockoutRiskEvent,
  attestation: Pick<VendorAttestation, "id" | "evidenceHash">,
): PurchaseOrderRequest {
  return {
    vendorId: vendor.id,
    sku: stockout.sku,
    quantity: stockout.requestedQty,
    quoteId: vendor.quote.id,
    unitPriceCents: vendor.quote.unitPriceCents,
    currency: vendor.quote.currency,
    attestationId: attestation.id,
    evidenceHash: attestation.evidenceHash,
    idempotencyKey: `${stockout.eventId}:${vendor.id}`,
  };
}
