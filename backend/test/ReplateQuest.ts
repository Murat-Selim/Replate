import { expect } from "chai";
import hardhat from "hardhat";
const { ethers } = hardhat;
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers.js";
import { Contract } from "ethers";
import "@nomicfoundation/hardhat-chai-matchers";

declare global {
  var upgrades: {
    deployProxy: (factory: any, args?: any[], options?: any) => Promise<any>;
    upgradeProxy: (proxy: any, factory: any, options?: any) => Promise<any>;
    prepareUpgrade: (proxy: any, factory: any, options?: any) => Promise<any>;
  };
}

const USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

function packReceiptSignatures(userSignature: string, validatorSignature: string): string {
  return ethers.AbiCoder.defaultAbiCoder().encode(
    ["bytes", "bytes"],
    [userSignature, validatorSignature]
  );
}

type ReplateQuestContract = Contract & {
  acceptValidator: () => Promise<any>;
  finalizeWeek: (user: string) => Promise<any>;
  pause: () => Promise<any>;
  unpause: () => Promise<any>;
  setPhase: (phase: number) => Promise<any>;
  transferValidator: (newValidator: string) => Promise<any>;
  connect: (signer: HardhatEthersSigner) => ReplateQuestContract;
  validator: () => Promise<string>;
  devWallet: () => Promise<string>;
  currentPhase: () => Promise<number>;
  paused: () => Promise<boolean>;
  pendingValidator: () => Promise<string>;
  hasBadge: (user: string) => Promise<boolean>;
  getUserSummary: (user: string) => Promise<any>;
  getCurrentWeekReport: (user: string) => Promise<any>;
  getPoolStatus: () => Promise<any>;
};

describe("ReplateQuest", function () {
  let replate: ReplateQuestContract;
  let owner: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;
  let devWallet: HardhatEthersSigner;

  beforeEach(async function () {
    [owner, user1, user2, devWallet] = await ethers.getSigners();

    const ReplateQuestFactory = await ethers.getContractFactory("ReplateQuest");
    
    const proxy = await upgrades.deployProxy(
      ReplateQuestFactory,
      [USDC_ADDRESS, devWallet.address],
      { kind: "uups" }
    );

    replate = proxy as unknown as ReplateQuestContract;
  });

  describe("Initialization", function () {
    it("should set the correct validator", async function () {
      expect(await replate.validator()).to.equal(owner.address);
    });

    it("should set the correct dev wallet", async function () {
      expect(await replate.devWallet()).to.equal(devWallet.address);
    });

    it("should start in FREE phase", async function () {
      expect(await replate.currentPhase()).to.equal(0);
      expect(await (replate as any).FEE()).to.equal(500_000);
    });
  });

  describe("claimQuestXp", function () {
    it("awards quest XP once and only through the validator", async function () {
      const questId = ethers.id("receipts-2");
      const weekKey = ethers.id("2026-W33");

      await expect(
        (replate as any).claimQuestXp(user1.address, questId, weekKey, 80)
      ).to.emit(replate, "QuestXpClaimed").withArgs(user1.address, questId, weekKey, 80);

      expect(await (replate as any).totalPoints(user1.address)).to.equal(80);
      await expect(
        (replate as any).claimQuestXp(user1.address, questId, weekKey, 80)
      ).to.be.revertedWith("Quest XP already claimed");
      await expect(
        (replate.connect(user1) as any).claimQuestXp(user1.address, ethers.id("health-65"), weekKey, 100)
      ).to.be.revertedWith("Unauthorized");
    });
  });

  describe("finalizeWeek", function () {
    it("should reset streak when the finalized week is empty", async function () {
      await ethers.provider.send("evm_increaseTime", [7 * 86400]);
      await ethers.provider.send("evm_mine", []);

      await replate.finalizeWeek(user1.address);

      const summary = await replate.getUserSummary(user1.address);
      expect(summary._receiptStreak).to.equal(0);
    });
  });

  describe("Admin Functions", function () {
    it("should allow validator to pause", async function () {
      await replate.pause();
      expect(await replate.paused()).to.be.true;
    });

    it("should allow validator to unpause", async function () {
      await replate.pause();
      await replate.unpause();
      expect(await replate.paused()).to.be.false;
    });

    it("should keep the contract permanently in FREE phase", async function () {
      await expect(replate.setPhase(1)).to.be.revertedWith("Paid phase disabled");
      expect(await replate.currentPhase()).to.equal(0);
    });

    it("should initiate validator transfer", async function () {
      await replate.transferValidator(user2.address);
      expect(await replate.pendingValidator()).to.equal(user2.address);
    });

    it("should allow new validator to accept transfer", async function () {
      await replate.transferValidator(user2.address);
      await replate.connect(user2).acceptValidator();
      expect(await replate.validator()).to.equal(user2.address);
    });
  });

  describe("View Functions", function () {
    it("should return correct user summary", async function () {
      const summary = await replate.getUserSummary(user1.address);
      expect(summary._receiptCount).to.equal(0);
      expect(summary._totalCheckIns).to.equal(0);
    });

    it("should return current week report", async function () {
      const report = await replate.getCurrentWeekReport(user1.address);
      expect(report.receiptCount).to.equal(0);
      expect(report.weekPoints).to.equal(0);
    });

    it("should return pool status", async function () {
      const status = await replate.getPoolStatus();
      expect(status._currentPhase).to.equal(0);
      expect(status._weeklyPool).to.equal(0);
    });
  });

  // ─── EIP-712 Meta-Transaction Tests ────────────────────────────────
  describe("EIP-712 Meta-Transactions", function () {
    const DOMAIN_NAME = "ReplateQuest";
    const DOMAIN_VERSION = "1";

    // Must match contract typehashes
    const CHECK_IN_TYPES = {
      CheckIn: [
        { name: "user", type: "address" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    };

    const RECEIPT_TYPES = {
      SubmitReceipt: [
        { name: "user", type: "address" },
        { name: "receiptHash", type: "bytes32" },
        { name: "totalItems", type: "uint8" },
        { name: "healthyItems", type: "uint8" },
        { name: "unhealthyItems", type: "uint8" },
        { name: "fruitVegGrams", type: "uint16" },
        { name: "householdSize", type: "uint8" },
        { name: "daysCovered", type: "uint8" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    };

    let replateV2: ReplateQuestContract;
    let domain: {
      name: string;
      version: string;
      chainId: number;
      verifyingContract: string;
    };

    beforeEach(async function () {
      // Initialize V2 for EIP-712 support
      await (replate as any).initializeV2();

      replateV2 = replate;
      const contractAddress = await replateV2.getAddress();
      const network = await ethers.provider.getNetwork();

      domain = {
        name: DOMAIN_NAME,
        version: DOMAIN_VERSION,
        chainId: Number(network.chainId),
        verifyingContract: contractAddress,
      };
    });

    describe("checkInWithSig", function () {
      it("should accept valid EIP-712 signature for check-in", async function () {
        const nonce = await (replateV2 as any).nonces(user1.address);
        const block = await ethers.provider.getBlock("latest");
        const deadline = block!.timestamp + 3600; // 1 hour from now

        const message = {
          user: user1.address,
          nonce: nonce,
          deadline: deadline,
        };

        // user1 signs the typed data
        const signature = await user1.signTypedData(domain, CHECK_IN_TYPES, message);

        // Anyone can relay the transaction
        await (replateV2 as any).checkInWithSig(
          user1.address,
          deadline,
          signature
        );

        const summary = await replateV2.getUserSummary(user1.address);
        expect(summary._totalPoints).to.equal(10);
        expect(summary._totalCheckIns).to.equal(1);
      });

      it("should reject invalid signature", async function () {
        const nonce = await (replateV2 as any).nonces(user1.address);
        const block = await ethers.provider.getBlock("latest");
        const deadline = block!.timestamp + 3600;

        const message = {
          user: user1.address,
          nonce: nonce,
          deadline: deadline,
        };

        // user2 signs instead of user1 — wrong signer
        const signature = await user2.signTypedData(domain, CHECK_IN_TYPES, message);

        await expect(
          (replateV2 as any).checkInWithSig(user1.address, deadline, signature)
        ).to.be.revertedWith("Invalid signature");
      });

      it("should reject expired deadline", async function () {
        const nonce = await (replateV2 as any).nonces(user1.address);
        const block = await ethers.provider.getBlock("latest");
        const deadline = block!.timestamp - 1; // Already expired

        const message = {
          user: user1.address,
          nonce: nonce,
          deadline: deadline,
        };

        const signature = await user1.signTypedData(domain, CHECK_IN_TYPES, message);

        await expect(
          (replateV2 as any).checkInWithSig(user1.address, deadline, signature)
        ).to.be.revertedWith("Signature expired");
      });

      it("should prevent nonce replay (same signature twice)", async function () {
        const nonce = await (replateV2 as any).nonces(user1.address);
        const block = await ethers.provider.getBlock("latest");
        const deadline = block!.timestamp + 86400 * 2; // 2 days — survives 1-day time advance

        const message = {
          user: user1.address,
          nonce: nonce,
          deadline: deadline,
        };

        const signature = await user1.signTypedData(domain, CHECK_IN_TYPES, message);

        // First call succeeds
        await (replateV2 as any).checkInWithSig(user1.address, deadline, signature);

        // Advance time to next day so "Already checked in today" doesn't interfere
        await ethers.provider.send("evm_increaseTime", [86400]);
        await ethers.provider.send("evm_mine", []);

        // Same signature with old nonce should fail
        await expect(
          (replateV2 as any).checkInWithSig(user1.address, deadline, signature)
        ).to.be.revertedWith("Invalid signature");
      });
    });

    describe("submitReceiptWithSig", function () {
      const TEST_RECEIPT_HASH = ethers.id("test-receipt");
      it("should accept valid EIP-712 signature for receipt", async function () {
        const nonce = await (replateV2 as any).nonces(user1.address);
        const block = await ethers.provider.getBlock("latest");
        const deadline = block!.timestamp + 3600;

        const message = {
          user: user1.address,
          receiptHash: TEST_RECEIPT_HASH,
          totalItems: 10,
          healthyItems: 6,
          unhealthyItems: 2,
          fruitVegGrams: 600,
          householdSize: 2,
          daysCovered: 1,
          nonce: nonce,
          deadline: deadline,
        };

        const signature = await user1.signTypedData(domain, RECEIPT_TYPES, message);
        const validatorSignature = await owner.signTypedData(domain, RECEIPT_TYPES, message);

        await (replateV2 as any).submitReceiptWithSig(
          user1.address,
          TEST_RECEIPT_HASH,
           10, 6, 2, 600, 2, 1,
           deadline,
           packReceiptSignatures(signature, validatorSignature)
        );

        expect(await (replateV2 as any).usedReceiptHashes(TEST_RECEIPT_HASH)).to.be.true;
        const summary = await replateV2.getUserSummary(user1.address);
        expect(summary._receiptCount).to.equal(1);
        expect(summary._totalPoints).to.be.gt(0);
        expect(await (replateV2 as any).balanceOf(user1.address)).to.equal(1);
        expect(await (replateV2 as any).hasBadge(user1.address)).to.be.true;
        expect(await (replateV2 as any).ownerOf(1)).to.equal(user1.address);

        await (replateV2 as any).setBadgeBaseURI("ipfs://badge-cid/");
        expect(await (replateV2 as any).tokenURI(1)).to.equal("ipfs://badge-cid/1");
        await expect(
          (replateV2.connect(user1) as any).transferFrom(user1.address, user2.address, 1)
        ).to.be.revertedWith("Badge is soulbound");
      });

      it("should not overflow expected grams for a 10x30-day household", async function () {
        const nonce = await (replateV2 as any).nonces(user1.address);
        const block = await ethers.provider.getBlock("latest");
        const deadline = block!.timestamp + 3600;
        const receiptHash = ethers.id("large-expected-grams");
        const message = {
          user: user1.address,
          receiptHash,
          totalItems: 10,
          healthyItems: 6,
          unhealthyItems: 2,
          fruitVegGrams: 600,
          householdSize: 10,
          daysCovered: 30,
          nonce,
          deadline,
        };
        const userSignature = await user1.signTypedData(domain, RECEIPT_TYPES, message);
        const validatorSignature = await owner.signTypedData(domain, RECEIPT_TYPES, message);

        const tx = (replateV2 as any).submitReceiptWithSig(
            user1.address,
            receiptHash,
            10, 6, 2, 600, 10, 30,
            deadline,
            packReceiptSignatures(userSignature, validatorSignature)
          );
        await expect(tx).to.emit(replateV2, "ReceiptVerified")
          .withArgs(receiptHash, user1.address, 70, 10, 60, 10, 6, 2, 600, 90000);
      });

      it("should allow multiple receipts on the same day and week", async function () {
        const block = await ethers.provider.getBlock("latest");
        const deadline = block!.timestamp + 3600;

        for (const index of Array.from({ length: 8 }, (_, value) => value + 1)) {
          const receiptHash = ethers.id(`same-period-${index}`);
          const nonce = await (replateV2 as any).nonces(user1.address);
          const message = {
            user: user1.address,
            receiptHash,
            totalItems: 10,
            healthyItems: 6,
            unhealthyItems: 2,
            fruitVegGrams: 600,
            householdSize: 2,
            daysCovered: 1,
            nonce,
            deadline,
          };
          const signature = await user1.signTypedData(domain, RECEIPT_TYPES, message);
          const validatorSignature = await owner.signTypedData(domain, RECEIPT_TYPES, message);

          await (replateV2 as any).submitReceiptWithSig(
            user1.address,
            receiptHash,
            10, 6, 2, 600, 2, 1,
            deadline,
            packReceiptSignatures(signature, validatorSignature),
          );
        }

        const summary = await replateV2.getUserSummary(user1.address);
        expect(summary._receiptCount).to.equal(8);
      });

      it("should reject invalid signature for receipt", async function () {
        const nonce = await (replateV2 as any).nonces(user1.address);
        const block = await ethers.provider.getBlock("latest");
        const deadline = block!.timestamp + 3600;

        const message = {
          user: user1.address,
          receiptHash: TEST_RECEIPT_HASH,
          totalItems: 10,
          healthyItems: 6,
          unhealthyItems: 2,
          fruitVegGrams: 600,
          householdSize: 2,
          daysCovered: 1,
          nonce: nonce,
          deadline: deadline,
        };

        // Wrong signer
        const signature = await user2.signTypedData(domain, RECEIPT_TYPES, message);
        const validatorSignature = await owner.signTypedData(domain, RECEIPT_TYPES, message);

        await expect(
          (replateV2 as any).submitReceiptWithSig(
            user1.address,
            TEST_RECEIPT_HASH,
            10, 6, 2, 600, 2, 1,
            deadline,
            packReceiptSignatures(signature, validatorSignature)
          )
        ).to.be.revertedWith("Invalid user signature");
      });

      it("should prevent receipt hash replay even after a day", async function () {
        const nonce = await (replateV2 as any).nonces(user1.address);
        const block = await ethers.provider.getBlock("latest");
        const deadline = block!.timestamp + 86400 * 2; // 2 days

        const message = {
          user: user1.address,
          receiptHash: TEST_RECEIPT_HASH,
          totalItems: 10,
          healthyItems: 6,
          unhealthyItems: 2,
          fruitVegGrams: 600,
          householdSize: 2,
          daysCovered: 1,
          nonce: nonce,
          deadline: deadline,
        };

        const signature = await user1.signTypedData(domain, RECEIPT_TYPES, message);
        const validatorSignature = await owner.signTypedData(domain, RECEIPT_TYPES, message);
        const signatures = packReceiptSignatures(signature, validatorSignature);

        // First call succeeds
        await (replateV2 as any).submitReceiptWithSig(
          user1.address,
          TEST_RECEIPT_HASH,
           10, 6, 2, 600, 2, 1,
           deadline,
           signatures
        );

        // Advance to next day
        await ethers.provider.send("evm_increaseTime", [86400]);
        await ethers.provider.send("evm_mine", []);

        // Same signature with old nonce should fail
        await expect(
          (replateV2 as any).submitReceiptWithSig(
            user1.address,
            TEST_RECEIPT_HASH,
            10, 6, 2, 600, 2, 1,
            deadline,
            signatures
          )
        ).to.be.revertedWith("Receipt already used");
      });
    });

    describe("Nonce management", function () {
      it("should increment nonce after each WithSig call", async function () {
        const nonce0 = await (replateV2 as any).nonces(user1.address);
        expect(nonce0).to.equal(0);

        const block = await ethers.provider.getBlock("latest");
        const deadline = block!.timestamp + 3600;

        const message = {
          user: user1.address,
          nonce: nonce0,
          deadline: deadline,
        };

        const signature = await user1.signTypedData(domain, CHECK_IN_TYPES, message);
        await (replateV2 as any).checkInWithSig(user1.address, deadline, signature);

        const nonce1 = await (replateV2 as any).nonces(user1.address);
        expect(nonce1).to.equal(1);
      });
    });
  });
});
