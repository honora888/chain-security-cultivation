// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";

import {GuardianQuest} from "../src/GuardianQuest.sol";

/// @title Deploy Guardian Quest
/// @notice 将 GuardianQuest 部署到 Monad Testnet
contract DeployGuardianQuest is Script {
    uint256 internal constant MONAD_TESTNET_CHAIN_ID = 10143;

    function run() external returns (GuardianQuest guardian) {
        require(block.chainid == MONAD_TESTNET_CHAIN_ID, "Wrong network: expected Monad Testnet");

        address admin = vm.envAddress("ADMIN_ADDRESS");

        require(admin != address(0), "ADMIN_ADDRESS cannot be zero");

        vm.startBroadcast();

        guardian = new GuardianQuest(admin);

        vm.stopBroadcast();

        console2.log("GuardianQuest deployed at:", address(guardian));

        console2.log("Guardian admin:", admin);

        console2.log("Chain ID:", block.chainid);
    }
}
