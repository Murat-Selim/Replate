const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

for (const app of ["frontend-baseapp", "frontend-farcaster"]) {
    const source = fs.readFileSync(path.resolve(__dirname, "../..", app, "src/lib/receipt-hunt.ts"), "utf8");
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
    const storage = new Map();
    const listeners = new Map();
    let unavailable = false;
    let readUnavailable = false;
    const browser = {
        localStorage: {
            getItem(key) { if (readUnavailable) throw Error("storage unavailable"); return storage.get(key) || null; },
            setItem(key, value) { if (unavailable) throw Error("storage quota exceeded"); storage.set(key, value); },
        },
        addEventListener(type, listener) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(listener); },
        removeEventListener(type, listener) { listeners.get(type)?.delete(listener); },
        dispatchEvent(event) { for (const listener of listeners.get(event.type) || []) listener(); },
    };
    const environment = { env: {} };
    function load() {
        const context = { exports: {}, window: browser, process: environment, Event: class { constructor(type) { this.type = type; } } };
        vm.runInNewContext(compiled, context);
        return context.exports;
    }
    let api = load();
    const walletA = "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    const walletB = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    const progress = (address = walletA) => api.readHuntProgress(api.getHuntSnapshot(address));
    let notifications = 0;
    const unsubscribe = api.subscribeHuntProgress(() => notifications++);

    storage.set("replate:receipt-hunt-01:2026-10-21:social", JSON.stringify({ follow: { opened: true, verified: true }, engagement: { opened: true, verified: true } }));
    assert.equal(api.isHuntUnlocked(progress()), false, "Legacy browser-wide progress must not be assigned to a wallet");
    const disconnectedStorage = storage.size;
    api.updateHuntTask(undefined, "follow", "open");
    api.updateHuntTask(undefined, "follow", "verify");
    assert.equal(storage.size, disconnectedStorage, "Disconnected users cannot save task progress");
    assert.equal(api.getHuntSnapshot(), "", "Disconnected users have no verified tasks");
    assert.equal(api.isHuntUnlocked(progress()), false);
    api.updateHuntTask(walletA, "follow", "verify");
    assert.equal(progress().follow.verified, false, "Verify requires opening the task first");
    api.updateHuntTask(walletA, "follow", "open");
    assert.equal(progress().follow.verified, false, "Opening X alone does not complete a task");
    api.updateHuntTask(walletA, "follow", "verify");
    assert.equal(api.isHuntUnlocked(progress()), false, "One verified task keeps the reward locked");
    api.updateHuntTask(walletA, "engagement", "open");
    api.updateHuntTask(walletA, "engagement", "verify");
    assert.equal(api.isHuntUnlocked(progress()), true);
    assert.equal(api.isHuntUnlocked(progress(walletA.toLowerCase())), true, "Wallet address casing must not reset progress");
    assert.equal(api.isHuntUnlocked(progress(walletB)), false, "Switching wallets must lock the Hunt for the new wallet");
    api.updateHuntTask(walletB, "follow", "verify");
    assert.equal(progress(walletB).follow.verified, false, "The new wallet cannot reuse the previous wallet's opened tasks");
    api.updateHuntTask(walletB, "follow", "open");
    api.updateHuntTask(walletB, "follow", "verify");
    assert.equal(api.isHuntUnlocked(progress(walletB)), false, "Each wallet needs both tasks");
    assert.equal(api.isHuntUnlocked(progress(walletA)), true, "Returning to the original wallet restores its own progress");
    assert.equal(api.getHuntSnapshot(), "", "Disconnecting must hide verified progress");
    assert.ok(notifications > 0);
    unsubscribe();
    api = load();
    assert.equal(api.isHuntUnlocked(progress()), true, "Progress survives navigation/reload");
    assert.equal(progress(walletB).follow.verified, true);
    assert.equal(progress(walletB).engagement.verified, false, "Reload preserves each wallet's separate progress");
    assert.equal(api.isHuntUnlocked(api.readHuntProgress("broken JSON")), false);
    assert.equal(api.isHuntUnlocked(api.readHuntProgress(JSON.stringify({ follow: { verified: true }, engagement: { verified: true } }))), false);
    unavailable = true;
    api.updateHuntTask(walletA, "follow", "verify");
    assert.equal(progress(walletB).follow.verified, true, "One wallet's failed write must not hide another wallet's saved progress");
    storage.clear();
    api = load();
    for (const task of ["follow", "engagement"]) { api.updateHuntTask(walletA, task, "open"); api.updateHuntTask(walletA, task, "verify"); }
    assert.equal(api.isHuntUnlocked(progress()), true, "Verification still works when browser storage cannot be written");
    assert.equal(api.isHuntUnlocked(progress(walletB)), false, "Memory fallback must also isolate wallets");
    api.updateHuntTask(walletB, "follow", "open");
    api.updateHuntTask(walletB, "follow", "verify");
    assert.equal(api.isHuntUnlocked(progress(walletA)), true, "Another wallet's memory updates must preserve original progress");
    assert.equal(api.isHuntUnlocked(progress(walletB)), false);
    assert.equal(api.getHuntSnapshot(), "");
    readUnavailable = true;
    api = load();
    assert.equal(api.getHuntSnapshot(walletA), "");
    for (const task of ["follow", "engagement"]) { api.updateHuntTask(walletA, task, "open"); api.updateHuntTask(walletA, task, "verify"); }
    assert.equal(api.isHuntUnlocked(progress()), true, "Verification works when browser storage cannot be read");
    assert.equal(api.isHuntUnlocked(progress(walletB)), false);
    assert.equal(api.getHuntAnnouncementUrl(), null);
    environment.env.NEXT_PUBLIC_RECEIPT_HUNT_ANNOUNCEMENT_URL = "javascript:alert(1)";
    assert.equal(api.getHuntAnnouncementUrl(), null);
    environment.env.NEXT_PUBLIC_RECEIPT_HUNT_ANNOUNCEMENT_URL = "https://x.com/replateapp/status/123456789";
    assert.equal(api.getHuntAnnouncementUrl(), environment.env.NEXT_PUBLIC_RECEIPT_HUNT_ANNOUNCEMENT_URL);
    console.log(`${app}: wallet isolation, disconnect, legacy records, persistence, and storage fallback OK`);
}
