import axios from "axios";
const OFF_API = "https://world.openfoodfacts.org/api/v2/product";
const OFF_SEARCH = "https://world.openfoodfacts.org/api/v2/search";
// Keywords for quick classification without API
const HEALTHY_KEYWORDS = [
    "organic", "vegetable", "fruit", "salad", "spinach", "broccoli", "carrot",
    "apple", "banana", "orange", "berry", "tomato", "lettuce", "kale",
    "chicken breast", "fish", "salmon", "turkey", "egg", "yogurt", "oat",
    "brown rice", "quinoa", "beans", "lentil", "almond", "walnut", "avocado",
    "olive oil", "green tea", "water", "milk",
    // Turkish Keywords
    "tavuk", "balik", "ton", "sut", "yumurta", "yogurt", "mercimek", "nohut", "fasulye",
    "bulgur", "yulaf", "zeytinyagi", "su", "meyve", "sebze", "ispanak", "elma", "muz",
    "domates", "salatalik", "havuc", "marul", "kuruyemis", "ceviz", "findik", "badem",
    "tam bugday", "siyez", "ekmek", "lor", "peynir", "salata", "pirinc", "bulgur",
];
const UNHEALTHY_KEYWORDS = [
    "soda", "cola", "chips", "cookie", "candy", "chocolate", "cake",
    "donut", "ice cream", "frozen pizza", "hot dog", "bacon", "sausage",
    "fried", "fast food", "burger", "pizza", "energy drink", "alcohol",
    "sugar", "corn syrup",
    // Turkish Keywords
    "seker", "cikolata", "ips", "biskuvi", "kek", "pasta", "borek", "pogaca", "cips",
    "goofret", "kolat", "gazoz", "enerji icecegi", "salam", "sosis", "sucuk", "pastirma",
    "ketcap", "mayonez", "recel", "bal", "un", "margarin", "kizartma", "hazir",
];
const FRUIT_VEG_KEYWORDS = {
    "banana": 120, "apple": 180, "orange": 200, "avocado": 150,
    "tomato": 100, "broccoli": 150, "carrot": 60, "spinach": 30,
    "muz": 120, "elma": 180, "portakal": 200, "avokado": 150,
    "domates": 100, "brokoli": 150, "havuc": 60, "ispanak": 30,
    "salatalik": 100, "biber": 100, "sogan": 80, "patates": 150,
};
/**
 * Classify food items from receipt lines
 */
export async function classifyFoods(lines) {
    const products = [];
    let healthyItems = 0;
    let unhealthyItems = 0;
    let fruitVegGrams = 0;
    // Extract potential product lines
    const productLines = extractProductLines(lines);
    for (const line of productLines) {
        const classification = await classifyProduct(line);
        products.push(classification);
        if (classification.category === "healthy") {
            healthyItems++;
        }
        else if (classification.category === "unhealthy") {
            unhealthyItems++;
        }
        fruitVegGrams += classification.fruitVegGrams;
    }
    return {
        totalItems: productLines.length,
        healthyItems,
        unhealthyItems,
        fruitVegGrams,
        products,
    };
}
/**
 * Extract product lines from receipt text
 */
function extractProductLines(lines) {
    const products = [];
    // Price pattern: optional currency symbols, stars, then digits with dot or comma
    const pricePattern = /[\*]?\d+[\.,]\d{2}$/;
    for (const line of lines) {
        const trimmed = line.trim();
        // Skip header/footer lines (Turkish support)
        if (trimmed.match(/^(TOTAL|SUBTOTAL|TAX|DATE|STORE|CASHIER|CHANGE|TOPLAM|KDV|FIŞ|SAAT|TARIH|ARA)/i)) {
            continue;
        }
        // Skip very short lines
        if (trimmed.length < 3) {
            continue;
        }
        // Clean up KDV markers like %01, %08, %18
        let cleaned = trimmed.replace(/%\d{2}/g, "").trim();
        // Remove price from end if exists
        if (pricePattern.test(cleaned)) {
            cleaned = cleaned.replace(pricePattern, "").trim();
        }
        // Skip if it looks like a number, date or weight info (x 8,95)
        if (cleaned.match(/^[\d\/\-:,x ]+$/)) {
            continue;
        }
        if (cleaned.length > 2) {
            products.push(cleaned);
        }
    }
    return products;
}
/**
 * Classify a single product
 */
async function classifyProduct(productName) {
    const normalized = productName.toLowerCase();
    // Check fruit/veg grams first
    let fruitVegGrams = 0;
    for (const [keyword, grams] of Object.entries(FRUIT_VEG_KEYWORDS)) {
        if (normalized.includes(keyword)) {
            fruitVegGrams += grams;
        }
    }
    // Quick keyword classification
    const isHealthy = HEALTHY_KEYWORDS.some(kw => normalized.includes(kw));
    const isUnhealthy = UNHEALTHY_KEYWORDS.some(kw => normalized.includes(kw));
    if (isHealthy && !isUnhealthy) {
        return {
            name: productName,
            category: "healthy",
            fruitVegGrams,
            confidence: 0.85,
        };
    }
    if (isUnhealthy && !isHealthy) {
        return {
            name: productName,
            category: "unhealthy",
            fruitVegGrams: 0,
            confidence: 0.85,
        };
    }
    // Try Open Food Facts API for ambiguous items
    if (process.env.USE_OFF_API === "true") {
        try {
            const offResult = await queryOpenFoodFacts(productName);
            if (offResult) {
                return offResult;
            }
        }
        catch (error) {
            console.warn("OFF API failed, using fallback:", error);
        }
    }
    // Default to neutral
    return {
        name: productName,
        category: "neutral",
        fruitVegGrams,
        confidence: 0.5,
    };
}
/**
 * Query Open Food Facts API
 */
async function queryOpenFoodFacts(productName) {
    try {
        const response = await axios.get(OFF_SEARCH, {
            params: {
                search_terms: productName,
                fields: "product_name,nutriscore_grade,fruits_vegetables_nuts_100g",
                page_size: 1,
                json: 1,
            },
            timeout: 3000,
        });
        const products = response.data?.products;
        if (!products || products.length === 0) {
            return null;
        }
        const product = products[0];
        const nutriscore = product.nutriscore_grade?.toUpperCase();
        const fruitVeg = product.fruits_vegetables_nuts_100g || 0;
        // Nutriscore: A/B = healthy, D/E = unhealthy, C = neutral
        let category = "neutral";
        if (nutriscore === "A" || nutriscore === "B") {
            category = "healthy";
        }
        else if (nutriscore === "D" || nutriscore === "E") {
            category = "unhealthy";
        }
        return {
            name: productName,
            category,
            nutriscore,
            fruitVegGrams: Math.round(fruitVeg),
            confidence: 0.9,
        };
    }
    catch (error) {
        return null;
    }
}
