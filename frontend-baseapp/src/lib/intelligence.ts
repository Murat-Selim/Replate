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

export async function unlockAdvancedIntelligence(
    walletClient: WalletClient,
    input: { receiptId: string; receiptHash: string; userAddress: string },
): Promise<AdvancedReport> {
    if (!walletClient.account) throw new Error("Connect your wallet before unlocking Advanced Intelligence");

    const signer: ClientEvmSigner = {
        address: walletClient.account.address,
        signTypedData: (message) => walletClient.signTypedData({ ...message, account: walletClient.account } as never),
    };
    const httpClient = new x402HTTPClient(
        new x402Client().register("eip155:8453", new ExactEvmScheme(signer)),
    );
    const url = getApiUrl("/api/intelligence/advanced");
    const body = JSON.stringify(input);
    const unpaid = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body });
    const unpaidBody = await unpaid.json().catch(() => ({}));
    if (unpaid.status !== 402) throw new Error(unpaidBody.error || "Advanced Intelligence is unavailable");

    const paymentRequired = httpClient.getPaymentRequiredResponse(
        (name) => unpaid.headers.get(name),
        unpaidBody,
    );
    const paymentPayload = await httpClient.createPaymentPayload(paymentRequired);
    const paid = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...httpClient.encodePaymentSignatureHeader(paymentPayload) },
        body,
    });
    const paidBody = await paid.json().catch(() => ({}));
    if (!paid.ok || !paidBody.success || !paidBody.report) {
        throw new Error(paidBody.error || "Advanced Intelligence payment failed");
    }
    return paidBody.report as AdvancedReport;
}
