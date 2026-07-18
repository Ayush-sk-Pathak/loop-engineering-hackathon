// Pure matching helpers for evidence collection. They never invent a value —
// when data does not support a determination, callers omit the signal (the
// policy then yields insufficient_evidence) rather than guess.

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
 * RDAP shape: events[].{ eventAction: "registration", eventDate }. Also accepts
 * common flat fields from registrar variants.
 */
export function registrationDate(record: Record<string, unknown>): Date | undefined {
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

const HOMOGLYPHS: Record<string, string> = { "0": "o", "1": "l", "3": "e", "5": "s" };

function secondLevel(domain: string): string {
  return hostOf(domain).split(".")[0] ?? "";
}

function deglyph(label: string): string {
  return label.replace(/[0135]/g, (ch) => HOMOGLYPHS[ch] ?? ch).replace(/[^a-z]/g, "");
}

/**
 * A domain is flagged as a typosquat when its second-level label uses
 * digit-for-letter substitution (kingst0n, archr0ma) and, once normalized,
 * matches or contains a peer candidate's label. The digit condition keeps the
 * check asymmetric: the genuine domain never flags against its imitator.
 */
export function detectTyposquat(domain: string, peerDomains: string[]): boolean {
  const label = secondLevel(domain);
  if (!label || !/[0135]/.test(label)) return false;
  const normalized = deglyph(label);
  return peerDomains.some((peer) => {
    const peerLabel = deglyph(secondLevel(peer));
    if (!peerLabel || peer === domain) return false;
    return normalized === peerLabel || normalized.includes(peerLabel);
  });
}
