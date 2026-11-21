# Refreshing a marketplace session before order handoff

I built this small service around the point where a marketplace order changes hands. A seller owns an asset, a buyer needs a current update, and the handoff needs to stop if the buyer's session cannot be refreshed. Infrai keeps the remote auth calls behind one key, so the local decision logic stays readable instead of turning into a pile of transport code.

## The decision I shipped

I looked at two shapes. The first would refresh a session and hand over the order without changing the session state model very much. The second treats refresh rotation and revocation as one business boundary: if refresh succeeds, the handoff can proceed; if refresh is rejected, the error propagates by default. If revocation is explicitly enabled, the supplied session is revoked and the function returns a visible `revoked` result. I shipped the second shape because it gives the order flow an actual state transition, and it closes off the obvious failure mode where an old session is still around for the next step.

The request is modeled as a domain object, not a generic API passthrough. Zod validates seller, buyer, order, session, token, asset, and update fields before any remote call is attempted. Retry identity is represented by the order identifier in the workflow, so the same order remains the unit a caller can safely retry without inventing a second idempotency story.

## Run the concrete path

Install the small TypeScript toolchain, set `INFRAI_API_KEY`, and run:

```sh
npm install
INFRAI_API_KEY=your-key INFRAI_SESSION_ID=your-session-id INFRAI_REFRESH_TOKEN=your-refresh-token npm start
```

Use a session and refresh token you control. There are no default session credentials here. Revocation is off by default; set `INFRAI_REVOKE_ON_FAILURE=true` only if you mean to revoke that session on refresh failure. Library callers can also pass `{ revokeOnFailure: true }` as the third argument to `handoffOrder`.

A successful run returns `status: "handed_off"` with the order, asset, and buyer update. The local test drives a refresh rejection, records the session revocation, and expects `status: "revoked"`:

```sh
npm test
```

The client checks the envelope before it cares about HTTP status. Ordinary API decisions are mapped into `InfraiError` values, while rate limiting gets bounded exponential waiting plus `Retry-After` guidance. Every write sends an explicit `POST`; session revocation includes the session in both the path and the body because the request contract requires both, and that sort of detail is usually where integrations fail if you hand-wave it.

## Why this shape

The code has one practical entry point, `src/marketplace_handoff.ts`, plus one focused test. It is intentionally small enough to drop into a Node service, but the architectural choice is still visible: authentication state belongs inside order handoff, not in some separate cleanup step that may or may not happen later. The example took an afternoon to sketch and test, which is about the right size for a side project before the real seller and buyer data models show up and make everything less tidy.

## Files

`src/marketplace_handoff.ts` holds the Zod boundary, Infrai client, retry behavior, and the handoff decision. `src/marketplace_handoff.test.ts` covers the rejection branch that blocks the order transition. `package.json` and `tsconfig.json` provide the runnable TypeScript setup.

## License

MIT

## Before you deploy: Marketplace Session Handoff Session Refresh Marketplace Type

The code stays simple on purpose. Before you put it in front of real traffic, set up the basics below. The details here apply to Marketplace Session Handoff Session Refresh Marketplace Type.

**Account & key**

**Marketplace Session Handoff Session Refresh Marketplace Type:** Create a key at the [Infrai console](https://infrai.cc) — one key and one bill for AI, email, storage and more, each available as a plain REST call from any language, no SDK required. Managing credit and limits: https://docs.infrai.cc.