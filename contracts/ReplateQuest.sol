// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title ReplateQuest
/// @notice On-chain grocery verification and reward system built on Base
/// @dev UUPS upgradeable, pausable, reentrancy-protected
contract ReplateQuest is
    Initializable,
    ERC721Upgradeable,
    UUPSUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable
{
    // ─── Phase System ────────────────────────────────────────────────
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
    uint256 constant FEE                        = 1e6;  // 1 USDC (6 decimals)
    uint16  constant DAILY_FRUIT_VEG_PER_PERSON = 300;
    uint8   constant MIN_HEALTHY_SCORE          = 60;
    uint256 constant BASE_POINTS                = 50;
    uint256 constant STREAK_BONUS               = 25;
    uint256 constant CHECKIN_POINTS             = 10;   // XP per daily check-in

    // ─── Mappings ────────────────────────────────────────────────────
    mapping(address => Receipt[])                         public receipts;
    mapping(address => uint256)                           public totalPoints;
    mapping(address => uint256)                           public streak;
    mapping(address => bool)                              public hasBadge;
    mapping(address => mapping(uint256 => WeeklyReport))  public weeklyReports;

    // ─── Security Mappings ───────────────────────────────────────────
    mapping(uint256 => bool)                             public weekDistributed;
    mapping(address => mapping(uint256 => bool))         public weekFinalized;
    mapping(address => uint256)                          public lastReceiptDay;

    // ─── Check-in Mappings ───────────────────────────────────────────
    mapping(address => uint256)                          public lastCheckInDay;
    mapping(address => uint256)                          public checkInStreak;
    mapping(address => uint256)                          public totalCheckIns;

    // ─── Events ──────────────────────────────────────────────────────
    event ReceiptSubmitted(
        address indexed user,
        uint8   healthScore,
        uint8   nutritionScore,
        uint256 pointsEarned,
        uint16  expectedGrams,
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

        validator    = msg.sender;
        devWallet    = _devWallet;
        usdc         = IERC20(_usdc);
        currentPhase = Phase.FREE;
    }

    // ─── UUPS Upgrade Authorization ──────────────────────────────────
    /// @dev Only validator can authorize upgrades
    function _authorizeUpgrade(address newImplementation) internal override onlyValidator {}

    // ─── Phase Management ────────────────────────────────────────────

    /// @notice Switch between FREE and PAID phase
    function setPhase(Phase _phase) external onlyValidator {
        emit PhaseChanged(currentPhase, _phase);
        currentPhase = _phase;
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

    /// @notice Submit a verified receipt for a user
    function submitReceipt(
        address user,
        uint8   totalItems,
        uint8   healthyItems,
        uint8   unhealthyItems,
        uint16  fruitVegGrams,
        uint8   householdSize,
        uint8   daysCovered
    ) external onlyValidator whenNotPaused nonReentrant {

        require(user != address(0),                             "Invalid user address");
        require(totalItems > 0,                                 "Empty receipt");
        require(healthyItems + unhealthyItems <= totalItems,    "Item count mismatch");
        require(householdSize >= 1 && householdSize <= 10,      "Household size must be 1-10");
        require(daysCovered >= 1 && daysCovered <= 30,          "Days covered must be 1-30");

        // Prevent daily XP farming — one receipt per user per day
        uint256 today = block.timestamp / 1 days;
        require(lastReceiptDay[user] < today, "Already submitted a receipt today");
        lastReceiptDay[user] = today;

        // -- PAID phase: collect 1 USDC and split to pools --
        if (currentPhase == Phase.PAID) {
            require(usdc.transferFrom(user, address(this), FEE), "USDC transfer failed");
            weeklyPool += FEE / 2;  // 50% → weekly reward pool
            devFund    += FEE / 2;  // 50% → developer fund
        }

        // -- Calculate scores --
        uint8 healthScore = _calcHealthScore(totalItems, healthyItems, unhealthyItems);

        uint16 expectedGrams = uint16(householdSize)
                             * uint16(daysCovered)
                             * DAILY_FRUIT_VEG_PER_PERSON;

        uint8 nutritionScore = _calcNutritionScore(fruitVegGrams, expectedGrams);

        uint256 points = _calcPoints(healthScore, totalItems, healthyItems, nutritionScore);

        // -- Save to blockchain --
        receipts[user].push(Receipt({
            timestamp:      block.timestamp,
            healthScore:    healthScore,
            nutritionScore: nutritionScore,
            totalItems:     totalItems,
            healthyItems:   healthyItems,
            unhealthyItems: unhealthyItems,
            fruitVegGrams:  fruitVegGrams,
            householdSize:  householdSize,
            daysCovered:    daysCovered,
            pointsEarned:   points
        }));

        totalPoints[user] += points;

        // -- Add to weekly report --
        uint256 weekNum = block.timestamp / 7 days;
        WeeklyReport storage report = weeklyReports[user][weekNum];
        report.receiptCount     += 1;
        report.totalPoints      += points;
        report.avgHealthScore    = _updateAvg(report.avgHealthScore,    healthScore,    report.receiptCount);
        report.avgNutritionScore = _updateAvg(report.avgNutritionScore, nutritionScore, report.receiptCount);

        emit ReceiptSubmitted(user, healthScore, nutritionScore, points, expectedGrams, fruitVegGrams);

        // -- Badge check --
        _checkAndMintBadge(user, healthScore, nutritionScore);
    }

    function _checkAndMintBadge(address user, uint8 healthScore, uint8 nutritionScore) internal {
        if (!hasBadge[user] && healthScore >= MIN_HEALTHY_SCORE && nutritionScore >= 60) {
            hasBadge[user] = true;
            nextTokenId++;
            _mint(user, nextTokenId);
            emit BadgeMinted(user, nextTokenId);
        }
    }

    // ─── Daily Check-in ──────────────────────────────────────────────

    /// @notice User checks in daily to earn 10 XP. Streak resets if a day is missed.
    function checkIn(address user) external onlyValidator whenNotPaused {
        require(user != address(0), "Invalid user address");

        uint256 today = block.timestamp / 1 days;
        require(lastCheckInDay[user] < today, "Already checked in today");

        // Update check-in streak
        // If last check-in was yesterday → streak continues, otherwise reset to 1
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
        require(report.receiptCount > 0, "No receipts last week");

        bool healthyWeek   = report.avgHealthScore   >= MIN_HEALTHY_SCORE;
        bool nutritionWeek = report.avgNutritionScore >= 60;

        if (healthyWeek && nutritionWeek) {
            streak[user] += 1;
            uint256 bonus = streak[user] * STREAK_BONUS;
            report.totalPoints += bonus;
            totalPoints[user]  += bonus;
        } else {
            streak[user] = 0;
        }

        emit WeekFinalized(user, lastWeek, report.totalPoints, streak[user]);
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
        uint16 expectedGrams
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
}
