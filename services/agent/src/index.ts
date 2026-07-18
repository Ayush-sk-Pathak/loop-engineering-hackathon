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
} from "@continuim/contracts";
import { SCHEMA_VERSION } from "@continuim/contracts";

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

export interface LoopHistory {
  provenVendorIds: string[];
  knowsAuthorizationRequired: boolean;
}

export interface LoopResult {
  orderedVendorId?: string;
  blacklistedVendorIds: string[];
  atRiskPoValuePreventedCents: number;
  verificationSpendCents: number;
  verificationMode: VerificationVerdict["evidenceMode"];
  deniedRequestId?: string;
  deniedEnforcementPoint?: ProcurementResult["enforcementPoint"];
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function runProcurementLoop(
  stockout: StockoutRiskEvent,
  candidates: VendorCandidate[],
  ports: LoopPorts,
  stepDelayMs = 0,
  history?: LoopHistory,
): Promise<LoopResult> {
  const correlationId = stockout.eventId;
  const blacklistedVendorIds: string[] = [];
  let atRiskPoValuePreventedCents = 0;
  let verificationSpendCents = 0;
  let verificationMode: VerificationVerdict["evidenceMode"] = "fixture";
  let deniedRequestId: string | undefined;
  let deniedEnforcementPoint: ProcurementResult["enforcementPoint"] | undefined;
  let learnedAuthorizationRequirement = history?.knowsAuthorizationRequired ?? false;
  const provenVendorIds = new Set(history?.provenVendorIds ?? []);

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
    "Select the lowest-priced candidate, observe procurement controls, and adapt without human intervention",
  );
  if (learnedAuthorizationRequirement) {
    await emit(
      "recalled_history",
      "Recalled from the incident ledger: procurement requires vendor-scoped evidence; skipping the unattested attempt",
    );
  }

  const priced = [...candidates]
    .filter((vendor) =>
      vendor.quote.sku === stockout.sku &&
      vendor.quote.availableQty >= stockout.requestedQty)
    .sort((a, b) => a.quote.unitPriceCents - b.quote.unitPriceCents);
  const ranked = [
    ...priced.filter((vendor) => provenVendorIds.has(vendor.id)),
    ...priced.filter((vendor) => !provenVendorIds.has(vendor.id)),
  ];
  for (const vendor of ranked) {
    await emit(
      "sourced",
      `Candidate quoted ${(vendor.quote.unitPriceCents / 100).toFixed(2)} USD per unit${
        provenVendorIds.has(vendor.id)
          ? " (prioritized: proven fulfillment in prior incidents)"
          : ""
      }`,
      vendor,
    );

    if (!learnedAuthorizationRequirement) {
      await emit(
        "authorization_attempted",
        "Submitting the lowest-cost plan before a vendor capability has been issued",
        vendor,
      );
      const attempted = await ports.procurement.submit(
        makePurchaseRequest(vendor, stockout),
      );
      if (attempted.status !== 403) {
        throw new Error(`Unattested purchase must be denied, received ${attempted.status}`);
      }
      learnedAuthorizationRequirement = true;
      deniedRequestId = attempted.requestId;
      deniedEnforcementPoint = attempted.enforcementPoint;
      const prevented = vendor.quote.unitPriceCents * stockout.requestedQty;
      atRiskPoValuePreventedCents += prevented;
      await emit(
        "authorization_denied",
        `Procurement policy denied the unattested plan (${attempted.requestId})`,
        vendor,
        {
          enforcementPoint: attempted.enforcementPoint,
          preventedValueCents: prevented,
          requestId: attempted.requestId,
        },
      );
      await emit(
        "replanned",
        "Observed that procurement requires vendor-scoped evidence; acquiring it before retrying",
        vendor,
      );
    }

    await emit("verifying", "Collecting independent vendor evidence", vendor);
    const { verdict, attestation } = await ports.verification.verify(vendor);
    verificationSpendCents += verdict.totalCostCents;
    if (verdict.evidenceMode === "live") verificationMode = "live";

    if (verdict.status !== "eligible" || !attestation) {
      await emit(
        "ineligible",
        verdict.reasons.join("; "),
        vendor,
        { riskScore: verdict.riskScore, evidenceMode: verdict.evidenceMode },
      );
      blacklistedVendorIds.push(vendor.id);
      await emit("blacklisted", "Candidate removed from this procurement run", vendor);
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
      verificationMode,
      deniedRequestId,
      deniedEnforcementPoint,
    };
  }

  await emit("failed", "No eligible vendor could fulfill the requested quantity");
  return {
    blacklistedVendorIds,
    atRiskPoValuePreventedCents,
    verificationSpendCents,
    verificationMode,
    deniedRequestId,
    deniedEnforcementPoint,
  };
}

function makePurchaseRequest(
  vendor: VendorCandidate,
  stockout: StockoutRiskEvent,
  attestation?: Pick<VendorAttestation, "id" | "evidenceHash" | "nonce">,
): PurchaseOrderRequest {
  return {
    vendorId: vendor.id,
    vendorDomain: vendor.domain,
    sku: stockout.sku,
    quantity: stockout.requestedQty,
    quoteId: vendor.quote.id,
    payeeName: vendor.quote.payeeName,
    payeeAccountRef: vendor.quote.payeeAccountRef,
    unitPriceCents: vendor.quote.unitPriceCents,
    currency: vendor.quote.currency,
    attestationId: attestation?.id ?? "unattested",
    evidenceHash: attestation?.evidenceHash ?? "unattested",
    authorizationNonce: attestation?.nonce ?? "unattested",
    idempotencyKey: `${stockout.eventId}:${vendor.id}`,
  };
}
