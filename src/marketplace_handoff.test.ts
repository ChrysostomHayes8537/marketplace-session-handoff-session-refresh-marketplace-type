import assert from "node:assert/strict";
import { handoffOrder, InfraiAuth } from "./marketplace_handoff.ts";

class TestAuth extends InfraiAuth {
  revoked = "";
  async refresh(): Promise<{ ok: boolean }> { throw new Error("refresh rejected"); }
  async revoke(sessionId: string): Promise<{ ok: boolean }> { this.revoked = sessionId; return { ok: true }; }
}

const auth = new TestAuth("test-key");
const result = await handoffOrder({ sellerId: "seller", buyerId: "buyer", orderId: "order", sessionId: "session", refreshToken: "refresh", assetId: "asset", buyerUpdate: "ready" }, auth, { revokeOnFailure: true });
assert.equal(result.status, "revoked");
assert.equal(auth.revoked, "session");
console.log("handoff decision test passed");

const safeAuth = new TestAuth("test-key");
await assert.rejects(handoffOrder({ sellerId: "seller", buyerId: "buyer", orderId: "order", sessionId: "session", refreshToken: "refresh", assetId: "asset", buyerUpdate: "ready" }, safeAuth), /refresh rejected/);
assert.equal(safeAuth.revoked, "");
console.log("refresh failure does not revoke by default");
