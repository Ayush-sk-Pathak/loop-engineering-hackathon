import { createHash, randomUUID } from "node:crypto";
import type {
  EvidenceKind,
  EvidenceSignal,
  VendorAttestation,
  VendorCandidate,
  VerificationVerdict,
} from "@continuim/contracts";
import { VERIFICATION_POLICY_VERSION } from "@continuim/contracts";
import { signVendorAttestation } from "@continuim/security";

const REQUIRED_SIGNALS: EvidenceKind[] = [
  "company_identity_match",
  "domain_age_days",
  "web_presence",
  "payee_identity_match",
  "typosquat_detected",
];

export interface VerificationResult {
  verdict: VerificationVerdict;
  attestation?: VendorAttestation;
}

function boolSignal(signals: EvidenceSignal[], kind: EvidenceKind): boolean | undefined {
  const value = signals.find((signal) => signal.kind === kind)?.value;
  return typeof value === "boolean" ? value : undefined;
}

function numberSignal(signals: EvidenceSignal[], kind: EvidenceKind): number | undefined {
  const value = signals.find((signal) => signal.kind === kind)?.value;
  return typeof value === "number" ? value : undefined;
}

export function evaluateEvidence(
  vendor: VendorCandidate,
  signals: EvidenceSignal[],
  signingSecret: string,
  now = new Date(),
): VerificationResult {
  const missing = REQUIRED_SIGNALS.filter(
    (kind) => !signals.some((signal) => signal.kind === kind),
  );
  const companyMatch = boolSignal(signals, "company_identity_match");
  const domainAge = numberSignal(signals, "domain_age_days");
  const webPresence = boolSignal(signals, "web_presence");
  const contactReachable = boolSignal(signals, "contact_reachable");
  const payeeMatch = boolSignal(signals, "payee_identity_match");
  const typosquat = boolSignal(signals, "typosquat_detected");

  let riskScore = 0;
  const reasons: string[] = [];
  if (companyMatch === false) {
    riskScore += 35;
    reasons.push("Company identity could not be corroborated");
  }
  if (domainAge !== undefined && domainAge < 30) {
    riskScore += 30;
    reasons.push(`Domain is only ${domainAge} days old`);
  } else if (domainAge !== undefined && domainAge < 90) {
    riskScore += 15;
    reasons.push(`Domain is younger than 90 days (${domainAge})`);
  }
  if (webPresence === false) {
    riskScore += 20;
    reasons.push("No corroborating web footprint was found");
  }
  if (contactReachable === false) {
    riskScore += 20;
    reasons.push("The listed contact channel was unreachable");
  }
  if (payeeMatch === false) {
    riskScore += 100;
    reasons.push("Quoted payee entity does not match the vendor identity");
  }
  if (typosquat === true) {
    riskScore += 100;
    reasons.push("Domain is a likely typosquat of a known supplier");
  }

  riskScore = Math.min(riskScore, 100);
  const hardFailure = payeeMatch === false || typosquat === true;
  const compoundFailure = domainAge !== undefined && domainAge < 30 && webPresence === false;
  const status = missing.length
    ? "insufficient_evidence"
    : hardFailure || compoundFailure || riskScore >= 60
      ? "ineligible"
      : "eligible";
  if (missing.length) reasons.unshift(`Missing required evidence: ${missing.join(", ")}`);
  if (!reasons.length) reasons.push("Required identity and contact signals are consistent");

  const evidenceHash = createHash("sha256")
    .update(JSON.stringify({
      vendorId: vendor.id,
      vendorDomain: vendor.domain,
      quoteId: vendor.quote.id,
      signals,
    }))
    .digest("hex");
  const evaluatedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + 15 * 60_000).toISOString();
  const evidenceMode = signals.some((signal) => signal.source.mode === "fixture")
    ? "fixture"
    : "live_zero";
  const verdict: VerificationVerdict = {
    id: randomUUID(),
    vendorId: vendor.id,
    status,
    riskScore,
    reasons,
    signals,
    evidenceMode,
    evidenceHash,
    totalCostCents: paidCallCost(signals),
    policyVersion: VERIFICATION_POLICY_VERSION,
    evaluatedAt,
    expiresAt,
  };

  if (status !== "eligible") return { verdict };

  const unsigned = {
    id: randomUUID(),
    vendorId: vendor.id,
    vendorDomain: vendor.domain,
    verified: true as const,
    quoteId: vendor.quote.id,
    sku: vendor.quote.sku,
    payeeName: vendor.quote.payeeName,
    payeeAccountRef: vendor.quote.payeeAccountRef,
    evidenceHash,
    policyVersion: VERIFICATION_POLICY_VERSION,
    unitPriceCents: vendor.quote.unitPriceCents,
    maxQuantity: vendor.quote.availableQty,
    maxAmountCents: vendor.quote.unitPriceCents * vendor.quote.availableQty,
    currency: vendor.quote.currency,
    nonce: randomUUID(),
    issuedAt: evaluatedAt,
    expiresAt,
  };
  return { verdict, attestation: signVendorAttestation(unsigned, signingSecret) };
}

function paidCallCost(signals: EvidenceSignal[]): number {
  const calls = new Map<string, number>();
  for (const signal of signals) {
    const source = signal.source;
    const callId = source.receiptId ??
      `${source.provider}:${source.serviceId}:${source.observedAt}`;
    calls.set(callId, Math.max(calls.get(callId) ?? 0, source.costCents));
  }
  return [...calls.values()].reduce((total, cost) => total + cost, 0);
}
