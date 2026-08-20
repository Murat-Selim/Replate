# Replate Whitepaper

**Onchain proof of healthy living.**  
A receipt intelligence and rewards protocol built for health-focused users in the Base and Farcaster ecosystems.

**Version 2 · Living product document**

This document separates what is **Live**, what is **Planned**, and what represents the broader **Strategy**.

---

# LIVE

## 1. Current product  
**Live**

A user uploads or captures a grocery receipt and provides household context.

Google Cloud Vision extracts the receipt text. Replate removes totals, payment lines, and recognized non-food items, then normalizes and classifies products as healthy, unhealthy, or neutral. Optional Open Food Facts enrichment may support analysis.

The user receives a Health Score and Nutrition Score, reviews the result, signs an EIP-712 message, and submits the verification transaction from the connected wallet.

The current frontend therefore preserves a **user-signed Base transaction** as the primary verification path.

A validator-relayed gasless path exists in the backend but is not the default frontend flow.

---

## 2. Scoring and onchain verification  
**Live**

The Health Score gives full weight to recognized healthy products, partial weight to neutral products, and zero weight to unhealthy products.

The Nutrition Score compares fruit-and-vegetable grams with an average reference target of approximately 300g per person per day, adjusted by household size and the period covered.

The blockchain stores only aggregate information such as:

- Health Score
- Nutrition Score
- item counts
- fruit-and-vegetable grams
- household size
- days covered
- points
- timestamp
- receipt hash

Raw images, OCR text, product names, store names, and detailed AI recommendations are not written to the smart contract.

Replate scoring is informational feedback, not medical advice.

---

## 3. XP, streaks, and badges  
**Live**

Verified receipts can produce XP and update weekly progress.

Daily check-ins use a separate XP and streak mechanic.

A Replate Badge NFT can be minted when defined health and nutrition thresholds are reached.

These mechanics are designed to reward consistency rather than perfection.

---

## 4. Privacy and current data handling  
**Live**

Replate does not intend to retain raw receipt images or full OCR text longer than necessary for product operation.

OCR, normalization, and classification may be inaccurate, particularly for blurry, damaged, multilingual, or unusual receipts.

Current onchain data is pseudonymous rather than fully anonymous because wallet addresses and aggregate activity remain publicly visible on Base.

The current product is designed so that detailed receipt content stays offchain while only aggregate proof data is written to the smart contract.

## 5. Replate Intelligence data layer
**Live**

Replate now runs a hosted PostgreSQL intelligence layer on Neon alongside the Base contracts.

The current pipeline is:

**Verified Receipt -> Normalized Data -> Derived Features -> Replate Intelligence**

The live feature layer calculates basket diversity, fruit-and-vegetable coverage, protein ratio, estimated household coverage, and rule-based insights and recommendations for a verified receipt.

PostgreSQL stores the verified receipt reference, derived features, and paid intelligence report status. The raw receipt image and full OCR text remain offchain and are not written to the smart contract.

Blockchain remains the verification and reward layer, while PostgreSQL provides the current normalization, feature, and intelligence layer.

---

## 6. x402 Detailed Basket Analysis and agent access
**Live**

After a receipt is verified, a user can unlock **Detailed Basket Analysis** for **$0.10 USDC** on Base Mainnet through the x402 payment flow.

The paid endpoint is `POST /api/intelligence/advanced`. It returns a report based on the already verified receipt and the derived intelligence features. Coinbase CDP acts as the facilitator and ERC-8021 Builder Code attribution is supported.

The service is also discoverable by autonomous agents through the `.well-known/agent.json`, `.well-known/agent-card.json`, and `/openapi.json` endpoints. An agent wallet can pay with Base USDC and request the report programmatically.

**x402 is the payment rail. Detailed Basket Analysis is the live product.**

---

## 7. Contract and receipt pricing model
**Live**

Receipt submissions on the upgraded Base contract are permanently free and have no contract-level daily receipt limit. Receipt-hash replay protection remains active for signed submissions.

The legacy `PAID` phase and fee storage remain only for UUPS upgrade compatibility; they are not used to charge for receipt submissions. The separate paid product is the x402-powered Detailed Basket Analysis endpoint.

---

# PLANNED

## 8. Extended intelligence roadmap
**Planned**

The foundational PostgreSQL intelligence layer is live. The following historical and aggregated intelligence extensions remain planned.

The proposed pipeline is:

**Derived Features
→ Behavioral History
→ Replate Intelligence**

Planned extensions include:

- 30 / 60 / 90-day trends
- historical improvement
- shopping consistency
- aggregate consumer signals
- permissioned reputation

Blockchain remains the verification and reward layer.

Historical analysis, aggregation, and permissioned intelligence remain planned extensions.

---

## 9. Premium consumer model
**Planned**

The basic Replate experience is intended to remain accessible without charging for every receipt.

Replate may also introduce **Replate Intelligence+**:

**5 USDC · 30 days**

Potential benefits include:

- advanced receipt analysis
- personalized recommendations
- historical trends
- advanced weekly reports
- premium profile status
- premium quests
- early feature access
- selected seasonal benefits
- proposed **1.5x XP multiplier** on eligible verified activity

Subscription status would be managed by Replate while x402 acts as the payment rail.

---

## 10. Extended x402, MCP, and AI infrastructure
**Planned**

The x402 consumer report and agent payment path are live. Planned extensions include:

**AI Agent / Web3 Application
→ Replate API or MCP Tool
→ x402 Payment
→ Extended Replate Intelligence**

Potential paid services include:

- Basket Intelligence
- Nutrition Intelligence
- Behavioral Trend Analysis
- Recommendation Intelligence
- Aggregated Consumer Insights
- Permissioned Reputation Signals

MCP-compatible tools, broader B2B APIs, historical trend products, aggregate consumer insights, and permissioned reputation signals remain planned.

---

## 11. Founder NFT and sponsored ecosystem
**Planned**

Replate plans to explore a limited Founder NFT collection:

**Supply:** 444  
**Mint Price:** 5 USDC

Potential utility includes:

- Founder status
- profile badges
- early access
- Founder-only quests
- selected seasonal benefits
- community privileges
- possible Intelligence+ benefits

Founder NFTs are intended as utility and membership assets rather than guaranteed revenue-sharing products.

Replate may also work with AI companies, Web3 protocols, wallets, Base ecosystem projects, wellness companies, and consumer brands on sponsored quests, seasons, reward pools, or infrastructure campaigns.

Sponsors are an additional growth layer, not the core revenue dependency.

---

## 12. Planned roadmap
**Planned**

Near-term priorities include:

- better retailer parsing
- stronger product normalization
- OCR and classification confidence
- duplicate and fraud detection
- Intelligence+ membership
- longer-term historical behavioral tracking
- expanded trend and aggregate intelligence products
- B2B Intelligence APIs
- MCP-compatible AI tools
- Founder NFT utility
- sponsored ecosystem experiments

A native token and mass-market wallet-abstracted experience remain conditional on proven product-market fit and sustainable usage.

---

# STRATEGY

## 13. Abstract
**Strategy**

Replate combines OCR, product classification, household context, AI analysis, and Base blockchain verification to turn grocery receipts into health feedback, verifiable progress, and privacy-conscious behavioral intelligence.

Today, Replate includes receipt analysis, Health Score, Nutrition Score, XP, streaks, badges, weekly progress, user-signed onchain verification, Neon-backed intelligence features, and x402-paid Detailed Basket Analysis for users and agents.

The long-term vision is to build **Replate Intelligence**: a structured intelligence layer that can serve users, AI agents, and Web3 applications through premium consumer features, x402-powered APIs, and MCP-compatible tools.

---

## 14. Mission and audience
**Strategy**

Replate helps users understand and improve their grocery-shopping behavior while creating a transparent, verifiable record of progress.

Phase 1 focuses primarily on crypto-native users in the Base and Farcaster ecosystems interested in health, fitness, community, AI, and onchain identity.

The initial objective is to prove repeated receipt usage, retention, useful scoring, reliable data normalization, and sustained onchain participation.

Long term, Replate may also serve AI agents, developers, wellness platforms, and Web3 applications that need structured grocery and behavioral intelligence.

---

## 15. The Problem

**Strategy**

Every year, billions of grocery receipts are discarded after serving a single purpose: proving that a purchase happened.

Yet these receipts contain valuable signals about real-world consumer behavior, including what people buy, how shopping patterns change over time, and how those choices may relate to nutrition, household habits, and healthier living.

Today, much of this information is lost, fragmented, or locked inside closed systems.

Replate's goal is to capture this otherwise wasted data, process it responsibly, and transform it into structured, privacy-conscious intelligence.

The Replate model is:

Discarded Receipt Data
→ Structured Grocery Data
→ Verified Behavioral Signals
→ Replate Intelligence
→ x402-Powered AI & Web3 Services

Instead of treating receipts as disposable records, Replate aims to turn them into useful intelligence that can circulate within the blockchain and AI ecosystem.

Through Replate Intelligence, derived and aggregated insights may become accessible to AI agents, Web3 applications, and developers through x402-powered services, while raw personal receipt data remains protected.

The objective is to create a healthier data economy where value is not extracted from users and lost inside closed platforms.

Instead:

Users contribute real-world activity.
Replate transforms that activity into useful intelligence.
AI and Web3 applications gain access to valuable structured signals.
Part of the economic value generated can return to the Replate ecosystem and its users.

Replate therefore addresses two connected problems:

valuable real-world receipt data is currently wasted, and users rarely participate in the value created from their own activity.

The long-term goal is to turn this discarded information into a useful, privacy-conscious intelligence layer that benefits users, developers, AI systems, and the broader Web3 ecosystem.
---

## 16. Privacy and data principles
**Strategy**

Replate separates data into three broad classes:

**Private Data** — raw receipts, OCR text, and exact user purchase history.

**Permissioned Data** — user-level trends, reputation, or personalized intelligence explicitly authorized by the user.

**Aggregated Intelligence** — anonymized or sufficiently aggregated behavioral and statistical signals.

The guiding principle is:

**Replate monetizes intelligence, not personal receipt data.**

---

## 17. Economic model
**Strategy**

Replate is designed around three participants.

### Users

Users contribute verified real-world activity and receive health feedback, XP, streaks, badges, onchain progress, paid Detailed Basket Analysis, and potential future rewards.

### AI and Web3 applications

External applications may pay for structured basket intelligence, nutrition signals, behavioral trends, recommendations, aggregate intelligence, or permissioned reputation.

### Replate

Potential revenue sources include:

- Intelligence+ subscriptions
- pay-per-use premium analysis
- x402 B2B APIs
- MCP / AI agent usage
- sponsored programs
- selected premium features

A portion of future infrastructure revenue may support ecosystem growth and recurring reward pools.

The legacy contract PAID receipt mechanism is disabled; receipt submissions are free and the x402-powered intelligence endpoint is the separate paid product.

---

## 18. Risks and open questions
**Strategy**

The quality of Replate Intelligence depends on accurate OCR, strong normalization, reliable classification, fraud resistance, sufficient user activity, historical depth, and appropriate privacy controls.

Fake receipts, duplicate submissions, and Sybil activity may weaken both rewards and intelligence quality.

AI companies will only pay for Replate services if the intelligence provides meaningful value that is difficult or expensive to reproduce independently.

x402 enables payment but does not create demand by itself.

Privacy, user consent, data licensing, subscriptions, NFTs, rewards, sponsored campaigns, and future token plans require appropriate legal and compliance review before expansion.

---

## 19. Vision
**Strategy**

Replate begins with a grocery receipt.

Its long-term evolution is:

**Receipt Analyzer  
→ Health & Nutrition Tracker  
→ Onchain Healthy-Living Proof  
→ Verified Behavioral Data Layer  
→ Replate Intelligence  
→ x402 AI Services  
→ MCP Agent Infrastructure  
→ Real-World Intelligence Network**

The goal is to create a system where users understand and verify their progress, premium users receive deeper intelligence, AI systems gain access to useful privacy-conscious behavioral signals, and Replate generates sustainable infrastructure revenue.

### Real behavior. Verified intelligence. Machine-to-machine commerce.

**Shop Smart. Eat All. Replate.**
