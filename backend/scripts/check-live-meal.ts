import "dotenv/config";
import { readFileSync } from "node:fs";
import { analyzeMealPhoto } from "../server/services/meal-analysis.js";

// Usage: tsx scripts/check-live-meal.ts <meal-photo.jpg>  (needs OCR_API_KEY; makes one paid model call)
const path = process.argv[2];
if (!path) throw new Error("Pass a meal photo path");
const started = Date.now();
const result = await analyzeMealPhoto(readFileSync(path).toString("base64"));
console.log(JSON.stringify(result, null, 2));
console.log(`took ${((Date.now() - started) / 1000).toFixed(1)}s`);
