# Replate — İlerleme Raporu V1

> Son güncelleme: 18 Ağustos 2026  
> Kaynak: Whitepaper v1.0, repository kaynak kodu ve yerel doğrulama sonuçları  
> Bu belge yaşayan bir proje takip belgesidir. `PROGRESS.md` ve `progress1.md` korunur.

## Durumlar

| İşaret | Anlam |
|---|---|
| ✅ Tamamlandı | Kaynak kodda uygulanmış ve incelenebilir. |
| 🟡 Kısmen tamamlandı | Kod mevcut; dağıtım, entegrasyon veya operasyon kanıtı eksik. |
| ⬜ Planlandı | Hedef tanımlı; uygulama kanıtı yok. |
| 🔴 Bloke/Risk | Üretime geçişi engelleyebilecek açık konu. |

## Yönetici özeti

Replate; Base üzerinde UUPS/ERC-721 sözleşmesi, Google Cloud Vision OCR, yerel ürün kataloğu ve isteğe bağlı Open Food Facts sınıflandırması, Express API, EIP-712 imzalı fiş/check-in akışları, haftalık sıralama/USDC dağıtımı ve iki Next.js istemcisi bulunan çalışan bir ürün tabanıdır.

Bu güncellemede P0/P1’in ilk kodlama paketi uygulandı:

- ✅ Normalize OCR çıktısından deterministik `receiptHash` üretiliyor.
- ✅ Hash EIP-712 fiş imzasına bağlandı ve sözleşmede global tek-kullanımlı hale getirildi.
- ✅ Backend ve iki frontend yeni imza/ABI sırasına geçirildi.
- ✅ Backend ve frontend varsayılan kontrat adresi Base mainnet `0x9d646D474ba0D1bF03E61453898c160b7f9e3E90` üzerinde hizalandı.
- ✅ `deployment.json` chain, proxy adresi ve ABI sürümü için tek kaynak oldu; ABI export üç tüketiciyi tek komutla güncelliyor.
- ✅ Production yapılandırma doğrulaması, fail-closed mock davranışı, daha sıkı CORS ve korumalı cron çalışması eklendi.
- ✅ Base ve Farcaster ürün dili ödül önceliğinden sağlık analizi/fiş doğrulama odağına taşındı; mobil CTA ve sonuç geri bildirimi iyileştirildi.

Ürün yine de PAID mainnet pilotuna hazır sayılmamalıdır. Mainnet proxy’nin V3 implementation’a yükseltildiği, `initializeV3` çalıştığı, aktif fazın/USDC’nin doğru olduğu ve Basescan doğrulaması repository’den kanıtlanamıyor. Bağımsız güvenlik incelemesi, veri saklama/KVKK-GDPR süreci ve üretim cron gözlemlenebilirliği de tamamlanmamıştır.

**Bir sonraki ana kilometre taşı:** Mainnet V3 zincir üstü doğrulama + temiz CI + veri saklama denetimi + PAID allowance/onay deneyimi tamamlandıktan sonra sınırlı pilot için go/no-go kararı.

## Mevcut mimari

| Katman | Durum | Mevcut uygulama |
|---|---|---|
| Akıllı sözleşme | 🟡 | UUPS, ERC-721 badge, EIP-712, nonce/deadline, pause, reentrancy, dinamik ücret, FREE/PAID, haftalık havuz ve replay koruması. Mainnet sürümü doğrulanmalı. |
| Validator/relayer | ✅ | Klasik validator işlemleri ile imzalı check-in/fiş relay akışları mevcut. |
| OCR | ✅ | Vision OCR, base64/boyut/kalite kontrolü, normalize metin ve hash üretimi mevcut. |
| Sınıflandırıcı | ✅ | Yerel Türkçe katalog, OCR alias’ları, sağlıklı/sağlıksız/nötr sınıfları ve meyve-sebze gram tahmini mevcut. |
| Open Food Facts | 🟡 | Entegrasyon var; kullanım `USE_OFF_API=true` ortam değişkenine bağlı. |
| Express API | ✅ | Verify receipt, meta-sign, check-in, user, leaderboard ve cron rotaları mevcut. |
| Haftalık operasyon | 🟡 | Finalize/dağıtım, idempotency ve korumalı tetikleyici mevcut; production çalışma geçmişi/dashboard yok. |
| Base App | 🟡 | Cüzdan, kamera/galeri, fiş analizi, imza, impact ve leaderboard var; PAID onay UX’i eksik. |
| Farcaster Mini App | 🟡 | SDK/provider, kamera fallback’i ve aynı çekirdek akış var; ortak E2E eşitlik paketi eksik. |

## Tamamlanan özellikler

### Sözleşme ve güvenlik

- ✅ `FREE`/`PAID` fazları ve validator kontrollü `setPhase`.
- ✅ Değişken `FEE`, yeni deployment ve V3 initializer için `500000` (0.50 USDC), validator kontrollü `setFee`.
- ✅ Validator kontrollü `setUSDC`.
- ✅ PAID ücretinin %50 haftalık havuz, %50 operasyon fonu olarak ayrılması.
- ✅ Pause, reentrancy, UUPS yetkilendirmesi ve iki aşamalı validator/dev-wallet transferi.
- ✅ EIP-712 nonce ve deadline replay koruması.
- ✅ `receiptHash` imzaya bağlı; `usedReceiptHashes` ile aynı hash ikinci kez kullanılamıyor.
- ✅ `ReceiptHashConsumed` eventi.
- ✅ Yeni storage alanı mevcut `FEE` sonrasına eklenerek upgradeable storage sırası korundu.

### Skor ve ilerleme

- ✅ Sağlık ve beslenme skorları.
- ✅ Temel XP ve skor bonusları.
- ✅ Kullanıcı başına UTC gününde tek fişten XP.
- ✅ Günlük check-in, 10 XP ve check-in serisi.
- ✅ Haftalık fiş serisi/finalizasyon ve seri bonusu.
- ✅ Cüzdan başına ilk uygun fişte ERC-721 badge.
- ✅ All-time ve haftalık leaderboard verisi.
- ✅ En fazla 100 kullanıcıya XP payı oranında USDC dağıtımı.

### OCR, API ve production güvenliği

- ✅ Geçersiz, boş, aşırı büyük ve düşük güvenli OCR girdileri reddediliyor.
- ✅ OCR satırları NFKC, whitespace ve locale-aware lowercase ile normalize edilip `keccak256` hash’e çevriliyor.
- ✅ Hash analiz yanıtından istemciye, typed-data’ya ve sözleşme çağrısına aynı değer olarak taşınıyor.
- ✅ Production’da eksik OCR/RPC/signer yapılandırmasının örtük mock başarıya düşmesi engellendi.
- ✅ Mock davranışı yalnız non-production ortamda açık bayrakla kullanılabiliyor.
- ✅ Exact-origin CORS ve production config doğrulaması eklendi.
- ✅ Cron secret zorunlu, timing-safe karşılaştırılıyor ve üst üste çalışma engelleniyor.
- ✅ Internal node-cron Vercel dışında yalnız açık `ENABLE_INTERNAL_CRON` bayrağıyla çalışıyor.
- ✅ Haftalık finalize/dağıtım hataları artık başarılı sonuç olarak yutulmuyor.

### Frontend

- ✅ Ana sayfa ve CTA dili “kripto kazan” yerine sağlık analizi ve fiş doğrulama odağına taşındı.
- ✅ “Shop” navigasyonu “Verify / Verify Receipt” olarak yeniden adlandırıldı.
- ✅ Mobil “Scan or Upload Receipt” CTA’sı belirginleştirildi.
- ✅ Sonuç ekranında olumlu sepet gözlemi, tek uygulanabilir iyileştirme önerisi ve “tıbbi tavsiye değildir” notu eklendi.
- ✅ Base ve Farcaster istemcilerinde `receiptHash` typed-data/ABI/işlem sırası eşitlendi.

## Kısmi ve riskli alanlar

| Alan | Durum | Eksik doğrulama / eylem |
|---|---|---|
| Aktif PAID fazı | 🔴 | Mainnet proxy’den `currentPhase`, `FEE`, `usdc`, `paused` okunmalı; hukuk ve güvenlik go/no-go kaydı olmadan açılmamalı. |
| Mainnet V3 upgrade | 🔴 | Proxy implementation slotu, initializer sürümü, storage layout ve `FEE=500000` zincir üstünde doğrulanmalı. |
| Basescan verification | 🟡 | Proxy ve implementation doğrulama bağlantıları release kaydına eklenmeli. |
| Haftalık cron | 🟡 | Son başarı, tx hash, retry ve alarm dashboard’u kurulmalı. |
| Open Food Facts | 🟡 | Production env, timeout/cache/fallback ve sınıflandırma doğruluk metriği doğrulanmalı. |
| İstemci eşitliği | 🟡 | Kamera, galeri, EOA/cüzdan, FREE/PAID, hata ve sonuç için ortak E2E paketi eklenmeli. |
| PAID onay UX’i | 🔴 | Ücret, USDC bakiye, allowance, approve, bölüşüm ve iptal açıkça gösterilmeli. |
| Veri saklama | 🔴 | Görsel/OCR/log/yedek/üçüncü taraf saklama süresi ve silme testi yok. |
| Bağımsız audit | ⬜ | Upgrade, EIP-712, ücret ve dağıtım akışını kapsayan inceleme yapılmalı. |
| Test kilitleri | 🔴 | Hardhat `cache/validations.json.lock` Windows `EPERM` sorunu temiz CI’da çözülmeli. |

## Whitepaper–uygulama farkları

| Whitepaper hedefi | Durum | Fark / sonraki eylem |
|---|---|---|
| Sağlık kanıtı birincil değer önerisi | ✅ | Ana metin ve CTA’lar bu yönde güncellendi; kullanıcı testiyle doğrulanmalı. |
| İki istemci aynı kontrat/protokol | 🟡 | Adres, ABI ve hash sırası hizalı; otomatik drift/E2E testi eksik. |
| Normalize `receiptHash` ve tek kullanım | ✅ | Backend–frontend–contract hattında uygulandı; deployment sonrası zincir E2E kanıtı gerekli. |
| Validator-attested fiş/check-in | ✅ | EIP-712, nonce ve deadline mevcut. |
| Şeffaf FREE/PAID geçişi | 🟡 | Faz ve ücret kodu var; kullanıcı onay ekranı ve zincir durum doğrulaması eksik. |
| Dinamik 0.50 USDC | 🟡 | Kodda tamam; mainnet V3 initializer doğrulanmalı. |
| Haftalık orantılı ödül | 🟡 | Kod mevcut; gerçek cron/snapshot/rounding/retry operasyonu kanıtlanmalı. |
| Ham fiş zincire yazılmaz | ✅ | Yalnız özet ve hash zincire gider. |
| Gizlilik/veri saklama politikası | ⬜ | KVKK/GDPR, TTL, log redaction ve silme garantisi hazırlanmalı. |
| Multisig/timelock | ⬜ | Merkezi validator yönetiminden kontrollü yönetişime geçiş tasarlanmalı. |

## Planlanan ürün hedefleri

| Hedef | Durum | İlk adım |
|---|---|---|
| Çok boyutlu final skor ve tutarlılık metriği | ⬜ | Sürümlü formül, ağırlık, açıklanabilirlik ve geriye dönük etki spesifikasyonu. |
| Badge sahiplerine günlük sign havuzu | ⬜ | Fon kaynağı, claim, bütçe, sybil ve hukuk modeli. |
| Haftalık quest | ⬜ | Quest şeması, süre, kanıt, admin ve ödül modeli. |
| Streak mystery box | ⬜ | Rastgelelik, odds, bütçe ve gambling/consumer-law incelemesi. |
| Görsel ilerleme sistemi | ⬜ | Ödülden bağımsız sağlık alışkanlığı prototipi. |
| Founder NFT | ⬜ | Arz, fayda, mint, metadata ve hukuk sınırları. |
| Sponsorlu görevler | ⬜ | Sponsor uygunluk/reklam politikası ve görev kanıtı. |
| Premium üyelik | ⬜ | Pay-to-win olmayan sağlık içgörüsü paketi. |
| Marketplace | ⬜ | Ayrı ürün kapsamı, satıcı, komisyon, iade ve tüketici süreci. |
| Gizlilik/KVKK/GDPR ve ham fiş silme garantisi | ⬜ | Veri envanteri, hukuki dayanak, TTL ve otomatik silme testi. |
| Uzun vadeli token geçişi | ⬜ | Gereklilik, utility, hukuk ve USDC’den geri uyumlu geçiş araştırması. |

## Önceliklendirilmiş yol haritası

### P0 — Üretim güvenliği

| Görev | Amaç | Bağımlılık | Kabul kriteri | Katman |
|---|---|---|---|---|
| Mainnet V3 doğrulama | Canlı sürümü kanıtlamak | Validator/RPC | Implementation, initializer, fee, USDC, faz ve pause kayıtlı; Basescan verified. | contract, operations |
| Tek deployment manifesti | ABI/adres drift’ini önlemek | Mainnet proxy kararı | Backend ve iki frontend build-time aynı chain/address/ABI sürümünü doğrular. | contract, backend, frontend |
| Clean CI | Release güveni | EPERM kilidinin çözümü | Contract test, backend typecheck/test ve iki frontend build temiz checkout’ta geçer. | tüm teknik katmanlar |
| Veri saklama denetimi | Kişisel veriyi minimize etmek | Altyapı envanteri | Her alanın konum/amaç/süre/silme sahibi belgeli ve TTL testi başarılı. | backend, operations/legal |
| PAID güvenlik kapısı | Yanlış ekonomik geçişi önlemek | Audit, V3 | İmzalı go/no-go; allowance, hata, pause ve incident senaryoları testli. | contract, frontend, operations/legal |

### P1 — Kullanıcı güveni ve ürün

| Görev | Amaç | Bağımlılık | Kabul kriteri | Katman |
|---|---|---|---|---|
| PAID onay deneyimi | Maliyeti açık göstermek | P0 | Faz, ücret, bakiye, allowance, approve, iptal ve bölüşüm iki istemcide testli. | frontend, contract |
| Ağırlıklı final skor | Dengeli davranış ölçümü | Veri analizi | Formül, sınır testleri, açıklama ve versiyonlama onaylı. | contract, backend, frontend |
| Gizlilik politikası | Şeffaf veri yönetimi | P0 veri denetimi | Yayınlanmış KVKK/GDPR metni, süreler ve silme kanalı mevcut. | operations/legal, frontend |
| Ortak E2E matrisi | İstemci eşitliği | Deployment manifesti | FREE/PAID, kamera/galeri, imza, hata ve sonuç iki istemcide geçer. | frontend, backend |

### P2 — Katılım ve anti-sybil

| Görev | Amaç | Bağımlılık | Kabul kriteri | Katman |
|---|---|---|---|---|
| Quest sistemi | Sağlıklı davranış hedefi | Final skor | Oluşturma, süre, kanıt ve ödül E2E testli. | contract, backend, frontend |
| Badge sign havuzu | Kontrollü katılım ödülü | PAID verisi/hukuk | Claim idempotent; bütçe ve sybil koruması ölçümlü. | contract, backend, legal |
| Mystery box | Seri motivasyonu | Quest/hukuk | Odds açık, rastgelelik doğrulanabilir, bütçe sınırlı. | contract, backend, frontend |
| Analitik/anti-sybil | Kötüye kullanımı azaltmak | Gizlilik event planı | Duplicate ve risk sinyalleri, rate limit ve inceleme prosedürü mevcut. | backend, operations/legal |

### P3 — Gelir ve uzun vadeli ekonomi

| Görev | Amaç | Bağımlılık | Kabul kriteri | Katman |
|---|---|---|---|---|
| Premium/Founder NFT | Ödül havuzu dışı gelir/topluluk | Kullanıcı/hukuk araştırması | Fayda açık, getiri vaadi yok, iptal veya mint kuralları testli. | contract, frontend, legal |
| Sponsorlu görev/marketplace | Gelir çeşitlendirme | Quest/satıcı süreçleri | Reklam etiketi, uygunluk, komisyon, iade ve ölçüm denetlenebilir. | backend, frontend, legal |
| Token araştırması | Merkeziyetsizlik ihtiyacını ölçmek | PMF ve hukuk | Tokensız alternatiflerle karşılaştırma ve onaylı ekonomi/risk raporu. | contract, operations/legal |

## Doğrulama kaydı

- ✅ Backend server TypeScript typecheck başarılı.
- ✅ Base ve Farcaster production build’leri Google Fonts ağına bağlı olmadan başarılı.
- ✅ Next.js TypeScript build worker’ı Windows `spawn EPERM` hatasını önlemek için worker threads ile çalışıyor.
- ✅ `npm run export-abi` Hardhat/tsx worker’larına bağlı olmadan üç ABI hedefini güncelliyor.
- ✅ `git diff --check` temizlenmiştir.
- ✅ Hardhat compile başarılı; contract test suite 28 test ile başarılı.
- ✅ `receiptHash` entegrasyonu sonrası Base production build ve Farcaster `tsc --noEmit --incremental false` doğrulaması başarılıdır.

## PAID go/no-go kontrolü

- [ ] Tek doğrulanmış mainnet proxy ve ABI manifesti.
- [ ] V3 implementation, initializer, `FEE`, Base USDC, faz ve pause zincir üstünde doğrulandı.
- [ ] Bağımsız audit kritik/yüksek bulguları kapalı.
- [ ] Contract/backend/iki frontend temiz CI tamamen yeşil.
- [ ] PAID allowance/bakiye/açık onay/iptal UX’i iki istemcide geçiyor.
- [ ] Cron retry, alarm, relayer bakiye ve dağıtım runbook’u çalışıyor.
- [ ] Ham fiş/OCR saklama ve silme kontrolleri teknik olarak doğrulandı.
- [ ] KVKK/GDPR ile USDC ödül modelinin hukuk/vergisel değerlendirmesi tamam.
- [ ] Pilot bütçesi, kullanıcı limiti, pause ve incident sahipleri belirlendi.

Bu maddeler tamamlanmadan PAID pilotu için karar **NO-GO** olarak kalmalıdır.
