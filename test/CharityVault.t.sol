// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {VulnerableCharityVault} from "../src/VulnerableCharityVault.sol";
import {FixedCharityVault} from "../src/FixedCharityVault.sol";
import {ReentrancyAttacker} from "../src/ReentrancyAttacker.sol";

contract CharityVaultTest is Test {
    VulnerableCharityVault internal vulnerableVault;
    FixedCharityVault internal fixedVault;

    address internal donor;
    address internal normalUser;

    function setUp() public {
        vulnerableVault = new VulnerableCharityVault();
        fixedVault = new FixedCharityVault();

        donor = makeAddr("donor");
        normalUser = makeAddr("normalUser");

        // 给测试账户分配本地测试资金
        vm.deal(donor, 30 ether);
        vm.deal(normalUser, 2 ether);
        vm.deal(address(this), 5 ether);

        // 分别向两个金库存入 10 ETH
        vm.startPrank(donor);

        vulnerableVault.donate{value: 10 ether}();
        fixedVault.donate{value: 10 ether}();

        vm.stopPrank();
    }

    /// @notice 证明漏洞版本可以被攻击并清空
    function testVulnerableVaultCanBeDrained() public {
        ReentrancyAttacker attacker = new ReentrancyAttacker(address(vulnerableVault));

        attacker.attack{value: 1 ether}();

        assertEq(address(vulnerableVault).balance, 0, "Vulnerable vault should be drained");

        assertEq(address(attacker).balance, 11 ether, "Attacker should receive the seed and stolen funds");

        assertGt(attacker.reentryCount(), 1, "Attack should re-enter more than once");
    }

    /// @notice 证明修复版本会阻止重入攻击
    function testFixedVaultBlocksReentrancy() public {
        ReentrancyAttacker attacker = new ReentrancyAttacker(address(fixedVault));

        vm.expectRevert();
        attacker.attack{value: 1 ether}();

        assertEq(address(fixedVault).balance, 10 ether, "Fixed vault funds should remain safe");

        assertEq(address(attacker).balance, 0, "Attacker should not receive funds");
    }

    /// @notice 证明修复后正常用户仍能提款
    function testFixedVaultAllowsNormalWithdrawal() public {
        vm.prank(normalUser);
        fixedVault.donate{value: 1 ether}();

        assertEq(fixedVault.balances(normalUser), 1 ether);

        uint256 balanceBeforeWithdrawal = normalUser.balance;

        vm.prank(normalUser);
        fixedVault.withdraw();

        assertEq(fixedVault.balances(normalUser), 0);

        assertEq(normalUser.balance, balanceBeforeWithdrawal + 1 ether, "Normal user should receive their funds");
    }
}
