import { x402Client } from "@x402/core/client";
import { x402HTTPClient } from "@x402/core/http";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import type { ClientEvmSigner } from "@x402/evm";
import type { WalletClient } from "viem";
import { getApiUrl } from "@/lib/api";

export interface AdvancedReport {
    healthScore: number;
    nutritionScore: number;
    insights: { message: string }[];
    recommendations: { message: string }[];
}

export interface MealAnalysis {
    detectedLabels: { label: string; confidence: number }[];
    components: string[];
    balanceScore: number;
    confidence: number;
    insight: string;
    recommendation: string;
}

export interface BehaviorIntelligence {
    purchaseFrequency: Record<string, number>;
    topCategories: string[];
    basketTrend: string;
    repeatPurchaseRatio: number;
}

export interface ReceiptProductPrice {
    id: string;
    name: string;
    canonicalProductId: string | null;
    category: string;
    quantity: number;
    currencyCode: string | null;
    paidPrice: number | null;
    unitPrice: number | null;
    priceUnit: string;
}

export interface ReceiptProductPrices {
    receiptId: string;
    currencyCode: string | null;
    products: ReceiptProductPrice[];
}

export interface SpendingBreakdown {
    currencies: { currencyCode: string | null; totalSpent: number; averageReceiptSpend: number; receiptCount: number; exactReceiptCount: number; lineItemEstimateCount: number; foodSpend: number; householdSpend: number; categories: { category: string; amount: number; share: number; recentAmount: number; previousAmount: number; shareChange: number | null }[]; last30Days: { spent: number; previous30Days: number; change: number | null } }[];
}

export interface ReceiptSpendingBreakdown {
    receiptId: string;
    currencyCode: string | null;
    receiptTotal: number | null;
    pricedItemsTotal: number;
    pricedItemCount: number;
    totalLineItemCount: number;
    categories: { category: string; amount: number; share: number; itemCount: number }[];
}

export interface BasketIntelligence { basketScore: number; basketDiversity: number; healthyItemRatio: number; fruitVegRatio: number; categories: Record<string, number> }

async function requestPaidJson<T>(walletClient: WalletClient, path: string, init: RequestInit = {}): Promise<T> {
    if (!walletClient.account) throw new Error("Connect your wallet before unlocking Replate Intelligence");
    const signer: ClientEvmSigner = {
        address: walletClient.account.address,
        signTypedData: (message) => walletClient.signTypedData({ ...message, account: walletClient.account } as never),
    };
    const httpClient = new x402HTTPClient(
        new x402Client().register("eip155:8453", new ExactEvmScheme(signer)),
    );
    const url = getApiUrl(path);
    const unpaid = await fetch(url, { ...init, body: undefined });
    const unpaidBody = await unpaid.json().catch(() => ({}));
    if (unpaid.status !== 402) throw new Error(unpaidBody.error || "Replate Intelligence is unavailable");
    const paymentRequired = httpClient.getPaymentRequiredResponse(
        (name) => unpaid.headers.get(name),
        unpaidBody,
    );
    const paymentPayload = await httpClient.createPaymentPayload(paymentRequired);
    const paid = await fetch(url, {
        ...init,
        headers: { ...(init.headers || {}), ...httpClient.encodePaymentSignatureHeader(paymentPayload) },
    });
    const paidBody = await paid.json().catch(() => ({}));
    if (!paid.ok || !paidBody.success) throw new Error(paidBody.error || paidBody.errorMessage || "Replate Intelligence payment failed");
    return paidBody as T;
}

export async function unlockAdvancedIntelligence(
    walletClient: WalletClient,
    input: { receiptId: string; receiptHash: string; userAddress: string },
): Promise<AdvancedReport> {
    const response = await requestPaidJson<{ report: AdvancedReport }>(walletClient, "/api/intelligence/advanced", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    return response.report;
}

export function requestMealAnalysis(walletClient: WalletClient, imageBase64: string) {
    return requestPaidJson<{ success: true; data: MealAnalysis }>(walletClient, "/api/analyze-meal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64 }),
    }).then((response) => response.data);
}

export function fetchBehaviorIntelligence(walletClient: WalletClient) {
    return requestPaidJson<{ success: true } & BehaviorIntelligence>(walletClient, "/api/intelligence/behavior/me");
}

export function fetchReceiptProductPrices(walletClient: WalletClient, receiptId: string) {
    return requestPaidJson<{ success: true } & ReceiptProductPrices>(walletClient, `/api/intelligence/price/receipt/${receiptId}`);
}

export function fetchSpendingBreakdown(walletClient: WalletClient) {
    return requestPaidJson<{ success: true } & SpendingBreakdown>(walletClient, "/api/intelligence/spending/me");
}

export function fetchReceiptSpendingBreakdown(walletClient: WalletClient, receiptId: string) {
    return requestPaidJson<{ success: true } & ReceiptSpendingBreakdown>(walletClient, `/api/intelligence/spending/receipt/${receiptId}`);
}

export function fetchBasketIntelligence(walletClient: WalletClient, receiptId: string) {
    return requestPaidJson<{ success: true } & BasketIntelligence>(walletClient, `/api/intelligence/basket/${receiptId}`);
}
