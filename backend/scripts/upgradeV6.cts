import hardhat from "hardhat";
import "@openzeppelin/hardhat-upgrades";

const { ethers, upgrades } = hardhat;
const IMPLEMENTATION_SLOT =
  "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  if (network.chainId !== 8453n) throw new Error("This script only upgrades Base mainnet");

  const proxyAddress = process.env.CONTRACT_ADDRESS ||
    "0x9d646D474ba0D1bF03E61453898c160b7f9e3E90";
  const current = await ethers.getContractAt("ReplateQuest", proxyAddress);
  const validator = await current.validator();
  if (validator.toLowerCase() !== deployer.address.toLowerCase()) {
    throw new Error(`Deployer is not validator: ${deployer.address}`);
  }

  console.log("Upgrading ReplateQuest V6 with account:", deployer.address);
  console.log("Proxy:", proxyAddress);

  const factory = await ethers.getContractFactory("ReplateQuest");
  const upgraded = await upgrades.upgradeProxy(proxyAddress, factory, { kind: "uups" });
  await upgraded.waitForDeployment();

  const rawImplementation = await ethers.provider.getStorage(proxyAddress, IMPLEMENTATION_SLOT);
  const implementation = ethers.getAddress(ethers.dataSlice(rawImplementation, 12));
  console.log("Implementation:", implementation);
  console.log("Current phase:", (await upgraded.currentPhase()).toString());
  console.log("Receipt daily/weekly limits: removed");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
