import axios from "axios";

const OFF_API = "https://world.openfoodfacts.org/api/v2/product";
const OFF_SEARCH = "https://world.openfoodfacts.org/api/v2/search";

export interface ClassificationResult {
  name: string;
  category: "healthy" | "unhealthy" | "neutral";
  nutriscore?: string;
  fruitVegGrams: number;
  confidence: number;
}

export interface FoodClassification {
  totalItems: number;
  healthyItems: number;
  unhealthyItems: number;
  fruitVegGrams: number;
  products: ClassificationResult[];
}

// Keywords for quick classification without API
const HEALTHY_KEYWORDS = [
  "organic", "vegetable", "fruit", "salad", "spinach", "broccoli", "carrot",
  "apple", "banana", "orange", "berry", "tomato", "lettuce", "kale",
  "chicken breast", "fish", "salmon", "turkey", "egg", "yogurt", "oat",
  "brown rice", "quinoa", "beans", "lentil", "almond", "walnut", "avocado",
  "olive oil", "coconut water", "green tea", "water", "milk",
];

const UNHEALTHY_KEYWORDS = [
  "soda", "cola", "chips", "cookie", "candy", "chocolate", "cake",
  "donut", "ice cream", "frozen pizza", "hot dog", "bacon", "sausage",
  "fried", "fast food", "burger", "pizza", "energy drink", "alcohol",
  "beer", "wine", "cigarette", "vape", "sugar", "corn syrup",
];

const FRUIT_VEG_KEYWORDS: Record<string, number> = {
  "banana": 120, "apple": 180, "orange": 200, "avocado": 150,
  "tomato": 100, "broccoli": 150, "carrot": 60, "spinach": 30,
  "lettuce": 50, "cucumber": 100, "pepper": 100, "onion": 80,
  "garlic": 10, "potato": 150, "sweet potato": 130, "berries": 100,
  "strawberry": 20, "blueberry": 5, "grape": 5, "watermelon": 300,
  "mango": 200, "pineapple": 200, "lemon": 50, "lime": 40,
  "peach": 150, "pear": 180, "plum": 60, "kiwi": 70,
};

/**
 * Classify food items from receipt lines
 */
export async function classifyFoods(lines: string[]): Promise<FoodClassification> {
  const products: ClassificationResult[] = [];
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
    } else if (classification.category === "unhealthy") {
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
function extractProductLines(lines: string[]): string[] {
  const products: string[] = [];
  const pricePattern = /\$?\d+\.?\d{0,2}$/;

  for (const line of lines) {
    // Skip header/footer lines
    if (line.match(/^(TOTAL|SUBTOTAL|TAX|DATE|STORE|CASHIER|CHANGE)/i)) {
      continue;
    }

    // Skip very short lines
    if (line.trim().length < 3) {
      continue;
    }

    // Remove price from end
    const cleaned = line.replace(pricePattern, "").trim();

    // Skip if it looks like a number or date
    if (cleaned.match(/^[\d\/\-:]+$/)) {
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
async function classifyProduct(productName: string): Promise<ClassificationResult> {
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
    } catch (error) {
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
async function queryOpenFoodFacts(productName: string): Promise<ClassificationResult | null> {
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
    let category: "healthy" | "unhealthy" | "neutral" = "neutral";
    if (nutriscore === "A" || nutriscore === "B") {
      category = "healthy";
    } else if (nutriscore === "D" || nutriscore === "E") {
      category = "unhealthy";
    }

    return {
      name: productName,
      category,
      nutriscore,
      fruitVegGrams: Math.round(fruitVeg),
      confidence: 0.9,
    };
  } catch (error) {
    return null;
  }
}
