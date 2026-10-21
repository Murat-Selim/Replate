const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");
const vm = require("node:vm");
const ts = require("typescript");

const payer = "0x1111111111111111111111111111111111111111";
const recipient = "0xAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAa";
const asset = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const encoded = (value) => Buffer.from(JSON.stringify(value)).toString("base64");

async function main() {
    for (const app of ["frontend-baseapp", "frontend-farcaster"]) {
        const appRoot = path.resolve(__dirname, "../..", app);
        const source = fs.readFileSync(path.join(appRoot, "src/lib/intelligence.ts"), "utf8");
        const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
        const appRequire = createRequire(path.join(appRoot, "package.json"));
        let requests;
        let signatures;
        let nextResponse;
        const required = {
            x402Version: 2, resource: { url: "https://test.invalid/receipt", mimeType: "application/json" },
            accepts: [{ scheme: "exact", network: "eip155:8453", amount: "50000", asset, payTo: recipient, maxTimeoutSeconds: 300, extra: { name: "USD Coin", version: "2" } }],
        };
        const context = {
            exports: {},
            require: (name) => name === "@/lib/api" ? { getApiUrl: (url) => `https://test.invalid${url}` } : appRequire(name),
            fetch: async (url, init) => {
                requests.push({ url, init });
                if (requests.length === 1) return new Response("{}", { status: 402, headers: { "PAYMENT-REQUIRED": encoded(required) } });
                assert.equal(requests.length, 2, "A failed payment must not be retried automatically");
                assert(init.headers["PAYMENT-SIGNATURE"]);
                return nextResponse;
            },
        };
        vm.runInNewContext(compiled, context);
        const api = context.exports;
        const wallet = (address) => ({ account: { address }, signTypedData: async () => { signatures++; return `0x${"1".repeat(130)}`; } });
        const reset = () => { requests = []; signatures = 0; nextResponse = new Response('{"success":true}'); };

        for (const call of [api.fetchReceiptSpendingBreakdown, api.fetchReceiptProductPrices]) {
            reset();
            await assert.rejects(call(wallet(recipient.toLowerCase()), "1"), /payment recipient.*different wallet/i);
            assert.equal(signatures, 0, "Self-payments must stop before asking for a signature");
            assert.equal(requests.length, 1, "Self-payments must not send a paid request");
        }

        reset();
        nextResponse = new Response(JSON.stringify({ success: true, receiptId: "1", categories: [] }), { status: 200 });
        const result = await api.fetchReceiptSpendingBreakdown(wallet(payer), "1");
        assert.equal(result.success, true);
        assert.equal(result.receiptId, "1");
        assert.equal(signatures, 1);
        assert.equal(requests.length, 2);

        for (const reason of ["invalid_exact_evm_insufficient_balance", "self_send_not_allowed"]) {
            reset();
            nextResponse = new Response("{}", { status: 402, headers: { "PAYMENT-REQUIRED": encoded({ ...required, error: reason }) } });
            await assert.rejects(api.fetchReceiptSpendingBreakdown(wallet(payer), "1"), reason === "self_send_not_allowed" ? /payment recipient.*different wallet/i : new RegExp(reason));
            assert.equal(requests.length, 2);
        }

        reset();
        nextResponse = new Response("{}", { status: 402, headers: { "PAYMENT-RESPONSE": encoded({ success: false, errorReason: "settlement_failed", errorMessage: "Settlement was rejected", network: "eip155:8453", transaction: "" }) } });
        await assert.rejects(api.fetchReceiptSpendingBreakdown(wallet(payer), "1"), /Settlement was rejected/);

        reset();
        nextResponse = new Response('{"success":true}', { status: 200, headers: { "PAYMENT-RESPONSE": encoded({ success: false, errorReason: "settlement_failed", network: "eip155:8453", transaction: "" }) } });
        await assert.rejects(api.fetchReceiptSpendingBreakdown(wallet(payer), "1"), /settlement_failed/);

        reset();
        nextResponse = new Response(JSON.stringify({ success: false, error: "Verified receipt not found" }), { status: 404 });
        await assert.rejects(api.fetchReceiptSpendingBreakdown(wallet(payer), "1"), /Verified receipt not found/);

        reset();
        nextResponse = new Response("Gateway timeout", { status: 504 });
        await assert.rejects(api.fetchReceiptSpendingBreakdown(wallet(payer), "1"), /HTTP 504/);
        console.log(`${app}: self-payment blocked before signing, normal payment, header errors, and no automatic retries OK`);
    }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
