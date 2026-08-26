// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/NoncesUpgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title ReplateQuest
/// @notice On-chain grocery verification and reward system built on Base
/// @dev UUPS upgradeable, pausable, reentrancy-protected
contract ReplateQuest is
    Initializable,
    ERC721Upgradeable,
    UUPSUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    EIP712Upgradeable,
    NoncesUpgradeable
{
    using Strings for uint256;
    // ─── Phase System ────────────────────────────────────────────────
    // Legacy phase storage is retained for UUPS layout compatibility.
    // Receipt submissions are permanently free in this implementation.
    enum Phase { FREE, PAID }
    Phase public currentPhase;

    // ─── Structs ─────────────────────────────────────────────────────
    struct Receipt {
        uint256 timestamp;
        uint8   healthScore;
        uint8   nutritionScore;
        uint8   totalItems;
        uint8   healthyItems;
        uint8   unhealthyItems;
        uint16  fruitVegGrams;
        uint8   householdSize;
        uint8   daysCovered;
        uint256 pointsEarned;
    }

    struct ReceiptAuthorization {
        address user;
        bytes32 receiptHash;
        uint8 totalItems;
        uint8 healthyItems;
        uint8 unhealthyItems;
        uint16 fruitVegGrams;
        uint8 householdSize;
        uint8 daysCovered;
        uint256 deadline;
    }

    struct WeeklyReport {
        uint256 totalPoints;
        uint8   receiptCount;
        uint8   avgHealthScore;
        uint8   avgNutritionScore;
    }

    // ─── Addresses ───────────────────────────────────────────────────
    address public validator;
    address public pendingValidator;
    address public devWallet;
    address public pendingDevWallet;
    IERC20  public usdc;
    uint256 private nextTokenId;

    // ─── Pools ───────────────────────────────────────────────────────
    uint256 public weeklyPool;  // 50% → weekly reward pool
    uint256 public devFund;     // 50% → developer fund

    // ─── Constants ───────────────────────────────────────────────────
    uint16  constant DAILY_FRUIT_VEG_PER_PERSON = 300;
    uint8   constant MIN_HEALTHY_SCORE          = 60;
    uint256 constant BASE_POINTS                = 50;
    uint256 constant STREAK_BONUS               = 25;
    uint256 constant CHECKIN_POINTS             = 10;   // XP per daily check-in

    // ─── EIP-712 Typehashes ──────────────────────────────────────────
    bytes32 constant CHECKIN_TYPEHASH = keccak256(
        "CheckIn(address user,uint256 nonce,uint256 deadline)"
    );
    bytes32 constant RECEIPT_TYPEHASH = keccak256(
        "SubmitReceipt(address user,bytes32 receiptHash,uint8 totalItems,uint8 healthyItems,uint8 unhealthyItems,uint16 fruitVegGrams,uint8 householdSize,uint8 daysCovered,uint256 nonce,uint256 deadline)"
    );

    // ─── Mappings ────────────────────────────────────────────────────
    mapping(address => Receipt[])                         public receipts;
    mapping(address => uint256)                           public totalPoints;
    mapping(address => uint256)                           public streak;
    mapping(address => bool)                              public hasBadge;
    mapping(address => mapping(uint256 => WeeklyReport))  public weeklyReports;

    // ─── Security Mappings ───────────────────────────────────────────
    mapping(uint256 => bool)                             public weekDistributed;
    mapping(address => mapping(uint256 => bool))         public weekFinalized;
    // Daily receipt throttle. The slot is legacy, but safe to reuse for this invariant.
    mapping(address => uint256)                          public lastReceiptDay;

    // ─── Check-in Mappings ───────────────────────────────────────────
    mapping(address => uint256)                          public lastCheckInDay;
    mapping(address => uint256)                          public checkInStreak;
    mapping(address => uint256)                          public totalCheckIns;

    // ─── Dynamic Fee Variable (V3) ──────────────────────────────────
    uint256 public FEE;
    // Appended after all V3 storage to preserve the upgradeable layout.
    mapping(bytes32 => bool) public usedReceiptHashes;
    // Appended after all existing storage to preserve the UUPS layout.
    mapping(bytes32 => bool) public questXpClaimed;
    // Appended after all existing storage to preserve the UUPS layout.
    mapping(address => uint256) public lastFinalizedWeek;
    // Appended after all existing storage to preserve the UUPS layout.
    string public badgeBaseURI;

    // ─── Events ──────────────────────────────────────────────────────
    event ReceiptSubmitted(
        address indexed user,
        uint8   healthScore,
        uint8   nutritionScore,
        uint256 pointsEarned,
        uint256 expectedGrams,
        uint16  actualGrams
    );
    event WeekFinalized(address indexed user, uint256 weekNumber, uint256 weeklyPoints, uint256 newStreak);
    event BadgeMinted(address indexed user, uint256 tokenId);
    event PhaseChanged(Phase oldPhase, Phase newPhase);
    event WeeklyRewardsDistributed(uint256 weekNumber, uint256 totalDistributed);
    event ValidatorTransferInitiated(address indexed current, address indexed pending);
    event ValidatorTransferAccepted(address indexed oldValidator, address indexed newValidator);
    event DevWalletTransferInitiated(address indexed current, address indexed pending);
    event DevWalletTransferAccepted(address indexed oldWallet, address indexed newWallet);
    event USDCAddressUpdated(address indexed oldAddress, address indexed newAddress);
    event CheckedIn(address indexed user, uint256 day, uint256 checkInStreak, uint256 pointsEarned);
    event FeeUpdated(uint256 oldFee, uint256 newFee);
    event ReceiptHashConsumed(address indexed user, bytes32 indexed receiptHash);
    event QuestXpClaimed(address indexed user, bytes32 indexed questId, bytes32 indexed weekKey, uint256 amount);
    event BadgeBaseURIUpdated(string oldBaseURI, string newBaseURI);
    event ReceiptVerified(
        bytes32 indexed receiptHash,
        address indexed user,
        uint8 healthScore,
        uint8 nutritionScore,
        uint256 pointsEarned,
        uint8 totalItems,
        uint8 healthyItems,
        uint8 unhealthyItems,
        uint16 fruitVegGrams,
        uint256 expectedGrams
    );

    // ─── Modifiers ───────────────────────────────────────────────────
    modifier onlyValidator() {
        require(msg.sender == validator, "Unauthorized");
        _;
    }

    // ─── Initializer (replaces constructor for UUPS) ─────────────────
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _usdc, address _devWallet) public initializer {
        __ERC721_init("ReplateBadge", "RPB");
        __UUPSUpgradeable_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        __EIP712_init("ReplateQuest", "1");
        __Nonces_init();

        validator    = msg.sender;
        devWallet    = _devWallet;
        usdc         = IERC20(_usdc);
        currentPhase = Phase.FREE;
        FEE          = 5e5; // Legacy storage slot; receipt submissions are free
    }

    /// @notice V2 initializer — adds EIP-712 support for meta-transactions
    function initializeV2() public reinitializer(2) {
        __EIP712_init("ReplateQuest", "1");
        __Nonces_init();
    }

    /// @notice V3 initializer — sets initial fee amount as a mutable state variable
    function initializeV3() public reinitializer(3) {
        FEE = 5e5; // Legacy storage slot; receipt submissions are free
    }

    /// @notice V4 initializer — locks the legacy phase state to FREE
    function initializeV4() public reinitializer(4) {
        currentPhase = Phase.FREE;
    }

    // ─── UUPS Upgrade Authorization ──────────────────────────────────
    /// @dev Only validator can authorize upgrades
    function _authorizeUpgrade(address newImplementation) internal override onlyValidator {}

    // ─── Phase Management ────────────────────────────────────────────

    /// @notice Keep the legacy admin entry point, but reject PAID forever.
    function setPhase(Phase _phase) external onlyValidator {
        require(_phase == Phase.FREE, "Paid phase disabled");
        emit PhaseChanged(currentPhase, Phase.FREE);
        currentPhase = Phase.FREE;
    }

    // ─── Emergency Controls ──────────────────────────────────────────

    /// @notice Pause all state-changing functions in case of emergency
    function pause() external onlyValidator {
        _pause();
    }

    /// @notice Resume normal operations
    function unpause() external onlyValidator {
        _unpause();
    }

    // ─── Core Function ───────────────────────────────────────────────

    function _checkAndMintBadge(address user, uint8 healthScore, uint8 nutritionScore) internal {
        if (balanceOf(user) == 0 && healthScore >= MIN_HEALTHY_SCORE && nutritionScore >= 60) {
            hasBadge[user] = true;
            nextTokenId++;
            _mint(user, nextTokenId);
            emit BadgeMinted(user, nextTokenId);
        }
    }

    /// @notice Badge metadata is externally hosted and controlled by the validator.
    function setBadgeBaseURI(string calldata newBaseURI) external onlyValidator {
        emit BadgeBaseURIUpdated(badgeBaseURI, newBaseURI);
        badgeBaseURI = newBaseURI;
    }

    /// @notice Achievement badges are soulbound and cannot be transferred.
    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        returns (address)
    {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) revert("Badge is soulbound");
        return super._update(to, tokenId, auth);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return string.concat(badgeBaseURI, tokenId.toString());
    }

    // ─── Daily Check-in ──────────────────────────────────────────────

    /// @notice Meta-transaction check-in: user signs EIP-712 message, anyone can relay
    /// @param user      The user who signed the check-in request
    /// @param deadline  Signature expiry timestamp
    /// @param signature EIP-712 signature from the user
    function checkInWithSig(
        address user,
        uint256 deadline,
        bytes calldata signature
    ) external whenNotPaused {
        require(user != address(0), "Invalid user address");
        require(block.timestamp <= deadline, "Signature expired");

        uint256 currentNonce = _useNonce(user);

        bytes32 structHash = keccak256(abi.encode(
            CHECKIN_TYPEHASH,
            user,
            currentNonce,
            deadline
        ));

        bytes32 digest = _hashTypedDataV4(structHash);
        require(SignatureChecker.isValidSignatureNow(user, digest, signature), "Invalid signature");

        // ── Same logic as checkIn ──
        uint256 today = block.timestamp / 1 days;
        require(lastCheckInDay[user] < today, "Already checked in today");

        if (lastCheckInDay[user] == today - 1) {
            checkInStreak[user] += 1;
        } else {
            checkInStreak[user] = 1;
        }

        lastCheckInDay[user] = today;
        totalCheckIns[user]  += 1;
        totalPoints[user]    += CHECKIN_POINTS;

        emit CheckedIn(user, today, checkInStreak[user], CHECKIN_POINTS);
    }

    // ─── Weekly Reward Distribution ──────────────────────────────────

    /// @notice Distribute USDC to top 100 users proportional to their XP shares
    /// @param top100  Winner wallet addresses (max 100)
    /// @param shares  Each user's XP share
    function distributeWeeklyRewards(
        address[] calldata top100,
        uint256[] calldata shares
    ) external onlyValidator whenNotPaused nonReentrant {

        require(top100.length == shares.length,              "Array length mismatch");
        require(top100.length > 0 && top100.length <= 100,  "Must have 1-100 users");

        // Prevent duplicate distribution for the same week
        uint256 weekNum = (block.timestamp / 7 days) - 1;
        require(!weekDistributed[weekNum], "Already distributed this week");
        weekDistributed[weekNum] = true;

        uint256 pool = weeklyPool;
        weeklyPool = 0;

        // Transfer dev fund
        if (devFund > 0) {
            uint256 toSend = devFund;
            devFund = 0;
            require(usdc.transfer(devWallet, toSend), "Dev fund transfer failed");
        }

        // Distribute proportional to XP shares
        uint256 totalShares = 0;
        for (uint256 i = 0; i < shares.length; i++) {
            totalShares += shares[i];
        }
        require(totalShares > 0, "Total shares cannot be zero");

        for (uint256 i = 0; i < top100.length; i++) {
            if (shares[i] == 0) continue;
            uint256 reward = (pool * shares[i]) / totalShares;
            if (reward > 0) {
                require(usdc.transfer(top100[i], reward), "Reward transfer failed");
            }
        }

        emit WeeklyRewardsDistributed(weekNum, pool);
    }

    // ─── Streak Finalization ─────────────────────────────────────────

    /// @notice Finalize a user's weekly streak. Called by validator every week per user.
    function finalizeWeek(address user) external onlyValidator whenNotPaused {

        uint256 lastWeek = (block.timestamp / 7 days) - 1;

        // Prevent duplicate finalization
        require(!weekFinalized[user][lastWeek], "Already finalized for this user this week");
        weekFinalized[user][lastWeek] = true;

        WeeklyReport storage report = weeklyReports[user][lastWeek];

        bool healthyWeek = report.receiptCount > 0 &&
            report.avgHealthScore >= MIN_HEALTHY_SCORE &&
            report.avgNutritionScore >= 60;
        bool consecutiveWeek = lastFinalizedWeek[user] + 1 == lastWeek;

        if (healthyWeek && consecutiveWeek) {
            streak[user] += 1;
            uint256 bonus = streak[user] * STREAK_BONUS;
            report.totalPoints += bonus;
            totalPoints[user]  += bonus;
        } else if (healthyWeek) {
            streak[user] = 1;
        } else {
            streak[user] = 0;
        }

        lastFinalizedWeek[user] = lastWeek;
        emit WeekFinalized(user, lastWeek, report.totalPoints, streak[user]);
    }

    /// @notice Meta-transaction receipt submission: user signs EIP-712 message, anyone can relay
    function submitReceiptWithSig(
        address user,
        bytes32 receiptHash,
        uint8   totalItems,
        uint8   healthyItems,
        uint8   unhealthyItems,
        uint16  fruitVegGrams,
        uint8   householdSize,
        uint8   daysCovered,
        uint256 deadline,
        bytes calldata signatures
    ) external whenNotPaused nonReentrant {

        require(user != address(0),                             "Invalid user address");
        require(receiptHash != bytes32(0),                      "Invalid receipt hash");
        require(!usedReceiptHashes[receiptHash],                "Receipt already used");
        require(block.timestamp <= deadline,                    "Signature expired");
        require(totalItems > 0,                                 "Empty receipt");
        require(healthyItems + unhealthyItems <= totalItems,    "Item count mismatch");
        require(householdSize >= 1 && householdSize <= 10,      "Household size must be 1-10");
        require(daysCovered >= 1 && daysCovered <= 30,          "Days covered must be 1-30");

        ReceiptAuthorization memory authorization = ReceiptAuthorization({
            user: user,
            receiptHash: receiptHash,
            totalItems: totalItems,
            healthyItems: healthyItems,
            unhealthyItems: unhealthyItems,
            fruitVegGrams: fruitVegGrams,
            householdSize: householdSize,
            daysCovered: daysCovered,
            deadline: deadline
        });
        _verifyReceiptAuthorization(authorization, signatures);

        // ── Same logic as submitReceipt (without onlyValidator) ──
        usedReceiptHashes[receiptHash] = true;
        emit ReceiptHashConsumed(user, receiptHash);

        _processReceipt(authorization);
    }

    function _verifyReceiptAuthorization(
        ReceiptAuthorization memory authorization,
        bytes calldata signatures
    ) internal {
        (bytes memory userSignature, bytes memory validatorSignature) =
            abi.decode(signatures, (bytes, bytes));
        bytes32 digest = _receiptDigest(authorization, _useNonce(authorization.user));
        require(SignatureChecker.isValidSignatureNow(authorization.user, digest, userSignature), "Invalid user signature");
        require(SignatureChecker.isValidSignatureNow(validator, digest, validatorSignature), "Invalid validator attestation");
    }

    /// @dev Internal: build the receipt authorization digest.
    function _receiptDigest(
        ReceiptAuthorization memory authorization,
        uint256 currentNonce
    ) internal view returns (bytes32) {
        bytes32 structHash = keccak256(abi.encode(
            RECEIPT_TYPEHASH,
            authorization.user,
            authorization.receiptHash,
            authorization.totalItems,
            authorization.healthyItems,
            authorization.unhealthyItems,
            authorization.fruitVegGrams,
            authorization.householdSize,
            authorization.daysCovered,
            currentNonce,
            authorization.deadline
        ));

        return _hashTypedDataV4(structHash);
    }

    /// @dev Internal: process receipt data (shared by submitReceipt and submitReceiptWithSig)
    function _processReceipt(
        ReceiptAuthorization memory authorization
    ) internal {
        uint8 healthScore = _calcHealthScore(
            authorization.totalItems,
            authorization.healthyItems,
            authorization.unhealthyItems
        );

        uint256 expectedGrams = uint256(authorization.householdSize)
                              * uint256(authorization.daysCovered)
                              * DAILY_FRUIT_VEG_PER_PERSON;

        uint256 today = block.timestamp / 1 days;
        require(lastReceiptDay[authorization.user] < today, "Daily receipt limit reached");
        lastReceiptDay[authorization.user] = today;

        uint256 weekNum = block.timestamp / 7 days;
        require(weeklyReports[authorization.user][weekNum].receiptCount < 7, "Weekly receipt limit reached");

        uint8 nutritionScore = _calcNutritionScore(authorization.fruitVegGrams, expectedGrams);
        uint256 points = _calcPoints(
            healthScore,
            authorization.totalItems,
            authorization.healthyItems,
            nutritionScore
        );

        receipts[authorization.user].push(Receipt({
            timestamp:      block.timestamp,
            healthScore:    healthScore,
            nutritionScore: nutritionScore,
            totalItems:     authorization.totalItems,
            healthyItems:   authorization.healthyItems,
            unhealthyItems: authorization.unhealthyItems,
            fruitVegGrams:  authorization.fruitVegGrams,
            householdSize:  authorization.householdSize,
            daysCovered:    authorization.daysCovered,
            pointsEarned:   points
        }));

        totalPoints[authorization.user] += points;

        WeeklyReport storage report = weeklyReports[authorization.user][weekNum];
        report.receiptCount     += 1;
        report.totalPoints      += points;
        report.avgHealthScore    = _updateAvg(report.avgHealthScore,    healthScore,    report.receiptCount);
        report.avgNutritionScore = _updateAvg(report.avgNutritionScore, nutritionScore, report.receiptCount);

        emit ReceiptSubmitted(
            authorization.user,
            healthScore,
            nutritionScore,
            points,
            expectedGrams,
            authorization.fruitVegGrams
        );
        _emitReceiptVerified(authorization, healthScore, nutritionScore, points, expectedGrams);

        _checkAndMintBadge(authorization.user, healthScore, nutritionScore);
    }

    function _emitReceiptVerified(
        ReceiptAuthorization memory authorization,
        uint8 healthScore,
        uint8 nutritionScore,
        uint256 points,
        uint256 expectedGrams
    ) internal {
        emit ReceiptVerified(
            authorization.receiptHash,
            authorization.user,
            healthScore,
            nutritionScore,
            points,
            authorization.totalItems,
            authorization.healthyItems,
            authorization.unhealthyItems,
            authorization.fruitVegGrams,
            expectedGrams
        );
    }

    // ─── Internal Calculation Functions ──────────────────────────────

    function _calcHealthScore(
        uint8 totalItems,
        uint8 healthyItems,
        uint8 unhealthyItems
    ) internal pure returns (uint8) {
        uint8   neutralItems = totalItems - healthyItems - unhealthyItems;
        uint256 rawScore     = (uint256(healthyItems) * 10) + (uint256(neutralItems) * 5);
        uint256 maxScore     = uint256(totalItems) * 10;
        uint256 score        = (rawScore * 100) / maxScore;
        if (score > 100) score = 100;
        return uint8(score);
    }

    /// @dev WHO standard: 300g fruit/veg per person per day
    ///      Over-buying is penalized to discourage food waste
    function _calcNutritionScore(
        uint16 actualGrams,
        uint256 expectedGrams
    ) internal pure returns (uint8) {
        if (expectedGrams == 0) return 75;
        if (actualGrams == 0)   return 10;

        uint256 ratio = (uint256(actualGrams) * 100) / uint256(expectedGrams);

        if      (ratio < 30)   return 10;  // Way too low ❌❌
        else if (ratio < 50)   return 40;  // Insufficient ❌
        else if (ratio < 80)   return 75;  // Acceptable ⚠️
        else if (ratio <= 120) return 100; // Ideal range ✅
        else if (ratio <= 150) return 75;  // Slightly over ⚠️
        else                   return 40;  // Waste risk ❌
    }

    function _calcPoints(
        uint8 healthScore,
        uint8 totalItems,
        uint8 healthyItems,
        uint8 nutritionScore
    ) internal pure returns (uint256) {
        uint256 points = BASE_POINTS;

        // Health score bonus
        if (healthScore >= MIN_HEALTHY_SCORE) {
            points += uint256(healthScore) - 50;
        }

        // Healthy item ratio bonus
        if (totalItems > 0) {
            uint256 ratio = (uint256(healthyItems) * 100) / uint256(totalItems);
            if      (ratio >= 80) points += 20;
            else if (ratio >= 50) points += 10;
        }

        // Nutrition score bonus/penalty
        if      (nutritionScore >= 80) points += 30;
        else if (nutritionScore >= 50) points += 15;
        else if (nutritionScore >= 30) points += 0;
        else {
            points = points > 20 ? points - 20 : 10;
        }

        return points;
    }

    function _updateAvg(
        uint8 currentAvg,
        uint8 newValue,
        uint8 count
    ) internal pure returns (uint8) {
        if (count <= 1) return newValue;
        uint256 total = (uint256(currentAvg) * (count - 1)) + uint256(newValue);
        return uint8(total / count);
    }

    /// @notice Award a completed quest's XP once for a user and ISO week.
    function claimQuestXp(
        address user,
        bytes32 questId,
        bytes32 weekKey,
        uint256 amount
    ) external onlyValidator whenNotPaused {
        require(user != address(0), "Invalid user address");
        require(questId != bytes32(0), "Invalid quest id");
        require(weekKey != bytes32(0), "Invalid week key");
        require(amount > 0 && amount <= 1000, "Invalid quest XP");

        bytes32 claimId = keccak256(abi.encode(user, questId, weekKey));
        require(!questXpClaimed[claimId], "Quest XP already claimed");

        questXpClaimed[claimId] = true;
        totalPoints[user] += amount;

        emit QuestXpClaimed(user, questId, weekKey, amount);
    }

    // ─── View Functions ───────────────────────────────────────────────

    function getUserSummary(address user) external view returns (
        uint256 _totalPoints,
        uint256 _level,
        uint256 _receiptStreak,
        uint256 _checkInStreak,
        uint256 _totalCheckIns,
        uint256 _receiptCount,
        bool    _hasBadge
    ) {
        return (
            totalPoints[user],
            totalPoints[user] / 500,
            streak[user],
            checkInStreak[user],
            totalCheckIns[user],
            receipts[user].length,
            hasBadge[user]
        );
    }

    function getCurrentWeekReport(address user) external view returns (
        uint256 weekPoints,
        uint8   receiptCount,
        uint8   avgHealthScore,
        uint8   avgNutritionScore
    ) {
        uint256 weekNum = block.timestamp / 7 days;
        WeeklyReport storage r = weeklyReports[user][weekNum];
        return (r.totalPoints, r.receiptCount, r.avgHealthScore, r.avgNutritionScore);
    }

    function getLastReceipt(address user) external view returns (
        uint256 timestamp,
        uint8   healthScore,
        uint8   nutritionScore,
        uint8   totalItems,
        uint8   healthyItems,
        uint16  fruitVegGrams,
        uint8   householdSize,
        uint8   daysCovered,
        uint256 pointsEarned
    ) {
        require(receipts[user].length > 0, "No receipts found");
        Receipt storage r = receipts[user][receipts[user].length - 1];
        return (
            r.timestamp, r.healthScore, r.nutritionScore,
            r.totalItems, r.healthyItems,
            r.fruitVegGrams, r.householdSize,
            r.daysCovered, r.pointsEarned
        );
    }

    /// @notice View current pool and phase status
    function getPoolStatus() external view returns (
        uint256 _weeklyPool,
        uint256 _devFund,
        Phase   _currentPhase
    ) {
        return (weeklyPool, devFund, currentPhase);
    }

    // ─── Admin Functions ─────────────────────────────────────────────

    /// @notice Step 1: Initiate validator transfer
    function transferValidator(address _new) external onlyValidator {
        require(_new != address(0), "Invalid address");
        pendingValidator = _new;
        emit ValidatorTransferInitiated(validator, _new);
    }

    /// @notice Step 2: New validator must accept
    function acceptValidator() external {
        require(msg.sender == pendingValidator, "Not pending validator");
        emit ValidatorTransferAccepted(validator, pendingValidator);
        validator        = pendingValidator;
        pendingValidator = address(0);
    }

    /// @notice Step 1: Initiate devWallet transfer
    function transferDevWallet(address _new) external onlyValidator {
        require(_new != address(0), "Invalid address");
        pendingDevWallet = _new;
        emit DevWalletTransferInitiated(devWallet, _new);
    }

    /// @notice Step 2: New devWallet must accept
    function acceptDevWallet() external {
        require(msg.sender == pendingDevWallet, "Not pending dev wallet");
        emit DevWalletTransferAccepted(devWallet, pendingDevWallet);
        devWallet        = pendingDevWallet;
        pendingDevWallet = address(0);
    }

    /// @notice Update USDC contract address if needed
    function setUSDC(address _newUsdc) external onlyValidator {
        require(_newUsdc != address(0), "Invalid address");
        emit USDCAddressUpdated(address(usdc), _newUsdc);
        usdc = IERC20(_newUsdc);
    }

    /// @notice Update the per-receipt fee (in USDC's smallest unit, 6 decimals)
    function setFee(uint256 _newFee) external onlyValidator {
        emit FeeUpdated(FEE, _newFee);
        FEE = _newFee;
    }
}
