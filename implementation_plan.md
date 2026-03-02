# Replate — Implementation Plan

Based on PROGRESS.md, here's the step-by-step build order. The **frontend is already built** (Next.js + Tailwind). We need to build:

---

## ✅ Already Done
- [x] Frontend pages: Home, Shop, Impact, Leaderboard
- [x] MiniAppReady component (`sdk.actions.ready()`)
- [x] Farcaster manifest route (`/.well-known/farcaster.json`)
- [x] Design system (globals.css with brand tokens)
- [x] Shell, Header, BottomNav, SideMenu components

---

## Phase 1: Smart Contract (Solidity + Hardhat)

### Step 1: Set up Hardhat project
- Install Hardhat, OpenZeppelin upgradeable contracts, dotenv
- Configure `hardhat.config.ts` for Base mainnet + Sepolia
- Create `.env` with PRIVATE_KEY, RPC_URL, etc.

### Step 2: Create `ReplateQuest.sol`
- Full contract from PROGRESS.md (already documented)
- Includes: receipt submission, badge minting, weekly rewards, check-in, streak finalization, admin functions

### Step 3: Deploy script
- UUPS proxy deployment via `upgrades.deployProxy()`
- Initialize with USDC address + dev wallet

### Step 4: Generate ABI + contract address config
- Export ABI JSON for frontend `useReadContract` calls
- Create `src/lib/contract.ts` with `CONTRACT_ADDRESS` + `ABI`

---

## Phase 2: Backend API (Express)

### Step 5: Create Express server structure
- `server/index.ts` — Express app entry
- `server/routes/verify-receipt.ts` — POST /api/verify-receipt
- `server/routes/leaderboard.ts` — GET /api/leaderboard
- `server/services/ocr.ts` — Google Cloud Vision OCR
- `server/services/classifier.ts` — Open Food Facts classification
- `server/services/contract.ts` — ethers.js contract interaction
- `server/cron/weekly.ts` — Weekly finalization + distribution

### Step 6: Implement OCR pipeline
- Google Cloud Vision `textDetection()`
- Extract product names from receipt lines

### Step 7: Implement Food Classification
- Open Food Facts API search
- Nutriscore grading (a/b = healthy, d/e = unhealthy)
- Fruit/veg gram extraction

### Step 8: Contract interaction service
- ethers.js wallet from PRIVATE_KEY
- `submitReceipt()`, `finalizeWeek()`, `distributeWeeklyRewards()`, `checkIn()`

### Step 9: Weekly cron job
- `node-cron` every Sunday 00:00 UTC
- Finalize streaks, distribute rewards to top 100

---

## Phase 3: Frontend ↔ Backend Integration

### Step 10: Wire up Shop page verification
- Call POST `/api/verify-receipt` with image + user data
- Display results (healthScore, nutritionScore, XP earned)

### Step 11: Wire up Impact page with on-chain data
- `useReadContract` for `getUserSummary`, `getCurrentWeekReport`
- Daily check-in button → call backend → `checkIn()` on contract

### Step 12: Wire up Leaderboard with real data
- Fetch GET `/api/leaderboard`
- Replace hardcoded `leaders` array

### Step 13: Share after verify (viral loop)
- `composeCast()` from MiniKit after receipt verification

---

## Phase 4: Farcaster Manifest & Deployment

### Step 14: Update farcaster.json manifest
- Real `accountAssociation` values
- Correct app metadata (subtitle, description, category)
- Real image URLs (icon, splash, screenshots, OG)

### Step 15: Environment variables
- Set up `.env.local` for Next.js
- Set up Vercel env vars for production

### Step 16: Deploy & test
- Deploy to Vercel
- Test at `base.dev/preview`
- Validate manifest

---

## Recommended Build Order
Start with **Phase 2 Step 5-8** (Backend API) since the contract isn't deployed yet and we can mock contract calls initially. Then Phase 1 for actual deployment.
