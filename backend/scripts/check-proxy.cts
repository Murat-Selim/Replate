import hardhat from "hardhat";
const { ethers } = hardhat;

async function main() {
  const [deployer] = await ethers.getSigners();
  const PROXY_ADDRESS = process.env.CONTRACT_ADDRESS || "0x9d646D474ba0D1bF03E61453898c160b7f9e3E90";

  console.log("Checking Proxy on Base Mainnet...");
  console.log("Deployer Address:", deployer.address);
  console.log("Proxy Address:", PROXY_ADDRESS);

  const contract = await ethers.getContractAt("ReplateQuest", PROXY_ADDRESS);

  try {
    const validator = await contract.validator();
    console.log("\nContract State:");
    console.log("- Validator on contract:", validator);
    console.log("- Is Deployer the Validator?", validator.toLowerCase() === deployer.address.toLowerCase());
  } catch (err: any) {
    console.error("Error reading validator():", err.message);
  }

  try {
    const devWallet = await contract.devWallet();
    console.log("- DevWallet on contract:", devWallet);
  } catch (err: any) {
    console.error("Error reading devWallet():", err.message);
  }

  try {
    const phase = await contract.currentPhase();
    console.log("- Current Phase:", phase.toString());
  } catch (err: any) {
    console.error("Error reading currentPhase():", err.message);
  }

  // Check if FEE exists and what value it returns
  try {
    const fee = await contract.FEE();
    console.log("- FEE getter returned:", fee.toString(), `(${Number(fee) / 1e6} USDC)`);
    console.log("💡 NOTE: FEE is already readable! The contract might ALREADY be upgraded to V3!");
  } catch (err: any) {
    console.log("- FEE getter call failed (expected if not V3 yet or constant):", err.message);
  }

  // Read implementation address slot (ERC1967)
  const IMPL_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  const implRaw = await ethers.provider.getStorage(PROXY_ADDRESS, IMPL_SLOT);
  const implAddress = ethers.dataSlice(implRaw, 12);
  console.log("- Current Implementation Address:", implAddress);
}

main().catch(console.error);
