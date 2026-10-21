import { keccak256, toBytes } from "viem";
import { CONTRACT_ADDRESS, appChain } from "@/lib/network";
import { getApiUrl } from "@/lib/api";

export type HuntTaskStatus = "not_submitted" | "pending" | "approved" | "rejected";
export interface HuntStatus {
    followStatus: HuntTaskStatus;
    engagementStatus: HuntTaskStatus;
    revision: number;
    unlocked: boolean;
    announcementUrl: string | null;
}
export interface HuntReview {
    id: string;
    wallet_address: string;
    x_username: string;
    repost_url: string;
    follow_status: Exclude<HuntTaskStatus, "not_submitted">;
    engagement_status: Exclude<HuntTaskStatus, "not_submitted">;
    revision: number;
    follow_proof?: string;
    engagement_proof?: string;
}
export interface HuntAuthorization {
    wallet: string;
    data: unknown;
    deadline: number;
    signature: string;
}

export function huntMessage(action: string, wallet: string, data: unknown, deadline: number): string {
    return ["Replate Receipt Hunt", "Campaign: receipt-hunt-01", `Chain: ${appChain.id}`,
        `Contract: ${CONTRACT_ADDRESS.toLowerCase()}`, `Action: ${action}`,
        `Wallet: ${wallet.toLowerCase()}`, `Data: ${keccak256(toBytes(JSON.stringify(data)))}`, `Expires: ${deadline}`].join("\n");
}

export async function signHuntRequest(wallet: string, action: string, data: unknown, sign: (message: string) => Promise<string>): Promise<HuntAuthorization> {
    const deadline = Math.floor(Date.now() / 1000) + 240;
    const signature = await sign(huntMessage(action, wallet, data, deadline));
    return { wallet, data, deadline, signature };
}

async function readResponse<T>(response: Response): Promise<T> {
    const payload = await response.json();
    if (!response.ok || !payload.success) throw new Error(payload.error || "Receipt Hunt is unavailable");
    return payload.data as T;
}

export async function getHuntStatus(wallet: string, signal?: AbortSignal): Promise<HuntStatus> {
    return readResponse<HuntStatus>(await fetch(getApiUrl(`/api/receipt-hunt/status/${wallet}`), { cache: "no-store", signal }));
}

export async function postHunt<T>(path: string, body: HuntAuthorization): Promise<T> {
    return readResponse<T>(await fetch(getApiUrl(`/api/receipt-hunt${path}`), {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }));
}
