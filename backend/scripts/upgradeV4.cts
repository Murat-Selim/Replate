import hardhat from "hardhat";
import "@openzeppelin/hardhat-upgrades";

const { ethers, upgrades } = hardhat;

/**
 * Upgrade ReplateQuest to V4:
 * - Receipt submissions are permanently FREE.
 * - The daily receipt limit is removed.
 * - Legacy phase/fee storage is preserved for UUPS compatibility.
 *
 * Usage:
 *   npx hardhat run scripts/upgradeV4.cts --network baseSepolia
 *   npx hardhat run scripts/upgradeV4.cts --network baseMainnet
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const defaultProxy = network.chainId === 84532n
    ? "0x99AEb0FEC26Dd8b0f237399bDad9812134D0C8F9"
    : "0x9d646D474ba0D1bF03E61453898c160b7f9e3E90";
  const proxyAddress = process.env.CONTRACT_ADDRESS || defaultProxy;

  console.log("Upgrading ReplateQuest to V4 with account:", deployer.address);
  console.log("Proxy:", proxyAddress);
  console.log("Network:", network.name, network.chainId.toString());

  const factory = await ethers.getContractFactory("ReplateQuest");
  const upgraded = await upgrades.upgradeProxy(proxyAddress, factory, {
    kind: "uups",
    call: { fn: "initializeV4", args: [] },
  });
  await upgraded.waitForDeployment();

  console.log("V4 implementation deployed behind the existing proxy:", await upgraded.getAddress());
  console.log("Current phase:", (await upgraded.currentPhase()).toString(), "(0 = FREE)");
  console.log("Daily receipt limit: disabled");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
