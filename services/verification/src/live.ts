import type { EvidenceSignal, VendorCandidate } from "@continuim/contracts";
import { detectTyposquat, hostOf, namesAgree, registrationDate } from "./match.ts";
import { SCENARIOS } from "./scenarios.ts";
import type { EvidenceCollector } from "./collector.ts";

// Live evidence gathered directly from public providers: rdap.org for domain
// registration, Firecrawl for the vendor's web presence, Linkup (optional) for
// news mentions. Fail-closed: a provider failure omits the signal — the policy
// then yields insufficient_evidence. Nothing is ever fabricated.

interface HostFacts {
  registeredAt?: Date;
  markdown?: string;
  expiresAt: number;
}

export class LiveEvidenceCollector implements EvidenceCollector {
  readonly mode = "live" as const;
  private readonly cache = new Map<string, HostFacts>();

  constructor(
    private readonly firecrawlKey: string,
    private readonly linkupKey: string | undefined,
    private readonly timeoutMs: number,
    private readonly cacheTtlMs: number,
  ) {}

  async collect(vendor: VendorCandidate): Promise<EvidenceSignal[]> {
    const observedAt = new Date().toISOString();
    const local = this.localSignals(vendor, observedAt);
    const hardFailed = local.some(
      (signal) =>
        (signal.kind === "payee_identity_match" && signal.value === false) ||
        (signal.kind === "typosquat_detected" && signal.value === true),
    );
    // A locally hard-failed vendor is decisively ineligible; spend no
    // external calls corroborating it.
    if (hardFailed) return local;

    const host = hostOf(vendor.domain);
    const facts = await this.hostFacts(host, vendor);
    const signals = [...local];

    if (facts.registeredAt) {
      const ageDays = Math.floor((Date.now() - facts.registeredAt.getTime()) / 86_400_000);
      signals.push({
        kind: "domain_age_days",
        value: ageDays,
        outcome: ageDays < 30 ? "fail" : ageDays < 90 ? "warn" : "pass",
        detail: `Domain registered ${ageDays} days ago (RDAP)`,
        source: this.source("rdap.org", "rdap-domain", observedAt),
      });
    }

    if (facts.markdown !== undefined) {
      signals.push({
        kind: "web_presence",
        value: true,
        outcome: "pass",
        detail: "Vendor domain serves a live business page",
        source: this.source("Firecrawl", "firecrawl-scrape", observedAt),
      });
      const content = facts.markdown.toLowerCase();
      const identity =
        contentMentions(content, vendor.tradingName) ||
        contentMentions(content, vendor.legalName);
      signals.push({
        kind: "company_identity_match",
        value: identity,
        outcome: identity ? "pass" : "fail",
        detail: identity
          ? "Scraped site content corroborates the vendor name"
          : "Scraped site content does not mention the vendor name",
        source: this.source("Firecrawl", "firecrawl-scrape", observedAt),
      });
    }

    const news = await this.newsPresence(vendor, observedAt);
    if (news) signals.push(news);
    return signals;
  }

  private localSignals(vendor: VendorCandidate, observedAt: string): EvidenceSignal[] {
    const payeeMatch =
      namesAgree(vendor.quote.payeeName, vendor.legalName) ||
      namesAgree(vendor.quote.payeeName, vendor.tradingName);
    const peerDomains = Object.values(SCENARIOS)
      .flatMap((scenario) => scenario.vendors.map((candidate) => candidate.domain))
      .filter((domain) => domain !== vendor.domain);
    const typosquat = detectTyposquat(vendor.domain, peerDomains);
    return [
      {
        kind: "payee_identity_match",
        value: payeeMatch,
        outcome: payeeMatch ? "pass" : "fail",
        detail: payeeMatch
          ? "Quoted payee and candidate legal entity agree"
          : "Quoted payee entity does not match the candidate legal entity",
        source: this.source("Continuim local checks", "payee-consistency", observedAt),
      },
      {
        kind: "typosquat_detected",
        value: typosquat,
        outcome: typosquat ? "fail" : "pass",
        detail: typosquat
          ? "Domain uses lookalike substitution against a known candidate"
          : "No lookalike domain pattern against known candidates",
        source: this.source("Continuim local checks", "domain-similarity", observedAt),
      },
    ];
  }

  private async hostFacts(host: string, vendor: VendorCandidate): Promise<HostFacts> {
    const cached = this.cache.get(host);
    if (cached && cached.expiresAt > Date.now()) return cached;
    const [rdap, scrape] = await Promise.all([this.rdap(host), this.scrape(vendor)]);
    const facts: HostFacts = { expiresAt: Date.now() + this.cacheTtlMs };
    if (rdap) facts.registeredAt = rdap;
    if (scrape !== undefined) facts.markdown = scrape;
    // Cache only when both providers answered, so a transient failure retries.
    if (rdap && scrape !== undefined) this.cache.set(host, facts);
    return facts;
  }

  // rdap.org rate-limits repeat lookups; fall back to the registry RDAP
  // directly for .com/.net so a transient 429 cannot sink a verification.
  private async rdap(host: string): Promise<Date | undefined> {
    const urls = [`https://rdap.org/domain/${host}`];
    if (/\.(com|net)$/.test(host)) {
      const tld = host.split(".").pop();
      urls.push(`https://rdap.verisign.com/${tld}/v1/domain/${host}`);
    }
    for (const url of urls) {
      try {
        const response = await fetch(url, {
          headers: { accept: "application/rdap+json" },
          signal: AbortSignal.timeout(this.timeoutMs),
        });
        if (!response.ok) {
          console.warn(`live-evidence: rdap ${host} via ${new URL(url).host} -> ${response.status}`);
          continue;
        }
        const registered = registrationDate(await response.json() as Record<string, unknown>);
        if (registered) return registered;
      } catch (error) {
        console.warn(`live-evidence: rdap ${host} via ${new URL(url).host} failed:`, error);
      }
    }
    return undefined;
  }

  // One retry: the first uncached render of a heavy page can come back empty
  // or time out inside the provider even when the site is fine.
  private async scrape(vendor: VendorCandidate): Promise<string | undefined> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const markdown = await this.scrapeOnce(vendor);
      if (markdown) return markdown;
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
    return undefined;
  }

  private async scrapeOnce(vendor: VendorCandidate): Promise<string | undefined> {
    const host = hostOf(vendor.domain);
    try {
      const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.firecrawlKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          url: `https://${host}`,
          formats: ["markdown"],
          onlyMainContent: true,
          timeout: Math.min(this.timeoutMs, 15_000),
        }),
        signal: AbortSignal.timeout(this.timeoutMs + 3_000),
      });
      if (!response.ok) {
        console.warn(`live-evidence: firecrawl ${host} -> ${response.status}`);
        return undefined;
      }
      const body = await response.json() as { data?: { markdown?: string }; markdown?: string };
      const markdown = body.data?.markdown ?? body.markdown ?? "";
      if (!markdown) console.warn(`live-evidence: firecrawl ${host} returned empty content`);
      return markdown;
    } catch (error) {
      console.warn(`live-evidence: firecrawl ${host} failed:`, error);
      return undefined;
    }
  }

  private async newsPresence(
    vendor: VendorCandidate,
    observedAt: string,
  ): Promise<EvidenceSignal | undefined> {
    if (!this.linkupKey) return undefined;
    try {
      const response = await fetch("https://api.linkup.so/v1/search", {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.linkupKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          q: `${vendor.legalName} ${vendor.domain}`,
          depth: "standard",
          outputType: "searchResults",
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!response.ok) return undefined;
      const body = await response.json() as Record<string, unknown>;
      const results = Array.isArray(body.results) ? body.results : [];
      const present = results.length > 0;
      return {
        kind: "news_presence",
        value: present,
        outcome: present ? "pass" : "warn",
        detail: present
          ? `Found ${results.length} independent public mentions`
          : "No established public mentions were found",
        source: this.source("Linkup", "linkup-search", observedAt),
      };
    } catch {
      return undefined;
    }
  }

  private source(provider: string, serviceId: string, observedAt: string) {
    return { provider, serviceId, mode: "live" as const, costCents: 0, observedAt };
  }
}

function contentMentions(content: string, name: string): boolean {
  const flatten = (value: string) =>
    value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  const needle = flatten(name);
  return needle.length > 0 && flatten(content).includes(needle);
}
