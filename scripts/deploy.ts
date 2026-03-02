import hardhat from "hardhat";
const { ethers, upgrades } = hardhat;
const hre = hardhat;

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("Deploying ReplateQuest with account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // Base Sepolia USDC address (testnet)
  // For Base mainnet, use: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
  const USDC_ADDRESS = process.env.USDC_ADDRESS || "0x036CbD53842c5426634e7929541eC2318f3dCF7e"; // Base Sepolia USDC
  const DEV_WALLET = process.env.DEV_WALLET || deployer.address;

  console.log("\nDeployment parameters:");
  console.log("- USDC Address:", USDC_ADDRESS);
  console.log("- Dev Wallet:", DEV_WALLET);
  console.log("- Network:", (await ethers.provider.getNetwork()).name);

  const ReplateQuest = await ethers.getContractFactory("ReplateQuest");
  
  console.log("\nDeploying proxy...");
  
  const proxy = await upgrades.deployProxy(
    ReplateQuest,
    [USDC_ADDRESS, DEV_WALLET],
    {
      kind: "uups",
      initializer: "initialize",
    }
  );

  await proxy.waitForDeployment();
  
  const proxyAddress = await proxy.getAddress();
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);

  console.log("\n✅ Deployment successful!");
  console.log("- Proxy address:", proxyAddress);
  console.log("- Implementation address:", implementationAddress);
  
  // Save to .env for reference
  console.log("\n📝 Add to your .env:");
  console.log(`CONTRACT_ADDRESS=${proxyAddress}`);
  
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
