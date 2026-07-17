import type { PurchaseOrder } from "@continuim/contracts";

/**
 * StableEmail purchase-order receipt module (item B3).
 *
 * Two disclosed delivery paths, selected by EMAIL_MODE (default "off"):
 *   - "stableemail": the sponsor path — Zero StableEmail, which returns a paid
 *     receipt id + a provider message id (the live proof captured in B7).
 *   - "fallback": a DISCLOSED non-sponsor path (a generic email API). It is not a
 *     Zero tool and is labeled `sponsor: "none"` so nothing here can be mistaken
 *     for paid Zero evidence (decisions 0010 and 0014).
 *
 * Off by default, so the origin's behavior and every preexisting test are
 * unchanged. The exact live request/response shape is finalized against the real
 * provider in B7 (key-gated); this module is exercised in tests via an injected
 * fake transport, never a live call.
 */

export type EmailMode = "stableemail" | "fallback";

export interface EmailReceipt {
  mode: EmailMode;
  /** Human-readable provider label for logs/trace — never a contract field. */
  provider: string;
  /** Honest sponsor attribution: the fallback path is explicitly not a Zero tool. */
  sponsor: "zero" | "none";
  /** Provider message id (the "received message" proof captured live in B7). */
  messageId: string;
  /** Zero payment receipt id — present only on the StableEmail (sponsor) path. */
  zeroReceiptId?: string;
}

export interface EmailTransport {
  readonly mode: EmailMode;
  readonly sponsor: "zero" | "none";
  sendPurchaseOrderReceipt(order: PurchaseOrder): Promise<EmailReceipt>;
}

/**
 * Build the transport from the environment. Returns null when EMAIL_MODE is unset
 * or "off" (the default) — the post-201 hook then does nothing. Fails closed if a
 * live mode is selected without its configuration; it never silently degrades to a
 * different path (decision 0010).
 */
export function createEmailTransport(
  env: Record<string, string | undefined> = process.env,
): EmailTransport | null {
  const mode = env.EMAIL_MODE ?? "off";
  if (mode === "off") return null;

  const recipient = env.EMAIL_TO;
  const timeoutMs = Number(env.EMAIL_TIMEOUT_MS ?? 30_000);

  if (mode === "stableemail") {
    const url = env.STABLEEMAIL_URL;
    if (!url || !recipient) {
      throw new Error("EMAIL_MODE=stableemail requires STABLEEMAIL_URL and EMAIL_TO");
    }
    return new HttpEmailTransport(
      "stableemail",
      "zero",
      "zero-stableemail",
      url,
      env.STABLEEMAIL_TOKEN,
      recipient,
      timeoutMs,
    );
  }

  if (mode === "fallback") {
    const url = env.EMAIL_FALLBACK_URL;
    if (!url || !recipient) {
      throw new Error("EMAIL_MODE=fallback requires EMAIL_FALLBACK_URL and EMAIL_TO");
    }
    return new HttpEmailTransport(
      "fallback",
      "none",
      "disclosed-non-zero-email",
      url,
      env.EMAIL_FALLBACK_TOKEN,
      recipient,
      timeoutMs,
    );
  }

  throw new Error(`Unknown EMAIL_MODE '${mode}' (expected off, stableemail, or fallback)`);
}

/**
 * One receipt per PO id. `createPurchaseOrder` returns 201 on an idempotent replay
 * as well as a fresh order, and the server hook fires on every 201; deduping by the
 * (stable) order id keeps replays from re-sending. Mirrors the module-level state
 * used for idempotency in index.ts.
 */
const emailedOrderIds = new Set<string>();

export async function emitPurchaseOrderReceipt(
  transport: EmailTransport,
  order: PurchaseOrder,
): Promise<EmailReceipt | null> {
  if (emailedOrderIds.has(order.id)) return null;
  emailedOrderIds.add(order.id);
  return transport.sendPurchaseOrderReceipt(order);
}

export function resetEmailStateForTests(): void {
  emailedOrderIds.clear();
}

export function purchaseOrderReceiptBody(
  order: PurchaseOrder,
): { subject: string; text: string } {
  const amount = (order.totalAmountCents / 100).toFixed(2);
  return {
    subject: `StockShield PO ${order.id} accepted`,
    text:
      `Purchase order ${order.id} was accepted.\n` +
      `Vendor: ${order.vendorId}\n` +
      `SKU: ${order.sku}  Qty: ${order.quantity}\n` +
      `Total: ${amount} ${order.currency}\n` +
      `Inbound: ${order.inboundStatus}  Created: ${order.createdAt}\n`,
  };
}

class HttpEmailTransport implements EmailTransport {
  constructor(
    readonly mode: EmailMode,
    readonly sponsor: "zero" | "none",
    private readonly provider: string,
    private readonly url: string,
    private readonly token: string | undefined,
    private readonly recipient: string,
    private readonly timeoutMs: number,
  ) {}

  async sendPurchaseOrderReceipt(order: PurchaseOrder): Promise<EmailReceipt> {
    const { subject, text } = purchaseOrderReceiptBody(order);
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (this.token) headers.authorization = `Bearer ${this.token}`;
    const response = await fetch(this.url, {
      method: "POST",
      headers,
      body: JSON.stringify({ to: this.recipient, subject, text }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!response.ok) {
      throw new Error(`${this.provider} send failed with ${response.status}`);
    }
    const body = (await response.json()) as Record<string, unknown>;
    return {
      mode: this.mode,
      provider: this.provider,
      sponsor: this.sponsor,
      messageId: String(body.messageId ?? body.id ?? ""),
      zeroReceiptId:
        this.sponsor === "zero" && typeof body.receiptId === "string"
          ? body.receiptId
          : undefined,
    };
  }
}
