# Replate — EIP-712 + ERC-4337 Entegrasyon Progress

## Genel Mimari

```
Smart Wallet (Coinbase)  →  ERC-4337  →  CDP Paymaster gas öder  →  Contract  (from = user ✅)
EOA (MetaMask, Rainbow)  →  EIP-712   →  Backend imzayı doğrular  →  Contract  (from = backend ⚠️)
```

> EOA akışında `from = backend wallet` olmaya devam eder — Builder Code bu kullanıcıları görmez.
> Smart Wallet akışında `from = user smart wallet` olur — Builder Code görür ✅

---

## Faz 1 — Contract Güncellemesi

### Yapılacaklar

- [ ] **ERC20Permit ekle** — EIP-712 için tek contract değişikliği
  - `ERC20PermitUpgradeable` miras al
  - `__ERC20Permit_init("ReplateQuest")` initialize'a ekle
  - Bu sayede EIP-712 domain separator otomatik oluşur

- [ ] **`msg.sender` validator kontrolünü kaldır**
  - `onlyValidator` modifier'ını `checkIn` ve `submitReceipt` fonksiyonlarından çıkar
  - Validator kontrolü artık backend'de imza doğrulamasıyla yapılacak
  - Contract sadece imzayı doğrulayacak, `msg.sender`'a bakmayacak

- [ ] **`upgradeProxy` ile deploy et**
  ```bash
  npx hardhat run scripts/upgrade.ts --network base
  ```

- [ ] **Basescan'da verify et**
  ```bash
  npx hardhat verify --network base IMPLEMENTATION_ADDRESS
  ```

### Notlar
- Proxy adresi değişmez, sadece implementation güncellenir
- CDP Paymaster contract'a erişimi yok, sadece gas sponsor eder
- ERC-4337 için contract değişikliği gerekmez, Paymaster her şeyi dışarıdan halleder

---

## Faz 2 — Backend Güncellemesi (EIP-712 / EOA)

### Yapılacaklar

- [ ] **`GET /api/nonce/:address`** route ekle
  - Contract'tan kullanıcının mevcut nonce'unu döner
  - Replay attack koruması için her işlemde artar

- [ ] **`POST /api/checkin`** route güncelle
  - Body: `{ userAddress, nonce, signature }`
  - `verifyTypedData` (viem) ile imzayı doğrula
  - Doğruysa `checkInWithSig(user, nonce, sig)` çağır

- [ ] **`POST /api/receipt/submit-sig`** route ekle
  - Body: `{ userAddress, totalItems, healthyItems, unhealthyItems, fruitVegGrams, householdSize, daysCovered, nonce, signature }`
  - `verifyTypedData` ile doğrula
  - Doğruysa `submitReceiptWithSig(...)` çağır

- [ ] **`meta.ts`** yeni route dosyası oluştur
  - Nonce, checkin-sig, receipt-sig endpoint'lerini buraya topla
  - `app.ts`'e import et

- [ ] **EIP-712 domain sabiti** tanımla
  ```typescript
  const DOMAIN = {
    name: "ReplateQuest",
    version: "1",
    chainId: 8453,
    verifyingContract: process.env.CONTRACT_ADDRESS,
  };
  ```

---

## Faz 3 — Frontend Güncellemesi

### 3a — Wallet Tipi Tespiti

- [ ] **`src/lib/walletType.ts`** oluştur
  - `getBytecode(address)` ile EOA mi Smart Wallet mi tespit et
  - `"smart" | "eoa"` döner

### 3b — EIP-712 İmzalama (EOA)

- [ ] **`src/lib/eip712.ts`** oluştur
  - Farcaster SDK `ethProvider` kullanarak `signTypedData` çağır
  - `signCheckIn(address, nonce)` fonksiyonu
  - `signReceipt(address, data, nonce)` fonksiyonu

### 3c — ERC-4337 (Smart Wallet)

- [ ] **Coinbase CDP API key al**
  - `portal.cdp.coinbase.com` → Paymaster → Base Mainnet
  - Ücretsiz tier: aylık 10M gas unit

- [ ] **`src/lib/paymaster.ts`** oluştur
  ```typescript
  export const PAYMASTER_CAPABILITIES = {
    paymasterService: {
      url: "https://api.developer.coinbase.com/rpc/v1/base/CDP_KEY",
    },
  };
  ```

- [ ] **`src/lib/wagmi.ts`** oluştur
  ```typescript
  coinbaseWallet({ appName: "Replate", preference: "smartWalletOnly" })
  ```

- [ ] **`wagmi/experimental` — `useWriteContracts`** kullan
  - Smart Wallet için `capabilities: PAYMASTER_CAPABILITIES` ekle

### 3d — Unified Hook

- [ ] **`src/lib/useTransaction.ts`** oluştur
  - `useCheckIn()` — wallet tipine göre ERC-4337 veya EIP-712 seçer
  - `useSubmitReceipt()` — aynı mantık
  - Tüm bileşenler bu hook'u kullanır, wallet tipini bilmek zorunda kalmaz

### 3e — App Provider

- [ ] **`WagmiProvider` + `QueryClientProvider`** ile app'i wrap et
- [ ] Farcaster SDK `ethProvider` + wagmi `coinbaseWallet` connector birlikte çalışacak şekilde ayarla

---

## Faz 4 — Test

### Contract Testleri
- [ ] `checkInWithSig` — geçerli imza ile başarılı
- [ ] `checkInWithSig` — geçersiz imza reject ediyor mu
- [ ] `submitReceiptWithSig` — geçerli imza ile başarılı
- [ ] `submitReceiptWithSig` — geçersiz imza reject ediyor mu
- [ ] Nonce replay koruması çalışıyor mu (aynı nonce iki kez kullanılamaz)

### Backend Testleri
- [ ] `GET /api/nonce/:address` doğru nonce döndürüyor
- [ ] `POST /api/checkin` geçerli imza kabul ediyor
- [ ] `POST /api/checkin` geçersiz imza reddediyor (400)
- [ ] `POST /api/receipt/submit-sig` geçerli imza ile tx oluşturuyor

### Frontend Testleri
- [ ] EOA cüzdan → EIP-712 akışı → imza ekranı çıkıyor
- [ ] Smart Wallet → ERC-4337 akışı → Paymaster gas ödüyor
- [ ] Builder Code dashboard'da Smart Wallet tx'leri görünüyor
- [ ] Leaderboard her iki akıştan gelen user'ları gösteriyor

---

## Faz 5 — Deploy & Verify

- [ ] Contract upgrade → Base mainnet
- [ ] Implementation verify → Basescan
- [ ] Backend Vercel'e push
- [ ] CDP Paymaster URL → Vercel env variable
- [ ] Frontend Vercel'e push
- [ ] Builder Code dashboard'da user sayısı artıyor mu kontrol et

---

## Dosya Değişim Özeti

| Dosya | Değişim |
|---|---|
| `ReplateQuest.sol` | ERC20Permit ekle, `msg.sender` validator kontrolü kaldır |
| `scripts/upgrade.ts` | upgradeProxy script |
| `backend/routes/meta.ts` | Yeni — nonce, checkin-sig, receipt-sig |
| `backend/routes/checkin.ts` | Güncelle — EIP-712 doğrulama ekle |
| `backend/services/contract.ts` | `checkInWithSig`, `submitReceiptWithSig` çağrıları |
| `src/lib/wagmi.ts` | Yeni — Coinbase Smart Wallet config |
| `src/lib/paymaster.ts` | Yeni — CDP Paymaster capabilities |
| `src/lib/walletType.ts` | Yeni — EOA / Smart Wallet tespiti |
| `src/lib/eip712.ts` | Yeni — EOA imzalama fonksiyonları |
| `src/lib/useTransaction.ts` | Yeni — unified hook |
| `src/main.tsx` | WagmiProvider + QueryClientProvider wrap |

---

## Öncelik Sırası

```
Faz 1 (Contract)  →  Faz 2 (Backend)  →  Faz 3 (Frontend)  →  Faz 4 (Test)  →  Faz 5 (Deploy)
     ↓                     ↓                      ↓
  upgrade.ts           meta.ts              useTransaction.ts
  verify               nonce route          walletType.ts
                       sig doğrulama        eip712.ts
                                            paymaster.ts
                                            wagmi.ts
```

---

## Önemli Notlar

- CDP Paymaster proxy contract'a erişimi yok — sadece gas sponsor eder, güvenli
- ERC-4337'de `msg.sender = EntryPoint` olur — validator kontrolü imza tabanlı yapılmalı
- EOA akışında Builder Code kullanıcıyı görmez (`from = backend`) — bu bilinen kısıt
- Nonce her başarılı işlemde artar — replay attack imkansız
- `usersCache` (1 saatlik TTL) Tenderly limitini koruyor — değiştirme