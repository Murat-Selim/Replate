const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");
const ts = require("typescript");

const payer = `0x${"1".repeat(40)}`;
const payTo = `0x${"2".repeat(40)}`;
const image = Buffer.from("test meal photo bytes").toString("base64");
async function main() {
    for (const app of ["frontend-baseapp", "frontend-farcaster"]) {
        const root = path.resolve(__dirname, "../..", app);
        const appRequire = createRequire(path.join(root, "package.json"));
        const viem = appRequire("viem");
        const compiled = ts.transpileModule(fs.readFileSync(path.join(root, "src/lib/meal-payment.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
        const storage = new Map();
        let transfers = 0;
        let quotes = 0;
        let posts = 0;
        let responseStatus = 200;
        let pending = false;
        let amount = "10000";
        let chain = 8453;
        let errorCode;
        let batch = false;
        let lastHash;
        const wallet = {
            account: { address: payer }, getChainId: async () => chain, switchChain: async ({ id }) => { chain = id; },
            signTypedData: () => { throw Error("Meal payments must never request an x402 signature"); },
            writeContract: async (call) => {
                assert(!batch);
                assert.equal(call.functionName, "transfer");
                assert.equal(call.args[0], payTo);
                assert.equal(call.args[1], 10000n);
                assert.equal(call.chain.id, 8453);
                assert.match(call.dataSuffix, /^0x[0-9a-f]{64}abcd$/);
                return lastHash = `0x${(++transfers).toString(16).padStart(64, "0")}`;
            },
            sendCallsSync: async (call) => {
                assert(batch);
                const transfer = viem.encodeFunctionData({ abi: viem.erc20Abi, functionName: "transfer", args: [payTo, 10000n] });
                assert(call.calls[0].data.startsWith(transfer));
                assert.equal(call.calls[0].data.length, transfer.length + 68);
                lastHash = `0x${(++transfers).toString(16).padStart(64, "0")}`;
                return { receipts: [{ transactionHash: lastHash }] };
            },
        };
        function load() {
            const context = { exports: {}, atob, AbortSignal, setTimeout: (callback) => { callback(); },
                require: (name) => name === "@/lib/api" ? { getApiUrl: (url) => `https://test.invalid${url}` }
                    : ["@/lib/config", "@/lib/farcasterConfig"].includes(name) ? { DATA_SUFFIX: "0xabcd" } : appRequire(name),
                window: { localStorage: { getItem: (key) => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) } },
                fetch: async (url, init) => {
                    assert(!init?.headers?.["PAYMENT-SIGNATURE"]);
                    if (url.endsWith("/payment")) {
                        quotes++;
                        return new Response(JSON.stringify({ success: true, payment: { chainId: 8453, asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", payTo, amount } }));
                    }
                    posts++;
                    assert.equal(JSON.parse(init.body).txHash, lastHash);
                    if (pending) { pending = false; return new Response(JSON.stringify({ errorCode: "PAYMENT_PENDING" }), { status: 409 }); }
                    if (responseStatus !== 200) return new Response(JSON.stringify({ error: errorCode ? "Payment reverted" : "Model unavailable", errorCode }), { status: responseStatus });
                    return new Response(JSON.stringify({ success: true, data: { balanceScore: 85 } }));
                },
            };
            vm.runInNewContext(compiled, context);
            return context.exports;
        }
        let api = load();
        pending = true;
        assert.equal((await api.requestMealAnalysis(wallet, image)).balanceScore, 85);
        assert.equal(transfers, 1);
        assert.equal(posts, 2);
        assert.equal(quotes, 1);
        api = load();
        await api.requestMealAnalysis(wallet, image);
        assert.equal(transfers, 1, "A reload resumes the original payment");
        assert.equal(quotes, 1);
        responseStatus = 502;
        await assert.rejects(api.requestMealAnalysis(wallet, image + "\n"), /Model unavailable/);
        responseStatus = 200;
        await api.requestMealAnalysis(wallet, image);
        assert.equal(transfers, 1, "A provider failure must not trigger a new transfer");
        const otherImage = Buffer.from("another meal photo").toString("base64");
        amount = "20000";
        await assert.rejects(api.requestMealAnalysis(wallet, otherImage), /Unexpected meal payment details/);
        assert.equal(transfers, 1, "The browser refuses a quote above 0.01 USDC");
        amount = "10000";
        wallet.account.address = payTo;
        await assert.rejects(api.requestMealAnalysis(wallet, otherImage), /different/);
        assert.equal(transfers, 1);
        wallet.account.address = payer;
        batch = true;
        chain = 84532;
        await api.requestMealAnalysis(wallet, otherImage, { smartWallet: true });
        assert.equal(transfers, 2, "Base Account uses a normal wallet batch, not x402");
        assert.equal(chain, 8453);
        batch = false;
        responseStatus = 422;
        errorCode = "PAYMENT_REVERTED";
        const thirdImage = Buffer.from("third meal photo").toString("base64");
        const callbacks = [];
        await assert.rejects(api.requestMealAnalysis(wallet, thirdImage, { onPayment: (hash) => callbacks.push(hash) }), /reverted/);
        assert.equal(callbacks.at(-1), null, "A reverted transaction clears the saved-payment state");
        responseStatus = 200;
        errorCode = undefined;
        await api.requestMealAnalysis(wallet, thirdImage);
        assert.equal(transfers, 4, "Only a confirmed revert permits creating a replacement transfer");
        console.log(`${app}: direct transfer, photo commitment, quote cap, Base Account, saved-payment retries and no x402 signing OK`);
    }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
