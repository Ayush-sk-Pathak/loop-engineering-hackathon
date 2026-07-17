"use client";

import Link from "next/link";
import { DATACENTER } from "@/lib/datacenter/config";

export function DatacenterShell({
  connected,
  lastUpdated,
  children,
}: {
  connected: boolean;
  lastUpdated: number;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-ground text-ink">
      <a
        href="#datacenter-main"
        className="fixed left-3 top-3 z-[60] -translate-y-20 rounded-md bg-ink px-3 py-2 text-xs font-semibold text-white focus:translate-y-0"
      >
        Skip to monitoring
      </a>
      <header className="sticky top-0 z-50 border-b border-line bg-surface/95 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-[1480px] flex-wrap items-center gap-3 px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="grid size-8 place-items-center rounded-lg bg-ink text-white" aria-hidden>
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="4" y="4" width="16" height="16" rx="3" />
                <path d="M9 9h6v6H9zM9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3" />
              </svg>
            </span>
            <div>
              <p className="text-sm font-semibold tracking-[-0.015em]">{DATACENTER.company}</p>
              <p className="text-[10px] font-medium uppercase tracking-[0.07em] text-faint">Compute control center</p>
            </div>
          </div>
          <span className="mx-1 hidden h-7 w-px bg-line sm:block" />
          <div className="hidden sm:block">
            <p className="text-[10px] font-bold uppercase tracking-[0.07em] text-faint">Site</p>
            <p className="text-xs font-semibold text-muted">{DATACENTER.site}</p>
          </div>
          <nav aria-label="Data center sections" className="order-3 flex w-full gap-1 overflow-x-auto border-t border-line pt-2 md:order-none md:ml-5 md:w-auto md:border-0 md:pt-0">
            {[
              ["#overview", "Overview"],
              ["#fleet", "GPU fleet"],
              ["#telemetry", "Telemetry"],
              ["#incidents", "Incidents"],
            ].map(([href, label]) => (
              <a key={href} href={href} className="shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold text-muted hover:bg-surface-2 hover:text-ink">
                {label}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <span className={`status-pill ${connected ? "ok" : "warn"}`}>
              {connected ? "Control plane live" : "Control plane unavailable"}
            </span>
            <span className="hidden text-[10px] text-faint lg:block">
              {lastUpdated ? `Updated ${new Date(lastUpdated).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : "Awaiting sample"}
            </span>
            <Link href="/dashboard" className="btn-secondary hidden sm:inline-flex">Open business agent</Link>
          </div>
        </div>
      </header>
      <main id="datacenter-main" className="mx-auto max-w-[1480px] px-4 py-5 sm:px-6 sm:py-7">
        {children}
      </main>
    </div>
  );
}
