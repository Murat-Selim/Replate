/** Offline route/security checks: ephemeral wallets, fake database, local RPC only. */
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import express from "express";
import { Pool } from "pg";
import { encodeAbiParameters, parseAbiParameters, toFunctionSelector } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const admin = privateKeyToAccount(generatePrivateKey());
const participant = privateKeyToAccount(generatePrivateKey());
const other = privateKeyToAccount(generatePrivateKey());
const proof = "data:image/jpeg;base64,/9j/2Q==";
type Entry = {
  id: string; campaign_id: string; wallet_address: string; x_username: string;
  follow_proof: string; engagement_proof: string; repost_url: string;
  follow_status: string; engagement_status: string; revision: number;
};
const entries = new Map<string, Entry>();
let databaseFailure = false;
let writes = 0;
const originalQuery = Pool.prototype.query;

function uniqueX(candidate: Entry) {
  if (candidate.follow_status === "approved" && candidate.engagement_status === "approved" && [...entries.values()].some(row =>
    row.id !== candidate.id && row.x_username === candidate.x_username && row.follow_status === "approved" && row.engagement_status === "approved")) {
    throw Object.assign(new Error("duplicate approved X account"), { code: "23505" });
  }
}

Pool.prototype.query = (async (sql: string, values: unknown[]) => {
  if (databaseFailure) throw new Error("test database unavailable");
  if (sql.startsWith("INSERT INTO receipt_hunt_submissions")) {
    const [campaign, wallet, username, follow, engagement, url, revision] = values;
    const current = [...entries.values()].find(row => row.campaign_id === campaign && row.wallet_address === wallet);
    if ((!current && revision !== 0) || (current && (current.revision !== revision || (current.follow_status === "approved" && current.engagement_status === "approved")))) return { rows: [] };
    const row: Entry = { id: current?.id || String(entries.size + 1), campaign_id: String(campaign), wallet_address: String(wallet),
      x_username: String(username), follow_proof: String(follow), engagement_proof: String(engagement), repost_url: String(url),
      follow_status: "pending", engagement_status: "pending", revision: (current?.revision || 0) + 1 };
    entries.set(row.id, row); writes++;
    return { rows: [{ revision: row.revision }] };
  }
  if (sql.startsWith("UPDATE receipt_hunt_submissions")) {
    const [follow, engagement, , id, campaign, revision] = values;
    const current = entries.get(String(id));
    if (!current || current.campaign_id !== campaign || current.revision !== revision) return { rows: [] };
    const updated = { ...current, follow_status: String(follow), engagement_status: String(engagement), revision: current.revision + 1 };
    uniqueX(updated); entries.set(current.id, updated); writes++;
    return { rows: [{ revision: updated.revision }] };
  }
  if (sql.startsWith("SELECT follow_status")) {
    const row = [...entries.values()].find(row => row.campaign_id === values[0] && row.wallet_address === values[1]);
    return { rows: row ? [{ follow_status: row.follow_status, engagement_status: row.engagement_status, revision: row.revision }] : [] };
  }
  if (sql.includes("follow_proof, engagement_proof FROM")) {
    const row = entries.get(String(values[0]));
    return { rows: row?.campaign_id === values[1] ? [{ ...row }] : [] };
  }
  if (sql.includes("ORDER BY updated_at DESC LIMIT 100")) return { rows: [...entries.values()].map(({ follow_proof, engagement_proof, ...row }) => row) };
  throw new Error(`Unexpected test query: ${sql}`);
}) as never;

async function listen(server: Server) {
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address(); assert(address && typeof address !== "string");
  return `http://127.0.0.1:${address.port}`;
}

const rpc = express();
rpc.use(express.json());
rpc.post("/", (req, res) => {
  const answer = (request: { id: number; method: string; params?: { data?: string }[] }) => ({ jsonrpc: "2.0", id: request.id,
    ...(request.method === "eth_call" && request.params?.[0]?.data === toFunctionSelector("validator()")
      ? { result: encodeAbiParameters(parseAbiParameters("address"), [admin.address]) }
      : { error: { code: 3, message: "execution reverted" } }) });
  res.json(Array.isArray(req.body) ? req.body.map(answer) : answer(req.body));
});
const rpcServer = createServer(rpc);
let apiServer: Server | undefined;

try {
  process.env.RPC_URL = await listen(rpcServer);
  process.env.DATABASE_URL = "postgresql://test@127.0.0.1/hunt-test";
  process.env.DATABASE_SSL = "";
  process.env.RECEIPT_HUNT_ANNOUNCEMENT_URL = "https://x.com/replateapp/status/123456789";
  const { default: router, huntMessage } = await import("../server/routes/receipt-hunt.js");
  const app = express(); app.use(express.json({ limit: "4mb" })); app.use("/api/receipt-hunt", router);
  apiServer = createServer(app);
  const origin = await listen(apiServer);
  const evidence = { xUsername: "test_user", followProof: proof, engagementProof: proof, repostUrl: "", revision: 0 };
  async function signed(account: typeof participant, action: string, data: unknown, deadline = Math.floor(Date.now() / 1000) + 240) {
    return { wallet: account.address, data, deadline, signature: await account.signMessage({ message: huntMessage(action, account.address, data, deadline) }) };
  }
  async function post(path: string, body: unknown) {
    const response = await fetch(`${origin}/api/receipt-hunt${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  }
  async function status(wallet = participant.address) {
    const response = await fetch(`${origin}/api/receipt-hunt/status/${wallet}`);
    assert.equal(response.headers.get("cache-control"), "no-store");
    return { status: response.status, body: await response.json() };
  }

  assert.equal((await post("/submit", { data: evidence })).status, 401);
  const forged = await signed(other, "submit", evidence); forged.wallet = participant.address;
  assert.equal((await post("/submit", forged)).status, 401);
  assert.equal((await post("/submit", await signed(participant, "submit", evidence, Math.floor(Date.now() / 1000) - 1))).status, 401);
  assert.equal((await post("/submit", await signed(participant, "submit", evidence, Math.floor(Date.now() / 1000) + 600))).status, 401);
  const tampered = await signed(participant, "submit", evidence); tampered.data = { ...evidence, xUsername: "someone_else" };
  assert.equal((await post("/submit", tampered)).status, 401);
  assert.equal((await post("/submit", await signed(participant, "review-access", evidence))).status, 401);
  assert.equal((await post("/submit", await signed(participant, "submit", { ...evidence, followProof: "data:image/svg+xml;base64,PHN2Zz4=" }))).status, 400);
  assert.equal((await post("/submit", await signed(participant, "submit", { ...evidence, repostUrl: "https://example.com/test_user/status/123" }))).status, 400);
  assert.equal(writes, 0);
  console.log("OK: unsigned, forged, expired, tampered, cross-action, and invalid evidence requests cannot write");

  const submission = await signed(participant, "submit", { ...evidence, followStatus: "approved", engagementStatus: "approved" });
  assert.equal((await post("/submit", submission)).status, 200);
  const pending = (await status()).body.data;
  assert.equal(pending.followStatus, "pending"); assert.equal(pending.unlocked, false);
  assert.equal(JSON.stringify(pending).includes(proof), false);
  assert.equal(JSON.stringify(pending).includes("test_user"), false);
  assert.equal((await post("/submit", submission)).status, 409);
  assert.equal((await post("/admin/list", await signed(participant, "review-access", {}))).status, 403);
  assert.equal((await post("/admin/proof/1", await signed(participant, "review-access", {}))).status, 403);
  const unauthorizedReview = { id: "1", revision: 1, followStatus: "approved", engagementStatus: "approved" };
  assert.equal((await post("/admin/review", await signed(participant, "review", unauthorizedReview))).status, 403);
  const adminAccess = await signed(admin, "review-access", {});
  const list = await post("/admin/list", adminAccess); assert.equal(list.status, 200);
  assert.equal(JSON.stringify(list.body).includes(proof), false);
  assert.equal((await post("/admin/proof/1", adminAccess)).body.data.follow_proof, proof);
  console.log("OK: proofs stay private; participants cannot self-approve or replay a submission");

  async function review(revision: number, followStatus: string, engagementStatus: string, id = "1") {
    return post("/admin/review", await signed(admin, "review", { id, revision, followStatus, engagementStatus }));
  }
  assert.equal((await review(1, "approved", "pending")).status, 200);
  assert.equal((await status()).body.data.unlocked, false);
  assert.equal((await review(1, "approved", "approved")).status, 409);
  assert.equal((await review(2, "approved", "approved")).status, 200);
  assert.equal((await status()).body.data.unlocked, true);
  assert.equal((await post("/submit", submission)).status, 409);
  assert.equal((await post("/submit", await signed(participant, "submit", { ...evidence, revision: 3 }))).status, 409);
  console.log("OK: one approval keeps the lock; two unlock; old decisions cannot overwrite newer evidence");

  assert.equal((await post("/submit", await signed(other, "submit", evidence))).status, 200);
  assert.equal((await review(1, "approved", "approved", "2")).status, 409);
  assert.equal((await status(other.address)).body.data.unlocked, false);
  assert.equal((await review(3, "rejected", "rejected")).status, 200);
  assert.equal((await status()).body.data.unlocked, false);
  assert.equal((await post("/submit", await signed(participant, "submit", { ...evidence, revision: 4 }))).status, 200);
  assert.equal((await status()).body.data.followStatus, "pending");
  assert.equal((await review(4, "approved", "approved")).status, 409);
  console.log("OK: duplicate X accounts cannot unlock two wallets; rejection and resubmission reset approval");

  databaseFailure = true;
  assert.equal((await status()).status, 503);
  assert.equal((await post("/admin/list", adminAccess)).status, 503);
  console.log("OK: database failure does not expose evidence or grant access");
} finally {
  Pool.prototype.query = originalQuery;
  if (apiServer) await new Promise<void>(resolve => apiServer!.close(() => resolve()));
  await new Promise<void>(resolve => rpcServer.close(() => resolve()));
}
