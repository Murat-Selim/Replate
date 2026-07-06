import { Router, Request, Response } from "express";
import {
  getUserNonce,
  submitCheckInWithSig,
  submitReceiptWithSig,
} from "../services/contract.js";
import { clearLeaderboardCache } from "./leaderboard.js";
import { verifyTypedData } from "viem";

const router = Router();

// ─── EIP-712 Domain ──────────────────────────────────────────────────
const EIP712_DOMAIN = {
  name: "ReplateQuest" as const,
  version: "1" as const,
  chainId: Number(process.env.CHAIN_ID) || 8453, // 8453 = Base Mainnet, 84532 = Base Sepolia
  verifyingContract: (process.env.CONTRACT_ADDRESS ||
    "0x9d646D474ba0D1bF03E61453898c160b7f9e3E90") as `0x${string}`,
};

// ─── EIP-712 Types ───────────────────────────────────────────────────
const CHECK_IN_TYPES = {
  CheckIn: [
    { name: "user", type: "address" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

const RECEIPT_TYPES = {
  SubmitReceipt: [
    { name: "user", type: "address" },
    { name: "totalItems", type: "uint8" },
    { name: "healthyItems", type: "uint8" },
    { name: "unhealthyItems", type: "uint8" },
    { name: "fruitVegGrams", type: "uint16" },
    { name: "householdSize", type: "uint8" },
    { name: "daysCovered", type: "uint8" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

// ─── GET /api/meta/nonce/:address ────────────────────────────────────
router.get("/nonce/:address", async (req: Request, res: Response) => {
  try {
    const { address } = req.params;

    if (!address || typeof address !== "string" || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      res.status(400).json({ error: "Valid address is required" });
      return;
    }

    const nonce = await getUserNonce(address);
    res.json({ nonce, address });
  } catch (error) {
    console.error("❌ Nonce fetch failed:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
});

// ─── POST /api/meta/checkin-sig ──────────────────────────────────────
router.post("/checkin-sig", async (req: Request, res: Response) => {
  try {
    const { userAddress, nonce, deadline, signature } = req.body;

    // Validation
    if (!userAddress || !/^0x[a-fA-F0-9]{40}$/.test(userAddress)) {
      res.status(400).json({ error: "Valid user address is required" });
      return;
    }
    if (nonce === undefined || nonce === null) {
      res.status(400).json({ error: "Nonce is required" });
      return;
    }
    if (!deadline) {
      res.status(400).json({ error: "Deadline is required" });
      return;
    }
    if (!signature) {
      res.status(400).json({ error: "Signature is required" });
      return;
    }

    // Check deadline hasn't passed
    const now = Math.floor(Date.now() / 1000);
    if (deadline <= now) {
      res.status(400).json({ error: "Signature deadline has passed" });
      return;
    }

    // Verify signature off-chain first (saves gas on invalid sigs)
    const isValid = await verifyTypedData({
      address: userAddress as `0x${string}`,
      domain: EIP712_DOMAIN,
      types: CHECK_IN_TYPES,
      primaryType: "CheckIn",
      message: {
        user: userAddress as `0x${string}`,
        nonce: BigInt(nonce),
        deadline: BigInt(deadline),
      },
      signature: signature as `0x${string}`,
    });

    if (!isValid) {
      res.status(400).json({ error: "Invalid signature" });
      return;
    }

    console.log(`📍 Processing EIP-712 check-in for ${userAddress}...`);

    const result = await submitCheckInWithSig(
      userAddress,
      Number(deadline),
      signature
    );

    // Refresh leaderboard
    clearLeaderboardCache();

    res.json({
      success: true,
      data: {
        pointsEarned: result.pointsEarned,
        txHash: result.txHash,
      },
    });
  } catch (error) {
    console.error("❌ CheckIn with sig failed:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
});

// ─── POST /api/meta/receipt-sig ──────────────────────────────────────
router.post("/receipt-sig", async (req: Request, res: Response) => {
  try {
    const {
      userAddress,
      totalItems,
      healthyItems,
      unhealthyItems,
      fruitVegGrams,
      householdSize,
      daysCovered,
      nonce,
      deadline,
      signature,
    } = req.body;

    // Validation
    if (!userAddress || !/^0x[a-fA-F0-9]{40}$/.test(userAddress)) {
      res.status(400).json({ error: "Valid user address is required" });
      return;
    }
    if (!totalItems || totalItems < 1) {
      res.status(400).json({ error: "Total items must be at least 1" });
      return;
    }
    if (!householdSize || householdSize < 1 || householdSize > 10) {
      res.status(400).json({ error: "Household size must be 1-10" });
      return;
    }
    if (!signature || !deadline) {
      res.status(400).json({ error: "Signature and deadline are required" });
      return;
    }

    // Check deadline
    const now = Math.floor(Date.now() / 1000);
    if (deadline <= now) {
      res.status(400).json({ error: "Signature deadline has passed" });
      return;
    }

    // Verify signature off-chain first
    const isValid = await verifyTypedData({
      address: userAddress as `0x${string}`,
      domain: EIP712_DOMAIN,
      types: RECEIPT_TYPES,
      primaryType: "SubmitReceipt",
      message: {
        user: userAddress as `0x${string}`,
        totalItems,
        healthyItems,
        unhealthyItems,
        fruitVegGrams,
        householdSize,
        daysCovered: daysCovered || 1,
        nonce: BigInt(nonce),
        deadline: BigInt(deadline),
      },
      signature: signature as `0x${string}`,
    });

    if (!isValid) {
      res.status(400).json({ error: "Invalid signature" });
      return;
    }

    console.log(`📊 Processing EIP-712 receipt for ${userAddress}...`);

    const result = await submitReceiptWithSig(
      {
        user: userAddress,
        totalItems,
        healthyItems,
        unhealthyItems,
        fruitVegGrams,
        householdSize,
        daysCovered: daysCovered || 1,
      },
      Number(deadline),
      signature
    );

    // Refresh leaderboard
    clearLeaderboardCache();

    res.json({
      success: true,
      data: {
        txHash: result.txHash,
        healthScore: result.healthScore,
        nutritionScore: result.nutritionScore,
        pointsEarned: result.pointsEarned,
        daysCovered: result.daysCovered,
        badgeMinted: result.badgeMinted,
      },
    });
  } catch (error) {
    console.error("❌ Receipt with sig failed:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
});

export default router;
