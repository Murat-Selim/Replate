/**
 * Quick test: Simulate OCR output from the Turkish receipt photo
 * and run it through the classifier to verify correctness.
 */

// Simulated OCR lines from the receipt photo
const RECEIPT_LINES = [
  "BELGE",
  "ETTN:2b67893b4374d0db3fd9e1948baaed6",
  "SEKER TOZ 2000 G PETEK %01 *87,50",
  "MEZE CIKOFTE 384 G COKCA %01 *32,50",
  "YUMURTA 15LI L 63-72 G %01 *99,00",
  "MARGARIN PAKET 250 G VERA %01 *23,00",
  "PORTAKAL 500 G CAYKUR %01 *45,54",
  "CAY TURKAK 1 L BIRSAN %01 *149,95",
  "SUT YAGLI 1 L BIRSAN %01 *46,00",
  "MAYDANOZ %01 *29,50",
  "BIBER CARLISTON PAKET (300G) %01 *54,50",
  "DOMATES x119,50 TL/kg %01 *51,39",
  "0.430",
  "LIMON %01 *14,43",
  "0.145",
  "BUTUN TAVUK POSETLI x125,00 TL/kg %01 *233,00",
  "1.864",
  "BAR KAKAO KAPL. YER FISTIKLI %01 *8,00",
  "KAHVE INS. KAU 1 ARADA 18 G CAF %01 *5,50",
  "KAHVE INS. 3U 1 ARADA 17.5 G N %01 *12,25",
  "DURULUK FINDIKLI 1 %01 *5,00",
  "BAR KAKAO LAVAS 200 G NIMET %01 *52,00",
  "KAHVE INS. 3U 1 ARADA YER FISTIKLI 4 %01 *8,50",
  "0.630",
  "MUZ x72,50 TL/kg *54,99",
  "0.755",
  "ARMUT DEVECI x99,50 TL/kg *54,74",
  "SALALIK %01 *73,13",
  "0.475",
  "PATATES x21,50 TL/kg *20,04",
  "0.915",
  "ELMA STARKING x109,50 TL/kg *42,51",
  "4",
  "ELMA GRANNY SMITH x1,00 TL/ad *82,67",
  "ALISVERIS POSETI %20 *4,00",
  "ARA TOPLAM",
];

async function main() {
  // Use dynamic import for ESM compatibility
  const { classifyFoods } = await import("../server/services/classifier.js");

  console.log("=== Testing classifier with Turkish receipt ===\n");

  const result = await classifyFoods(RECEIPT_LINES);

  console.log("\n=== RESULTS ===");
  console.log(`Total items: ${result.totalItems}`);
  console.log(`Healthy: ${result.healthyItems}`);
  console.log(`Unhealthy: ${result.unhealthyItems}`);
  console.log(`Neutral: ${result.totalItems - result.healthyItems - result.unhealthyItems}`);
  console.log(`Fruit/Veg grams: ${result.fruitVegGrams}`);
  console.log("\n--- Product Details ---");
  for (const p of result.products) {
    const emoji = p.category === "healthy" ? "✅" : p.category === "unhealthy" ? "❌" : "⚪";
    console.log(`${emoji} ${p.name} → ${p.category} (${p.fruitVegGrams}g)`);
  }

  // Expected classification for the receipt items:
  console.log("\n=== EXPECTED ===");
  console.log("SEKER TOZ → unhealthy ❌");
  console.log("MEZE CIKOFTE → neutral/unhealthy");
  console.log("YUMURTA → healthy ✅");
  console.log("MARGARIN → unhealthy ❌");
  console.log("PORTAKAL → healthy ✅ (fruit)");
  console.log("CAY → healthy ✅");
  console.log("SUT YAGLI → healthy ✅");
  console.log("MAYDANOZ → healthy ✅ (veg)");
  console.log("BIBER CARLISTON → healthy ✅ (veg)");
  console.log("DOMATES → healthy ✅ (veg)");
  console.log("LIMON → healthy ✅ (fruit)");
  console.log("BUTUN TAVUK → healthy ✅");
  console.log("BAR KAKAO YER FISTIKLI → unhealthy ❌");
  console.log("KAHVE INS 1 ARADA → unhealthy ❌");
  console.log("KAHVE INS 3U 1 ARADA → unhealthy ❌");
  console.log("DURULUK FINDIKLI → neutral/healthy");
  console.log("BAR KAKAO LAVAS → unhealthy ❌");
  console.log("KAHVE INS FISTIKLI → unhealthy ❌");
  console.log("MUZ → healthy ✅ (fruit)");
  console.log("ARMUT DEVECI → healthy ✅ (fruit)");
  console.log("SALALIK → healthy ✅ (veg)");
  console.log("PATATES → healthy ✅ (veg)");
  console.log("ELMA STARKING → healthy ✅ (fruit)");
  console.log("ELMA GRANNY SMITH → healthy ✅ (fruit)");
}

main().catch(console.error);
