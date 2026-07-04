import hardhat from "hardhat";
import "@openzeppelin/hardhat-upgrades";
const { ethers, upgrades } = hardhat;
const hre = hardhat;

/**
 * Upgrade ReplateQuest proxy to V2 (EIP-712 + NoncesUpgradeable)
 * Usage:
 *   npx hardhat run scripts/upgrade.cts --network baseMainnet
 *   npx hardhat run scripts/upgrade.cts --network baseSepolia
 */
async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Upgrading ReplateQuest with account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // The existing proxy address — must match what's in .openzeppelin/*.json
  const PROXY_ADDRESS = process.env.CONTRACT_ADDRESS || "0xb9b7BD63E098ABd55605312933899fC4f3EF59F8";

  console.log("\nUpgrade parameters:");
  console.log("- Proxy Address:", PROXY_ADDRESS);
  console.log("- Network:", (await ethers.provider.getNetwork()).name);

  const ReplateQuestV2 = await ethers.getContractFactory("ReplateQuest");

  console.log("\nUpgrading proxy...");

  const upgraded = await upgrades.upgradeProxy(PROXY_ADDRESS, ReplateQuestV2, {
    call: { fn: "initializeV2", args: [] },
  });

  await upgraded.waitForDeployment();

  const proxyAddress = await upgraded.getAddress();
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);

  console.log("\n✅ Upgrade successful!");
  console.log("- Proxy address (unchanged):", proxyAddress);
  console.log("- New implementation address:", implementationAddress);

  // Verify on Basescan (if API key provided)
  if (process.env.BASESCAN_API_KEY) {
    console.log("\n⏳ Waiting for 30 seconds before verification...");
    await new Promise(resolve => setTimeout(resolve, 30000));

    try {
      await hre.run("verify:verify", {
        address: implementationAddress,
        constructorArguments: [],
      });
      console.log("✅ Implementation verified on Basescan");
    } catch (error) {
      console.log("⚠️ Verification failed (may need manual verification):", error);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
