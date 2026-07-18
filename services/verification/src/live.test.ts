import assert from "node:assert/strict";
import test from "node:test";
import { LiveEvidenceCollector } from "./live.ts";
import { detectTyposquat, namesAgree, registrationDate } from "./match.ts";
import { DEMO_VENDORS } from "./fixtures.ts";
import { SCENARIOS } from "./scenarios.ts";

const kinds = (signals: { kind: string }[]) => signals.map((signal) => signal.kind).sort();

test("registrationDate parses RDAP events and flat fields", () => {
  const viaEvents = registrationDate({
    events: [
      { eventAction: "last changed", eventDate: "2024-01-01T00:00:00Z" },
      { eventAction: "registration", eventDate: "1993-08-30T04:00:00Z" },
    ],
  });
  assert.equal(viaEvents?.getUTCFullYear(), 1993);
  const viaFlat = registrationDate({ creationDate: "2000-09-11T13:09:07Z" });
  assert.equal(viaFlat?.getUTCFullYear(), 2000);
  assert.equal(registrationDate({ events: [{ eventAction: "expiration" }] }), undefined);
});

test("namesAgree matches punctuation and containment variants", () => {
  assert.equal(namesAgree("Kingston Technology Company, Inc.", "Kingston Technology Company Inc"), true);
  assert.equal(namesAgree("Archroma", "Archroma Management GmbH"), true);
  assert.equal(namesAgree("Vertex Trade Holdings Ltd", "Kingston Technolgy Distribution LLC"), false);
  assert.equal(namesAgree("", "Kingston"), false);
});

test("typosquat detector flags homoglyph imitators, never the genuine domain", () => {
  const peers = ["kingston.com", "archroma.com"];
  assert.equal(detectTyposquat("kingst0n-supply.com", peers), true);
  assert.equal(detectTyposquat("archr0ma-supply.com", peers), true);
  assert.equal(detectTyposquat("kingston.com", ["kingst0n-supply.com", "archroma.com"]), false);
  assert.equal(detectTyposquat("archroma.com", ["archr0ma-supply.com"]), false);
});

test("catalog lookalikes hard-fail locally; eligible vendors pass local checks", () => {
  for (const scenario of Object.values(SCENARIOS)) {
    const domains = scenario.vendors.map((vendor) => vendor.domain);
    for (const vendor of scenario.vendors) {
      const payeeMatch =
        namesAgree(vendor.quote.payeeName, vendor.legalName) ||
        namesAgree(vendor.quote.payeeName, vendor.tradingName);
      const typosquat = detectTyposquat(
        vendor.domain,
        domains.filter((domain) => domain !== vendor.domain).concat(
          Object.values(SCENARIOS).flatMap((peer) => peer.vendors.map((v) => v.domain)),
        ),
      );
      const isLookalike = vendor.id === "vendor-lookalike" || vendor.id === "vendor-pacificdye";
      assert.equal(payeeMatch, !isLookalike, `${vendor.id} payee`);
      assert.equal(typosquat, isLookalike, `${vendor.id} typosquat`);
    }
  }
});

test("live collector short-circuits hard-failed vendors with zero provider calls", async () => {
  const collector = new LiveEvidenceCollector("test-key", undefined, 1_000, 60_000);
  const originalFetch = globalThis.fetch;
  let fetches = 0;
  globalThis.fetch = (async () => {
    fetches += 1;
    throw new Error("network disabled in test");
  }) as typeof fetch;
  try {
    const lookalike = DEMO_VENDORS[0]!;
    const signals = await collector.collect(lookalike);
    assert.equal(fetches, 0);
    assert.deepEqual(kinds(signals), ["payee_identity_match", "typosquat_detected"]);
    assert.equal(signals.find((s) => s.kind === "payee_identity_match")?.value, false);
    assert.equal(signals.find((s) => s.kind === "typosquat_detected")?.value, true);
    assert.ok(signals.every((s) => s.source.mode === "live"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("live collector omits provider signals on failure instead of guessing", async () => {
  const collector = new LiveEvidenceCollector("test-key", "linkup-key", 1_000, 60_000);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error("network disabled in test");
  }) as typeof fetch;
  try {
    const eligible = DEMO_VENDORS[1]!;
    const signals = await collector.collect(eligible);
    // Local checks pass; every remote signal is omitted, never fabricated.
    assert.deepEqual(kinds(signals), ["payee_identity_match", "typosquat_detected"]);
    assert.equal(signals.find((s) => s.kind === "payee_identity_match")?.value, true);
    assert.equal(signals.find((s) => s.kind === "typosquat_detected")?.value, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("live collector maps provider responses into evidence signals", async () => {
  const collector = new LiveEvidenceCollector("test-key", "linkup-key", 1_000, 60_000);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    if (url.startsWith("https://rdap.org/")) {
      return Response.json({
        events: [{ eventAction: "registration", eventDate: "1993-08-30T04:00:00Z" }],
      });
    }
    if (url.startsWith("https://api.firecrawl.dev/")) {
      return Response.json({ data: { markdown: "# Kingston Technology\nMemory modules." } });
    }
    if (url.startsWith("https://api.linkup.so/")) {
      return Response.json({ results: [{ name: "Kingston ships DDR5" }] });
    }
    throw new Error(`unexpected fetch ${url}`);
  }) as typeof fetch;
  try {
    const eligible = DEMO_VENDORS[1]!;
    const signals = await collector.collect(eligible);
    assert.deepEqual(kinds(signals), [
      "company_identity_match",
      "domain_age_days",
      "news_presence",
      "payee_identity_match",
      "typosquat_detected",
      "web_presence",
    ]);
    assert.equal(signals.find((s) => s.kind === "company_identity_match")?.value, true);
    assert.equal(signals.find((s) => s.kind === "web_presence")?.value, true);
    assert.ok(Number(signals.find((s) => s.kind === "domain_age_days")?.value) > 10_000);
    assert.ok(signals.every((s) => s.source.mode === "live"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
