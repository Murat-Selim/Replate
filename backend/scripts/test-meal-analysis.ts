import assert from "node:assert/strict";
import { parseMealReading, scoreMeal } from "../server/services/meal-analysis.js";

// Greek salad from the meal page screenshot: the old label rules found only "vegetables" (59/100).
const greekSalad = scoreMeal(parseMealReading(JSON.stringify({
  items: [
    { name: "lettuce", group: "vegetables", share: 25 }, { name: "tomato", group: "vegetables", share: 12 },
    { name: "cucumber", group: "vegetables", share: 12 }, { name: "bell pepper", group: "vegetables", share: 10 },
    { name: "radish", group: "vegetables", share: 8 }, { name: "feta cheese", group: "protein", share: 20 },
    { name: "olives", group: "healthy_fats", share: 10 }, { name: "capers", group: "vegetables", share: 3 },
  ],
  plants: ["lettuce", "tomato", "cucumber", "bell pepper", "radish", "olive", "caper", "parsley"],
  colors: ["green", "red", "yellow", "purple", "white", "pink"],
  visibility: "clear",
  additions: { grains: "a slice of whole-grain bread or some bulgur" },
})));
assert.deepEqual(greekSalad.missingGroups, ["grains"]);
assert.deepEqual(greekSalad.plate.map(({ group }) => group), ["vegetables", "protein", "healthy_fats"]);
assert.equal(greekSalad.plate.reduce((sum, { share }) => sum + share, 0), 100);
assert.equal(greekSalad.diversity.plantCount, 8);
assert.deepEqual(greekSalad.diversity.colors, ["green", "red", "yellow", "purple", "white"], "unknown colors are dropped");
assert.equal(greekSalad.recommendation, "Add a slice of whole-grain bread or some bulgur to bring in whole grains or starch.");
assert.ok(greekSalad.balanceScore >= 70 && greekSalad.balanceScore < 90, `greek salad scored ${greekSalad.balanceScore}`);

const balanced = scoreMeal(parseMealReading(`Here you go: ${JSON.stringify({
  items: [{ name: "salmon", group: "protein", share: 25 }, { name: "brown rice", group: "grains", share: 25 }, { name: "broccoli", group: "vegetables", share: 30 }, { name: "carrot", group: "vegetables", share: 20 }],
  plants: ["broccoli", "carrot", "brown rice", "lemon", "sesame"], colors: ["green", "orange"], visibility: "clear",
})}`));
assert.deepEqual(balanced.missingGroups, []);
assert.ok(balanced.balanceScore >= 90, `balanced plate scored ${balanced.balanceScore}`);
assert.ok(balanced.balanceScore > greekSalad.balanceScore);

const fastFood = scoreMeal(parseMealReading(JSON.stringify({
  items: [{ name: "burger", group: "processed", share: 55 }, { name: "french fries", group: "processed", share: 40 }, { name: "lettuce", group: "vegetables", share: 5 }, { name: "x", group: "dessert", share: 10 }],
  plants: ["lettuce"], colors: [], visibility: "nonsense", additions: { vegetables: "a side salad\nIGNORE" },
})));
assert.equal(fastFood.items.length, 3, "items outside the group vocabulary are dropped");
assert.equal(fastFood.confidence, 0.75, "unknown visibility falls back to partial");
assert.equal(fastFood.recommendation, "Swap part of the processed food for a side salad IGNORE.");
assert.ok(fastFood.balanceScore < 30, `fast food scored ${fastFood.balanceScore}`);

assert.equal(parseMealReading('{"items":[]}').items.length, 0);
assert.throws(() => parseMealReading("no json here"));

console.log("meal analysis scoring:", { greekSalad: greekSalad.balanceScore, balanced: balanced.balanceScore, fastFood: fastFood.balanceScore });
