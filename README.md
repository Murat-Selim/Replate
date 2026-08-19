# Replate 🥗

Turn receipts into healthier insights you can verify. Scan a grocery receipt to understand your basket's health and nutrition balance, then save the proof onchain. Replate is a Web3 mini-app built on the **Base** blockchain that encourages healthy grocery shopping and reduces food waste. Users upload grocery receipts, the system analyzes them using Google Cloud Vision OCR + Open Food Facts API, and verified results are recorded on-chain as XP, streaks, and NFT badges.

## Current Status

The current production target is Base mainnet. The canonical `ReplateQuest` proxy is upgraded to the receipt-hash replay-protected implementation, and both frontend clients plus the backend use the matching ABI.

The default contract onboarding phase remains `FREE`. The separate contract `PAID` phase is not a production go-ahead; allowance UX, security review, legal/data-retention controls, and operational monitoring remain open. The x402-powered Personalized Basket Insights endpoint is available independently at `$0.01 USDC` per request.

---

## 🚀 Key Features

- **Receipt Analysis**: Google Vision OCR, input validation, normalization, and deterministic receipt hashing.
- **Health & Nutrition Scoring**: Local product catalog classification with optional Open Food Facts enrichment.
- **EIP-712 Receipt Flow**: Users sign receipt data and the client/relayer submits it through `submitReceiptWithSig`.
- **Replay Protection**: Each `receiptHash` can be consumed only once on-chain.
- **Progress and Rewards**: XP, health streaks, daily check-ins, weekly reports, and ERC-721 badges.
- **Paid Basket Insights**: Personalized Basket Insights unlocked with a `$0.01 USDC` x402 payment on Base Mainnet.
- **Weekly Leaderboard**: Top 100 users can share the weekly USDC pool in the PAID phase.
- **Quest Previews**: Weekly quest progress is currently off-chain and does not promise tokens, XP, or USDC.

---

## 🛠 Tech Stack

- **Blockchain**: Base (EVM-compatible)
- **Smart Contracts**: Solidity ^0.8.22 (UUPS Upgradeable, OpenZeppelin)
- **Frontend**: Next.js 16 + React 19 + Tailwind CSS
- **Backend**: Node.js + Express + TypeScript
- **Database**: Hosted PostgreSQL on Neon
- **OCR**: Google Cloud Vision API
- **Food Data**: Open Food Facts API
- **Product Catalog**: Local Turkish retailer/product aliases and nutrition heuristics.
- **Signing**: EIP-712 typed data with nonce and deadline replay protection.
- **Wallet/SDK**: Farcaster Mini-App SDK, Wagmi, Ethers.js
- **Agent Payments**: x402 v2 with Coinbase CDP facilitator and ERC-8021 Builder Code attribution

---

## 🏗 System Architecture

1.  **Receipt Upload**: User uploads a receipt image from either frontend.
2.  **OCR Processing**: Backend validates the image and uses Google Cloud Vision to extract receipt lines.
3.  **Classification**: Local catalog rules classify products; Open Food Facts is optional enrichment.
4.  **Scoring and Hashing**: Health/nutrition scores are calculated and normalized receipt text becomes a deterministic `receiptHash`.
5.  **User Approval**: The user signs receipt data with EIP-712 typed data containing the hash, nonce, and deadline.
6.  **On-Chain Submit**: The client or relayer submits `submitReceiptWithSig` to `ReplateQuest`.
7.  **Rewards**: The contract records XP, weekly reports, streaks, and eligible ERC-721 badges.
8.  **Insight Payment**: An agent or user wallet signs a `$0.01 USDC` x402 payment on Base Mainnet.
9.  **Settlement**: Coinbase CDP verifies and settles the payment to the configured receiver wallet.
10. **Personalized Basket Insights**: The backend returns rule-based recommendations from the stored derived features.

---

## 📄 Smart Contract: `ReplateQuest.sol`

The core logic resides on-chain to ensure transparency and trust.

- **Proxy Address**: [`0x9d646D474ba0D1bF03E61453898c160b7f9e3E90`](https://basescan.org/address/0x9d646D474ba0D1bF03E61453898c160b7f9e3E90) (Base mainnet, chain ID `8453`)
- **Implementation**: [`0x425Ff13453417A090D91e279558127f20642c227`](https://basescan.org/address/0x425Ff13453417A090D91e279558127f20642c227#code), verified on Basescan.
- **Runtime state verified on 2026-08-02**: `FREE`, `FEE=500000` (`0.50 USDC` in `PAID`), `paused=false`.
- **Receipt security**: EIP-712 nonce/deadline checks plus one-time `receiptHash` consumption via `usedReceiptHashes`.
- **Scoring Logic**:
    - **Health Score**: Based on the ratio of healthy vs. unhealthy items.
    - **Nutrition Score**: Based on fruit/vegetable weight relative to household size (General standard: 300g/day).
- **Points System**: Users earn `BASE_POINTS` (50) plus bonuses for high health/nutrition scores and streaks.
- **Upgradeable storage**: The replay-protection mapping is appended after `FEE` to preserve the existing storage layout.

---

## 🚦 Getting Started

### Prerequisites

- Node.js (v20+)
- Google Cloud Vision API Credentials
- Base mainnet RPC and Base USDC (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`); Base Sepolia is optional for test deployments.

### Installation

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/Murat-Selim/Replate.git
    cd Replate
    ```

2.  **Install dependencies**:
    ```bash
    cd backend && npm install
    cd ../frontend-baseapp && npm install
    cd ../frontend-farcaster && npm install
    ```

3.  **Environment Setup**:

    Frontend apps use `NEXT_PUBLIC_API_URL` to talk to the backend.
    For local development, set it to `http://localhost:3001`.
    Set `USE_OFF_API=true` to enrich unknown local-catalog products with Open Food Facts.
    Default network is `baseMainnet` and default contract is `0x9d646D474ba0D1bF03E61453898c160b7f9e3E90`.
    If you deploy a new contract or switch networks:
    - update `CONTRACT_ADDRESS` in `backend/.env`
    - update `NEXT_PUBLIC_CHAIN` and `NEXT_PUBLIC_CONTRACT_ADDRESS` in both frontend apps
    - keep `NEXT_PUBLIC_BUILDER_CODE` aligned with the backend `BUILDER_CODE`
    - copy the refreshed ABI file into each frontend app if the contract interface changed

    Advanced Basket Insights uses hosted PostgreSQL on Neon and the Coinbase CDP x402 facilitator.
    Configure these backend variables in Vercel (Production):

    - `DATABASE_URL`: Neon pooled PostgreSQL connection string.
    - `DATABASE_SSL=require`.
    - `X402_PAY_TO`: a receiver wallet address different from the paying user wallet.
    - `CDP_API_KEY_ID` and `CDP_API_KEY_SECRET`: CDP credentials; mark both Sensitive.
    - Leave `X402_FACILITATOR_URL` and `X402_FACILITATOR_API_KEY` empty when using CDP.
    - `GOOGLE_CREDENTIALS_JSON`: the complete Google Vision service-account JSON; mark Sensitive.
    - `BUILDER_CODE` and `BUILDER_CODE_SUFFIX`: public attribution values; do not mark Sensitive.

    Run the database migrations once after creating the Neon project:

    ```bash
    cd backend
    npm run db:migrate
    ```

    Environment changes require a new Vercel deployment. `DATABASE_URL`, CDP secrets,
    Google credentials, and private keys must never be committed to the repository.
    Verify a receipt transaction with `npm run check:builder -- 0x<tx-hash>` from `backend`.

### Contract Config Strategy

There is no shared package yet, so the generated ABI is copied into each client.

- `backend/.openzeppelin/base.json` records the Base mainnet UUPS deployment history and storage layout.
- `deployment.json` is the single source for the canonical chain, proxy address, and ABI version.
- `backend/src/lib/contract.ts` stores the generated ABI and exports the backend contract address.
- `backend/src/lib/network.ts` resolves `CONTRACT_ADDRESS` from env with the canonical mainnet fallback.
- `frontend-baseapp/src/lib/contract.ts` and `frontend-farcaster/src/lib/contract.ts` store the matching ABI.
- Both frontends resolve the same proxy and ABI version from the manifest unless explicitly overridden by env.

When the Solidity interface changes, run `npm run export-abi` from `backend`; it regenerates the backend and both frontend ABI files.

### Running the Apps

Run each app in its own terminal:

- **Backend**
  ```bash
  cd backend
  npm install
  npm run dev
  ```
- **Base frontend**
  ```bash
  cd frontend-baseapp
  npm install
  npm run dev
  ```
- **Farcaster frontend**
  ```bash
  cd frontend-farcaster
  npm install
  npm run dev
  ```

API resolution works like this in both frontends:

- If `NEXT_PUBLIC_API_URL` is set, requests go there.
- If it is not set and the app runs on `localhost`, requests go to `http://localhost:3001`.
- If it is not set in production, requests stay relative (`/api/...`). This is useful for the Farcaster app when backend routes are deployed behind the same Vercel domain.

---
## Safety and Current Limits

- The current contract onboarding phase is `FREE`; do not enable the contract `PAID` phase without allowance/balance/approval UX, security review, and an explicit go/no-go decision.
- Contract `PAID` receipts cost `0.50 USDC`; that fee is separate from the x402 Personalized Basket Insights price of `$0.01 USDC`.
- Quest previews are off-chain and do not promise tokens, XP, or USDC.
- Only receipt summaries and hashes are written on-chain; the full receipt image is not.
- Production mock OCR/contract behavior is disabled unless explicitly enabled outside production.
- Independent audit, data-retention/KVKK-GDPR controls, and production cron observability remain open.
---


## 📡 API Endpoints (Backend)

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/verify-receipt` | `POST` | Validates and analyzes a receipt, returns the normalized `receiptHash`, and can relay on-chain. |
| `/api/receipts/confirmed` | `POST` | Verifies and persists a successful on-chain receipt. |
| `/api/receipts/latest?userAddress=0x...` | `GET` | Restores the latest verified receipt for a wallet. |
| `/api/intelligence/advanced` | `POST` | Returns Personalized Basket Insights after a `$0.01 USDC` x402 payment. |
| `/.well-known/agent.json` | `GET` | Agent discovery card with x402 and endpoint metadata. |
| `/.well-known/agent-card.json` | `GET` | Alternate agent card route. |
| `/api/leaderboard` | `GET` | Fetches the top XP earners. |
| `/api/user/:address` | `GET` | Returns user summary, streaks, reports, and pool state. |
| `/api/check-in` | `POST` | Records a daily user check-in. |
| `/api/quests/:address` | `GET` | Returns the current off-chain weekly quest preview/progress. |
| `/api/meta/nonce/:address` | `GET` | Returns the current EIP-712 nonce. |
| `/api/meta/checkin-sig` | `POST` | Relays a signed check-in transaction. |
| `/api/meta/receipt-sig` | `POST` | Relays a signed receipt transaction with `receiptHash`. |

---

## x402 Agent Quickstart

Agents can call the paid endpoint with the official x402 fetch client. The wrapper
automatically handles the `402 Payment Required` response, signs the payment, retries
the request, and returns the report. The agent wallet needs Base Mainnet USDC.

```text
# Endpoint
POST https://replate-backend61.vercel.app/api/intelligence/advanced

# Test: should return 402 before payment
curl -i -X POST https://replate-backend61.vercel.app/api/intelligence/advanced \
  -H "Content-Type: application/json" \
  -d '{"receiptId":"1","receiptHash":"0x_VERIFIED_RECEIPT_HASH","userAddress":"0x_AGENT_WALLET_ADDRESS"}'

# Payment: $0.01 USDC · Base Mainnet · exact EIP-3009

# Discovery
GET https://replate-backend61.vercel.app/openapi.json
GET https://replate-backend61.vercel.app/.well-known/agent.json
GET https://replate-backend61.vercel.app/.well-known/agent-card.json
```

Install the client:

```bash
npm install @x402/fetch @x402/evm viem dotenv
```

Create `.env` in the agent project:

```env
EVM_PRIVATE_KEY=0x_AGENT_WALLET_PRIVATE_KEY
REPLATE_API_URL=https://replate-backend61.vercel.app
RECEIPT_ID=1
RECEIPT_HASH=0x_VERIFIED_RECEIPT_HASH
```

Create `agent.mjs`:

```js
import "dotenv/config";
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

const signer = privateKeyToAccount(process.env.EVM_PRIVATE_KEY);
const client = new x402Client();

registerExactEvmScheme(client, { signer });

const fetchWithPayment = wrapFetchWithPayment(fetch, client);
const response = await fetchWithPayment(
  `${process.env.REPLATE_API_URL}/api/intelligence/advanced`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      receiptId: process.env.RECEIPT_ID,
      receiptHash: process.env.RECEIPT_HASH,
      userAddress: signer.address,
    }),
  },
);

if (!response.ok) {
  throw new Error(`${response.status}: ${await response.text()}`);
}

console.log(await response.json());
```

The request body is Replate-specific: `receiptId` and `receiptHash` identify an
already verified receipt, while `userAddress` must equal the paying wallet. Unlike
a date-based bulletin endpoint, this report cannot be requested without a verified
receipt reference.

Run it with:

```bash
node agent.mjs
```

The receipt must already be verified and the `userAddress` must match the paying
wallet. Never share `EVM_PRIVATE_KEY`; it belongs only to the agent wallet.

---

## 📜 License

This project is licensed under the MIT License.
