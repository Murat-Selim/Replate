import { Router, type Request, type Response } from "express";
import { createPublicClient, http, keccak256, toBytes } from "viem";
import { base } from "viem/chains";
import { runtimeConfig } from "../config.js";
import { getDatabasePool } from "../db.js";

export const HUNT_CAMPAIGN = "receipt-hunt-01";
const ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const STATES = ["pending", "approved", "rejected"];
const client = createPublicClient({ chain: base, transport: http(runtimeConfig.rpcUrl || "https://mainnet.base.org") });
const router = Router();

class HuntError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export function huntMessage(action: string, wallet: string, data: unknown, deadline: number): string {
  return ["Replate Receipt Hunt", `Campaign: ${HUNT_CAMPAIGN}`, `Chain: ${base.id}`,
    `Contract: ${runtimeConfig.contractAddress.toLowerCase()}`, `Action: ${action}`,
    `Wallet: ${wallet.toLowerCase()}`, `Data: ${keccak256(toBytes(JSON.stringify(data)))}`, `Expires: ${deadline}`].join("\n");
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new HuntError("Invalid request");
  return value as Record<string, unknown>;
}

async function authenticate(body: Record<string, unknown>, action: string, data: unknown, admin = false): Promise<string> {
  const { wallet, signature, deadline } = body;
  const now = Math.floor(Date.now() / 1000);
  if (typeof wallet !== "string" || !ADDRESS.test(wallet) || typeof signature !== "string" ||
      !/^0x(?:[a-fA-F0-9]{2})+$/.test(signature) || signature.length > 20000 ||
      typeof deadline !== "number" || !Number.isSafeInteger(deadline) || deadline <= now || deadline > now + 300) {
    throw new HuntError("A valid, unexpired wallet signature is required", 401);
  }
  const valid = await client.verifyMessage({ address: wallet as `0x${string}`, signature: signature as `0x${string}`,
    message: huntMessage(action, wallet, data, deadline), mode: "eoa" });
  if (!valid) throw new HuntError("Invalid wallet signature", 401);
  if (admin) {
    const validator = await client.readContract({ address: runtimeConfig.contractAddress as `0x${string}`,
      abi: [{ type: "function", name: "validator", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] }], functionName: "validator" });
    if (validator.toLowerCase() !== wallet.toLowerCase()) throw new HuntError("Only the Replate validator wallet can review tasks", 403);
  }
  return wallet.toLowerCase();
}

function jpeg(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 1500000 || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) return false;
  const bytes = Buffer.from(value.slice("data:image/jpeg;base64,".length), "base64");
  return bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function postUrl(value: unknown, username?: string): value is string {
  if (typeof value !== "string" || value.length > 250) return false;
  try {
    const url = new URL(value);
    const match = url.pathname.match(/^\/([a-z0-9_]{1,15})\/status\/\d+\/?$/i);
    return url.protocol === "https:" && ["x.com", "twitter.com", "www.x.com", "www.twitter.com"].includes(url.hostname) &&
      !url.username && !url.password && !url.port && !!match && (!username || match[1].toLowerCase() === username);
  } catch { return false; }
}

function run(handler: (req: Request, res: Response) => Promise<void>) {
  return async (req: Request, res: Response) => {
    res.set("Cache-Control", "no-store");
    try { await handler(req, res); }
    catch (error) {
      if (error instanceof HuntError) { res.status(error.status).json({ success: false, error: error.message }); return; }
      if ((error as { code?: string })?.code === "23505") {
        res.status(409).json({ success: false, error: "This X account is already approved for another wallet" }); return;
      }
      console.error("Receipt Hunt request failed");
      res.status(503).json({ success: false, error: "Receipt Hunt review is unavailable. Please try again later." });
    }
  };
}

router.get("/status/:wallet", run(async (req, res) => {
  const wallet = String(req.params.wallet);
  if (!ADDRESS.test(wallet)) throw new HuntError("A valid wallet address is required");
  const result = await getDatabasePool().query(
    "SELECT follow_status, engagement_status, revision FROM receipt_hunt_submissions WHERE campaign_id = $1 AND wallet_address = $2",
    [HUNT_CAMPAIGN, wallet.toLowerCase()],
  );
  const row = result.rows[0];
  const announcement = process.env.RECEIPT_HUNT_ANNOUNCEMENT_URL?.trim() || "";
  res.json({ success: true, data: { followStatus: row?.follow_status || "not_submitted", engagementStatus: row?.engagement_status || "not_submitted",
    revision: row?.revision || 0, unlocked: row?.follow_status === "approved" && row?.engagement_status === "approved",
    announcementUrl: postUrl(announcement) ? announcement : null } });
}));

router.post("/submit", run(async (req, res) => {
  const body = record(req.body);
  const data = record(body.data);
  const { xUsername, followProof, engagementProof, repostUrl, revision } = data;
  if (typeof xUsername !== "string" || !/^[a-z0-9_]{1,15}$/.test(xUsername) || !jpeg(followProof) || !jpeg(engagementProof) ||
      typeof revision !== "number" || !Number.isSafeInteger(revision) || revision < 0 ||
      (repostUrl !== "" && !postUrl(repostUrl, xUsername))) {
    throw new HuntError("Provide your X username, two JPEG screenshots, and a valid submission revision. Any post link must belong to your X account.");
  }
  const wallet = await authenticate(body, "submit", data);
  const result = await getDatabasePool().query(
    `INSERT INTO receipt_hunt_submissions (campaign_id, wallet_address, x_username, follow_proof, engagement_proof, repost_url)
     SELECT $1, $2, $3, $4, $5, $6 WHERE $7 = 0 OR EXISTS (
       SELECT 1 FROM receipt_hunt_submissions WHERE campaign_id = $1 AND wallet_address = $2 AND revision = $7)
     ON CONFLICT (campaign_id, wallet_address) DO UPDATE SET x_username = EXCLUDED.x_username,
       follow_proof = EXCLUDED.follow_proof, engagement_proof = EXCLUDED.engagement_proof, repost_url = EXCLUDED.repost_url,
       follow_status = 'pending', engagement_status = 'pending', reviewer_wallet = NULL, reviewed_at = NULL,
       revision = receipt_hunt_submissions.revision + 1, updated_at = NOW()
     WHERE receipt_hunt_submissions.revision = $7
       AND NOT (receipt_hunt_submissions.follow_status = 'approved' AND receipt_hunt_submissions.engagement_status = 'approved')
     RETURNING revision`,
    [HUNT_CAMPAIGN, wallet, xUsername, followProof, engagementProof, repostUrl, revision],
  );
  if (!result.rows.length) throw new HuntError("Your submission changed or is already approved. Refresh its status before continuing.", 409);
  res.json({ success: true, data: { revision: result.rows[0].revision } });
}));

router.post("/admin/list", run(async (req, res) => {
  await authenticate(record(req.body), "review-access", {}, true);
  // shortcut: show the latest 100 submissions during the pilot; paginate before expanding the campaign.
  const result = await getDatabasePool().query(
    `SELECT id::text, wallet_address, x_username, repost_url, follow_status, engagement_status, revision, updated_at
     FROM receipt_hunt_submissions WHERE campaign_id = $1 ORDER BY updated_at DESC LIMIT 100`, [HUNT_CAMPAIGN],
  );
  res.json({ success: true, data: result.rows });
}));

router.post("/admin/proof/:id", run(async (req, res) => {
  await authenticate(record(req.body), "review-access", {}, true);
  const id = String(req.params.id);
  if (!/^\d{1,18}$/.test(id)) throw new HuntError("Invalid submission ID");
  const result = await getDatabasePool().query(
    "SELECT id::text, wallet_address, x_username, repost_url, follow_status, engagement_status, revision, follow_proof, engagement_proof FROM receipt_hunt_submissions WHERE id = $1 AND campaign_id = $2",
    [id, HUNT_CAMPAIGN],
  );
  if (!result.rows.length) throw new HuntError("Submission not found", 404);
  res.json({ success: true, data: result.rows[0] });
}));

router.post("/admin/review", run(async (req, res) => {
  const body = record(req.body);
  const data = record(body.data);
  const { id, revision, followStatus, engagementStatus } = data;
  if (typeof id !== "string" || !/^\d{1,18}$/.test(id) || typeof revision !== "number" || !Number.isSafeInteger(revision) || revision < 1 ||
      typeof followStatus !== "string" || !STATES.includes(followStatus) || typeof engagementStatus !== "string" || !STATES.includes(engagementStatus)) {
    throw new HuntError("Invalid review decision");
  }
  const reviewer = await authenticate(body, "review", data, true);
  const result = await getDatabasePool().query(
    `UPDATE receipt_hunt_submissions SET follow_status = $1, engagement_status = $2,
       reviewer_wallet = $3, reviewed_at = NOW(), updated_at = NOW(), revision = revision + 1
     WHERE id = $4 AND campaign_id = $5 AND revision = $6 RETURNING revision`,
    [followStatus, engagementStatus, reviewer, id, HUNT_CAMPAIGN, revision],
  );
  if (!result.rows.length) throw new HuntError("This submission changed. Reload its evidence before reviewing.", 409);
  res.json({ success: true, data: { revision: result.rows[0].revision } });
}));

export default router;
