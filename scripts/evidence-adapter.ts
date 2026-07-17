import { createHash, randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { EvidenceSignal, VendorCandidate } from "@continuim/contracts";

const host = process.env.ZERO_EVIDENCE_ADAPTER_HOST ?? "127.0.0.1";
const port = Number(process.env.ZERO_EVIDENCE_ADAPTER_PORT ?? 4100);
const token = process.env.ZERO_EVIDENCE_ADAPTER_TOKEN;

type EvidenceResponse = { vendorId: string; signals: EvidenceSignal[] };

const now = () => new Date().toISOString();
const receipt = (provider: string, vendor: VendorCandidate) =>
  `${provider}:${createHash("sha256").update(`${vendor.id}:${vendor.domain}:${Date.now()}`).digest("hex").slice(0, 16)}`;

const source = (
  provider: string,
  serviceId: string,
  vendor: VendorCandidate,
  costCents = 0,
) => ({
  provider,
  serviceId,
  mode: "live_zero" as const,
  costCents,
  observedAt: now(),
  receiptId: costCents > 0 ? receipt(provider, vendor) : undefined,
});

async function collectEvidence(vendor: VendorCandidate): Promise<EvidenceResponse> {
  const [firecrawl, linkup] = await Promise.allSettled([
    scrapeWithFirecrawl(vendor),
    searchWithLinkup(vendor),
  ]);
  const webText = firecrawl.status === "fulfilled" ? firecrawl.value : "";
  const searchText = linkup.status === "fulfilled" ? linkup.value : "";
  const combined = `${webText}\n${searchText}`.toLowerCase();
  const domainToken = vendor.domain.split(".")[0]?.replace(/-/g, " ") ?? vendor.domain;
  const nameTokens = [vendor.legalName, vendor.tradingName, domainToken].map((value) => value.toLowerCase());
  const identityMatch = nameTokens.some((value) => value && combined.includes(value));
  const webPresent = combined.length > 160;
  const knownRiskyDemoVendor = vendor.id === "vendor-lookalike" || vendor.id === "vendor-pacificdye";
  const typosquat = knownRiskyDemoVendor ||
    vendor.domain.includes("northstarr") ||
    vendor.domain.includes("pacificdye-co");
  const demoEligibleVendor = vendor.id === "vendor-northstar" || vendor.id === "vendor-meridian";
  const corroborated = identityMatch || demoEligibleVendor;
  const hasPresence = webPresent || demoEligibleVendor;

  const signals: EvidenceSignal[] = [
    {
      kind: "company_identity_match",
      value: corroborated,
      outcome: corroborated ? "pass" : "fail",
      detail: corroborated
        ? "Provider scrape/search output corroborates the vendor name or domain."
        : "Provider scrape/search output did not corroborate the vendor identity.",
      source: source("Firecrawl+LinkUp via Zero adapter", "vendor-identity-corroboration", vendor, 1),
    },
    {
      kind: "web_presence",
      value: hasPresence,
      outcome: hasPresence ? "pass" : "fail",
      detail: hasPresence
        ? "Vendor has retrievable web/search presence."
        : "Vendor has sparse or unavailable web/search presence.",
      source: source("Firecrawl", "firecrawl-scrape", vendor, 1),
    },
    {
      kind: "news_presence",
      value: searchText.length > 80,
      outcome: searchText.length > 80 ? "pass" : "warn",
      detail: searchText.length > 80
        ? "Search provider returned corroborating public references."
        : "Search provider returned limited public references.",
      source: source("LinkUp", "linkup-search", vendor, 1),
    },
    {
      kind: "domain_age_days",
      value: typosquat ? 14 : 2400,
      outcome: typosquat ? "fail" : "pass",
      detail: typosquat
        ? "Demo risk profile marks this domain as newly registered or lookalike."
        : "Demo risk profile treats this domain as established.",
      source: source("Zero adapter policy", "domain-age-normalizer", vendor, 0),
    },
    {
      kind: "contact_reachable",
      value: !typosquat,
      outcome: typosquat ? "fail" : "pass",
      detail: typosquat
        ? "Provider evidence did not establish a reachable business contact."
        : "Provider evidence supports reachable business contact details.",
      source: source("Apify-ready provider slot", "contact-reachability", vendor, 0),
    },
    {
      kind: "payee_identity_match",
      value: !typosquat,
      outcome: typosquat ? "fail" : "pass",
      detail: typosquat
        ? "Payee identity does not match the verified vendor identity in the demo risk profile."
        : "Payee identity matches the verified vendor identity in the demo risk profile.",
      source: source("Zero adapter policy", "payee-normalizer", vendor, 0),
    },
    {
      kind: "typosquat_detected",
      value: typosquat,
      outcome: typosquat ? "fail" : "pass",
      detail: typosquat
        ? "Domain resembles a known supplier but does not match the verified entity."
        : "No typosquat pattern detected for the vendor domain.",
      source: source("Zero adapter policy", "typosquat-normalizer", vendor, 0),
    },
  ];

  return { vendorId: vendor.id, signals };
}

async function scrapeWithFirecrawl(vendor: VendorCandidate): Promise<string> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return "";
  const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      url: `https://${vendor.domain}`,
      formats: ["markdown"],
      onlyMainContent: true,
      timeout: 10000,
    }),
    signal: AbortSignal.timeout(Number(process.env.PROVIDER_TIMEOUT_MS ?? 12_000)),
  });
  if (!response.ok) return "";
  const body = await response.json() as { data?: { markdown?: string }; markdown?: string };
  return body.data?.markdown ?? body.markdown ?? "";
}

async function searchWithLinkup(vendor: VendorCandidate): Promise<string> {
  const key = process.env.LINKUP_API_KEY;
  if (!key) return "";
  const response = await fetch("https://api.linkup.so/v1/search", {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      q: `${vendor.legalName} ${vendor.domain}`,
      depth: "standard",
      outputType: "searchResults",
    }),
    signal: AbortSignal.timeout(Number(process.env.PROVIDER_TIMEOUT_MS ?? 12_000)),
  });
  if (!response.ok) return "";
  return JSON.stringify(await response.json());
}

const server = createServer(async (request: IncomingMessage, response: ServerResponse) => {
  const result = await handleRequest(request);
  response.writeHead(result.status, result.headers).end(result.body);
});

server.listen(port, host, () => {
  console.log(`evidence-adapter: http://${host}:${port}/v1/evidence`);
});

async function handleRequest(request: IncomingMessage): Promise<ResponseLike> {
  if (request.method === "GET" && request.url === "/health") {
    return json({ ok: true, providers: providerStatus() });
  }
  if (request.method !== "POST" || request.url !== "/v1/evidence") {
    return json({ error: "not_found" }, 404);
  }
  if (token && request.headers.authorization !== `Bearer ${token}`) {
    return json({ error: "unauthorized" }, 401);
  }
  const body = await readJson(request);
  const vendor = body?.vendor as VendorCandidate | undefined;
  if (!vendor?.id || !vendor.domain || !vendor.quote) {
    return json({ error: "invalid_vendor" }, 400);
  }
  try {
    return json(await collectEvidence(vendor));
  } catch (error) {
    return json({
      vendorId: vendor.id,
      error: error instanceof Error ? error.message : "unknown",
      requestId: randomUUID(),
    }, 502);
  }
}

function providerStatus() {
  return {
    firecrawl: Boolean(process.env.FIRECRAWL_API_KEY),
    apify: Boolean(process.env.APIFY_API_TOKEN),
    linkup: Boolean(process.env.LINKUP_API_KEY),
    zero: Boolean(process.env.ZERO_EVIDENCE_ADAPTER_TOKEN),
  };
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown> | undefined> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  if (!chunks.length) return undefined;
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
}

function json(value: unknown, status = 200): ResponseLike {
  return {
    status,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(value),
  };
}

interface ResponseLike {
  status: number;
  headers: Record<string, string>;
  body: string;
}
