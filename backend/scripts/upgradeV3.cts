import hardhat from "hardhat";
import "@openzeppelin/hardhat-upgrades";
const { ethers, upgrades } = hardhat;
const hre = hardhat;

/**
 * Upgrade ReplateQuest proxy to V3 (Dynamic FEE variable + setFee admin function)
 * Usage:
 *   npx hardhat run scripts/upgradeV3.cts --network baseSepolia
 *   npx hardhat run scripts/upgradeV3.cts --network baseMainnet
 */
async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Upgrading ReplateQuest to V3 with account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // The existing proxy address — must match what's in .openzeppelin/*.json
  const network = await ethers.provider.getNetwork();
  const defaultProxy = network.chainId === 84532n
    ? "0x99AEb0FEC26Dd8b0f237399bDad9812134D0C8F9"
    : "0x9d646D474ba0D1bF03E61453898c160b7f9e3E90";
  const PROXY_ADDRESS = process.env.CONTRACT_ADDRESS || defaultProxy;

  console.log("\nUpgrade parameters:");
  console.log("- Proxy Address:", PROXY_ADDRESS);
  console.log("- Network:", network.name);

  // Check if initializeV3 has already been executed
  const currentContract = await ethers.getContractAt("ReplateQuest", PROXY_ADDRESS);
  let isAlreadyV3 = false;
  try {
    const existingFee = await currentContract.FEE();
    if (existingFee > 0n) {
      isAlreadyV3 = true;
      console.log(`\nℹ️  Contract is already running V3 (Current FEE = ${existingFee.toString()} / ${(Number(existingFee) / 1e6).toFixed(2)} USDC). Skipping initializeV3 call.`);
    }
  } catch (e) {
    console.log("\nContract is upgrading to V3 for the first time. Will execute initializeV3()...");
  }

  const ReplateQuestV3 = await ethers.getContractFactory("ReplateQuest");

  console.log("\nUpgrading proxy...");

  const upgradeOpts = isAlreadyV3 ? {} : { call: { fn: "initializeV3", args: [] } };
  const upgraded = await upgrades.upgradeProxy(PROXY_ADDRESS, ReplateQuestV3, upgradeOpts);

  await upgraded.waitForDeployment();

  const proxyAddress = await upgraded.getAddress();
  const implementationSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  const implementationRaw = await ethers.provider.getStorage(proxyAddress, implementationSlot);
  const implementationAddress = ethers.getAddress(ethers.dataSlice(implementationRaw, 12));

  // Read the FEE variable
  const fee = await upgraded.FEE();

  console.log("\n✅ Upgrade V3 successful!");
  console.log("- Proxy address (unchanged):", proxyAddress);
  console.log("- Implementation address:", implementationAddress);
  console.log("- FEE is active at:", fee.toString(), "USDC smallest units (", (Number(fee) / 1e6).toFixed(2), "USDC )");

  // Verify on Basescan (if API key provided)
  if (process.env.BASESCAN_API_KEY) {
    console.log("\n⏳ Waiting for 10 seconds before verification...");
    await new Promise(resolve => setTimeout(resolve, 10000));

    try {
      await hre.run("verify:verify", {
        address: implementationAddress,
        constructorArguments: [],
      });
      console.log("✅ Implementation verified on Basescan");
    } catch (error) {
      console.log("⚠️ Verification output:", error);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
