const { ethers } = require("ethers");
const dotenv = require("dotenv");

dotenv.config();

const txHash = process.argv[2] || process.env.TX_HASH;
const suffix = (process.env.BUILDER_CODE_SUFFIX || "62635f37746f39316561760b0080218021802180218021802180218021")
  .toLowerCase()
  .replace(/^0x/, "");
const rpcUrl = process.env.RPC_URL || process.env.BASE_RPC_URL || "https://base-rpc.publicnode.com";

if (!/^0x[a-fA-F0-9]{64}$/.test(txHash || "")) {
  console.error("Usage: node scripts/check-builder-attribution.cjs 0x<transaction-hash>");
  process.exit(1);
}

(async () => {
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const transaction = await provider.getTransaction(txHash);
  if (!transaction) {
    console.error("Transaction not found");
    process.exitCode = 1;
    return;
  }

  const attributed = transaction.data.toLowerCase().endsWith(suffix);
  console.log(JSON.stringify({
    hash: transaction.hash,
    chainId: transaction.chainId?.toString(),
    to: transaction.to,
    builderCode: attributed ? (process.env.BUILDER_CODE || "bc_7to91eav") : null,
    erc8021SuffixPresent: attributed,
  }, null, 2));
  process.exitCode = attributed ? 0 : 2;
})().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
