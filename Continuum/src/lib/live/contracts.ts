// Local, read-only mirror of the subset of @continuim/contracts (DemoState) that
// the Continuum live view consumes. Continuum is a standalone app (not linked to
// the root npm workspace), so we duplicate the shape here rather than import it.
// Source of truth: packages/contracts/src/index.ts:204-237 (schema v1.1).
// Keep in sync if the control-plane payload changes.

export type ScenarioId = "datacenter" | "apparel";
export type EvidenceMode = "fixture" | "live_zero";
export type AuthorizationMode = "development" | "pomerium";
export type RunStatus = "idle" | "running" | "complete" | "failed";

export type DecisionPhase =
  | "observed"
  | "planned"
  | "recalled_history"
  | "sourced"
  | "authorization_attempted"
  | "authorization_denied"
  | "replanned"
  | "verifying"
  | "ineligible"
  | "blacklisted"
  | "attested"
  | "ordered"
  | "inbound_scheduled"
  | "failed";

export interface DecisionEvent {
  schemaVersion: string;
  id: string;
  correlationId: string;
  phase: DecisionPhase;
  vendorId?: string;
  vendorName?: string;
  detail: string;
  occurredAt: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface VendorQuote {
  id: string;
  sku: string;
  payeeName: string;
  payeeAccountRef: string;
  unitPriceCents: number;
  currency: string;
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

export interface PurchaseOrder {
  id: string;
  vendorId: string;
  sku: string;
  quantity: number;
  totalAmountCents: number;
  currency: string;
  status: "accepted";
  inboundStatus: "scheduled";
  createdAt: string;
}

export interface DemoMetrics {
  atRiskPoValuePreventedCents: number;
  verificationSpendCents: number;
  inboundQuantity: number;
  verificationMode: EvidenceMode;
  authorizationMode: AuthorizationMode;
  deniedRequestId?: string;
  deniedEnforcementPoint?: "development" | "pomerium" | "origin";
}

export interface DemoState {
  runStatus: RunStatus;
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
