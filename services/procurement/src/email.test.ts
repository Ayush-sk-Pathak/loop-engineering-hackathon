import assert from "node:assert/strict";
import test from "node:test";
import type { PurchaseOrder } from "@stockshield/contracts";
import {
  createEmailTransport,
  emitPurchaseOrderReceipt,
  resetEmailStateForTests,
  type EmailMode,
  type EmailTransport,
} from "./email.ts";

const order: PurchaseOrder = {
  id: "PO-TEST1234",
  vendorId: "vendor-northstar",
  sku: "DDR5-ECC-64GB",
  quantity: 20,
  totalAmountCents: 240_000,
  currency: "USD",
  status: "accepted",
  inboundStatus: "scheduled",
  createdAt: new Date().toISOString(),
};

function fakeTransport(
  mode: EmailMode = "stableemail",
  sponsor: "zero" | "none" = "zero",
): EmailTransport & { sent: PurchaseOrder[] } {
  const sent: PurchaseOrder[] = [];
  return {
    mode,
    sponsor,
    sent,
    async sendPurchaseOrderReceipt(po) {
      sent.push(po);
      return { mode, provider: "fake", sponsor, messageId: `msg-${po.id}` };
    },
  };
}

test("email transport is off by default and fails closed when misconfigured", () => {
  assert.equal(createEmailTransport({}), null);
  assert.equal(createEmailTransport({ EMAIL_MODE: "off" }), null);
  assert.throws(
    () => createEmailTransport({ EMAIL_MODE: "stableemail" }),
    /STABLEEMAIL_URL/,
  );
  assert.throws(() => createEmailTransport({ EMAIL_MODE: "nope" }), /Unknown EMAIL_MODE/);
});

test("fallback transport is disclosed as a non-Zero path", () => {
  const transport = createEmailTransport({
    EMAIL_MODE: "fallback",
    EMAIL_FALLBACK_URL: "http://email.invalid/send",
    EMAIL_TO: "ops@example.test",
  });
  assert.ok(transport);
  assert.equal(transport.mode, "fallback");
  assert.equal(transport.sponsor, "none");
});

test("post-201 hook sends exactly one receipt per PO id", async () => {
  resetEmailStateForTests();
  const transport = fakeTransport("stableemail", "zero");

  const first = await emitPurchaseOrderReceipt(transport, order);
  assert.equal(transport.sent.length, 1);
  assert.equal(first?.sponsor, "zero");
  assert.equal(first?.messageId, "msg-PO-TEST1234");

  // An idempotent replay of the same PO must not re-send.
  const replay = await emitPurchaseOrderReceipt(transport, order);
  assert.equal(replay, null);
  assert.equal(transport.sent.length, 1);
});
