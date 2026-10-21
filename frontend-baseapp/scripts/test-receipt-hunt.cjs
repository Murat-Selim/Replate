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
    const browser = {
        localStorage: {
            getItem(key) { return storage.get(key) || null; },
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
    const progress = () => api.readHuntProgress(api.getHuntSnapshot());
    let notifications = 0;
    const unsubscribe = api.subscribeHuntProgress(() => notifications++);

    assert.equal(api.isHuntUnlocked(progress()), false);
    api.updateHuntTask("follow", "verify");
    assert.equal(progress().follow.verified, false, "Verify requires opening the task first");
    api.updateHuntTask("follow", "open");
    assert.equal(progress().follow.verified, false, "Opening X alone does not complete a task");
    api.updateHuntTask("follow", "verify");
    assert.equal(api.isHuntUnlocked(progress()), false, "One verified task keeps the reward locked");
    api.updateHuntTask("engagement", "open");
    api.updateHuntTask("engagement", "verify");
    assert.equal(api.isHuntUnlocked(progress()), true);
    assert.ok(notifications > 0);
    unsubscribe();
    api = load();
    assert.equal(api.isHuntUnlocked(progress()), true, "Progress survives navigation/reload");
    assert.equal(api.isHuntUnlocked(api.readHuntProgress("broken JSON")), false);
    assert.equal(api.isHuntUnlocked(api.readHuntProgress(JSON.stringify({ follow: { verified: true }, engagement: { verified: true } }))), false);
    storage.clear();
    unavailable = true;
    api = load();
    for (const task of ["follow", "engagement"]) { api.updateHuntTask(task, "open"); api.updateHuntTask(task, "verify"); }
    assert.equal(api.isHuntUnlocked(progress()), true, "Verification still works when browser storage cannot be written");
    assert.equal(api.getHuntAnnouncementUrl(), null);
    environment.env.NEXT_PUBLIC_RECEIPT_HUNT_ANNOUNCEMENT_URL = "javascript:alert(1)";
    assert.equal(api.getHuntAnnouncementUrl(), null);
    environment.env.NEXT_PUBLIC_RECEIPT_HUNT_ANNOUNCEMENT_URL = "https://x.com/replateapp/status/123456789";
    assert.equal(api.getHuntAnnouncementUrl(), environment.env.NEXT_PUBLIC_RECEIPT_HUNT_ANNOUNCEMENT_URL);
    console.log(`${app}: open → Verify → unlock, persistence, and storage fallback OK`);
}
