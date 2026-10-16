# Replate Intelligence on Coinbase Bazaar / Agentic Market

Discovery uses the installed `@x402/extensions` 2.22 SDK and the existing x402 v2
CDP Facilitator on Base mainnet. No API route, price, payment asset or facilitator
is replaced. All examples in the public discovery metadata are synthetic.

## Resources

| Method | Existing route | USDC / successful call | Authorization |
| --- | --- | --- | --- |
| POST | `/api/analyze-meal` | 0.01 | Payer supplies their own meal photo |
| POST | `/api/intelligence/advanced` | 0.10 | Payer, receipt owner, receipt hash and body wallet must match |
| GET | `/api/intelligence/basket/{receiptId}` | 0.04 | Receipt owner only |
| GET | `/api/intelligence/price/receipt/{receiptId}` | 0.03 | Receipt owner only; all products in one call |
| GET | `/api/intelligence/spending/receipt/{receiptId}` | 0.05 | Receipt owner only; one receipt and its currency |
| GET | `/api/intelligence/behavior/me` | 0.05 | Registered payer's own history only |
| GET | `/api/intelligence/spending/me` | 0.05 | Registered payer's own history only |

Each route declares its description, input example/schema and JSON output
example/schema through `declareDiscoveryExtension`. Dynamic GET routes use
`pathParams` and the SDK-generated `routeTemplate`. The same schemas are included
in `/openapi.json`. Recommendations are part of the existing Advanced Receipt
report (`report.recommendations`) and Meal response (`data.recommendation`); there
is no separate Recommendation endpoint.

Discovery describes private APIs but does not authorize access. Agents with
independent wallets cannot read another wallet's receipts or history, even if
they offer payment. No delegation has been introduced. Private intelligence
responses use `Cache-Control: private, no-store`.

## Public Meal Analysis

- Resource: `https://replate-backend61.vercel.app/api/analyze-meal`
- Method: `POST`, JSON body: `{ "imageBase64": "<base64 meal photo>" }`
- Price: **0.01 USDC per successful call**, Base mainnet (`eip155:8453`).
- No receipt ID, receipt verification or Replate registration is required.
- Returns estimated food groups, visible foods, plate shares, plant diversity,
  balance score and a practical suggestion. No exact calories or medical assessment.
- Input/output schemas and examples: `/openapi.json`.

## Listing process

1. Deploy the changes. On Vercel, system environment variables must be enabled
   (`VERCEL=1`) so Express trusts the platform proxy and advertises HTTPS.
2. Send an **unsigned** POST with `{}` to the resource. It should return HTTP 402,
   a `PAYMENT-REQUIRED` header, `resource.url` using HTTPS, and `extensions.bazaar`
   containing the POST body schema and JSON output example. No analysis runs.
3. Validate with Coinbase (no payment signature or API key is required):

   ```http
   POST https://api.cdp.coinbase.com/platform/v2/x402/validate
   Content-Type: application/json

   {"resource":"https://replate-backend61.vercel.app/api/analyze-meal","method":"POST"}
   ```

   Expected: `valid: true`, `simulation.outcome: "accepted"`. Validation alone
   does not create a listing or guarantee content-policy acceptance.
4. Complete **one real successful paid call** using an actual meal photo and the
   CDP Facilitator. This requires explicit approval for the 0.01 USDC payment
   and forwarding the photo to the configured model provider. A tiny PNG in the
   discovery example is for transport/schema illustration, not a food-analysis demo.
   The buyer's x402 client must preserve the `resource` and `bazaar` extension
   from the 402 challenge in its payment payload.
5. Check the facilitator's `EXTENSION-RESPONSES` header when available:
   `bazaar.status` may be `success`, `processing`, or `rejected`. Processing is
   not confirmation of a listing. Allow up to 15 minutes for indexing.
6. Check the catalog without sending a payment:

   ```http
   GET https://api.cdp.coinbase.com/platform/v2/x402/discovery/search?urlSubstring=replate-backend61.vercel.app&limit=20
   ```

There is no separate seller registration form. Indexing, search ranking and
editorial featuring are separate. Product, Category and Merchant Signals still
return 501 and are not published as working paid resources by this change.

## Server configuration

`CDP_API_KEY_ID`, `CDP_API_KEY_SECRET`, `X402_PAY_TO`, `OCR_API_KEY` and the database
connection stay on the server. Keys are never part of Bazaar metadata. The public
payment recipient address is expected to appear in the 402 payment challenge.

Sources:

- [Coinbase seller discovery](https://docs.cdp.coinbase.com/x402/seller/get-discovered)
- [Coinbase endpoint validation](https://docs.cdp.coinbase.com/api-reference/v2/rest-api/x402-facilitator/validate-x402-endpoint)

## Audit and verification — 2026-10-16

- Installed official SDK versions: `@x402/core`, `@x402/express`, `@x402/evm`,
  `@x402/extensions` 2.22.0. Existing exact EVM scheme, CDP extensions and builder
  attribution remain registered.
- Fixed Basket settlement resource resolution: it omitted `receiptId`, causing
  the ownership pre-settlement check to reject valid owners.
- Fixed Advanced's first-payment deadlock: the handler required a settled
  entitlement before the SDK could settle its buffered response. It now checks
  receipt ownership/hash before building that response; the SDK releases it only
  after successful settlement. The retry endpoint still requires the original
  settled entitlement.
- Offline checks: `node node_modules/tsx/dist/cli.mjs scripts/test-bazaar.ts`.
  Covers all seven v2 402 declarations and Bazaar schemas, actual owner response
  schemas, wrong owner/hash/payer, unregistered and registered stranger wallets,
  rejected signatures, first-call settlement, failed-settlement response privacy
  and private cache headers. The facilitator and database are mocks; these are
  not live settlement claims.
- Receipt price pre-settlement regression checks:
  `node node_modules/tsx/dist/cli.mjs scripts/test-receipt-spending.ts`.
- Backend TypeScript check: `node node_modules/typescript/bin/tsc --noEmit --incremental false`.
- Meal was verified in the live Coinbase Bazaar search and Agentic Market global
  search, and the Agentic validator displayed **Found on Bazaar**. Coinbase
  validation returned `valid: true`, simulation `accepted`.
- The previously completed Meal payment was checked read-only against Base:
  [0x599107…656339](https://basescan.org/tx/0x599107396c747dabf9f3eb855b54b976a3acb792899b82811b6024d414656339),
  block 52688839, successful receipt and matching 0.01 USDC transfer to the
  configured recipient. No new mainnet payment was made for this audit.

Meal's confirmed listing does not imply that all private resources are indexed.
Check every resource separately after deployment. Each newly declared resource
needs its own successful owner-authorized CDP payment before indexing can be
confirmed. Validation does not perform that payment. Do not use a server
validator key, expose private receipts or weaken ownership checks to seed a
listing.
