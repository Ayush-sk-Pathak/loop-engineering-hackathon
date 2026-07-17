export const SCHEMA_VERSION = "1.1" as const;
export const VERIFICATION_POLICY_VERSION = "vendor-risk-v1" as const;

export type Currency = "USD";
export type ScenarioId = "datacenter" | "apparel";
export type EvidenceMode = "fixture" | "live_zero";
export type VerificationStatus =
  | "eligible"
  | "ineligible"
  | "insufficient_evidence";

export interface VendorQuote {
  id: string;
  sku: string;
  payeeName: string;
  payeeAccountRef: string;
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
  source: "nexla" | "local" | "monitor";
}

export type EvidenceKind =
  | "company_identity_match"
  | "domain_age_days"
  | "web_presence"
  | "news_presence"
  | "contact_reachable"
  | "payee_identity_match"
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
  vendorDomain: string;
  verified: true;
  quoteId: string;
  sku: string;
  payeeName: string;
  payeeAccountRef: string;
  evidenceHash: string;
  policyVersion: typeof VERIFICATION_POLICY_VERSION;
  unitPriceCents: number;
  maxQuantity: number;
  maxAmountCents: number;
  currency: Currency;
  nonce: string;
  issuedAt: string;
  expiresAt: string;
  signature: string;
}

export interface PurchaseOrderRequest {
  vendorId: string;
  vendorDomain: string;
  sku: string;
  quantity: number;
  quoteId: string;
  payeeName: string;
  payeeAccountRef: string;
  unitPriceCents: number;
  currency: Currency;
  attestationId: string;
  evidenceHash: string;
  authorizationNonce: string;
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
  | "recalled_history"
  | "sourced"
  | "authorization_attempted"
  | "authorization_denied"
  | "replanned"
  | "verifying"
  | "explained"
  | "ineligible"
  | "blacklisted"
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
  | { kind: "development"; attestation: VendorAttestation }
  | {
      kind: "pomerium";
      serviceAccountToken: string;
      attestation: VendorAttestation;
    };

export interface ProcurementResult {
  status: number;
  order?: PurchaseOrder;
  reason?: string;
  enforcementPoint: "development" | "pomerium" | "origin";
  requestId: string;
}

export interface IncidentRecord {
  id: string;
  scenarioId: ScenarioId;
  sku: string;
  startedAt: string;
  resolvedAt: string;
  resolutionMs: number;
  orderedVendorId: string | null;
  blacklistedVendorIds: string[];
  verificationSpendCents: number;
  poValueCents: number;
  atRiskPoValuePreventedCents: number;
  evidenceMode: EvidenceMode;
}

export interface DemoMetrics {
  atRiskPoValuePreventedCents: number;
  verificationSpendCents: number;
  inboundQuantity: number;
  verificationMode: EvidenceMode;
  authorizationMode: "development" | "pomerium";
  deniedRequestId?: string;
  deniedEnforcementPoint?: ProcurementResult["enforcementPoint"];
}

export interface DemoState {
  runStatus: "idle" | "running" | "complete" | "failed";
  scenario: {
    id: ScenarioId;
    label: string;
    industry: string;
    trigger: string;
  };
  inventory: {
    sku: string;
    name: string;
    currentQty: number;
    threshold: number;
    inboundQty: number;
    critical: boolean;
    downtimeCostCentsPerMinute: number;
  };
  monitor: {
    active: boolean;
    watchedSkus: string[];
    lastCheckAt: string | null;
  };
  clientIncident?: {
    clientId: "meridian" | "northwind";
    nodeId: string;
    faultType: string;
    detectedAt: string;
  };
  events: DecisionEvent[];
  vendors: VendorCandidate[];
  blacklistedVendorIds: string[];
  order?: PurchaseOrder;
  metrics: DemoMetrics;
  learning: {
    incidentCount: number;
    lastResolutionMs: number | null;
    provenVendorIds: string[];
  };
  updatedAt: string;
}
