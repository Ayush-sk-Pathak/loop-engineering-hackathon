"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { AgentTheater } from "@/components/agent/DemoPlayer";
import { Wordmark } from "@/components/brand/Wordmark";
import { WORKSPACE_LIST } from "@/lib/data/workspaces";
import { useContinuum } from "@/lib/store";
import type { WorkspaceId } from "@/lib/types";

function HeroLoop() {
  const nodes = [
    { x: 510, y: 200, label: "Detect", sub: "Boundary breached", color: "#95620f" },
    { x: 745, y: 330, label: "Verify", sub: "Evidence purchased", color: "#4b47c9" },
    { x: 990, y: 235, label: "Guard", sub: "Policy enforced", color: "#bd3c32" },
    { x: 1215, y: 320, label: "Procure", sub: "Continuity restored", color: "#147a48" },
  ];
  return (
    <div className="pointer-events-none absolute inset-0 hidden overflow-hidden md:block" aria-hidden>
      <div className="absolute inset-0 bg-[linear-gradient(rgba(219,226,235,.38)_1px,transparent_1px),linear-gradient(90deg,rgba(219,226,235,.38)_1px,transparent_1px)] bg-[size:72px_72px] [mask-image:radial-gradient(ellipse_68%_62%_at_67%_43%,black,transparent_78%)]" />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1400 760" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="heroLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#95620f" />
            <stop offset="38%" stopColor="#4b47c9" />
            <stop offset="68%" stopColor="#bd3c32" />
            <stop offset="100%" stopColor="#147a48" />
          </linearGradient>
        </defs>
        <path
          d="M350 355 C 440 160, 560 155, 665 275 C 760 385, 835 365, 930 265 C 1010 180, 1090 220, 1260 370"
          fill="none"
          stroke="url(#heroLine)"
          strokeWidth="1.4"
          strokeDasharray="5 9"
          opacity=".5"
        />
        {nodes.map((node) => (
          <g key={node.label}>
            <circle cx={node.x} cy={node.y} r="5" fill={node.color} />
            <circle cx={node.x} cy={node.y} r="11" fill="none" stroke={node.color} opacity=".18" />
            <text x={node.x + 13} y={node.y - 3} fill="#101827" fontSize="12" fontWeight="650">{node.label}</text>
            <text x={node.x + 13} y={node.y + 14} fill="#8793a3" fontSize="9.5">{node.sub}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function MobileLoop() {
  return (
    <div className="mt-10 rounded-2xl border border-line bg-surface/80 p-4 shadow-sm md:hidden">
      <div className="grid grid-cols-4 gap-2">
        {[
          ["01", "Detect"],
          ["02", "Verify"],
          ["03", "Guard"],
          ["04", "Procure"],
        ].map(([number, label], index) => (
          <div key={label} className="relative text-center">
            {index < 3 && <span className="absolute left-[60%] top-3 h-px w-[80%] bg-line-strong" />}
            <span className={`relative mx-auto grid size-6 place-items-center rounded-full border bg-surface font-mono text-[9px] ${
              label === "Guard" ? "border-bad-line text-bad" : "border-brand-line text-brand-ink"
            }`}>{number}</span>
            <p className="mt-2 text-[10px] font-semibold text-muted">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function LandingPage() {
  const { workspaceId, setWorkspace } = useContinuum();

  return (
    <div className="min-h-screen bg-app">
      <header className="sticky top-0 z-50 border-b border-line/80 bg-app/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1380px] items-center px-5 sm:px-8">
          <Wordmark size="md" />
          <nav className="ml-auto hidden items-center gap-7 text-[13px] font-medium text-muted md:flex">
            <a href="#how-it-works" className="hover:text-ink">How it works</a>
            <a href="#live-product" className="hover:text-ink">Live product</a>
            <Link href="/dashboard" className="hover:text-ink">Operations</Link>
          </nav>
          <Link href="/continuum" className="btn-primary ml-5">
            Open Continuum
          </Link>
        </div>
      </header>

      <main>
        <section className="relative min-h-[calc(100svh-64px)] overflow-hidden border-b border-line bg-[radial-gradient(circle_at_72%_36%,rgba(75,71,201,.08),transparent_32%),radial-gradient(circle_at_88%_56%,rgba(20,122,72,.06),transparent_28%),linear-gradient(180deg,#fbfcfd,#f3f6fa)]">
          <HeroLoop />
          <div className="relative z-10 mx-auto flex min-h-[calc(100svh-64px)] max-w-[1380px] items-center px-5 py-20 sm:px-8">
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55 }}
              className="max-w-[590px]"
            >
              <div className="mb-6 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.08em] text-brand-ink">
                <span className="live-dot size-2 rounded-full bg-ok" />
                Autonomous continuity engine
              </div>
              <h1 className="text-[clamp(3.4rem,7vw,6.8rem)] font-semibold leading-[.86] tracking-[-0.065em] text-ink">
                Continuum
              </h1>
              <p className="mt-8 max-w-lg text-[clamp(1.65rem,3vw,2.7rem)] font-medium leading-[1.05] tracking-[-0.035em] text-ink">
                Continuity without waiting.
              </p>
              <p className="mt-5 max-w-md text-base leading-relaxed text-muted">
                When a critical boundary fails, Continuum discovers suppliers, verifies
                evidence, enforces payment policy, procures the recovery, and learns
                from the outcome.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link href="/continuum" className="btn-primary px-5 py-2.5">
                  Watch the agent work
                </Link>
                <Link href="/dashboard" className="btn-secondary px-5 py-2.5">
                  Explore operations
                </Link>
              </div>
              <MobileLoop />
            </motion.div>
          </div>
        </section>

        <section id="how-it-works" className="border-b border-line bg-surface px-5 py-24 sm:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="max-w-2xl">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-brand-ink">The control loop</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-ink sm:text-4xl">
                The agent can act. The policy decides if it should.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-muted">
                Procurement remains autonomous without making corporate controls
                optional. Verification and payment authorization happen outside the
                agent&apos;s judgment.
              </p>
            </div>
            <div className="mt-14 grid gap-10 md:grid-cols-3">
              {[
                ["01", "Observe the boundary", "Inventory, infrastructure, and traffic signals are continuously evaluated against business continuity thresholds."],
                ["02", "Verify before capital moves", "External evidence establishes entity, settlement account, provenance, and counterparty risk."],
                ["03", "Deny, reroute, and learn", "Policy blocks an unsafe payment. Continuum selects the verified alternative and stores the resolution path."],
              ].map(([number, title, body]) => (
                <article key={number} className="border-t border-line-strong pt-5">
                  <span className="font-mono text-xs font-semibold text-brand-ink">{number}</span>
                  <h3 className="mt-4 text-lg font-semibold tracking-[-0.02em] text-ink">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="live-product" className="bg-ground px-3 py-20 sm:px-8 sm:py-24">
          <div className="mx-auto max-w-[1380px]">
            <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-brand-ink">Live product</p>
                <h2 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-ink">See the policy guardrail in action.</h2>
                <p className="mt-3 max-w-2xl text-sm text-muted">
                  Switch industries, replay the incident, and watch the learned path
                  accelerate the next recovery without bypassing payment policy.
                </p>
              </div>
              <div className="sm:ml-auto">
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.06em] text-faint">Scenario</p>
                <div className="flex rounded-lg border border-line bg-surface-2 p-1">
                  {WORKSPACE_LIST.map((workspace) => (
                    <button
                      key={workspace.id}
                      type="button"
                      aria-pressed={workspaceId === workspace.id}
                      onClick={() => setWorkspace(workspace.id as WorkspaceId)}
                      className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                        workspaceId === workspace.id ? "bg-surface text-ink shadow-sm" : "text-muted"
                      }`}
                    >
                      {workspace.shortName}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="overflow-hidden rounded-2xl border border-line bg-app p-3 shadow-[0_18px_60px_rgba(16,24,39,.12)] sm:p-5">
              <div className="mb-4 flex items-center gap-2 border-b border-line pb-4">
                <span className="grid size-7 place-items-center rounded-lg bg-ink text-xs font-bold text-white">C</span>
                <span className="text-sm font-semibold text-ink">Continuum</span>
                <span className="ml-2 text-xs text-faint">Autonomous remediation workspace</span>
                <span className="status-pill ok ml-auto">Agent connected</span>
              </div>
              <AgentTheater autoStart compact />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-surface px-5 py-8 sm:px-8">
        <div className="mx-auto flex max-w-[1380px] flex-wrap items-center gap-4">
          <Wordmark size="sm" />
          <p className="text-xs text-faint">Autonomous continuity, policy enforced.</p>
          <Link href="/dashboard" className="ml-auto text-xs font-semibold text-brand-ink hover:underline">
            Open operations workspace
          </Link>
        </div>
      </footer>
    </div>
  );
}
