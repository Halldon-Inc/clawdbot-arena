// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CompToken
 * @notice $COMP - The native token for Clawdbot Arena betting platform
 * @dev ERC-20 token with fixed supply and burn capability
 *
 * Tokenomics:
 * - Total Supply: 1,000,000,000 (1 Billion) COMP
 * - Liquidity Pool: 700,000,000 (70%)
 * - Team/Treasury: 150,000,000 (15%) - vested
 * - Rewards Pool: 150,000,000 (15%) - for match winners
 */
contract CompToken is ERC20, ERC20Burnable, Ownable {

    // ============ Constants ============

    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 * 10**18; // 1 Billion COMP

    uint256 public constant LIQUIDITY_ALLOCATION = 700_000_000 * 10**18;  // 70%
    uint256 public constant TEAM_ALLOCATION = 150_000_000 * 10**18;       // 15%
    uint256 public constant REWARDS_ALLOCATION = 150_000_000 * 10**18;    // 15%

    // ============ State Variables ============

    address public liquidityWallet;
    address public teamWallet;
    address public rewardsPool;

    bool public distributed;

    // ============ Events ============

    event TokensDistributed(
        address indexed liquidity,
        address indexed team,
        address indexed rewards
    );

    // ============ Constructor ============

    constructor() ERC20("Clawdbot Arena", "COMP") Ownable(msg.sender) {
        // Mint total supply to contract for distribution
        _mint(address(this), TOTAL_SUPPLY);
    }

    // ============ Distribution ============

    /**
     * @notice Distributes tokens to allocation wallets (can only be called once)
     * @param _liquidityWallet Address for liquidity pool tokens
     * @param _teamWallet Address for team/treasury tokens (should be vesting contract)
     * @param _rewardsPool Address for rewards pool (BettingArena contract)
     */
    function distributeTokens(
        address _liquidityWallet,
        address _teamWallet,
        address _rewardsPool
    ) external onlyOwner {
        require(!distributed, "Already distributed");
        require(_liquidityWallet != address(0), "Invalid liquidity wallet");
        require(_teamWallet != address(0), "Invalid team wallet");
        require(_rewardsPool != address(0), "Invalid rewards pool");

        distributed = true;

        liquidityWallet = _liquidityWallet;
        teamWallet = _teamWallet;
        rewardsPool = _rewardsPool;

        _transfer(address(this), _liquidityWallet, LIQUIDITY_ALLOCATION);
        _transfer(address(this), _teamWallet, TEAM_ALLOCATION);
        _transfer(address(this), _rewardsPool, REWARDS_ALLOCATION);

        emit TokensDistributed(_liquidityWallet, _teamWallet, _rewardsPool);
    }

    // ============ View Functions ============

    /**
     * @notice Returns the allocation breakdown
     */
    function getAllocations() external pure returns (
        uint256 liquidity,
        uint256 team,
        uint256 rewards
    ) {
        return (LIQUIDITY_ALLOCATION, TEAM_ALLOCATION, REWARDS_ALLOCATION);
    }
}
