import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
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
});
