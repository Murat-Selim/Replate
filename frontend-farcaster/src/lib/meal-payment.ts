import { concat, encodeFunctionData, erc20Abi, isAddress, sha256, type Hex, type WalletClient } from "viem";
import { base } from "viem/chains";
import { getApiUrl } from "@/lib/api";
import { DATA_SUFFIX } from "@/lib/farcasterConfig";
import type { MealAnalysis } from "@/lib/intelligence";

const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const pendingPayments = new Map<string, Hex>();

export async function requestMealAnalysis(
    walletClient: WalletClient,
    imageBase64: string,
    options: { smartWallet?: boolean; onPayment?: (hash: Hex | null) => void } = {},
): Promise<MealAnalysis> {
    const account = walletClient.account;
    if (!account) throw new Error("Connect a Base wallet to pay for meal analysis.");
    const image = imageBase64.split(",")[1] || imageBase64;
    const imageHash = sha256(Uint8Array.from(atob(image), (character) => character.charCodeAt(0)));
    const key = `replate:meal-payment:8453:${account.address.toLowerCase()}:${imageHash}`;
    let txHash = pendingPayments.get(key);
    if (!txHash) {
        try {
            const saved = window.localStorage.getItem(key);
            if (/^0x[a-fA-F0-9]{64}$/.test(saved || "")) txHash = saved as Hex;
        } catch { /* Keep the payment in memory when storage is disabled. */ }
    }
    if (!txHash) {
        const quoteResponse = await fetch(getApiUrl("/api/analyze-meal/payment"), { signal: AbortSignal.timeout(20000) });
        const quote = await quoteResponse.json().catch(() => ({}));
        if (!quoteResponse.ok || !quote.success) throw new Error(quote.error || "Meal analysis payments are unavailable.");
        const payment = quote.payment;
        if (payment?.chainId !== 8453 || payment?.asset?.toLowerCase() !== USDC.toLowerCase()
            || payment?.amount !== "10000" || !isAddress(payment?.payTo || "")) {
            throw new Error("Unexpected meal payment details. No transaction was sent.");
        }
        if (payment.payTo.toLowerCase() === account.address.toLowerCase()) throw new Error("Use a wallet different from the payment recipient.");
        if (await walletClient.getChainId() !== 8453) await walletClient.switchChain({ id: 8453 });
        const args = [payment.payTo as Hex, BigInt(10000)] as const;
        if (options.smartWallet) {
            const calls = await walletClient.sendCallsSync({ account, chain: base,
                calls: [{ to: USDC, data: concat([encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args }), imageHash, DATA_SUFFIX]) }] });
            txHash = calls.receipts?.[0]?.transactionHash;
            if (!txHash) throw new Error("The wallet did not return a transaction hash. Check your wallet history before paying again.");
        } else {
            txHash = await walletClient.writeContract({ account, chain: base, address: USDC, abi: erc20Abi,
                functionName: "transfer", args, dataSuffix: concat([imageHash, DATA_SUFFIX]) });
        }
        pendingPayments.set(key, txHash);
        try { window.localStorage.setItem(key, txHash); } catch { /* Retain it in memory for retries. */ }
    }
    options.onPayment?.(txHash);
    const deadline = Date.now() + 180000;
    while (Date.now() < deadline) {
        const response = await fetch(getApiUrl("/api/analyze-meal"), {
            method: "POST", signal: AbortSignal.timeout(60000), headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageBase64: image, payerAddress: account.address, txHash }),
        });
        const body = await response.json().catch(() => ({}));
        if (response.status === 202 || (response.status === 409 && body.errorCode === "PAYMENT_PENDING")) {
            await new Promise((resolve) => setTimeout(resolve, 3000));
            continue;
        }
        if (body.errorCode === "PAYMENT_REVERTED") {
            pendingPayments.delete(key);
            try { window.localStorage.removeItem(key); } catch { /* Storage may be disabled. */ }
            options.onPayment?.(null);
        }
        if (!response.ok || !body.success || !body.data) throw new Error(body.error || "Analysis could not finish. Retry with the same photo to reuse your payment.");
        return body.data as MealAnalysis;
    }
    throw new Error("Your payment is saved. Retry with the same photo to resume without paying again.");
}
