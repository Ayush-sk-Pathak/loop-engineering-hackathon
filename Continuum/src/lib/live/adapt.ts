// Adapts the control-plane DemoState (/api/state) into Continuum's Workspace
// view-model so the existing ops pages render REAL run data through the same
// useContinuum() seam. Honesty rules (per PM directive):
//   - only real, structured DemoState fields are mapped; DecisionEvent.detail
//     strings are rendered verbatim as messages, never parsed into fake structure;
//   - the backend scenario id is surfaced verbatim (scenarioIdOf);
//   - fields the API genuinely does not provide (historical YTD aggregates,
//     category breakdown, org spend ceiling, integration roster) are left as the
//     base workspace's illustrative values and are labelled as such in the UI.
import { formatCurrency } from "../format";
import type {
  ActivityItem,
  Asset,
  AssetStatus,
  EvidenceSignal,
  PurchaseAttempt,
  Scenario,
  Supplier,
  Tone,
  VendorStatus,
  Workspace,
} from "../types";
import type { DecisionPhase, DemoState, VendorCandidate } from "./contracts";

export function scenarioIdOf(state: DemoState): string {
  return state.scenario.id;
}

const PHASE_LABEL: Record<DecisionPhase, string> = {
  observed: "Observed",
  planned: "Planned",
  recalled_history: "Recalled history",
  sourced: "Sourced",
  authorization_attempted: "Authorization attempted",
  authorization_denied: "Authorization denied",
  replanned: "Replanned",
  verifying: "Verifying",
  explained: "Explained",
  ineligible: "Ineligible",
  blacklisted: "Blacklisted",
  attested: "Attested",
  ordered: "Ordered",
  inbound_scheduled: "Inbound scheduled",
  failed: "Failed",
};

const PHASE_TONE: Record<DecisionPhase, Tone> = {
  observed: "warn",
  planned: "info",
  recalled_history: "info",
  sourced: "info",
  authorization_attempted: "warn",
  authorization_denied: "bad",
  replanned: "warn",
  verifying: "warn",
  explained: "info",
  ineligible: "bad",
  blacklisted: "bad",
  attested: "ok",
  ordered: "ok",
  inbound_scheduled: "ok",
  failed: "bad",
};

// Fallback-safe lookups: the control-plane's DecisionPhase set grows over time
// (e.g. "explained" was added mid-wave). Unknown phases degrade to a title-cased
// label and neutral tone instead of rendering `undefined`.
function titleCasePhase(p: string): string {
  return p.charAt(0).toUpperCase() + p.slice(1).replace(/_/g, " ");
}

function phaseLabel(p: DecisionPhase): string {
  return PHASE_LABEL[p] ?? titleCasePhase(p);
}

function phaseTone(p: DecisionPhase): Tone {
  return PHASE_TONE[p] ?? "neutral";
}

function timeOf(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "--:--";
  return new Date(ms).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  });
}

function vendorNameOf(state: DemoState, vendorId: string | undefined): string {
  if (!vendorId) return "Unknown vendor";
  const v = state.vendors.find((c) => c.id === vendorId);
  return v ? v.tradingName || v.legalName : vendorId;
}

function statusOf(state: DemoState, v: VendorCandidate): VendorStatus {
  if (state.blacklistedVendorIds.includes(v.id)) return "ineligible";
  if (state.learning.provenVendorIds.includes(v.id) || state.order?.vendorId === v.id) {
    return "verified";
  }
  return "unchecked";
}

function adaptSupplier(state: DemoState, v: VendorCandidate): Supplier {
  const status = statusOf(state, v);
  const blacklisted = status === "ineligible";
  const evidence: EvidenceSignal[] = [
    { label: "Domain", value: v.domain, state: blacklisted ? "bad" : "good" },
    { label: "Listing", value: v.synthetic ? "Synthetic" : "Disclosed", state: "neutral" },
    {
      label: "Policy status",
      value: status === "ineligible" ? "Ineligible" : status === "verified" ? "Verified" : "Candidate",
      state: blacklisted ? "bad" : status === "verified" ? "good" : "neutral",
    },
    { label: "Payee", value: v.quote.payeeName, state: "neutral" },
  ];
  return {
    id: v.id,
    name: v.tradingName || v.legalName,
    region: v.domain, // rendered under a live-aware "Domain" label
    capacityClass: `${v.quote.availableQty} units available`,
    trustScore: 0, // backend exposes no trust score; UI shows status, not this number
    settlementRail: v.quote.payeeName, // rendered under a live-aware "Payee" label
    baseFee: v.quote.unitPriceCents, // rendered under a live-aware "Unit quote" label
    slaMs: v.quote.leadTimeDays, // reinterpreted as DAYS under a live-aware "Lead time" label
    status,
    note: `${v.synthetic ? "Synthetic disclosed candidate" : "Disclosed candidate"}${
      blacklisted ? " · ineligible by policy" : status === "verified" ? " · authorized" : ""
    }`,
    evidence,
  };
}

function adaptAsset(state: DemoState): Asset {
  const { inventory } = state;
  const status: AssetStatus =
    inventory.currentQty <= 0 ? "failed" : inventory.currentQty <= inventory.threshold ? "critical" : "healthy";
  return {
    id: inventory.sku,
    name: inventory.name,
    current: `${inventory.currentQty} on hand${inventory.inboundQty > 0 ? ` · ${inventory.inboundQty} inbound` : ""}`,
    threshold: `${inventory.threshold}`,
    status,
    source: state.monitor.watchedSkus.includes(inventory.sku) ? "Monitor" : "Control plane",
  };
}

function adaptPurchases(state: DemoState): PurchaseAttempt[] {
  const rows: PurchaseAttempt[] = [];
  const denied = state.events.find((e) => e.phase === "authorization_denied");
  if (denied || state.metrics.deniedRequestId) {
    const point = state.metrics.deniedEnforcementPoint ?? "policy";
    rows.push({
      id: state.metrics.deniedRequestId ?? "denied",
      vendorName: vendorNameOf(state, denied?.vendorId ?? state.blacklistedVendorIds[0]),
      item: state.inventory.name,
      amount: state.metrics.atRiskPoValuePreventedCents,
      status: "blocked",
      reason: `403 · ${point} denied unattested request`,
      createdAt: denied ? timeOf(denied.occurredAt) : "Now",
    });
  }
  if (state.order) {
    rows.push({
      id: state.order.id,
      vendorName: vendorNameOf(state, state.order.vendorId),
      item: `${state.order.quantity} × ${state.order.sku}`,
      amount: state.order.totalAmountCents,
      status: state.order.inboundStatus === "scheduled" ? "placed" : "delivered",
      reason: `Authorized · inbound ${state.order.inboundStatus}`,
      createdAt: timeOf(state.order.createdAt),
    });
  }
  return rows;
}

function adaptActivity(state: DemoState): ActivityItem[] {
  return state.events
    .slice(-12)
    .reverse()
    .map((e) => ({
      time: timeOf(e.occurredAt),
      source: phaseLabel(e.phase),
      message: e.detail,
      tone: phaseTone(e.phase),
    }));
}

function adaptScenario(state: DemoState, base: Workspace): Scenario {
  const { inventory, scenario, metrics, order } = state;
  return {
    id: scenario.id,
    workspaceId: base.id,
    type: scenario.id,
    site: scenario.industry,
    title: scenario.trigger,
    metricLabel: "On hand",
    threshold: inventory.threshold,
    breachValue: inventory.currentQty,
    unit: "units",
    severity: "critical",
    description: `Monitoring ${inventory.name} (${inventory.sku}).`,
    impact: `On-hand ${inventory.currentQty} vs continuity threshold ${inventory.threshold}.`,
    item: inventory.name,
    candidateVendorIds: state.vendors.map((v) => v.id),
    blockedAmount: metrics.atRiskPoValuePreventedCents,
    protectedLabel: "At-risk value prevented",
    protectedValue: formatCurrency(metrics.atRiskPoValuePreventedCents),
    protectedDetail: order ? "Recovered via authorized vendor" : "Awaiting authorized order",
  };
}

// Overlay real run data onto a base (illustrative) workspace. The base supplies
// only the fields the control-plane does not expose (kpis aggregates, reportRows
// category breakdown, spendCeiling, integrations); everything run-specific is real.
export function adaptWorkspace(state: DemoState, base: Workspace): Workspace {
  return {
    ...base,
    name: state.scenario.label,
    shortName: state.scenario.id,
    industry: state.scenario.industry,
    host: "Live control-plane",
    scenario: adaptScenario(state, base),
    assets: [adaptAsset(state)],
    suppliers: state.vendors.map((v) => adaptSupplier(state, v)),
    purchases: adaptPurchases(state),
    activity: adaptActivity(state),
  };
}

// ---- Learning ledger + incidents (E3) ------------------------------------
// The control-plane exposes the learning ledger as a SUMMARY only
// (learning.incidentCount / lastResolutionMs / provenVendorIds) plus the live
// event stream (recalled_history, explained, …). Per-incident IncidentRecord[]
// history is NOT served over HTTP, so these helpers surface the current incident
// + the aggregate + proven-vendor history + reasoning feed — all real fields.

export interface ProvenVendor {
  id: string;
  name: string;
  domain: string;
}

// Vendors that closed a prior incident (learning.provenVendorIds), resolved to
// their current name/domain where the candidate is still present in the run.
export function provenVendorList(state: DemoState): ProvenVendor[] {
  return state.learning.provenVendorIds.map((id) => {
    const v = state.vendors.find((c) => c.id === id);
    return { id, name: v ? v.tradingName || v.legalName : id, domain: v?.domain ?? "—" };
  });
}

export interface LearningEvent {
  id: string;
  time: string;
  label: string;
  detail: string;
  tone: Tone;
}

// The decisions worth surfacing on the learning page: warm-path recalls, the
// agent's own explanations, and the resulting attestation/order. Detail strings
// are rendered verbatim — never parsed into structure.
const LEARNING_PHASES = new Set<DecisionPhase>([
  "recalled_history",
  "explained",
  "attested",
  "ordered",
]);

export function learningFeed(state: DemoState): LearningEvent[] {
  return state.events
    .filter((e) => LEARNING_PHASES.has(e.phase))
    .slice(-20)
    .reverse()
    .map((e) => ({
      id: e.id,
      time: timeOf(e.occurredAt),
      label: phaseLabel(e.phase),
      detail: e.detail,
      tone: phaseTone(e.phase),
    }));
}

export interface LiveIncident {
  scenarioId: string;
  title: string;
  sku: string;
  itemName: string;
  onHand: number;
  threshold: number;
  runStatus: string;
  deniedRequestId?: string;
  deniedPoint?: string;
  orderId?: string;
  orderVendor?: string;
  atRiskPreventedCents: number;
  verificationSpendCents: number;
  inboundQty: number;
}

// The one incident the control-plane currently holds in /api/state.
export function currentIncident(state: DemoState): LiveIncident {
  return {
    scenarioId: state.scenario.id,
    title: state.scenario.trigger,
    sku: state.inventory.sku,
    itemName: state.inventory.name,
    onHand: state.inventory.currentQty,
    threshold: state.inventory.threshold,
    runStatus: state.runStatus,
    deniedRequestId: state.metrics.deniedRequestId,
    deniedPoint: state.metrics.deniedEnforcementPoint,
    orderId: state.order?.id,
    orderVendor: state.order ? vendorNameOf(state, state.order.vendorId) : undefined,
    atRiskPreventedCents: state.metrics.atRiskPoValuePreventedCents,
    verificationSpendCents: state.metrics.verificationSpendCents,
    inboundQty: state.inventory.inboundQty,
  };
}
