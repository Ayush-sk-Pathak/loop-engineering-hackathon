import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import type { EvidenceKind, VendorCandidate } from "@continuim/contracts";
import {
  hostOf,
  mapDomainAge,
  mapEnrichment,
  mapWebPresence,
} from "./signals.ts";

const execFileAsync = promisify(execFile);

/**
 * One settled paid Zero service call. A single call may back several evidence
 * signals; every signal it produces reuses this call's `receiptId` and cost, so
 * the verification policy can deduplicate spend by receipt (see
 * services/verification/src/policy.ts `paidCallCost`). `receiptId` is required
 * whenever `costCents > 0`.
 */
export interface ZeroSignalDraft {
  kind: EvidenceKind;
  value: boolean | number | string;
  outcome: "pass" | "warn" | "fail";
  detail: string;
}

export interface ZeroServiceCall {
  provider: string;
  serviceId: string;
  costCents: number;
  observedAt: string;
  receiptId?: string;
  signals: ZeroSignalDraft[];
}

/** The adapter's only dependency on the live Zero surface — faked in unit tests. */
export interface ZeroTransport {
  gather(vendor: VendorCandidate): Promise<ZeroServiceCall[]>;
}

/**
 * A settled Zero service reference. Invocation coordinates (`capabilityUrl`,
 * `capabilityToken`) come from `zero get <serviceId>` and are recorded in
 * config/zero-services.json when item A4 settles the catalog.
 */
export interface ZeroServiceRef {
  serviceId: string;
  provider: string;
  method: "GET" | "POST";
  capabilityUrl: string;
  capabilityToken: string;
}

/** One `zero` run result: `runId` anchors the settlement receipt, payment -> cost. */
export interface ZeroRunResult {
  runId: string;
  costCents: number;
  body: unknown;
}

/** Invokes one paid Zero service. Real impl shells to the `zero` CLI; unit tests inject a fake. */
export interface ZeroClient {
  run(service: ZeroServiceRef, input: unknown): Promise<ZeroRunResult>;
}

/**
 * Candidate services from the 2026-07-17 catalog verification (A2,
 * docs/integrations/ZERO.md). `capabilityUrl`/`capabilityToken` are filled from
 * config/zero-services.json when A4 settles each service; until then a real run
 * refuses loudly rather than call an unsettled coordinate.
 */
export const CANDIDATE_SERVICES = {
  enrichment: {
    serviceId: "cap_fHxedyuNDjC6grLLINJYM",
    provider: "Riley Craig x402 Agent Store",
    method: "GET",
    capabilityUrl: "https://store.agentexchange.work/connect/company",
    capabilityToken: "z_tVSxYo.10",
  },
  domain: {
    serviceId: "cap_PYHZbk2tn2qaZty-h5qNC",
    provider: "ZeroClick x402 Service Registry",
    method: "POST",
    capabilityUrl: "https://whois.withzero.ai/run",
    capabilityToken: "z_ArG8Uy.1",
  },
  web: {
    serviceId: "cap_gimcJl-eOG0JdEAyZkDjG",
    provider: "J-sey Data API",
    method: "GET",
    capabilityUrl: "https://johncross-data-api.johncrossugwuegede.workers.dev/scrape",
    capabilityToken: "z_tQpXUH.12",
  },
} satisfies Record<string, ZeroServiceRef>;

/**
 * Returns a live Zero transport only when a real Zero session is configured.
 * Current Zero supports a managed wallet session from `zero auth login`; a
 * bring-your-own wallet can also be provided with `ZERO_PRIVATE_KEY`, and
 * sandbox runs may pass `ZERO_SESSION_TOKEN`. With no session it returns `null`,
 * and the adapter answers 503 "Zero session not configured": it must never
 * fabricate fixture-shaped `live` evidence (STRATEGY-LEDGER decision 0010).
 */
export function createZeroTransport(
  env: Record<string, string | undefined> = process.env,
): ZeroTransport | null {
  if (!hasZeroSession(env)) return null;
  return new LiveZeroTransport(new CliZeroClient());
}

function hasZeroSession(env: Record<string, string | undefined>): boolean {
  if (env.ZERO_PRIVATE_KEY?.trim()) return true;
  if (env.ZERO_SESSION_TOKEN?.trim()) return true;
  if (env.ZERO_AUTH_TOKEN?.trim()) return true;

  const home = env.HOME?.trim();
  if (!home) return false;
  const configPath = join(home, ".zero", "config.json");
  if (!existsSync(configPath)) return false;
  try {
    const config = JSON.parse(readFileSync(configPath, "utf8")) as Record<string, unknown>;
    return Boolean(config.session || config.auth || config.byoPrivateKey);
  } catch {
    return false;
  }
}

/**
 * Real Zero evidence transport: runs the candidate services per the A2 mapping
 * and normalizes each into a `ZeroServiceCall`. The company-enrichment call backs
 * both `company_identity_match` and `payee_identity_match`, so they share one
 * receipt; `typosquat_detected` is computed locally in the verification policy,
 * not here. Call errors and unsettled coordinates propagate (the adapter answers
 * 502) so A4 sees exactly what to tune.
 */
export class LiveZeroTransport implements ZeroTransport {
  constructor(private readonly client: ZeroClient) {}

  async gather(vendor: VendorCandidate): Promise<ZeroServiceCall[]> {
    const observedAt = new Date();
    const calls: ZeroServiceCall[] = [];

    const enrichment = await this.client.run(CANDIDATE_SERVICES.enrichment, {
      domain: hostOf(vendor.domain),
    });
    calls.push(
      toCall(CANDIDATE_SERVICES.enrichment, enrichment, observedAt, mapEnrichment(enrichment.body, vendor)),
    );

    const domain = await this.client.run(CANDIDATE_SERVICES.domain, { domain: hostOf(vendor.domain) });
    const ageSignals = mapDomainAge(domain.body, observedAt);
    if (!ageSignals.length) {
      throw new Error(
        `Zero domain service ${CANDIDATE_SERVICES.domain.serviceId} returned no registration ` +
          "date (A4: confirm the RDAP/WHOIS candidate exposes domain age)",
      );
    }
    calls.push(toCall(CANDIDATE_SERVICES.domain, domain, observedAt, ageSignals));

    const web = await this.client.run(CANDIDATE_SERVICES.web, { url: `https://${hostOf(vendor.domain)}` });
    calls.push(toCall(CANDIDATE_SERVICES.web, web, observedAt, mapWebPresence(web.body)));

    return calls;
  }
}

function toCall(
  service: ZeroServiceRef,
  run: ZeroRunResult,
  observedAt: Date,
  signals: ZeroSignalDraft[],
): ZeroServiceCall {
  return {
    provider: service.provider,
    serviceId: service.serviceId,
    costCents: run.costCents,
    observedAt: observedAt.toISOString(),
    receiptId: run.runId,
    signals,
  };
}

/**
 * Real Zero invocation through the `zero` CLI (docs: `zero fetch <url>
 * --capability <token> -d <json> --json` -> `{ runId, ok, status, latencyMs,
 * payment, body }`). The `zero` CLI must be installed with a wallet session
 * (`ZERO_PRIVATE_KEY` or `zero auth login`). Per-service coordinates and the
 * exact payment->cents parsing are SETTLED in item A4 against live responses;
 * this is the seam that keeps A4 a run-and-record step, not a write-integration
 * step.
 */
export class CliZeroClient implements ZeroClient {
  constructor(private readonly maxPayUsd = 0.5) {}

  async run(service: ZeroServiceRef, input: unknown): Promise<ZeroRunResult> {
    if (!service.capabilityUrl) {
      throw new Error(
        `Zero service ${service.serviceId} has no settled capability URL ` +
          "(A4 fills config/zero-services.json)",
      );
    }
    const args = ["fetch", service.capabilityUrl, "--capability", service.capabilityToken];
    if (service.method === "GET") {
      const url = new URL(service.capabilityUrl);
      if (!input || typeof input !== "object") throw new Error("GET Zero input must be an object");
      for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
        if (typeof value === "string") url.searchParams.set(key, value);
      }
      args[1] = url.toString();
    } else {
      args.push("-d", JSON.stringify(input));
    }
    args.push("--json", "--max-pay", String(this.maxPayUsd));
    const { stdout } = await execFileAsync("zero", args);
    const envelope = JSON.parse(stdout) as {
      runId?: string;
      ok?: boolean;
      payment?: { amount?: number };
      body?: unknown;
    };
    if (!envelope.ok || typeof envelope.runId !== "string") {
      throw new Error(`Zero run for ${service.serviceId} did not settle ok`);
    }
    return {
      runId: envelope.runId,
      costCents: Math.round((envelope.payment?.amount ?? 0) * 100), // USDC -> cents; confirm in A4
      body: envelope.body,
    };
  }
}
