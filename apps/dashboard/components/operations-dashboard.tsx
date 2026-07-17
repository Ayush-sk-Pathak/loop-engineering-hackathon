"use client";

import { useCallback, useEffect, useState } from "react";
import type { DecisionPhase, DemoState } from "@stockshield/contracts";
import {
  Ban,
  Check,
  CircleDollarSign,
  PackageCheck,
  Play,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  TriangleAlert,
  WalletCards,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_CONTROL_PLANE_URL ?? "http://127.0.0.1:4000";

const phaseIcon: Partial<Record<DecisionPhase, React.ReactNode>> = {
  policy_probe_denied: <Ban size={15} />,
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
  const rejected = state.vendors.find((vendor) => state.blacklistedVendorIds.includes(vendor.id));

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
          <button className="primaryButton" onClick={() => command("/api/demo/run")} disabled={isRunning}>
            <Play size={16} fill="currentColor" />{isRunning ? "Loop running" : "Trigger stockout"}
          </button>
        </div>
      </header>

      {connectionError && <div className="connectionBanner">Control plane connection interrupted. Retrying.</div>}

      <section className="metricBand" aria-label="Procurement metrics">
        <Metric icon={<Ban />} label="At-risk PO value prevented" value={money(state.metrics.atRiskPoValuePreventedCents)} tone="red" />
        <Metric icon={<WalletCards />} label="Verification spend" value={money(state.metrics.verificationSpendCents)} detail={state.metrics.verificationMode === "fixture" ? "No live charge in dev" : "Settled through Zero"} tone="gold" />
        <Metric icon={<PackageCheck />} label="Inbound scheduled" value={`${state.metrics.inboundQuantity} units`} detail="On-hand inventory unchanged" tone="green" />
        <Metric icon={<ShieldCheck />} label="Policy state" value={rejected ? "Denial proven" : "Awaiting probe"} detail="Pomerium required for prize demo" tone="blue" />
      </section>

      <div className="workspace">
        <section className="inventoryPanel">
          <div className="sectionHeading"><div><span>Storefront inventory</span><h1>{state.inventory.name}</h1></div><ShoppingBag size={20} /></div>
          <div className="productVisual">
            <img src="/product.png" alt="A silver laptop representing the demo product" />
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
            {state.events.length === 0 && <div className="emptyState"><CircleDollarSign size={28} /><strong>No active procurement run</strong><span>Trigger a stockout to start the evidence and authorization loop.</span></div>}
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
            <div><strong>Hard authorization boundary</strong><span>The prize demo must show Pomerium&apos;s request ID and authorize log, not an application-generated 403.</span></div>
          </div>
        </section>
      </div>

      <footer><span>Schema v1.0</span><span>SQLite decision trail</span><span>Updated {new Date(state.updatedAt).toLocaleTimeString()}</span></footer>
    </main>
  );
}

function Metric({ icon, label, value, detail, tone }: { icon: React.ReactNode; label: string; value: string; detail?: string; tone: string }) {
  return <div className={`metric ${tone}`}><span className="metricIcon">{icon}</span><div><span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</div></div>;
}
