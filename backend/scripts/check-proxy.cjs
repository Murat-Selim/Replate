const { ethers } = require("ethers");
const deployment = require("../../deployment.json");

const proxyAddress = process.env.CONTRACT_ADDRESS || deployment.contractAddress;
const rpcUrl = process.env.RPC_URL || process.env.BASE_RPC_URL || "https://mainnet.base.org";
const implementationSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
const abi = [
  "function validator() view returns (address)",
  "function devWallet() view returns (address)",
  "function currentPhase() view returns (uint8)",
  "function FEE() view returns (uint256)",
  "function usdc() view returns (address)",
  "function paused() view returns (bool)",
];

const read = async (fn) => {
  try {
    return { value: await fn() };
  } catch (error) {
    return { error: error.shortMessage || error.message || String(error) };
  }
};

const jsonValue = (result, transform = (value) => value) =>
  result.error ? { error: result.error } : transform(result.value);

async function main() {
  if (!ethers.isAddress(proxyAddress)) throw new Error(`Invalid proxy address: ${proxyAddress}`);

  const provider = new ethers.JsonRpcProvider(rpcUrl, deployment.chainId, { staticNetwork: true });
  const contract = new ethers.Contract(proxyAddress, abi, provider);
  const [network, code, rawImplementation, validator, devWallet, phase, fee, usdc, paused] = await Promise.all([
    provider.getNetwork(),
    provider.getCode(proxyAddress),
    provider.getStorage(proxyAddress, implementationSlot),
    read(() => contract.validator()),
    read(() => contract.devWallet()),
    read(() => contract.currentPhase()),
    read(() => contract.FEE()),
    read(() => contract.usdc()),
    read(() => contract.paused()),
  ]);

  if (code === "0x") throw new Error(`No contract code at ${proxyAddress}`);

  const result = {
    manifest: deployment,
    proxyAddress,
    rpcChainId: Number(network.chainId),
    implementation: ethers.dataSlice(rawImplementation, 12),
    validator: jsonValue(validator),
    devWallet: jsonValue(devWallet),
    currentPhase: jsonValue(phase, Number),
    fee: jsonValue(fee, (value) => value.toString()),
    usdc: jsonValue(usdc),
    paused: jsonValue(paused),
  };

  console.log(JSON.stringify(result, null, 2));
  if ([validator, devWallet, phase, fee, usdc, paused].some((item) => item.error)) process.exitCode = 2;
}

main().catch((error) => {
  console.error(error.shortMessage || error.message || error);
  process.exit(1);
});
