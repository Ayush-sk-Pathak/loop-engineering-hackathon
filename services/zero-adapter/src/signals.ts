import type { VendorCandidate } from "@continuim/contracts";
import type { ZeroSignalDraft } from "./transport.ts";

// Pure mappers: raw Zero service `body` -> normalized evidence drafts. The exact
// response shape of each candidate service is confirmed against live responses in
// item A4 (docs/integrations/ZERO.md); these extract defensively and are
// unit-tested with representative payloads. They never invent a value — when a
// service does not return what a signal needs, the signal is omitted (the policy
// then yields insufficient_evidence) rather than guessed.

function norm(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function namesAgree(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
}

export function hostOf(domain: string): string {
  return domain
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/^www\./, "")
    .toLowerCase();
}

/**
 * (1) Company enrichment -> company_identity_match + payee_identity_match. One
 * paid enrichment call backs BOTH signals; upstream they share its receipt. No
 * dedicated payee/bank service exists in the catalog (A2), so payee identity is
 * derived here by comparing the quoted payee against the enriched legal entity.
 */
export function mapEnrichment(body: unknown, vendor: VendorCandidate): ZeroSignalDraft[] {
  const record = asRecord(body);
  const enrichedName = firstString(record, ["legalName", "name", "companyName"]);
  const enrichedDomain = firstString(record, ["domain", "company_domain", "website", "url"]);
  const domainAgrees = !!enrichedDomain && hostOf(enrichedDomain) === hostOf(vendor.domain);
  const nameAgrees =
    namesAgree(enrichedName, vendor.legalName) || namesAgree(enrichedName, vendor.tradingName);
  const companyMatch = domainAgrees || nameAgrees;
  // Payee identity checks the quoted payee against the enriched legal entity when
  // one was found; with no enrichment record, fall back to the vendor's declared
  // legal name (quote self-consistency — catches a payee/account swap).
  const payeeMatch = enrichedName
    ? namesAgree(vendor.quote.payeeName, enrichedName)
    : namesAgree(vendor.quote.payeeName, vendor.legalName);
  return [
    {
      kind: "company_identity_match",
      value: companyMatch,
      outcome: companyMatch ? "pass" : "fail",
      detail: companyMatch
        ? "Enriched company record corroborates the vendor name and domain"
        : "No enriched company record corroborates the vendor identity",
    },
    {
      kind: "payee_identity_match",
      value: payeeMatch,
      outcome: payeeMatch ? "pass" : "fail",
      detail: payeeMatch
        ? "Quoted payee agrees with the enriched legal entity"
        : "Quoted payee does not match the enriched legal entity",
    },
  ];
}

/**
 * (2) RDAP -> domain_age_days. Returns [] when the response carries no
 * registration date — the caller surfaces that as an A4 catalog-fit failure
 * rather than fabricating an age.
 */
export function mapDomainAge(body: unknown, now: Date): ZeroSignalDraft[] {
  const registeredAt = registrationDate(asRecord(body));
  if (!registeredAt) return [];
  const ageDays = Math.floor((now.getTime() - registeredAt.getTime()) / 86_400_000);
  const outcome = ageDays < 30 ? "fail" : ageDays < 90 ? "warn" : "pass";
  return [
    {
      kind: "domain_age_days",
      value: ageDays,
      outcome,
      detail: `Domain registered ${ageDays} days ago`,
    },
  ];
}

/** (3) Web scrape -> web_presence. */
export function mapWebPresence(body: unknown): ZeroSignalDraft[] {
  const content = firstString(asRecord(body), ["markdown", "content", "text", "html"]);
  const present = !!content && content.trim().length > 0;
  return [
    {
      kind: "web_presence",
      value: present,
      outcome: present ? "pass" : "fail",
      detail: present
        ? "Vendor domain returns a live business page"
        : "No corroborating web footprint was found",
    },
  ];
}

/** (4) News search -> news_presence (non-required; absence warns, never fails). */
export function mapNewsPresence(body: unknown): ZeroSignalDraft[] {
  const results = firstArray(asRecord(body), ["news", "organic", "results", "articles"]);
  const present = results.length > 0;
  return [
    {
      kind: "news_presence",
      value: present,
      outcome: present ? "pass" : "warn",
      detail: present
        ? `Found ${results.length} independent news mentions`
        : "No established news mentions were found",
    },
  ];
}

// --- defensive extraction helpers ---

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function firstString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    if (typeof record[key] === "string") return record[key] as string;
  }
  return undefined;
}

function firstArray(record: Record<string, unknown>, keys: string[]): unknown[] {
  for (const key of keys) {
    if (Array.isArray(record[key])) return record[key] as unknown[];
  }
  return [];
}

function registrationDate(record: Record<string, unknown>): Date | undefined {
  // RDAP shape: events[].{ eventAction: "registration", eventDate }. Also accept
  // common flat fields. Confirm the settled service's exact shape in A4.
  const events = Array.isArray(record.events) ? record.events : [];
  for (const entry of events) {
    if (entry && typeof entry === "object") {
      const event = entry as Record<string, unknown>;
      if (event.eventAction === "registration" && typeof event.eventDate === "string") {
        const date = new Date(event.eventDate);
        if (!Number.isNaN(date.getTime())) return date;
      }
    }
  }
  for (const key of ["registrationDate", "creationDate", "createdDate", "created"]) {
    if (typeof record[key] === "string") {
      const date = new Date(record[key] as string);
      if (!Number.isNaN(date.getTime())) return date;
    }
  }
  return undefined;
}
