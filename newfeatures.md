Consumer Premium Layer
Kullanıcı kendi fişini yükler, ücretsiz basic sonucu alır, Base’te doğrular ve isterse kendi wallet’ıyla 0.10 USDC x402 ödeyip Advanced Replate Intelligence raporunu açar.

Agent / Machine Layer
Aynı kullanıcının izin verdiği verified receipt veya historical data üzerinde çalışan kişisel agent, ihtiyaç duyduğu ek intelligence araçlarını ayrı ayrı çağırabilir. Örneğin basket trend, price intelligence, nutrition comparison veya behavior insight gibi servisler için 0.01–0.03 USDC per call ödeyebilir.

Yani örnek akış şöyle olabilir:

USER
  ↓
Receipt Upload
  ↓
Free Basic Analysis
  ↓
Base Verification
  ↓
0.10 USDC x402
  ↓
Advanced Replate Intelligence Report
  ↓
PostgreSQL / Replate Intelligence
       ↑
       │
Personal AI Agent
       │
       ├─ get_basket_insight()      → 0.01 USDC
       ├─ get_price_intelligence()  → 0.01 USDC
       ├─ get_behavior_trend()      → 0.02 USDC
       └─ get_recommendation()      → 0.03 USDC

Buradaki kritik nokta şu: agent kullanıcının private receipt verisine otomatik erişmemeli. Wallet authorization / consent ile hangi receipt veya hangi intelligence scope’una erişebileceği belirlenmeli.

Böylece aynı Replate Intelligence Engine’den üç farklı müşteri tipi çıkıyor:

User → 0.10 USDC premium report
User’s Agent → micro x402 calls
External B2B Agent → aggregated x402 intelligence

Bu yapı bence çok güçlü çünkü 0.10 USDC’lik kullanıcı raporu ile 0.01–0.03 USDC’lik machine-to-machine çağrılar birbirini tamamlıyor; aynı şeyin iki kez satılması değil, farklı granülerlikte farklı ürünler oluyor.

Evet, bu yapı Replate için çok daha doğru. Hatta az önce konuştuğumuz “Connect Agent” kartından daha açık ve geliştirici dostu bir model olur.

Çünkü burada agent entegrasyonu için UI üzerinden agent bağlamak zorunda değilsin. Replate doğrudan machine-readable paid API provider olur.

Verify Receipt page’de, receipt doğrulandıktan sonra ayrı bir bölüm açarsın:

For AI Agents ▲

Machine-readable Replate Intelligence API via x402

Agents can autonomously pay and fetch intelligence from verified receipt data using x402 — no browser interaction required.

Mantık şöyle olur:

Human
  ↓
uploads receipt
  ↓
Base verifies receipt
  ↓
Replate stores normalized data
  ↓
Agent API becomes available

Sonra agent:

GET /api/intelligence/basket/{receiptId}

çağrısı yapar.

Replate önce 402 Payment Required döndürür.

Agent kendi private key’i / agent wallet’ı ile öder ve sonucu alır.

Bu yüzden page’de gerçekten şöyle bir geliştirici rehberi göstermek mantıklı:

For AI Agents ▲

Machine-readable API via x402

Verified receipts can be accessed through
permissioned Replate Intelligence endpoints.

# Basket Intelligence
GET /api/intelligence/basket/{receiptId}

# Price Intelligence
GET /api/intelligence/price/{receiptId}

# Behavior Intelligence
GET /api/intelligence/behavior/{wallet}

# Recommendation
GET /api/intelligence/recommendation/{receiptId}

Altında fiyatlar:

Basket Intelligence        0.01 USDC
Price Intelligence         0.01 USDC
Behavior Intelligence      0.02 USDC
Recommendation             0.03 USDC

Sonra örnek kullanım:

import { wrapFetchWithPayment } from "@x402/fetch";
import { x402Client } from "@x402/core/client";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

const signer = privateKeyToAccount(process.env.PRIVATE_KEY);

const client = new x402Client();
registerExactEvmScheme(client, { signer });

const fetchWithPay = wrapFetchWithPayment(fetch, client);

const res = await fetchWithPay(
  "https://replate.app/api/intelligence/basket/RECEIPT_ID"
);

const intelligence = await res.json();

Bence ayrıca iki link de koymalısın:

OpenAPI spec →
/openapi.json

Agent card →
/.well-known/agent-card.json

Bu çok değerli olur çünkü Replate API artık yalnızca insanlara yönelik değil, agent-discoverable hale gelir.

Ama burada kritik bir güvenlik ayrımı var:

Public endpoint ≠ public user data

Agent API’nin görünür olması sorun değil.

Ama belirli bir kullanıcının receipt intelligence’ına erişim:

receipt verified olmalı
permission scope olmalı
raw receipt dönmemeli
mümkünse receipt_id tahmin edilemez olmalı
private user intelligence için authorization gerekebilir

Yani:

/api/intelligence/basket/{receiptId}

endpoint public olarak belgelenebilir ama data access permissioned olabilir.

B2B aggregate endpoint’lerde ise kullanıcı izni yerine aggregate/privacy threshold uygulanır:

/api/intelligence/segments/healthy-baskets

gibi.

Bence Verify Receipt page’de üç bölüm çok iyi olur:

Receipt Result

✓ Verified on Base

[ Advanced Replate Intelligence — 0.10 USDC ]


For AI Agents ▲

Machine-readable API via x402

Basket Intelligence       0.01 USDC
Price Intelligence        0.01 USDC
Behavior Intelligence     0.02 USDC
Recommendation            0.03 USDC

[ OpenAPI spec ]
[ Agent card ]

Ve en önemli ayrım:

0.10 USDC
→ insan için full Advanced Report

0.01–0.03 USDC
→ agent için granular API call

Bu yapı çok daha net.

Kısacası: evet, Base Daily Brief’teki “For AI Agents” modelini Replate’a uygulamak bence doğru yaklaşım. Replate dashboard’da agent bağlama zorunluluğu olmadan doğrudan bir x402-powered Intelligence API provider olabilir.

