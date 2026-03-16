export function invalidateLeaderboardCache() {
    import("../routes/leaderboard.js").then((module) => {
        if (module.cachedLeaderboard) {
            module.cachedLeaderboard = null;
            module.cacheTimestamp = 0;
            console.log("🔄 Leaderboard cache invalidated");
        }
    }).catch(console.error);
}
export function setupEventListeners() {
    const rpcUrl = process.env.RPC_URL || process.env.BASE_SEPOLIA_RPC_URL;
    if (!rpcUrl) {
        console.log("⚠️ No RPC URL, skipping event listeners");
        return;
    }
    // Skip event listeners on public RPC (filter not supported)
    // The leaderboard will still work via polling/caching
    console.log("⚠️ Event listeners skipped (using cache-based polling instead)");
}
