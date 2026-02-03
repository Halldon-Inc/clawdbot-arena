// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/CompToken.sol";
import "../src/BettingArena.sol";

contract BettingArenaTest is Test {
    CompToken public token;
    BettingArena public arena;

    address public owner = address(1);
    address public treasury = address(2);
    address public operator = address(3);
    address public oracle = address(4);
    address public bettor1 = address(5);
    address public bettor2 = address(6);
    address public bettor3 = address(7);

    uint256 constant INITIAL_BALANCE = 10_000_000 * 10**18; // 10M COMP

    function setUp() public {
        vm.startPrank(owner);

        // Deploy token
        token = new CompToken();

        // Deploy arena
        arena = new BettingArena(address(token), treasury);

        // Grant roles
        arena.grantRole(arena.OPERATOR_ROLE(), operator);
        arena.grantRole(arena.ORACLE_ROLE(), oracle);

        // Distribute tokens - arena is rewards pool
        token.distributeTokens(owner, owner, address(arena));

        // Give bettors some tokens from liquidity allocation
        token.transfer(bettor1, INITIAL_BALANCE);
        token.transfer(bettor2, INITIAL_BALANCE);
        token.transfer(bettor3, INITIAL_BALANCE);

        vm.stopPrank();

        // Approve arena for all bettors
        vm.prank(bettor1);
        token.approve(address(arena), type(uint256).max);
        vm.prank(bettor2);
        token.approve(address(arena), type(uint256).max);
        vm.prank(bettor3);
        token.approve(address(arena), type(uint256).max);
    }

    // ============ Match Creation Tests ============

    function test_CreateMatch() public {
        vm.prank(operator);
        uint256 matchId = arena.createMatch(
            "platformer",
            2,
            block.timestamp + 2 hours,
            block.timestamp + 1 hours
        );

        assertEq(matchId, 1);

        (
            uint256 id,
            string memory gameType,
            uint256 botCount,
            uint256 startTime,
            uint256 lockTime,
            BettingArena.MatchStatus status,
            ,
            uint256 totalPool
        ) = arena.matches(matchId);

        assertEq(id, 1);
        assertEq(gameType, "platformer");
        assertEq(botCount, 2);
        assertEq(startTime, block.timestamp + 2 hours);
        assertEq(lockTime, block.timestamp + 1 hours);
        assertEq(uint8(status), uint8(BettingArena.MatchStatus.Open));
        assertEq(totalPool, 0);
    }

    function test_CannotCreateMatchWithLessThan2Bots() public {
        vm.prank(operator);
        vm.expectRevert("Need at least 2 bots");
        arena.createMatch("platformer", 1, block.timestamp + 2 hours, block.timestamp + 1 hours);
    }

    // ============ Betting Tests ============

    function test_PlaceBet() public {
        // Create match
        vm.prank(operator);
        uint256 matchId = arena.createMatch(
            "platformer",
            2,
            block.timestamp + 2 hours,
            block.timestamp + 1 hours
        );

        // Place bet
        uint256 betAmount = 1000 * 10**18;
        uint256 balanceBefore = token.balanceOf(bettor1);

        vm.prank(bettor1);
        arena.placeBet(matchId, 0, betAmount);

        assertEq(token.balanceOf(bettor1), balanceBefore - betAmount);
        assertEq(token.balanceOf(address(arena)), betAmount + token.REWARDS_ALLOCATION());

        // Check bet was recorded
        (address bettor, uint256 botIndex, uint256 amount, , bool claimed) = arena.getBet(matchId, 0);
        assertEq(bettor, bettor1);
        assertEq(botIndex, 0);
        assertEq(amount, betAmount);
        assertFalse(claimed);
    }

    function test_PlaceMultipleBets() public {
        vm.prank(operator);
        uint256 matchId = arena.createMatch(
            "platformer",
            2,
            block.timestamp + 2 hours,
            block.timestamp + 1 hours
        );

        uint256 bet1Amount = 1000 * 10**18;
        uint256 bet2Amount = 2000 * 10**18;
        uint256 bet3Amount = 500 * 10**18;

        vm.prank(bettor1);
        arena.placeBet(matchId, 0, bet1Amount); // Bet on bot 0

        vm.prank(bettor2);
        arena.placeBet(matchId, 1, bet2Amount); // Bet on bot 1

        vm.prank(bettor3);
        arena.placeBet(matchId, 0, bet3Amount); // Also bet on bot 0

        // Check pool
        (uint256 totalPool, uint256[] memory botPools, ) = arena.getMatchPool(matchId);
        assertEq(totalPool, bet1Amount + bet2Amount + bet3Amount);
        assertEq(botPools[0], bet1Amount + bet3Amount);
        assertEq(botPools[1], bet2Amount);
    }

    function test_CannotBetAfterLockTime() public {
        vm.prank(operator);
        uint256 matchId = arena.createMatch(
            "platformer",
            2,
            block.timestamp + 2 hours,
            block.timestamp + 1 hours
        );

        // Advance time past lock
        vm.warp(block.timestamp + 1 hours + 1);

        vm.prank(bettor1);
        vm.expectRevert("Betting locked");
        arena.placeBet(matchId, 0, 1000 * 10**18);
    }

    // ============ Resolution Tests ============

    function test_ResolveMatchAndClaimWinnings() public {
        // Create match
        vm.prank(operator);
        uint256 matchId = arena.createMatch(
            "platformer",
            2,
            block.timestamp + 2 hours,
            block.timestamp + 1 hours
        );

        // Place bets
        uint256 bet1Amount = 1000 * 10**18;
        uint256 bet2Amount = 3000 * 10**18;

        vm.prank(bettor1);
        arena.placeBet(matchId, 0, bet1Amount); // Winner

        vm.prank(bettor2);
        arena.placeBet(matchId, 1, bet2Amount); // Loser

        // Lock and resolve
        vm.warp(block.timestamp + 1 hours + 1);
        vm.prank(operator);
        arena.lockMatch(matchId);

        uint256 treasuryBefore = token.balanceOf(treasury);

        vm.prank(oracle);
        arena.resolveMatch(matchId, 0); // Bot 0 wins

        // Check house edge was sent to treasury (2.5% of losing pool)
        uint256 houseEdge = (bet2Amount * 250) / 10000;
        assertEq(token.balanceOf(treasury), treasuryBefore + houseEdge);

        // Claim winnings
        uint256 balanceBefore = token.balanceOf(bettor1);

        vm.prank(bettor1);
        arena.claimWinnings(matchId, 0);

        // Payout should be: original bet + (losing pool - house edge)
        uint256 expectedPayout = bet1Amount + (bet2Amount - houseEdge);
        assertEq(token.balanceOf(bettor1), balanceBefore + expectedPayout);
    }

    function test_CannotClaimLosingBet() public {
        vm.prank(operator);
        uint256 matchId = arena.createMatch(
            "platformer",
            2,
            block.timestamp + 2 hours,
            block.timestamp + 1 hours
        );

        vm.prank(bettor1);
        arena.placeBet(matchId, 0, 1000 * 10**18);

        vm.prank(bettor2);
        arena.placeBet(matchId, 1, 1000 * 10**18);

        vm.warp(block.timestamp + 1 hours + 1);
        vm.prank(operator);
        arena.lockMatch(matchId);

        vm.prank(oracle);
        arena.resolveMatch(matchId, 1); // Bot 1 wins

        vm.prank(bettor1);
        vm.expectRevert("Not a winning bet");
        arena.claimWinnings(matchId, 0); // Bettor1 bet on bot 0
    }

    // ============ Cancellation Tests ============

    function test_CancelMatchAndClaimRefund() public {
        vm.prank(operator);
        uint256 matchId = arena.createMatch(
            "platformer",
            2,
            block.timestamp + 2 hours,
            block.timestamp + 1 hours
        );

        uint256 betAmount = 1000 * 10**18;

        vm.prank(bettor1);
        arena.placeBet(matchId, 0, betAmount);

        uint256 balanceAfterBet = token.balanceOf(bettor1);

        vm.prank(operator);
        arena.cancelMatch(matchId, "Technical issues");

        vm.prank(bettor1);
        arena.claimRefund(matchId, 0);

        assertEq(token.balanceOf(bettor1), balanceAfterBet + betAmount);
    }

    // ============ Odds Calculation Tests ============

    function test_OddsCalculation() public {
        vm.prank(operator);
        uint256 matchId = arena.createMatch(
            "platformer",
            2,
            block.timestamp + 2 hours,
            block.timestamp + 1 hours
        );

        // Initially should have default odds
        uint256 initialOdds = arena.getOdds(matchId, 0);
        assertEq(initialOdds, 20000); // 2x default

        // After uneven betting, odds should adjust
        vm.prank(bettor1);
        arena.placeBet(matchId, 0, 1000 * 10**18);

        vm.prank(bettor2);
        arena.placeBet(matchId, 1, 3000 * 10**18);

        // Bot 0 has 1000, Bot 1 has 3000, Total 4000
        // Odds for bot 0 should be higher (less money on it)
        uint256 oddsBot0 = arena.getOdds(matchId, 0);
        uint256 oddsBot1 = arena.getOdds(matchId, 1);

        assertTrue(oddsBot0 > oddsBot1, "Bot 0 should have higher odds");
    }

    // ============ Access Control Tests ============

    function test_OnlyOperatorCanCreateMatch() public {
        vm.prank(bettor1);
        vm.expectRevert();
        arena.createMatch("platformer", 2, block.timestamp + 2 hours, block.timestamp + 1 hours);
    }

    function test_OnlyOracleCanResolveMatch() public {
        vm.prank(operator);
        uint256 matchId = arena.createMatch(
            "platformer",
            2,
            block.timestamp + 2 hours,
            block.timestamp + 1 hours
        );

        vm.warp(block.timestamp + 1 hours + 1);
        vm.prank(operator);
        arena.lockMatch(matchId);

        vm.prank(bettor1);
        vm.expectRevert();
        arena.resolveMatch(matchId, 0);
    }
}
