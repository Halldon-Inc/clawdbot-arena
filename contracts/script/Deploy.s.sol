// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {BettingArena} from "../src/BettingArena.sol";
import {CompToken} from "../src/CompToken.sol";

/**
 * @title DeployScript
 * @notice Deploys the Clawdbot Arena contracts to a network
 *
 * Usage:
 *   # Deploy to Base Sepolia
 *   forge script script/Deploy.s.sol:DeployScript \
 *     --rpc-url $BASE_SEPOLIA_RPC_URL \
 *     --broadcast --verify
 *
 *   # Deploy to local Anvil
 *   forge script script/Deploy.s.sol:DeployScript \
 *     --rpc-url http://localhost:8545 \
 *     --broadcast
 */
contract DeployScript is Script {
    // Configuration
    address public treasury;
    uint256 public initialTokenSupply = 1_000_000_000 * 10**18; // 1 billion COMP

    function setUp() public {
        // Treasury defaults to deployer if not set
        treasury = vm.envOr("TREASURY_ADDRESS", address(0));
    }

    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("Deploying contracts with deployer:", deployer);
        console.log("Deployer balance:", deployer.balance);

        // Use deployer as treasury if not set
        if (treasury == address(0)) {
            treasury = deployer;
        }
        console.log("Treasury address:", treasury);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy CompToken
        CompToken compToken = new CompToken(initialTokenSupply);
        console.log("CompToken deployed at:", address(compToken));
        console.log("Initial supply:", initialTokenSupply / 10**18, "COMP");

        // Deploy BettingArena
        BettingArena arena = new BettingArena(address(compToken), treasury);
        console.log("BettingArena deployed at:", address(arena));

        // Grant OPERATOR_ROLE to deployer for initial setup
        bytes32 operatorRole = arena.OPERATOR_ROLE();
        arena.grantRole(operatorRole, deployer);
        console.log("Granted OPERATOR_ROLE to deployer");

        // Optionally grant ORACLE_ROLE to a backend service
        address oracleAddress = vm.envOr("ORACLE_ADDRESS", address(0));
        if (oracleAddress != address(0)) {
            bytes32 oracleRole = arena.ORACLE_ROLE();
            arena.grantRole(oracleRole, oracleAddress);
            console.log("Granted ORACLE_ROLE to:", oracleAddress);
        }

        vm.stopBroadcast();

        // Log deployment summary
        console.log("\n=== Deployment Summary ===");
        console.log("Network:", block.chainid);
        console.log("CompToken:", address(compToken));
        console.log("BettingArena:", address(arena));
        console.log("Treasury:", treasury);
        console.log("==========================\n");

        // Write addresses to file for frontend
        _writeDeployment(address(compToken), address(arena));
    }

    function _writeDeployment(address compToken, address arena) internal {
        string memory chainId = vm.toString(block.chainid);
        string memory json = string.concat(
            '{\n',
            '  "chainId": ', chainId, ',\n',
            '  "compToken": "', vm.toString(compToken), '",\n',
            '  "bettingArena": "', vm.toString(arena), '",\n',
            '  "treasury": "', vm.toString(treasury), '",\n',
            '  "deployedAt": ', vm.toString(block.timestamp), '\n',
            '}'
        );

        string memory filename = string.concat("deployments/", chainId, ".json");
        vm.writeFile(filename, json);
        console.log("Deployment info written to:", filename);
    }
}

/**
 * @title DeployLocal
 * @notice Deploys to local Anvil with test accounts funded
 */
contract DeployLocal is Script {
    function run() public {
        // Use Anvil's default private key
        uint256 deployerPrivateKey = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;

        vm.startBroadcast(deployerPrivateKey);

        // Deploy tokens
        CompToken compToken = new CompToken(1_000_000_000 * 10**18);

        // Deploy arena
        address treasury = vm.addr(deployerPrivateKey);
        BettingArena arena = new BettingArena(address(compToken), treasury);

        // Grant roles
        arena.grantRole(arena.OPERATOR_ROLE(), treasury);
        arena.grantRole(arena.ORACLE_ROLE(), treasury);

        // Fund test accounts with COMP
        address[] memory testAccounts = new address[](5);
        testAccounts[0] = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;
        testAccounts[1] = 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC;
        testAccounts[2] = 0x90F79bf6EB2c4f870365E785982E1f101E93b906;
        testAccounts[3] = 0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65;
        testAccounts[4] = 0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc;

        for (uint i = 0; i < testAccounts.length; i++) {
            compToken.transfer(testAccounts[i], 10_000 * 10**18);
        }

        vm.stopBroadcast();

        console.log("Local deployment complete");
        console.log("CompToken:", address(compToken));
        console.log("BettingArena:", address(arena));
    }
}
