import { classifyFoods, normalizeProductText, type FoodClassification } from "./classifier.js";
import { extractReceiptMetadata, type ReceiptMetadata } from "./receipt-metadata.js";
import type { OCRResult } from "./ocr.js";
import { getSpendingCategory } from "./spending-categories.js";

export class ReceiptAnalysisError extends Error {
  readonly code = "RECEIPT_ANALYSIS_UNRELIABLE";

  constructor(public readonly issues: string[]) {
    super(`Receipt could not be read reliably after automatic recovery: ${issues.join("; ")}. No verification or payment was submitted. Try a sharper, full receipt photo.`);
    this.name = "ReceiptAnalysisError";
  }
}

export interface ReceiptAnalysis {
  classification: FoodClassification;
  metadata: ReceiptMetadata;
  method: "vision-layout" | "vision-text" | "image-recovery";
}

/** Use cents: a percentage tolerance silently accepts missing low-price products. */
export function receiptPriceIssues(input: {
  totalLineItemCount: number;
  pricedItemCount: number;
  pricedItemsTotal: number;
  receiptTotal: number | null;
  totalSpentSource: ReceiptMetadata["totalSpentSource"];
  expectedItemsTotal?: number | null;
}): string[] {
  const issues: string[] = [];
  if (input.totalLineItemCount < 1 || input.pricedItemCount !== input.totalLineItemCount) issues.push("Some receipt items are missing prices");
  if (input.totalSpentSource !== "receipt_total" || !Number.isFinite(input.receiptTotal) || (input.receiptTotal ?? 0) <= 0) {
    issues.push("The printed receipt total could not be read");
  } else if (input.expectedItemsTotal != null && (!Number.isFinite(input.expectedItemsTotal) || input.expectedItemsTotal < 0 || input.expectedItemsTotal > input.receiptTotal!)) {
    issues.push("The printed receipt subtotal is invalid");
  } else if (!Number.isFinite(input.pricedItemsTotal) || Math.abs(Math.round(input.pricedItemsTotal * 100) - Math.round((input.expectedItemsTotal ?? input.receiptTotal!) * 100)) > 1) {
    issues.push("Recognized item prices do not match the printed receipt total");
  }
  return issues;
}

function analysisIssues(analysis: ReceiptAnalysis): string[] {
  const { products } = analysis.classification;
  const issues = receiptPriceIssues({
    totalLineItemCount: products.length,
    pricedItemCount: products.filter((product) => typeof product.paidPrice === "number" && Number.isFinite(product.paidPrice) && product.paidPrice >= 0).length,
    pricedItemsTotal: products.reduce((sum, product) => sum + (product.paidPrice ?? 0), 0),
    receiptTotal: analysis.metadata.totalSpent,
    totalSpentSource: analysis.metadata.totalSpentSource,
    expectedItemsTotal: analysis.metadata.expectedItemsTotal,
  });
  if (!analysis.metadata.currencyCode) issues.push("The receipt currency could not be identified");
  if (products.some((product) => getSpendingCategory(product.name, product.category === "excluded") === "other")) {
    issues.push("Some product categories could not be identified");
  }
  return issues;
}

/** Recover from Vision paragraph order before using a second image reader. */
export async function analyzeReceipt(
  ocr: OCRResult,
  recoverImage?: () => Promise<ReceiptAnalysis>,
): Promise<ReceiptAnalysis> {
  const candidates: ReceiptAnalysis[] = [];
  const layouts: Array<[ReceiptAnalysis["method"], string[]]> = [["vision-layout", ocr.analysisLines ?? ocr.lines]];
  if (ocr.analysisLines && JSON.stringify(ocr.analysisLines) !== JSON.stringify(ocr.lines)) layouts.push(["vision-text", ocr.lines]);
  for (const [method, lines] of layouts) {
    const classification = await classifyFoods(lines);
    const candidate = { classification, metadata: extractReceiptMetadata(lines, classification.products), method };
    candidates.push(candidate);
  }
  const reliable = candidates.filter((candidate) => analysisIssues(candidate).length === 0);
  const signature = (candidate: ReceiptAnalysis) => JSON.stringify(candidate.classification.products.map((product) => [
    normalizeProductText(product.name), product.paidPrice, product.quantity, product.actualWeightGrams,
  ]));
  const layoutsAgree = reliable.every((candidate) => signature(candidate) === signature(reliable[0]));
  if (reliable.length && layoutsAgree && ocr.confidence >= 0.8) return reliable[0];
  const issues = analysisIssues(candidates[0]);
  if (!layoutsAgree) issues.push("OCR layouts disagree about product-to-price matching");
  if (ocr.confidence < 0.8) issues.push("The image reading confidence is too low");
  if (recoverImage) {
    const recovered = await recoverImage();
    const recoveredIssues = analysisIssues(recovered);
    if (recoveredIssues.length === 0) return recovered;
    throw new ReceiptAnalysisError(recoveredIssues);
  }
  throw new ReceiptAnalysisError(issues);
}
