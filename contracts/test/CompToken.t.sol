// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/CompToken.sol";

contract CompTokenTest is Test {
    CompToken public token;

    address public owner = address(1);
    address public liquidityWallet = address(2);
    address public teamWallet = address(3);
    address public rewardsPool = address(4);

    function setUp() public {
        vm.prank(owner);
        token = new CompToken();
    }

    function test_InitialState() public {
        assertEq(token.name(), "Clawdbot Arena");
        assertEq(token.symbol(), "COMP");
        assertEq(token.totalSupply(), token.TOTAL_SUPPLY());
        assertEq(token.balanceOf(address(token)), token.TOTAL_SUPPLY());
        assertEq(token.owner(), owner);
        assertFalse(token.distributed());
    }

    function test_TotalSupplyIs1Billion() public {
        assertEq(token.TOTAL_SUPPLY(), 1_000_000_000 * 10**18);
    }

    function test_AllocationsAddUp() public {
        (uint256 liquidity, uint256 team, uint256 rewards) = token.getAllocations();
        assertEq(liquidity + team + rewards, token.TOTAL_SUPPLY());
    }

    function test_DistributeTokens() public {
        vm.prank(owner);
        token.distributeTokens(liquidityWallet, teamWallet, rewardsPool);

        assertTrue(token.distributed());
        assertEq(token.balanceOf(liquidityWallet), token.LIQUIDITY_ALLOCATION());
        assertEq(token.balanceOf(teamWallet), token.TEAM_ALLOCATION());
        assertEq(token.balanceOf(rewardsPool), token.REWARDS_ALLOCATION());
        assertEq(token.balanceOf(address(token)), 0);
    }

    function test_CannotDistributeTwice() public {
        vm.startPrank(owner);
        token.distributeTokens(liquidityWallet, teamWallet, rewardsPool);

        vm.expectRevert("Already distributed");
        token.distributeTokens(liquidityWallet, teamWallet, rewardsPool);
        vm.stopPrank();
    }

    function test_OnlyOwnerCanDistribute() public {
        vm.prank(address(5));
        vm.expectRevert();
        token.distributeTokens(liquidityWallet, teamWallet, rewardsPool);
    }

    function test_CannotDistributeToZeroAddress() public {
        vm.startPrank(owner);

        vm.expectRevert("Invalid liquidity wallet");
        token.distributeTokens(address(0), teamWallet, rewardsPool);

        vm.expectRevert("Invalid team wallet");
        token.distributeTokens(liquidityWallet, address(0), rewardsPool);

        vm.expectRevert("Invalid rewards pool");
        token.distributeTokens(liquidityWallet, teamWallet, address(0));

        vm.stopPrank();
    }

    function test_TokensAreBurnable() public {
        vm.prank(owner);
        token.distributeTokens(liquidityWallet, teamWallet, rewardsPool);

        uint256 burnAmount = 1000 * 10**18;
        uint256 balanceBefore = token.balanceOf(liquidityWallet);

        vm.prank(liquidityWallet);
        token.burn(burnAmount);

        assertEq(token.balanceOf(liquidityWallet), balanceBefore - burnAmount);
        assertEq(token.totalSupply(), token.TOTAL_SUPPLY() - burnAmount);
    }
}
