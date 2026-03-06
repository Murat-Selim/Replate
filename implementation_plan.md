# Replate — Implementation Plan

Based on PROGRESS.md, here's the step-by-step build order. The **frontend is already built** (Next.js + Tailwind). We need to build:

---

## ✅ Already Done
- [x] Frontend pages: Home, Shop, Impact, Leaderboard
- [x] MiniAppReady component (`sdk.actions.ready()`)
- [x] Farcaster manifest route (`/.well-known/farcaster.json`)
- [x] Design system (globals.css with brand tokens)
- [x] Shell, Header, BottomNav, SideMenu components
- [x] Smart Contract deployed to Base Sepolia
  - Proxy: 0xb9b7BD63E098ABd55605312933899fC4f3EF59F8
  - Implementation: 0xb3c819bfe5383cc24555022566243267b6f9DdAf
  - USDC (Sepolia): 0x036CbD53842c5426634e7929541eC2318f3dCF7e
- [x] Backend API routes: verify-receipt, leaderboard, user, check-in
- [x] Contract service: ethers.js integration with contract
- [x] Frontend contract.ts updated with deployed address

---

## Phase 1: Smart Contract (Solidity + Hardhat) ✅ COMPLETED

### Deployed Addresses (Base Sepolia Testnet)
- **Proxy Contract**: [0xb9b7BD63E098ABd55605312933899fC4f3EF59F8](https://sepolia.basescan.org/address/0xb9b7BD63E098ABd55605312933899fC4f3EF59F8)
- **Implementation**: [0xb3c819bfe5383cc24555022566243267b6f9DdAf](https://sepolia.basescan.org/address/0xb3c819bfe5383cc24555022566243267b6f9DdAf)
- **USDC (Testnet)**: 0x036CbD53842c5426634e7929541eC2318f3dCF7e
- **Validator/Deployer**: 0x4A6370Dc13a9a5E63bd4edaA15bbfbf3438f82A5

### Step 1: Set up Hardhat project ✅
- Install Hardhat, OpenZeppelin upgradeable contracts, dotenv
- Configure `hardhat.config.ts` for Base mainnet + Sepolia
- Create `.env` with PRIVATE_KEY, RPC_URL, etc.

### Step 2: Create `ReplateQuest.sol` ✅
- Full contract from PROGRESS.md (already documented)
- Includes: receipt submission, badge minting, weekly rewards, check-in, streak finalization, admin functions
- **Status**: Deployed and verified on Base Sepolia

### Step 3: Deploy script ✅
- UUPS proxy deployment via `upgrades.deployProxy()`
- Initialize with USDC address + dev wallet
- **Status**: Successfully deployed to Base Sepolia

### Step 4: Generate ABI + contract address config ✅
- Export ABI JSON for frontend `useReadContract` calls
- Create `src/lib/contract.ts` with `CONTRACT_ADDRESS` + `ABI`
- **Status**: Updated with deployed contract address (0xb9b7BD63E098ABd55605312933899fC4f3EF59F8)

---

## Phase 2: Backend API (Express) ✅ COMPLETED

### Backend API Status
- **Status**: All routes implemented and ready for deployment
- **Port**: 3001 (configurable via PORT env var)

### Step 5: Create Express server structure ✅
- `server/index.ts` — Express app entry
- `server/routes/verify-receipt.ts` — POST /api/verify-receipt
- `server/routes/leaderboard.ts` — GET /api/leaderboard
- `server/routes/user.ts` — GET /api/user
- `server/routes/check-in.ts` — POST /api/check-in
- `server/services/ocr.ts` — Google Cloud Vision OCR
- `server/services/classifier.ts` — Open Food Facts classification
- `server/services/contract.ts` — ethers.js contract interaction
- `server/cron/weekly.ts` — Weekly finalization + distribution

### Step 6: Implement OCR pipeline ✅
- Google Cloud Vision `textDetection()`
- Extract product names from receipt lines

### Step 7: Implement Food Classification ✅
- Open Food Facts API search
- Nutriscore grading (a/b = healthy, d/e = unhealthy)
- Fruit/veg gram extraction

### Step 8: Contract interaction service ✅
- ethers.js wallet from VALIDATOR_PRIVATE_KEY
- `submitReceipt()`, `finalizeWeek()`, `distributeWeeklyRewards()`, `checkIn()`
- Uses deployed contract address: 0xb9b7BD63E098ABd55605312933899fC4f3EF59F8

### Step 9: Weekly cron job ✅
- `node-cron` every Sunday 00:00 UTC
- Finalize streaks, distribute rewards to top 100

---

## Phase 3: Frontend ↔ Backend Integration ✅ COMPLETED

### Integration Status
- **Status**: All endpoints wired, ready for production
- **Add to Mini App**: Implemented via `sdk.actions.addMiniApp()` on home page

### Step 10: Wire up Shop page verification ✅
- Call POST `/api/verify-receipt` with image + user data
- Display results (healthScore, nutritionScore, XP earned)

### Step 11: Wire up Impact page with on-chain data ✅
- `useReadContract` for `getUserSummary`, `getCurrentWeekReport`
- Daily check-in button → call backend → `checkIn()` on contract

### Step 12: Wire up Leaderboard with real data ✅
- Fetch GET `/api/leaderboard`
- Replace hardcoded `leaders` array

### Step 13: Share after verify (viral loop) ✅
- `composeCast()` from MiniKit after receipt verification

### Step 14: Add to Mini App button ✅
- `sdk.actions.addMiniApp()` on home page
- Button appears after 3 seconds to let user explore first

---

## Phase 4: Deployment

### Environment Variables Required

#### Backend (.env)
```env
PORT=3001
FRONTEND_URL=http://localhost:3000

# Blockchain (Base Sepolia)
VALIDATOR_PRIVATE_KEY=0x...
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
CONTRACT_ADDRESS=0xb9b7BD63E098ABd55605312933899fC4f3EF59F8
USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e

# Google Cloud Vision (for OCR)
GOOGLE_APPLICATION_CREDENTIALS=./gcloud-key.json

# Database (for leaderboard - optional)
MONGODB_URI=mongodb://...
```

#### Frontend (.env.local)
```env
NEXT_PUBLIC_URL=https://replate-kappa.vercel.app
NEXT_PUBLIC_API_URL=http://localhost:3001

# MiniKit / Coinbase Developer Platform
NEXT_PUBLIC_MINIKIT_PROJECT_ID=...

# Contract (Base Sepolia)
NEXT_PUBLIC_CONTRACT_ADDRESS=0xb9b7BD63E098ABd55605312933899fC4f3EF59F8
NEXT_PUBLIC_CHAIN_ID=84532

# USDC
NEXT_PUBLIC_USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
```

### Step 14: Update farcaster.json manifest ✅
- Real `accountAssociation` values
- Correct app metadata (subtitle, description, category)
- Real image URLs (icon, splash, screenshots, OG)

### Step 15: Environment variables ✅
- Set up `.env.local` for Next.js
- Set up Vercel env vars for production

### Step 16: Deploy & test
- [ ] Deploy to Vercel
- [ ] Test at `base.dev/preview`
- [ ] Validate manifest

---

## Current Deployment Status

### ✅ Completed Deployments
- Smart Contract: Base Sepolia (Testnet)
- Frontend: **https://replate-kappa.vercel.app** (Production)
- Backend: Ready for deployment

### ⏳ Pending
- ~~Vercel deployment (frontend + API routes)~~ ✅ COMPLETED
- Mainnet deployment (after testing)
- Production manifest configuration

---

## Next Steps

1. **Deploy to Vercel**: Push to GitHub and connect to Vercel
2. **Configure environment variables**: Add all required env vars in Vercel dashboard
3. **Test on Base**: Visit base.dev/preview with your deployed URL
4. **Deploy to Mainnet**: After testing, deploy contract to Base mainnet and update addresses
5. **Launch**: Publish to Base Mini App store

## Deployed Contract Information

| Network | Proxy Address | Implementation | USDC |
|---------|---------------|-----------------|------|
| Base Sepolia (Testnet) | 0xb9b7BD63E098ABd55605312933899fC4f3EF59F8 | 0xb3c819bfe5383cc24555022566243267b6f9DdAf | 0x036CbD53842c5426634e7929541eC2318f3dCF7e |
| Base Mainnet | _Pending_ | _Pending_ | 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 |
