# Replate Meal Analysis on Coinbase Bazaar

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
