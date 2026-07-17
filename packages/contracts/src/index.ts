export const SCHEMA_VERSION = "1.0" as const;
export const VERIFICATION_POLICY_VERSION = "vendor-risk-v1" as const;

export type Currency = "USD";
export type EvidenceMode = "fixture" | "live_zero";
export type VerificationStatus =
  | "eligible"
  | "ineligible"
  | "insufficient_evidence";

export interface VendorQuote {
  id: string;
  sku: string;
  unitPriceCents: number;
  currency: Currency;
  availableQty: number;
  leadTimeDays: number;
}

export interface VendorCandidate {
  id: string;
  legalName: string;
  tradingName: string;
  domain: string;
  phone?: string;
  synthetic: boolean;
  quote: VendorQuote;
}

export interface StockoutRiskEvent {
  schemaVersion: typeof SCHEMA_VERSION;
  type: "stockout_risk";
  eventId: string;
  sku: string;
  currentQty: number;
  threshold: number;
  requestedQty: number;
  occurredAt: string;
  source: "nexla" | "local";
}

export type EvidenceKind =
  | "company_identity_match"
  | "domain_age_days"
  | "web_presence"
  | "news_presence"
  | "contact_reachable"
  | "bank_entity_match"
  | "typosquat_detected";

export interface EvidenceSource {
  provider: string;
  serviceId: string;
  mode: EvidenceMode;
  costCents: number;
  observedAt: string;
  receiptId?: string;
}

export interface EvidenceSignal {
  kind: EvidenceKind;
  value: boolean | number | string;
  outcome: "pass" | "warn" | "fail";
  detail: string;
  source: EvidenceSource;
}

export interface VerificationVerdict {
  id: string;
  vendorId: string;
  status: VerificationStatus;
  riskScore: number;
  reasons: string[];
  signals: EvidenceSignal[];
  evidenceMode: EvidenceMode;
  evidenceHash: string;
  totalCostCents: number;
  policyVersion: typeof VERIFICATION_POLICY_VERSION;
  evaluatedAt: string;
  expiresAt: string;
}

export interface VendorAttestation {
  id: string;
  vendorId: string;
  verified: true;
  quoteId: string;
  evidenceHash: string;
  policyVersion: typeof VERIFICATION_POLICY_VERSION;
  maxAmountCents: number;
  currency: Currency;
  nonce: string;
  issuedAt: string;
  expiresAt: string;
  signature: string;
}

export interface PurchaseOrderRequest {
  vendorId: string;
  sku: string;
  quantity: number;
  quoteId: string;
  unitPriceCents: number;
  currency: Currency;
  attestationId: string;
  evidenceHash: string;
  idempotencyKey: string;
}

export interface PurchaseOrder {
  id: string;
  vendorId: string;
  sku: string;
  quantity: number;
  totalAmountCents: number;
  currency: Currency;
  status: "accepted";
  inboundStatus: "scheduled";
  createdAt: string;
}

export type DecisionPhase =
  | "observed"
  | "planned"
  | "sourced"
  | "verifying"
  | "ineligible"
  | "blacklisted"
  | "policy_probe_denied"
  | "attested"
  | "ordered"
  | "inbound_scheduled"
  | "failed";

export interface DecisionEvent {
  schemaVersion: typeof SCHEMA_VERSION;
  id: string;
  correlationId: string;
  phase: DecisionPhase;
  vendorId?: string;
  vendorName?: string;
  detail: string;
  occurredAt: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export type ProcurementCredential =
  | { kind: "development"; token: string }
  | { kind: "pomerium"; serviceAccountToken: string };

export interface ProcurementResult {
  status: number;
  order?: PurchaseOrder;
  reason?: string;
  enforcementPoint: "development" | "pomerium" | "origin";
  requestId: string;
}

export interface DemoMetrics {
  atRiskPoValuePreventedCents: number;
  verificationSpendCents: number;
  inboundQuantity: number;
  verificationMode: EvidenceMode;
}

export interface DemoState {
  runStatus: "idle" | "running" | "complete" | "failed";
  inventory: {
    sku: string;
    name: string;
    currentQty: number;
    threshold: number;
    inboundQty: number;
  };
  events: DecisionEvent[];
  vendors: VendorCandidate[];
  blacklistedVendorIds: string[];
  order?: PurchaseOrder;
  metrics: DemoMetrics;
  updatedAt: string;
}
