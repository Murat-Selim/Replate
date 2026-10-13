import type { FoodClassification } from "./classifier.js";
import { productSpendingCategory } from "./spending-categories.js";

export type ReceiptTotalSource = "receipt_total" | "line_items" | null;

export interface ReceiptMetadata {
  storeName: string | null;
  currencyCode: string | null;
  totalSpent: number | null;
  totalSpentSource: ReceiptTotalSource;
  /** Printed subtotal, only when separately printed tax reconciles it to the final total. */
  expectedItemsTotal?: number | null;
}

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
  method: "model-schema";
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
  if (products.some((product) => productSpendingCategory(product) === "other")) {
    issues.push("Some product categories could not be identified");
  }
  return issues;
}

export function assertReliableReceiptAnalysis(analysis: ReceiptAnalysis): void {
  const issues = analysisIssues(analysis);
  if (issues.length) throw new ReceiptAnalysisError(issues);
}
