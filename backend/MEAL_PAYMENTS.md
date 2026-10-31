# Meal Analysis payments

`POST /api/analyze-meal` uses a normal **0.01 USDC transfer on Base mainnet**.
It does not accept x402 payment signatures. Receipt intelligence and market APIs
retain their x402 payment flow.

1. Fetch `GET /api/analyze-meal/payment`. Do not send a transaction unless this
   returns a successful quote. It checks payment configuration, model availability
   and the existing payment ledger before returning the price and recipient.
2. Hash the decoded photo bytes with SHA-256. Send exactly 10000 atomic units of
   Base USDC using `transfer(payTo, 10000)`, appending that 32-byte hash to the call
   data. The supplied web clients also support Base Account batch transactions.
3. Submit `{ imageBase64, txHash, payerAddress }` to `/api/analyze-meal`.
4. HTTP 409 with `PAYMENT_PENDING` means the transfer is not yet confirmed; HTTP
   202 means the same analysis is running. Retry the same request and payment.
5. On success, the result is saved against that transaction and photo. Repeating
   the same request returns the saved result without another transfer or model
   call. A transaction cannot buy analysis of a different photo.

The server checks successful confirmation, the canonical USDC token, sender,
recipient, exact amount, and the photo commitment in the transaction calldata.
Concurrent requests claim the analysis atomically. A failed or interrupted model
call can resume with the same payment. The photo itself is not stored in the
payment ledger or put onchain; the ledger stores its hash and the analysis result.

The transfer happens before analysis. Network fees may apply. A confirmed payment
is not automatically refunded if the image contains no food or analysis fails.
Use a clear meal photo; keep the transaction hash when troubleshooting.

Set `MEAL_PAYMENT_TO` for a separate receiving wallet, or leave it unset to reuse
the existing `X402_PAY_TO` address. `RPC_URL`, `DATABASE_URL`, and `OCR_API_KEY`
must be configured. Existing migrations 001–008 are sufficient: the normal
transfer is recorded in the existing payment ledger under a `base-transfer:`
identifier, independently of x402.
