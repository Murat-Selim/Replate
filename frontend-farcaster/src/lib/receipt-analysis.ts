import { getApiUrl } from "./api";

interface PendingAnalysis { receiptHash: string; token: string }
interface AnalysisResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    pendingAnalysis?: PendingAnalysis;
    retryAfterMs?: number;
}

const storageKey = (address: string) => `replate:receipt-ocr:${address.toLowerCase()}`;

export function getPendingReceiptAnalysis(address?: string): PendingAnalysis | null {
    if (!address) return null;
    try {
        const saved = JSON.parse(sessionStorage.getItem(storageKey(address)) || "null");
        return /^0x[a-fA-F0-9]{64}$/.test(saved?.receiptHash) && /^[a-f0-9-]{36}$/.test(saved?.token) ? saved : null;
    } catch { return null; }
}

export function clearPendingReceiptAnalysis(address?: string): void {
    if (address) {
        try { sessionStorage.removeItem(storageKey(address)); } catch { /* Storage may be disabled. */ }
    }
}

/** Each poll resumes the same server job; it never resends an image. */
export async function analyzeReceiptForVerification<T>(
    request: { imageBase64?: string; userAddress: string; householdSize: number; daysCovered: number; fid?: number },
    onPending: (pending: boolean) => void,
    signal?: AbortSignal,
): Promise<T> {
    let pending = getPendingReceiptAnalysis(request.userAddress);
    if (!pending && !request.imageBase64) throw new Error("Please upload a receipt first.");
    const deadline = Date.now() + 10 * 60 * 1000;
    while (Date.now() < deadline) {
        signal?.throwIfAborted();
        const response = await fetch(getApiUrl("/api/verify-receipt"), {
            method: "POST", signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(60000)]) : AbortSignal.timeout(60000),
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(pending
                ? { userAddress: request.userAddress, pendingAnalysis: pending, onlyAnalyze: true }
                : { ...request, onlyAnalyze: true }),
        });
        const body = await response.json() as AnalysisResponse<T>;
        signal?.throwIfAborted();
        if (response.status === 202 && body.success && body.pendingAnalysis) {
            pending = body.pendingAnalysis;
            try { sessionStorage.setItem(storageKey(request.userAddress), JSON.stringify(pending)); } catch { /* Keep polling in memory. */ }
            onPending(true);
            await new Promise((resolve) => setTimeout(resolve, Math.min(10000, Math.max(1000, body.retryAfterMs || 3000))));
            continue;
        }
        if (!response.ok || !body.success || !body.data) {
            if (response.status >= 400 && response.status < 500) {
                clearPendingReceiptAnalysis(request.userAddress);
                onPending(false);
            }
            throw new Error(body.error || "Receipt analysis could not finish.");
        }
        // Retain the capability until wallet confirmation succeeds, allowing a retry without new OCR.
        return body.data;
    }
    throw new Error("Your receipt is still being read. Click Resume analysis to check the same job again.");
}
