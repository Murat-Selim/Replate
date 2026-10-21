const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");
const vm = require("node:vm");
const ts = require("typescript");

for (const app of ["frontend-baseapp", "frontend-farcaster"]) {
    const appRoot = path.resolve(__dirname, "../..", app);
    const source = fs.readFileSync(path.join(appRoot, "src/lib/receipt-hunt.ts"), "utf8");
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
    function load(targetBrowser = browser) {
        const context = { exports: {}, window: targetBrowser, process: environment, Event: class { constructor(type) { this.type = type; } } };
        vm.runInNewContext(compiled, context);
        return context.exports;
    }
    let api = load();
    const walletA = "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    const walletB = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    const progress = (address = walletA) => api.readHuntProgress(api.getHuntSnapshot(address), address);
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
    const walletBKey = `replate:receipt-hunt-01:2026-10-21:social:${walletB}`;
    storage.set(walletBKey, api.getHuntSnapshot(walletA));
    assert.equal(api.isHuntUnlocked(progress(walletB)), false, "A stale record stored under the new wallet key must not transfer verification");
    storage.set(walletBKey, JSON.stringify({ follow: { opened: true, verified: true }, engagement: { opened: true, verified: true } }));
    assert.equal(api.isHuntUnlocked(progress(walletB)), false, "Old wallet-scoped records without an owner must be ignored");
    storage.delete(walletBKey);
    assert.equal(api.isHuntUnlocked(progress(walletB)), false, "Switching wallets must lock the Hunt for the new wallet");
    api.updateHuntTask(walletB, "follow", "verify");
    assert.equal(progress(walletB).follow.verified, false, "The new wallet cannot reuse the previous wallet's opened tasks");
    api.updateHuntTask(walletB, "follow", "open");
    api.updateHuntTask(walletB, "follow", "verify");
    assert.equal(api.isHuntUnlocked(progress(walletB)), false, "Each wallet needs both tasks");
    assert.equal(api.isHuntUnlocked(progress(walletA)), true, "Returning to the original wallet restores its own progress");
    assert.equal(api.getHuntSnapshot(), "", "Disconnecting must hide verified progress");

    const appRequire = createRequire(path.join(appRoot, "package.json"));
    let account = { address: walletA, isConnected: true };
    let wallet = { data: { account: { address: walletA } }, isFetching: false, isError: false };
    const componentSource = fs.readFileSync(path.join(appRoot, "src/components/ReceiptHuntTasks.tsx"), "utf8");
    const componentCode = ts.transpileModule(componentSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
    const hooks = { useAccount: () => account, useFarcasterAccount: () => account, useWalletClient: (options) => {
        assert.equal(options.account, account.address, "The wallet client query must be scoped to the selected account");
        return wallet;
    } };
    const componentContext = { exports: {}, require(name) {
        if (name === "react") return { useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot() };
        if (name === "wagmi" || name === "@/hooks/useFarcasterAccount") return hooks;
        if (name === "@/lib/receipt-hunt") return api;
        if (name === "@/lib/network") return { appChain: { id: 8453 } };
        if (name === "next/link") return { __esModule: true, default: "a" };
        if (name === "lucide-react") return new Proxy({}, { get: () => () => null });
        return appRequire(name);
    } };
    vm.runInNewContext(componentCode, componentContext);
    function renderTasks() {
        const view = componentContext.exports.default({});
        const tree = typeof view.type === "function" ? view.type(view.props) : view;
        const status = tree.props.children.find((child) => child?.props?.role === "status");
        return { key: view.key, completed: status.props.children[0] };
    }
    const originalView = renderTasks();
    assert.equal(originalView.completed, 2);
    wallet = { ...wallet, data: { account: { address: walletB } } };
    assert.equal(renderTasks().completed, 0, "A wallet client differing from the cached connection must hide all verification");
    account = { address: walletB, isConnected: true };
    assert.equal(renderTasks().completed, 1);
    assert.notEqual(renderTasks().key, originalView.key, "Changing wallets must remount the task view");
    wallet = { data: undefined, isFetching: true, isError: false };
    assert.equal(renderTasks().completed, 0, "Verification must stay hidden until the selected wallet client is available");
    wallet = { data: { account: { address: walletB } }, isFetching: false, isError: true };
    assert.equal(renderTasks().completed, 0);
    account = { address: walletA, isConnected: false };
    wallet = { data: { account: { address: walletA } }, isFetching: false, isError: false };
    assert.equal(renderTasks().completed, 0, "Disconnecting must hide even a cached wallet client's verification");

    const otherStorage = new Map();
    const otherApi = load({ localStorage: { getItem: (key) => otherStorage.get(key) || null, setItem: (key, value) => otherStorage.set(key, value) }, dispatchEvent() {} });
    assert.equal(otherApi.isHuntUnlocked(otherApi.readHuntProgress(otherApi.getHuntSnapshot(walletB), walletB)), false, "A different browser and wallet must start unverified");
    for (const task of ["follow", "engagement"]) { otherApi.updateHuntTask(walletB, task, "open"); otherApi.updateHuntTask(walletB, task, "verify"); }
    assert.equal(otherApi.isHuntUnlocked(otherApi.readHuntProgress(otherApi.getHuntSnapshot(walletB), walletB)), true);
    assert.equal(api.isHuntUnlocked(progress(walletB)), false, "Another browser's updates must not affect this browser's wallet state");
    assert.ok(notifications > 0);
    unsubscribe();
    api = load();
    assert.equal(api.isHuntUnlocked(progress()), true, "Progress survives navigation/reload");
    assert.equal(progress(walletB).follow.verified, true);
    assert.equal(progress(walletB).engagement.verified, false, "Reload preserves each wallet's separate progress");
    assert.equal(api.isHuntUnlocked(api.readHuntProgress("broken JSON", walletA)), false);
    assert.equal(api.isHuntUnlocked(api.readHuntProgress(JSON.stringify({ walletAddress: walletA.toLowerCase(), follow: { verified: true }, engagement: { verified: true } }), walletA)), false);
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
    assert.equal(api.getHuntAnnouncementUrl(), "https://x.com/replateapp/status/2113002525443948724");
    const oldDemo = api.readHuntProgress(JSON.stringify({ walletAddress: walletA.toLowerCase(), follow: { opened: true, verified: true }, engagement: { opened: true, verified: true } }), walletA);
    assert.equal(oldDemo.follow.verified, true, "Adding the real announcement must preserve the follow task");
    assert.equal(oldDemo.engagement.verified, false, "Demo verification must not count as engagement with the real announcement");
    environment.env.NEXT_PUBLIC_RECEIPT_HUNT_ANNOUNCEMENT_URL = "javascript:alert(1)";
    assert.equal(api.getHuntAnnouncementUrl(), null);
    environment.env.NEXT_PUBLIC_RECEIPT_HUNT_ANNOUNCEMENT_URL = "https://x.com/replateapp/status/123456789";
    assert.equal(api.getHuntAnnouncementUrl(), environment.env.NEXT_PUBLIC_RECEIPT_HUNT_ANNOUNCEMENT_URL);
    assert.equal(progress().follow.verified, true);
    assert.equal(progress().engagement.verified, false, "Changing the announcement requires completing engagement with the new post");
    api.updateHuntTask(walletA, "engagement", "verify");
    assert.equal(progress().engagement.verified, false);
    api.updateHuntTask(walletA, "engagement", "open");
    api.updateHuntTask(walletA, "engagement", "verify");
    assert.equal(api.isHuntUnlocked(progress()), true);
    console.log(`${app}: announcement link, post-specific engagement, wallet isolation, persistence, and storage fallback OK`);
}
