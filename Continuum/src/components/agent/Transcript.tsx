"use client";

import { useEffect, useRef } from "react";
import { useContinuum } from "@/lib/store";
import { formatTs } from "@/lib/format";

export function Transcript() {
  const { snapshot } = useContinuum();
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [snapshot.transcript.length]);

  return (
    <aside className="panel flex min-h-[352px] flex-col">
      <div className="panel-header">
        Agent activity
        <span className="ml-auto normal-case tracking-normal text-faint">Live trace</span>
      </div>
      <div
        ref={listRef}
        role="log"
        aria-live="polite"
        aria-label="Continuum agent decisions"
        className="h-[314px] flex-1 overflow-y-auto bg-surface"
      >
        <ul className="space-y-0 p-3 font-mono text-[10.5px] leading-relaxed">
          {snapshot.transcript.map((entry) => (
            <li
              key={entry.id}
              className="grid grid-cols-[54px_72px_1fr] gap-2 border-b border-line/70 py-2.5 last:border-0"
            >
              <span className="text-faint">{formatTs(entry.ts)}</span>
              <span className={`font-semibold ${
                entry.tone === "bad" ? "text-bad" : entry.tone === "warn" ? "text-warn" : entry.tone === "ok" ? "text-ok" : "text-brand-ink"
              }`}>
                {entry.source}
              </span>
              <span className="break-words text-muted">{entry.message}</span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
