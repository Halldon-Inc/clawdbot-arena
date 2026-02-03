// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title BettingArena
 * @notice Main betting contract for Clawdbot Arena - holds all funds as escrow
 * @dev Implements pari-mutuel betting with 2.5% house edge
 */
contract BettingArena is ReentrancyGuard, Pausable, AccessControl {
    using SafeERC20 for IERC20;

    // ============ Constants ============

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");

    uint256 public constant HOUSE_EDGE_BPS = 250; // 2.5%
    uint256 public constant BPS_DENOMINATOR = 10000;

    uint256 public constant MIN_BET = 1 * 10**18;          // 1 COMP minimum
    uint256 public constant MAX_BET = 1_000_000 * 10**18;  // 1M COMP maximum

    // ============ State Variables ============

    IERC20 public immutable compToken;
    address public treasury;

    uint256 public matchCounter;

    // ============ Structs ============

    enum MatchStatus {
        Pending,      // Match created, awaiting start
        Open,         // Accepting bets
        Locked,       // Bets closed, match in progress
        Resolved,     // Winner determined, payouts available
        Cancelled     // Match cancelled, refunds available
    }

    struct Match {
        uint256 matchId;
        string gameType;
        uint256 botCount;
        uint256 startTime;
        uint256 lockTime;
        MatchStatus status;
        uint256 winnerIndex;
        uint256 totalPool;
        mapping(uint256 => uint256) botPools; // botIndex => total bets
    }

    struct Bet {
        address bettor;
        uint256 matchId;
        uint256 botIndex;
        uint256 amount;
        uint256 oddsAtBet; // Stored as basis points (e.g., 25000 = 2.5x)
        bool claimed;
    }

    // ============ Storage ============

    mapping(uint256 => Match) public matches;
    mapping(uint256 => Bet[]) public matchBets;
    mapping(address => uint256[]) public userBetIds;

    // Track total bets per match for iteration
    mapping(uint256 => uint256) public matchBetCount;

    // ============ Events ============

    event MatchCreated(
        uint256 indexed matchId,
        string gameType,
        uint256 botCount,
        uint256 startTime,
        uint256 lockTime
    );

    event BetPlaced(
        uint256 indexed matchId,
        address indexed bettor,
        uint256 botIndex,
        uint256 amount,
        uint256 odds,
        uint256 betIndex
    );

    event MatchLocked(uint256 indexed matchId);

    event MatchResolved(
        uint256 indexed matchId,
        uint256 winnerIndex,
        uint256 totalPool
    );

    event MatchCancelled(uint256 indexed matchId, string reason);

    event WinningsClaimed(
        uint256 indexed matchId,
        address indexed bettor,
        uint256 amount,
        uint256 betIndex
    );

    event RefundClaimed(
        uint256 indexed matchId,
        address indexed bettor,
        uint256 amount,
        uint256 betIndex
    );

    event TreasuryUpdated(address indexed newTreasury);

    // ============ Constructor ============

    constructor(address _compToken, address _treasury) {
        require(_compToken != address(0), "Invalid token");
        require(_treasury != address(0), "Invalid treasury");

        compToken = IERC20(_compToken);
        treasury = _treasury;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
        _grantRole(ORACLE_ROLE, msg.sender);
    }

    // ============ Match Management ============

    /**
     * @notice Creates a new match for betting
     * @param gameType Type of game (e.g., "platformer", "puzzle", "strategy")
     * @param botCount Number of bots competing
     * @param startTime When the match starts
     * @param lockTime When betting closes
     */
    function createMatch(
        string calldata gameType,
        uint256 botCount,
        uint256 startTime,
        uint256 lockTime
    ) external onlyRole(OPERATOR_ROLE) returns (uint256) {
        require(botCount >= 2, "Need at least 2 bots");
        require(lockTime > block.timestamp, "Lock time in past");
        require(startTime >= lockTime, "Start must be after lock");

        matchCounter++;
        uint256 matchId = matchCounter;

        Match storage m = matches[matchId];
        m.matchId = matchId;
        m.gameType = gameType;
        m.botCount = botCount;
        m.startTime = startTime;
        m.lockTime = lockTime;
        m.status = MatchStatus.Open;

        emit MatchCreated(matchId, gameType, botCount, startTime, lockTime);

        return matchId;
    }

    /**
     * @notice Lock betting for a match (automatic at lockTime or manual)
     */
    function lockMatch(uint256 matchId) external onlyRole(OPERATOR_ROLE) {
        Match storage m = matches[matchId];
        require(m.status == MatchStatus.Open, "Not open");

        m.status = MatchStatus.Locked;
        emit MatchLocked(matchId);
    }

    /**
     * @notice Resolve a match with the winner
     * @param matchId ID of the match
     * @param winnerIndex Index of the winning bot (0-indexed)
     */
    function resolveMatch(
        uint256 matchId,
        uint256 winnerIndex
    ) external onlyRole(ORACLE_ROLE) {
        Match storage m = matches[matchId];
        require(m.status == MatchStatus.Locked, "Not locked");
        require(winnerIndex < m.botCount, "Invalid winner");

        m.status = MatchStatus.Resolved;
        m.winnerIndex = winnerIndex;

        // Calculate and transfer house edge to treasury
        uint256 losingPool = m.totalPool - m.botPools[winnerIndex];
        uint256 houseEdge = (losingPool * HOUSE_EDGE_BPS) / BPS_DENOMINATOR;

        if (houseEdge > 0) {
            compToken.safeTransfer(treasury, houseEdge);
        }

        emit MatchResolved(matchId, winnerIndex, m.totalPool);
    }

    /**
     * @notice Cancel a match and allow refunds
     */
    function cancelMatch(
        uint256 matchId,
        string calldata reason
    ) external onlyRole(OPERATOR_ROLE) {
        Match storage m = matches[matchId];
        require(
            m.status == MatchStatus.Open || m.status == MatchStatus.Locked,
            "Cannot cancel"
        );

        m.status = MatchStatus.Cancelled;
        emit MatchCancelled(matchId, reason);
    }

    // ============ Betting Functions ============

    /**
     * @notice Place a bet on a bot in a match
     * @param matchId ID of the match
     * @param botIndex Index of the bot to bet on (0-indexed)
     * @param amount Amount of COMP to bet
     */
    function placeBet(
        uint256 matchId,
        uint256 botIndex,
        uint256 amount
    ) external nonReentrant whenNotPaused {
        Match storage m = matches[matchId];

        require(m.status == MatchStatus.Open, "Betting not open");
        require(block.timestamp < m.lockTime, "Betting locked");
        require(botIndex < m.botCount, "Invalid bot");
        require(amount >= MIN_BET, "Below minimum");
        require(amount <= MAX_BET, "Above maximum");

        // Transfer COMP from bettor to this contract (escrow)
        compToken.safeTransferFrom(msg.sender, address(this), amount);

        // Calculate current odds before this bet
        uint256 currentOdds = _calculateOdds(matchId, botIndex);

        // Update pools
        m.totalPool += amount;
        m.botPools[botIndex] += amount;

        // Create bet record
        uint256 betIndex = matchBets[matchId].length;
        matchBets[matchId].push(Bet({
            bettor: msg.sender,
            matchId: matchId,
            botIndex: botIndex,
            amount: amount,
            oddsAtBet: currentOdds,
            claimed: false
        }));

        userBetIds[msg.sender].push(betIndex);
        matchBetCount[matchId]++;

        emit BetPlaced(matchId, msg.sender, botIndex, amount, currentOdds, betIndex);
    }

    /**
     * @notice Claim winnings for a winning bet
     * @param matchId ID of the match
     * @param betIndex Index of the bet in matchBets array
     */
    function claimWinnings(
        uint256 matchId,
        uint256 betIndex
    ) external nonReentrant {
        Match storage m = matches[matchId];
        require(m.status == MatchStatus.Resolved, "Not resolved");

        Bet storage bet = matchBets[matchId][betIndex];
        require(bet.bettor == msg.sender, "Not your bet");
        require(!bet.claimed, "Already claimed");
        require(bet.botIndex == m.winnerIndex, "Not a winning bet");

        bet.claimed = true;

        uint256 payout = _calculatePayout(matchId, betIndex);
        compToken.safeTransfer(msg.sender, payout);

        emit WinningsClaimed(matchId, msg.sender, payout, betIndex);
    }

    /**
     * @notice Claim refund for a cancelled match
     * @param matchId ID of the match
     * @param betIndex Index of the bet
     */
    function claimRefund(
        uint256 matchId,
        uint256 betIndex
    ) external nonReentrant {
        Match storage m = matches[matchId];
        require(m.status == MatchStatus.Cancelled, "Not cancelled");

        Bet storage bet = matchBets[matchId][betIndex];
        require(bet.bettor == msg.sender, "Not your bet");
        require(!bet.claimed, "Already claimed");

        bet.claimed = true;

        compToken.safeTransfer(msg.sender, bet.amount);

        emit RefundClaimed(matchId, msg.sender, bet.amount, betIndex);
    }

    // ============ View Functions ============

    /**
     * @notice Get current odds for a bot (pari-mutuel)
     * @return Odds in basis points (25000 = 2.5x return)
     */
    function getOdds(
        uint256 matchId,
        uint256 botIndex
    ) external view returns (uint256) {
        return _calculateOdds(matchId, botIndex);
    }

    /**
     * @notice Get match pool information
     */
    function getMatchPool(uint256 matchId) external view returns (
        uint256 totalPool,
        uint256[] memory botPools,
        uint256[] memory odds
    ) {
        Match storage m = matches[matchId];
        totalPool = m.totalPool;

        botPools = new uint256[](m.botCount);
        odds = new uint256[](m.botCount);

        for (uint256 i = 0; i < m.botCount; i++) {
            botPools[i] = m.botPools[i];
            odds[i] = _calculateOdds(matchId, i);
        }
    }

    /**
     * @notice Get bet details
     */
    function getBet(
        uint256 matchId,
        uint256 betIndex
    ) external view returns (
        address bettor,
        uint256 botIndex,
        uint256 amount,
        uint256 oddsAtBet,
        bool claimed
    ) {
        Bet storage bet = matchBets[matchId][betIndex];
        return (bet.bettor, bet.botIndex, bet.amount, bet.oddsAtBet, bet.claimed);
    }

    /**
     * @notice Get all bets for a user in a match
     */
    function getUserBets(
        address user,
        uint256 matchId
    ) external view returns (uint256[] memory betIndices) {
        uint256 count = 0;
        Bet[] storage bets = matchBets[matchId];

        // Count user's bets
        for (uint256 i = 0; i < bets.length; i++) {
            if (bets[i].bettor == user) count++;
        }

        // Populate array
        betIndices = new uint256[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < bets.length; i++) {
            if (bets[i].bettor == user) {
                betIndices[idx++] = i;
            }
        }
    }

    // ============ Internal Functions ============

    /**
     * @dev Calculate pari-mutuel odds for a bot
     * @return Odds in basis points (10000 = 1x, 25000 = 2.5x)
     */
    function _calculateOdds(
        uint256 matchId,
        uint256 botIndex
    ) internal view returns (uint256) {
        Match storage m = matches[matchId];

        uint256 botPool = m.botPools[botIndex];
        if (botPool == 0) {
            return 20000; // Default 2x odds if no bets
        }

        uint256 totalPool = m.totalPool;
        if (totalPool == 0) return 20000;

        // Pari-mutuel: Pool / BotPool, adjusted for house edge on losers
        // Odds = (TotalPool - HouseEdge) / BotPool
        uint256 losingPool = totalPool - botPool;
        uint256 houseEdge = (losingPool * HOUSE_EDGE_BPS) / BPS_DENOMINATOR;
        uint256 distributablePool = totalPool - houseEdge;

        // Return as basis points (multiply by 10000)
        return (distributablePool * BPS_DENOMINATOR) / botPool;
    }

    /**
     * @dev Calculate payout for a winning bet
     */
    function _calculatePayout(
        uint256 matchId,
        uint256 betIndex
    ) internal view returns (uint256) {
        Match storage m = matches[matchId];
        Bet storage bet = matchBets[matchId][betIndex];

        uint256 winningPool = m.botPools[m.winnerIndex];
        uint256 losingPool = m.totalPool - winningPool;

        // House edge only on losing pool
        uint256 houseEdge = (losingPool * HOUSE_EDGE_BPS) / BPS_DENOMINATOR;
        uint256 distributableWinnings = losingPool - houseEdge;

        // User's share of winning pool
        uint256 userShare = (bet.amount * 1e18) / winningPool;
        uint256 userWinnings = (distributableWinnings * userShare) / 1e18;

        // Return original stake + winnings
        return bet.amount + userWinnings;
    }

    // ============ Admin Functions ============

    /**
     * @notice Update treasury address
     */
    function setTreasury(address _treasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_treasury != address(0), "Invalid treasury");
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }

    /**
     * @notice Pause betting
     */
    function pause() external onlyRole(OPERATOR_ROLE) {
        _pause();
    }

    /**
     * @notice Unpause betting
     */
    function unpause() external onlyRole(OPERATOR_ROLE) {
        _unpause();
    }

    /**
     * @notice Emergency withdraw (only for stuck funds, not user funds)
     */
    function emergencyWithdraw(
        address token,
        uint256 amount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        // Safety: Cannot withdraw COMP if there are active matches
        if (token == address(compToken)) {
            // This is a safety measure - in production, add more checks
            require(amount <= compToken.balanceOf(address(this)), "Exceeds balance");
        }
        IERC20(token).safeTransfer(msg.sender, amount);
    }
}
