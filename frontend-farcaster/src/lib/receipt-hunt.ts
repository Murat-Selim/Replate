export type HuntTask = "follow" | "engagement";
export interface HuntProgress {
    follow: { opened: boolean; verified: boolean };
    engagement: { opened: boolean; verified: boolean };
}

const STORAGE_KEY = "replate:receipt-hunt-01:2026-10-21:social";
const CHANGE_EVENT = "replate:receipt-hunt-progress";
const memorySnapshots = new Map<string, string>();
const memoryOnlyKeys = new Set<string>();

export function readHuntProgress(snapshot: string): HuntProgress {
    try {
        const saved = JSON.parse(snapshot);
        return {
            follow: { opened: saved?.follow?.opened === true, verified: saved?.follow?.opened === true && saved?.follow?.verified === true },
            engagement: { opened: saved?.engagement?.opened === true, verified: saved?.engagement?.opened === true && saved?.engagement?.verified === true },
        };
    } catch {
        return { follow: { opened: false, verified: false }, engagement: { opened: false, verified: false } };
    }
}

export function getHuntSnapshot(address?: string): string {
    if (!address) return "";
    const key = `${STORAGE_KEY}:${address.toLowerCase()}`;
    if (memoryOnlyKeys.has(key)) return memorySnapshots.get(key) || "";
    try { return window.localStorage.getItem(key) || ""; }
    catch { memoryOnlyKeys.add(key); return memorySnapshots.get(key) || ""; }
}

export function subscribeHuntProgress(listener: () => void): () => void {
    window.addEventListener("storage", listener);
    window.addEventListener(CHANGE_EVENT, listener);
    return () => {
        window.removeEventListener("storage", listener);
        window.removeEventListener(CHANGE_EVENT, listener);
    };
}

export function updateHuntTask(address: string | undefined, task: HuntTask, action: "open" | "verify"): void {
    if (!address) return;
    const key = `${STORAGE_KEY}:${address.toLowerCase()}`;
    const progress = readHuntProgress(getHuntSnapshot(address));
    const current = progress[task];
    progress[task] = {
        opened: current.opened || action === "open",
        verified: current.verified || (action === "verify" && current.opened),
    };
    const snapshot = JSON.stringify(progress);
    memorySnapshots.set(key, snapshot);
    try { window.localStorage.setItem(key, snapshot); } catch { memoryOnlyKeys.add(key); }
    window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function isHuntUnlocked(progress: HuntProgress): boolean {
    return progress.follow.verified && progress.engagement.verified;
}

export function getHuntAnnouncementUrl(): string | null {
    const url = process.env.NEXT_PUBLIC_RECEIPT_HUNT_ANNOUNCEMENT_URL?.trim() || "";
    return /^https:\/\/(?:www\.)?(?:x\.com|twitter\.com)\/[a-z0-9_]{1,15}\/status\/\d+(?:[/?#].*)?$/i.test(url) ? url : null;
}
