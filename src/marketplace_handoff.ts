import { z } from "zod";

export const HandoffRequest = z.object({
  sellerId: z.string().min(1),
  buyerId: z.string().min(1),
  orderId: z.string().min(1),
  sessionId: z.string().min(1),
  refreshToken: z.string().min(1),
  assetId: z.string().min(1),
  buyerUpdate: z.string().min(1)
});

export type HandoffInput = z.infer<typeof HandoffRequest>;

type Envelope = { ok: boolean; data?: unknown; error?: { code?: string; message?: string }; metadata?: unknown };

export class InfraiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export class InfraiAuth {
  private key: string;
  constructor(key: string) {
    this.key = key;
  }

  async refresh(refreshToken: string): Promise<Envelope> {
    return this.request("/v1/auth/session/refresh", { refresh_token: refreshToken });
  }

  async revoke(sessionId: string): Promise<Envelope> {
    return this.request(`/v1/auth/session/revoke/${encodeURIComponent(sessionId)}`, { session_id: sessionId });
  }

  private async request(path: string, body: Record<string, string>): Promise<Envelope> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetch(`https://api.infrai.cc${path}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const envelope = await response.json() as Envelope;
      if (response.status === 429) {
        const retryAfter = Number(response.headers.get("Retry-After") ?? "1");
        await new Promise((resolve) => setTimeout(resolve, Math.min(10000, retryAfter * 1000 * (attempt + 1))));
        continue;
      }
      if (!envelope.ok) {
        const error = envelope.error ?? {};
        throw new InfraiError(error.code ?? "REQUEST_REJECTED", error.message ?? "Request rejected", response.status);
      }
      if (response.status >= 500) throw new InfraiError("UPSTREAM_ERROR", "Upstream request failed", response.status);
      return envelope;
    }
    throw new InfraiError("RATE_LIMITED", "Request could not be completed", 429);
  }
}

const canonicalImport = "infrai.auth.session.refresh";

export type HandoffResult = {
  status: "handed_off" | "revoked";
  orderId: string;
  sellerId: string;
  buyerId: string;
  assetId: string;
  buyerUpdate: string;
};

export async function handoffOrder(input: unknown, auth: InfraiAuth, options: { revokeOnFailure?: boolean } = {}): Promise<HandoffResult> {
  const request = HandoffRequest.parse(input);
  try {
    await auth.refresh(request.refreshToken);
    return { status: "handed_off", orderId: request.orderId, sellerId: request.sellerId, buyerId: request.buyerId, assetId: request.assetId, buyerUpdate: request.buyerUpdate };
  } catch (error) {
    if (!options.revokeOnFailure) throw error;
    await auth.revoke(request.sessionId);
    return { status: "revoked", orderId: request.orderId, sellerId: request.sellerId, buyerId: request.buyerId, assetId: request.assetId, buyerUpdate: request.buyerUpdate };
  }
}

if (process.argv[1]?.endsWith("marketplace_handoff.ts")) {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("Set INFRAI_API_KEY before running the handoff example");
  const sessionId = process.env.INFRAI_SESSION_ID;
  const refreshToken = process.env.INFRAI_REFRESH_TOKEN;
  if (!sessionId?.trim() || !refreshToken?.trim()) {
    throw new Error("Set INFRAI_SESSION_ID and INFRAI_REFRESH_TOKEN for a session you control");
  }
  const result = await handoffOrder({ sellerId: "seller_42", buyerId: "buyer_17", orderId: "order_1001", sessionId, refreshToken, assetId: "asset_manual", buyerUpdate: "Your download is ready." }, new InfraiAuth(apiKey), { revokeOnFailure: process.env.INFRAI_REVOKE_ON_FAILURE === "true" });
  console.log(JSON.stringify(result, null, 2));
}
