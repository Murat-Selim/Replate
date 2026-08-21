import hardhat from "hardhat";
import "@openzeppelin/hardhat-upgrades";

const { ethers, upgrades } = hardhat;

/**
 * Upgrade ReplateQuest to V5:
 * - Supports EOA and EIP-1271 smart-wallet signatures.
 * - Keeps the existing UUPS proxy and storage layout.
 *
 * Usage:
 *   npx hardhat run scripts/upgradeV5.cts --network baseSepolia
 *   npx hardhat run scripts/upgradeV5.cts --network baseMainnet
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const defaultProxy = network.chainId === 84532n
    ? "0x99AEb0FEC26Dd8b0f237399bDad9812134D0C8F9"
    : "0x9d646D474ba0D1bF03E61453898c160b7f9e3E90";
  const proxyAddress = process.env.CONTRACT_ADDRESS || defaultProxy;

  console.log("Upgrading ReplateQuest to V5 with account:", deployer.address);
  console.log("Proxy:", proxyAddress);
  console.log("Network:", network.name, network.chainId.toString());

  const factory = await ethers.getContractFactory("ReplateQuest");
  const upgraded = await upgrades.upgradeProxy(proxyAddress, factory, { kind: "uups" });
  await upgraded.waitForDeployment();

  console.log("V5 implementation deployed behind the existing proxy:", await upgraded.getAddress());
  console.log("Current phase:", (await upgraded.currentPhase()).toString(), "(0 = FREE)");
  console.log("Smart-wallet EIP-1271 signatures: enabled");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
