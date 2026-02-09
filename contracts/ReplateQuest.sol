// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ReplateQuest is ERC721URIStorage, Ownable {
    uint256 private _nextTokenId;

    struct UserStats {
        uint256 totalShops;
        uint256 currentStreak;
        uint256 lastShopTimestamp;
        uint256 totalXP;
    }

    mapping(address => UserStats) public userStats;

    event ShopVerified(address indexed user, uint256 xpGained, uint256 newStreak);
    event BadgeMinted(address indexed user, uint256 tokenId, string badgeType);

    constructor() ERC721("Replate Badges", "RPLT") Ownable(msg.sender) {}

    function verifyShop(address user) external onlyOwner {
        UserStats storage stats = userStats[user];
        
        // Streak logic: Shop once every 1-8 days to keep streak
        if (stats.totalShops > 0) {
            uint256 timePassed = block.timestamp - stats.lastShopTimestamp;
            if (timePassed <= 8 days && timePassed >= 1 days) {
                stats.currentStreak += 1;
            } else if (timePassed > 8 days) {
                stats.currentStreak = 1;
            }
        } else {
            stats.currentStreak = 1;
        }

        stats.totalShops += 1;
        stats.lastShopTimestamp = block.timestamp;
        stats.totalXP += 100;

        emit ShopVerified(user, 100, stats.currentStreak);
    }

    function mintBadge(address user, string memory tokenURI) external onlyOwner returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _safeMint(user, tokenId);
        _setTokenURI(tokenId, tokenURI);

        emit BadgeMinted(user, tokenId, "Impact Badge");
        return tokenId;
    }

    function getStats(address user) external view returns (uint256, uint256, uint256, uint256) {
        UserStats memory stats = userStats[user];
        return (stats.totalShops, stats.currentStreak, stats.lastShopTimestamp, stats.totalXP);
    }
}
