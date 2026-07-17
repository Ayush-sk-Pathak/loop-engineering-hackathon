"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WORKSPACE_LIST } from "@/lib/data/workspaces";
import { useContinuum } from "@/lib/store";
import type { WorkspaceId } from "@/lib/types";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard", group: "Operations" },
  { href: "/inventory", label: "Inventory", icon: "inventory", group: "Operations" },
  { href: "/procurement", label: "Procurement", icon: "procurement", group: "Operations" },
  { href: "/suppliers", label: "Vendors", icon: "vendors", group: "Operations" },
  { href: "/continuum", label: "Continuum", icon: "shield", group: "Installed app" },
  { href: "/reports", label: "Reports", icon: "reports", group: "Manage" },
  { href: "/settings", label: "Settings", icon: "settings", group: "Manage" },
];

function Icon({ name, className = "size-4" }: { name: string; className?: string }) {
  const paths: Record<string, React.ReactNode> = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /></>,
    inventory: <><path d="m3 7 9-4 9 4-9 4-9-4Z" /><path d="M3 7v10l9 4 9-4V7M12 11v10" /></>,
    procurement: <><path d="M4 8h13l-3-3M20 16H7l3 3" /></>,
    vendors: <><path d="M12 2 4 6v6c0 5 3.4 8.3 8 10 4.6-1.7 8-5 8-10V6l-8-4Z" /><path d="m9 12 2 2 4-4" /></>,
    shield: <><path d="M12 2 4 6v6c0 5 3.4 8.3 8 10 4.6-1.7 8-5 8-10V6l-8-4Z" /><path d="M8 12h3l2-4 2 8 2-4h2" /></>,
    reports: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.3 1a7 7 0 0 0-1.7-1L14.9 2h-4l-.3 2.6a7 7 0 0 0-1.7 1l-2.3-1-2 3.4 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 1.7 1l.3 2.6h4l.3-2.6a7 7 0 0 0 1.7-1l2.3 1 2-3.4-2-1.5c.1-.3.1-.7.1-1Z" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  };
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      {paths[name]}
    </svg>
  );
}

export function AgentStatus() {
  const { snapshot } = useContinuum();
  return (
    <span className={`status-pill ${snapshot.running ? "warn" : "ok"}`}>
      {snapshot.running ? "Remediating" : "Agent connected"}
    </span>
  );
}

export function OpsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { workspaceId, setWorkspace } = useContinuum();

  return (
    <div className="min-h-screen bg-ground p-0 md:p-5">
      <div className="mx-auto min-h-screen max-w-[1480px] overflow-hidden border-line bg-app shadow-[0_16px_48px_rgba(16,24,39,.12)] md:min-h-[calc(100vh-40px)] md:rounded-2xl md:border">
        <header className="flex min-h-14 flex-wrap items-center gap-3 border-b border-line bg-surface px-4 py-2.5 md:px-5">
          <Link href="/dashboard" className="flex items-center gap-2.5 font-semibold tracking-[-0.01em] text-ink">
            <span className="grid size-7 place-items-center rounded-lg bg-ink text-surface">
              <span className="grid grid-cols-2 gap-0.5">
                <i className="size-1.5 rounded-[2px] border border-current" />
                <i className="size-1.5 rounded-[2px] border border-current" />
                <i className="size-1.5 rounded-[2px] border border-current" />
                <i className="size-1.5 rounded-[2px] border border-current" />
              </span>
            </span>
            OpsHub
          </Link>
          <span className="h-6 w-px bg-line" />
          <span className="hidden text-[10px] font-bold uppercase tracking-[0.08em] text-faint sm:block">
            Workspace
          </span>
          <div className="flex rounded-lg border border-line bg-surface-2 p-0.5">
            {WORKSPACE_LIST.map((workspace) => (
              <button
                key={workspace.id}
                type="button"
                aria-pressed={workspaceId === workspace.id}
                onClick={() => setWorkspace(workspace.id as WorkspaceId)}
                className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${
                  workspaceId === workspace.id
                    ? "bg-surface text-ink shadow-sm"
                    : "text-muted hover:text-ink"
                }`}
              >
                <span className="hidden lg:inline">{workspace.name}</span>
                <span className="lg:hidden">{workspace.shortName}</span>
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <AgentStatus />
            <button type="button" aria-label="Search" className="grid size-8 place-items-center rounded-lg border border-line bg-surface text-muted hover:text-ink">
              <Icon name="search" />
            </button>
            <span className="grid size-8 place-items-center rounded-full bg-brand text-xs font-bold text-white">
              KP
            </span>
          </div>
        </header>

        <nav className="flex gap-1 overflow-x-auto border-b border-line bg-surface px-3 py-2 md:hidden">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold ${
                  active ? "bg-brand-soft text-brand-ink" : "text-muted"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="grid md:grid-cols-[216px_minmax(0,1fr)]">
          <aside className="hidden min-h-[calc(100vh-97px)] flex-col border-r border-line bg-surface p-3 md:flex">
            {["Operations", "Installed app", "Manage"].map((group) => (
              <div key={group} className="mb-3">
                <p className="px-2.5 pb-1.5 pt-2 text-[10px] font-bold uppercase tracking-[0.08em] text-faint">
                  {group}
                </p>
                {NAV.filter((item) => item.group === group).map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition ${
                        active
                          ? "bg-brand-soft font-semibold text-brand-ink"
                          : "text-muted hover:bg-surface-2 hover:text-ink"
                      }`}
                    >
                      {active && <span className="absolute -left-3 inset-y-1.5 w-[3px] rounded-r bg-brand" />}
                      <Icon name={item.icon} />
                      {item.label}
                      {item.href === "/continuum" && (
                        <span className="ml-auto rounded-full border border-brand-line bg-surface px-1.5 py-0.5 text-[9px] font-bold uppercase text-brand-ink">
                          Live
                        </span>
                      )}
                      {item.href === "/inventory" && (
                        <span className="ml-auto rounded-full border border-bad-line bg-bad-soft px-1.5 py-0.5 text-[9px] font-bold text-bad">
                          1
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            ))}
            <div className="mt-auto flex items-center gap-2 border-t border-line px-2.5 pt-4 text-xs text-faint">
              <span className="live-dot size-2 rounded-full bg-ok" />
              Continuum connected
            </div>
          </aside>
          <main className="min-w-0 bg-app p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
