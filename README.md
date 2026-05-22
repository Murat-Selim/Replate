# Replate 🥗

Replate is a Web3 mini-app built on the **Base** blockchain that encourages healthy grocery shopping and reduces food waste. Users upload grocery receipts, the system analyzes them using Google Cloud Vision OCR + Open Food Facts API, and verified results are recorded on-chain as XP, streaks, and NFT badges.

---

## 🚀 Key Features

- **Receipt Analysis**: Automated OCR processing of grocery receipts to extract product names.
- **Health & Nutrition Scoring**: Products are classified via Open Food Facts API to calculate health and nutrition scores based on WHO standards.
- **On-Chain Rewards**: XP, streaks, and NFT badges are recorded on the Base blockchain.
- **Weekly Leaderboard**: Top 100 users share a weekly USDC reward pool (in PAID phase).
- **Daily Check-ins**: Earn extra XP by checking in daily.

---

## 🛠 Tech Stack

- **Blockchain**: Base (EVM-compatible)
- **Smart Contracts**: Solidity ^0.8.22 (UUPS Upgradeable, OpenZeppelin)
- **Frontend**: Next.js 16 + React 19 + Tailwind CSS
- **Backend**: Node.js + Express + TypeScript
- **OCR**: Google Cloud Vision API
- **Food Data**: Open Food Facts API
- **Wallet/SDK**: Farcaster Mini-App SDK, Wagmi, Ethers.js

---

## 🏗 System Architecture

1.  **Receipt Upload**: User uploads a receipt image via the Farcaster mini-app.
2.  **OCR Processing**: Backend uses Google Cloud Vision to extract product names and prices.
3.  **Classification**: Backend queries Open Food Facts to categorize items (Healthy, Unhealthy, Neutral) and fetch nutritional data.
4.  **Scoring**: The system calculates a Health Score (0-100) and a Nutrition Score (0-100).
5.  **On-Chain Submit**: The validator (backend) calls `submitReceipt` on the `ReplateQuest` smart contract.
6.  **Rewards**: The contract updates user XP, increments streaks, and mints badges if eligible.

---

## 📄 Smart Contract: `ReplateQuest.sol`

The core logic resides on-chain to ensure transparency and trust.

- **Proxy Address**: `0xb9b7BD63E098ABd55605312933899fC4f3EF59F8` (Base Sepolia)
- **Scoring Logic**:
    - **Health Score**: Based on the ratio of healthy vs. unhealthy items.
    - **Nutrition Score**: Based on fruit/vegetable weight relative to household size (WHO standard: 300g/day).
- **Points System**: Users earn `BASE_POINTS` (50) plus bonuses for high health/nutrition scores and streaks.

---

## 🚦 Getting Started

### Prerequisites

- Node.js (v20+)
- Google Cloud Vision API Credentials
- Base Sepolia RPC & Testnet USDC

### Installation

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/Murat-Selim/Replate.git
    cd Replate
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Environment Setup**:
    Use the example files in each app:

    - `backend/.env.example` -> copy to `backend/.env`
    - `frontend-baseapp/.env.example` -> copy to `frontend-baseapp/.env.local`
    - `frontend-farcaster/.env.example` -> copy to `frontend-farcaster/.env.local`

    Frontend apps use `NEXT_PUBLIC_API_URL` to talk to the backend.
    For local development, set it to `http://localhost:3001`.
    Default network is `baseSepolia` and default contract is `0xb9b7BD63E098ABd55605312933899fC4f3EF59F8`.
    If you deploy a new contract or switch to Base mainnet:
    - update `CONTRACT_ADDRESS` in `backend/.env`
    - update `NEXT_PUBLIC_CHAIN` and `NEXT_PUBLIC_CONTRACT_ADDRESS` in both frontend apps
    - copy the refreshed ABI file into each frontend app if the contract interface changed

### Contract Config Strategy

For now, this repo does not use a shared package for contract config.

- `backend/src/lib/contract.ts` stores ABI only
- `backend/src/lib/network.ts` resolves `CONTRACT_ADDRESS` from env with a default fallback
- `frontend-baseapp/src/lib/contract.ts` stores ABI and reads address from `src/lib/network.ts`
- `frontend-farcaster/src/lib/contract.ts` stores ABI and reads address from `src/lib/network.ts`

This keeps deploys simple while still letting each Vercel project manage its own contract address independently.

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

## 📡 API Endpoints (Backend)

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/verify-receipt` | `POST` | Processes receipt image and records on-chain. |
| `/api/leaderboard` | `GET` | Fetches the top XP earners. |
| `/api/user` | `GET` | Returns user summary (XP, level, streaks). |
| `/api/check-in` | `POST` | Records a daily user check-in. |

---

## 📜 License

This project is licensed under the MIT License.

