"use client";

import { useCallback, useEffect, useState } from "react";
import { SCHEMA_VERSION, type DecisionPhase, type DemoState } from "@stockshield/contracts";
import {
  Activity,
  Ban,
  Check,
  CircleDollarSign,
  MemoryStick,
  PackageCheck,
  RefreshCw,
  ServerCrash,
  ShieldCheck,
  TriangleAlert,
  WalletCards,
} from "lucide-react";

const API = "/api/control";

const phaseIcon: Partial<Record<DecisionPhase, React.ReactNode>> = {
  authorization_denied: <Ban size={15} />,
  replanned: <RefreshCw size={15} />,
  ineligible: <TriangleAlert size={15} />,
  attested: <ShieldCheck size={15} />,
  ordered: <Check size={15} />,
  inbound_scheduled: <PackageCheck size={15} />,
};

const money = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

export function OperationsDashboard() {
  const [state, setState] = useState<DemoState>();
  const [connectionError, setConnectionError] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`${API}/api/state`, { cache: "no-store" });
      if (!response.ok) throw new Error(String(response.status));
      setState(await response.json() as DemoState);
      setConnectionError(false);
    } catch {
      setConnectionError(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 400);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const command = async (path: string) => {
    await fetch(`${API}${path}`, { method: "POST" });
    await refresh();
  };

  if (!state) {
    return <main className="loading">{connectionError ? "Control plane unavailable" : "Loading operations state..."}</main>;
  }

  const isRunning = state.runStatus === "running";
  const isAtRisk = state.inventory.currentQty <= state.inventory.threshold && state.inventory.inboundQty === 0;
  const lastCheckSeconds = state.monitor.lastCheckAt
    ? Math.max(0, Math.floor((Date.now() - Date.parse(state.monitor.lastCheckAt)) / 1_000))
    : null;
  const denialLabel = state.metrics.deniedRequestId
    ? state.metrics.deniedEnforcementPoint === "pomerium"
      ? "Pomerium denied"
      : "Local guard denied"
    : "Awaiting attempt";

  return (
    <main>
      <header className="topbar">
        <div className="brand">
          <span className="brandMark"><ShieldCheck size={20} /></span>
          <div><strong>StockShield</strong><span>Procurement control plane</span></div>
        </div>
        <div className="actions">
          <span className={`mode ${state.metrics.verificationMode}`}>{state.metrics.verificationMode === "fixture" ? "Fixture evidence" : "Live Zero"}</span>
          <button className="iconButton" onClick={() => command("/api/demo/reset")} title="Reset demo" aria-label="Reset demo"><RefreshCw size={17} /></button>
          <button
            className="primaryButton"
            onClick={() => command("/api/demo/consume")}
            disabled={isRunning || state.inventory.currentQty === 0 || state.inventory.inboundQty > 0}
          >
            <ServerCrash size={16} />{isRunning ? "Agent responding" : "Simulate node failure"}
          </button>
        </div>
      </header>

      <div className={`monitorStrip ${state.monitor.active ? "active" : ""}`}>
        <Activity size={15} />
        <strong>{state.monitor.active ? "Inventory monitor active" : "Inventory monitor disabled"}</strong>
        <span>{state.monitor.watchedSkus.length} critical SKU watched</span>
        <span>{lastCheckSeconds === null ? "Awaiting first check" : `Checked ${lastCheckSeconds}s ago`}</span>
      </div>

      {connectionError && <div className="connectionBanner">Control plane connection interrupted. Retrying.</div>}

      <section className="metricBand" aria-label="Procurement metrics">
        <Metric
          icon={<Activity />}
          label={state.inventory.inboundQty > 0 ? "Recovery state" : "Outage exposure"}
          value={state.inventory.inboundQty > 0 ? "Inbound secured" : isAtRisk ? `${money(state.inventory.downtimeCostCentsPerMinute)}/min` : "Protected"}
          detail={isAtRisk ? "Illustrative incident rate" : `${state.inventory.currentQty} spares on hand`}
          tone={isAtRisk ? "red" : "green"}
        />
        <Metric icon={<Ban />} label="At-risk PO value prevented" value={money(state.metrics.atRiskPoValuePreventedCents)} tone="red" />
        <Metric icon={<WalletCards />} label="Verification spend" value={money(state.metrics.verificationSpendCents)} detail={state.metrics.verificationMode === "fixture" ? "No live charge in dev" : "Settled through Zero"} tone="gold" />
        <Metric
          icon={<ShieldCheck />}
          label="Authorization state"
          value={denialLabel}
          detail={state.metrics.deniedRequestId
            ? `Request ${state.metrics.deniedRequestId.slice(0, 12)}`
            : `${state.metrics.authorizationMode} mode`}
          tone="blue"
        />
      </section>

      <div className="workspace">
        <section className="inventoryPanel">
          <div className="sectionHeading"><div><span>Critical spares pool</span><h1>{state.inventory.name}</h1></div><MemoryStick size={20} /></div>
          <div className="productVisual">
            <MemoryStick size={112} strokeWidth={1.1} aria-label="ECC memory module" />
            <span className="sku">{state.inventory.sku}</span>
          </div>
          <div className="stockRow">
            <div><span>On hand</span><strong className={state.inventory.currentQty === 0 ? "dangerText" : ""}>{state.inventory.currentQty}</strong></div>
            <div><span>Reorder point</span><strong>{state.inventory.threshold}</strong></div>
            <div><span>Inbound</span><strong>{state.inventory.inboundQty}</strong></div>
          </div>
          <div className="stockTrack"><span style={{ width: `${Math.min(100, state.inventory.currentQty * 20)}%` }} /></div>
          <p className="inventoryNote">A PO schedules inbound supply. It does not claim physical inventory has already arrived.</p>
        </section>

        <section className="tracePanel">
          <div className="sectionHeading"><div><span>Autonomous decision trace</span><h2>{state.runStatus === "idle" ? "Ready" : state.runStatus}</h2></div><span className={`pulse ${isRunning ? "active" : ""}`} /></div>
          <div className="timeline" aria-live="polite">
            {state.events.length === 0 && <div className="emptyState"><Activity size={28} /><strong>Watching critical inventory</strong><span>Node failures consume spares. The monitor starts procurement when stock reaches the threshold.</span></div>}
            {[...state.events].reverse().map((event) => (
              <article className={`timelineItem phase-${event.phase}`} key={event.id}>
                <div className="timelineIcon">{phaseIcon[event.phase] ?? <span />}</div>
                <div><div className="eventMeta"><strong>{event.phase.replaceAll("_", " ")}</strong><time>{new Date(event.occurredAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time></div><p>{event.detail}</p>{event.vendorName && <span className="vendorLabel">{event.vendorName}</span>}</div>
              </article>
            ))}
          </div>
        </section>

        <section className="vendorPanel">
          <div className="sectionHeading"><div><span>Candidate vendors</span><h2>Evidence status</h2></div><CircleDollarSign size={20} /></div>
          <div className="vendorList">
            {state.vendors.map((vendor) => {
              const blocked = state.blacklistedVendorIds.includes(vendor.id);
              const selected = state.order?.vendorId === vendor.id;
              return <article className={`vendorRow ${blocked ? "blocked" : ""} ${selected ? "selected" : ""}`} key={vendor.id}>
                <div className="vendorIdentity"><span className="vendorLogo">{vendor.tradingName.slice(0, 2).toUpperCase()}</span><div><strong>{vendor.tradingName}</strong><span>{vendor.domain}</span></div></div>
                <div className="vendorQuote"><strong>{money(vendor.quote.unitPriceCents)}</strong><span>{vendor.quote.leadTimeDays}d lead</span></div>
                <div className="vendorStatus">{blocked ? <><Ban size={15} /> Ineligible</> : selected ? <><Check size={15} /> PO accepted</> : <>Pending</>}</div>
              </article>;
            })}
          </div>
          <div className="controlProof">
            <ShieldCheck size={18} />
            <div>
              <strong>{state.metrics.authorizationMode === "pomerium" ? "Pomerium authorization boundary" : "Local development guard"}</strong>
              <span>{state.metrics.authorizationMode === "pomerium"
                ? "Pair the request ID with Pomerium's authorize log to prove the origin was never reached."
                : "This mode proves object binding locally, but it is not evidence of a live Pomerium denial."}</span>
            </div>
          </div>
        </section>
      </div>

      <footer><span>Schema v{SCHEMA_VERSION}</span><span>SQLite decision trail</span><span>Updated {new Date(state.updatedAt).toLocaleTimeString()}</span></footer>
    </main>
  );
}

function Metric({ icon, label, value, detail, tone }: { icon: React.ReactNode; label: string; value: string; detail?: string; tone: string }) {
  return <div className={`metric ${tone}`}><span className="metricIcon">{icon}</span><div><span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</div></div>;
}
