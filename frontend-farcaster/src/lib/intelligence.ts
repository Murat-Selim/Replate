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

export interface IntelligenceBundle {
    receiptId: string;
    basket?: { basketScore: number; basketDiversity: number; healthyItemRatio: number; fruitVegRatio: number; categories: Record<string, number> };
    price?: { items: { canonicalProductId: string | null; itemName: string; paidPrice: number | null; marketAverage: number | null; priceScore: number | null; dealScore: number | null; sampleSize: number; confidence: number }[] };
    recommendations?: { type: string; priority: string; message: string }[];
    behavior?: { purchaseFrequency: Record<string, number>; topCategories: string[]; basketTrend: string; repeatPurchaseRatio: number };
    productPrices?: { canonicalProductId: string; averagePrice: number; minPrice: number; maxPrice: number; priceMomentum30d: number; sampleSize: number; confidence: number }[];
}

export interface BasketIntelligence {
    receiptId: string;
    basketScore: number;
    basketDiversity: number;
    healthyItemRatio: number;
    fruitVegRatio: number;
    categories: Record<string, number>;
}

export interface ReceiptPriceAnalysis {
    receiptId: string;
    items: { canonicalProductId: string | null; itemName: string; paidPrice: number | null; marketAverage: number | null; priceScore: number | null; dealScore: number | null; sampleSize: number; confidence: number }[];
}

export interface BehaviorIntelligence {
    purchaseFrequency: Record<string, number>;
    topCategories: string[];
    basketTrend: string;
    repeatPurchaseRatio: number;
}

export interface ProductPriceIntelligence {
    canonicalProductId: string;
    averagePrice: number;
    minPrice: number;
    maxPrice: number;
    priceMomentum30d: number;
    sampleSize: number;
    confidence: number;
}

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
    const unpaid = await fetch(url, init);
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
    if (!paid.ok || !paidBody.success) throw new Error(paidBody.error || "Replate Intelligence payment failed");
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

export async function unlockIntelligenceBundle(
    walletClient: WalletClient,
    input: { receiptId: string },
): Promise<IntelligenceBundle> {
    return requestPaidJson<IntelligenceBundle>(walletClient, "/api/intelligence/bundle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, include: ["basket", "price", "recommendation", "behavior", "productPrice"] }),
    });
}

export function fetchBasketIntelligence(walletClient: WalletClient, receiptId: string) {
    return requestPaidJson<{ success: true } & BasketIntelligence>(walletClient, `/api/intelligence/basket/${receiptId}`);
}

export function fetchReceiptPriceIntelligence(walletClient: WalletClient, receiptId: string) {
    return requestPaidJson<{ success: true } & ReceiptPriceAnalysis>(walletClient, `/api/intelligence/price/receipt/${receiptId}`);
}

export function fetchBehaviorIntelligence(walletClient: WalletClient) {
    return requestPaidJson<{ success: true } & BehaviorIntelligence>(walletClient, "/api/intelligence/behavior/me");
}

export function fetchRecommendationIntelligence(walletClient: WalletClient, receiptId: string) {
    return requestPaidJson<{ success: true; receiptId: string; recommendations: { type: string; priority: string; message: string }[] }>(walletClient, `/api/intelligence/recommendation/${receiptId}`);
}

export function fetchProductPriceIntelligence(walletClient: WalletClient, canonicalProductId: string) {
    return requestPaidJson<{ success: true } & ProductPriceIntelligence>(walletClient, `/api/intelligence/price/product/${canonicalProductId}`);
}
