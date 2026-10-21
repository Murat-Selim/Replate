export type HuntTask = "follow" | "engagement";
export interface HuntProgress {
    follow: { opened: boolean; verified: boolean };
    engagement: { opened: boolean; verified: boolean };
}

const STORAGE_KEY = "replate:receipt-hunt-01:2026-10-21:social";
const CHANGE_EVENT = "replate:receipt-hunt-progress";
let memorySnapshot = "";
let useMemory = false;

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

export function getHuntSnapshot(): string {
    if (useMemory) return memorySnapshot;
    try { return window.localStorage.getItem(STORAGE_KEY) || ""; }
    catch { useMemory = true; return memorySnapshot; }
}

export function subscribeHuntProgress(listener: () => void): () => void {
    window.addEventListener("storage", listener);
    window.addEventListener(CHANGE_EVENT, listener);
    return () => {
        window.removeEventListener("storage", listener);
        window.removeEventListener(CHANGE_EVENT, listener);
    };
}

export function updateHuntTask(task: HuntTask, action: "open" | "verify"): void {
    const progress = readHuntProgress(getHuntSnapshot());
    const current = progress[task];
    progress[task] = {
        opened: current.opened || action === "open",
        verified: current.verified || (action === "verify" && current.opened),
    };
    memorySnapshot = JSON.stringify(progress);
    try { window.localStorage.setItem(STORAGE_KEY, memorySnapshot); } catch { useMemory = true; }
    window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function isHuntUnlocked(progress: HuntProgress): boolean {
    return progress.follow.verified && progress.engagement.verified;
}

export function getHuntAnnouncementUrl(): string | null {
    const url = process.env.NEXT_PUBLIC_RECEIPT_HUNT_ANNOUNCEMENT_URL?.trim() || "";
    return /^https:\/\/(?:www\.)?(?:x\.com|twitter\.com)\/[a-z0-9_]{1,15}\/status\/\d+(?:[/?#].*)?$/i.test(url) ? url : null;
}
