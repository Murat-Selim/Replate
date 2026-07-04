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

type ReplateQuestContract = Contract & {
  submitReceipt: (user: string, totalItems: number, healthyItems: number, unhealthyItems: number, fruitVegGrams: number, householdSize: number, daysCovered: number) => Promise<any>;
  acceptValidator: () => Promise<any>;
  checkIn: (user: string) => Promise<any>;
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
    });
  });

  describe("submitReceipt", function () {
    it("should submit a receipt and calculate correct scores", async function () {
      await replate.submitReceipt(
        user1.address,
        10,
        6,
        2,
        600,
        2,
        1
      );

      const summary = await replate.getUserSummary(user1.address);
      expect(summary._receiptCount).to.equal(1);
      expect(summary._totalPoints).to.be.gt(0);
    });

    it("should prevent duplicate receipts on same day", async function () {
      await replate.submitReceipt(
        user1.address, 10, 6, 2, 600, 2, 1
      );

      await expect(
        replate.submitReceipt(user1.address, 10, 6, 2, 600, 2, 1)
      ).to.be.revertedWith("Already submitted a receipt today");
    });

    it("should only allow validator to submit", async function () {
      await expect(
        replate.connect(user1).submitReceipt(user1.address, 10, 6, 2, 600, 2, 1)
      ).to.be.revertedWith("Unauthorized");
    });

    it("should mint badge when health and nutrition scores are high enough", async function () {
      await replate.submitReceipt(
        user1.address,
        10,
        8,
        1,
        600,
        2,
        1
      );

      expect(await replate.hasBadge(user1.address)).to.be.true;
    });
  });

  describe("checkIn", function () {
    it("should allow daily check-in and award 10 XP", async function () {
      await replate.checkIn(user1.address);

      const summary = await replate.getUserSummary(user1.address);
      expect(summary._totalPoints).to.equal(10);
      expect(summary._checkInStreak).to.equal(1);
    });

    it("should prevent duplicate check-ins on same day", async function () {
      await replate.checkIn(user1.address);

      await expect(
        replate.checkIn(user1.address)
      ).to.be.revertedWith("Already checked in today");
    });

    it("should increment streak on consecutive days", async function () {
      await replate.checkIn(user1.address);
      
      await ethers.provider.send("evm_increaseTime", [86400]);
      await ethers.provider.send("evm_mine", []);

      await replate.checkIn(user1.address);

      const summary = await replate.getUserSummary(user1.address);
      expect(summary._checkInStreak).to.equal(2);
    });
  });

  describe("finalizeWeek", function () {
    it("should increment streak for healthy week", async function () {
      for (let i = 0; i < 3; i++) {
        await replate.submitReceipt(user1.address, 10, 8, 1, 600, 2, 1);
        
        await ethers.provider.send("evm_increaseTime", [86400]);
        await ethers.provider.send("evm_mine", []);
      }

      await ethers.provider.send("evm_increaseTime", [7 * 86400]);
      await ethers.provider.send("evm_mine", []);

      await replate.finalizeWeek(user1.address);

      const summary = await replate.getUserSummary(user1.address);
      expect(summary._receiptStreak).to.equal(1);
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

    it("should allow validator to change phase", async function () {
      await replate.setPhase(1);
      expect(await replate.currentPhase()).to.equal(1);
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
      await replate.submitReceipt(user1.address, 10, 6, 2, 600, 2, 1);
      await replate.checkIn(user1.address);

      const summary = await replate.getUserSummary(user1.address);
      expect(summary._receiptCount).to.equal(1);
      expect(summary._totalCheckIns).to.equal(1);
    });

    it("should return current week report", async function () {
      await replate.submitReceipt(user1.address, 10, 6, 2, 600, 2, 1);

      const report = await replate.getCurrentWeekReport(user1.address);
      expect(report.receiptCount).to.equal(1);
      expect(report.weekPoints).to.be.gt(0);
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
      it("should accept valid EIP-712 signature for receipt", async function () {
        const nonce = await (replateV2 as any).nonces(user1.address);
        const block = await ethers.provider.getBlock("latest");
        const deadline = block!.timestamp + 3600;

        const message = {
          user: user1.address,
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

        await (replateV2 as any).submitReceiptWithSig(
          user1.address,
          10, 6, 2, 600, 2, 1,
          deadline,
          signature
        );

        const summary = await replateV2.getUserSummary(user1.address);
        expect(summary._receiptCount).to.equal(1);
        expect(summary._totalPoints).to.be.gt(0);
      });

      it("should reject invalid signature for receipt", async function () {
        const nonce = await (replateV2 as any).nonces(user1.address);
        const block = await ethers.provider.getBlock("latest");
        const deadline = block!.timestamp + 3600;

        const message = {
          user: user1.address,
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

        await expect(
          (replateV2 as any).submitReceiptWithSig(
            user1.address,
            10, 6, 2, 600, 2, 1,
            deadline,
            signature
          )
        ).to.be.revertedWith("Invalid signature");
      });

      it("should prevent nonce replay for receipts", async function () {
        const nonce = await (replateV2 as any).nonces(user1.address);
        const block = await ethers.provider.getBlock("latest");
        const deadline = block!.timestamp + 86400 * 2; // 2 days

        const message = {
          user: user1.address,
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

        // First call succeeds
        await (replateV2 as any).submitReceiptWithSig(
          user1.address,
          10, 6, 2, 600, 2, 1,
          deadline,
          signature
        );

        // Advance to next day
        await ethers.provider.send("evm_increaseTime", [86400]);
        await ethers.provider.send("evm_mine", []);

        // Same signature with old nonce should fail
        await expect(
          (replateV2 as any).submitReceiptWithSig(
            user1.address,
            10, 6, 2, 600, 2, 1,
            deadline,
            signature
          )
        ).to.be.revertedWith("Invalid signature");
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
