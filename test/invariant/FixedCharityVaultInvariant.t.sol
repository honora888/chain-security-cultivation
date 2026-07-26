// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";

import {FixedCharityVault} from "../../src/FixedCharityVault.sol";

/// @notice Handler 负责生成有效的随机存款和提款操作
contract FixedVaultHandler is Test {
    FixedCharityVault internal immutable vault;

    address[] internal actors;

    /// @notice 测试中记录的“预期金库余额”
    /// @dev 这是 Ghost Variable，只存在于测试中
    uint256 public ghostExpectedVaultBalance;

    constructor(FixedCharityVault vaultAddress) {
        vault = vaultAddress;

        actors.push(address(0xA11CE));
        actors.push(address(0xB0B));
        actors.push(address(0xCA11));
    }

    /// @notice 随机选择用户，向金库存入随机金额
    function donate(uint256 actorSeed, uint256 amount) external {
        address actor = _selectActor(actorSeed);

        // 限制随机金额，避免生成没有意义的极端值
        amount = bound(amount, 1 wei, 1 ether);

        // 给测试账户分配本次存款所需资金
        vm.deal(actor, amount);

        vm.prank(actor);
        vault.donate{value: amount}();

        ghostExpectedVaultBalance += amount;
    }

    /// @notice 随机选择用户并尝试提款
    function withdraw(uint256 actorSeed) external {
        address actor = _selectActor(actorSeed);
        uint256 amount = vault.balances(actor);

        // 没有余额时直接结束，避免无意义的 revert
        if (amount == 0) {
            return;
        }

        vm.prank(actor);
        vault.withdraw();

        ghostExpectedVaultBalance -= amount;
    }

    /// @notice 计算所有测试用户在金库账本中的余额总和
    function sumRecordedBalances() external view returns (uint256 total) {
        for (uint256 index = 0; index < actors.length; index++) {
            total += vault.balances(actors[index]);
        }
    }

    function _selectActor(uint256 actorSeed) internal view returns (address) {
        uint256 actorIndex = bound(actorSeed, 0, actors.length - 1);

        return actors[actorIndex];
    }
}

contract FixedCharityVaultInvariantTest is StdInvariant, Test {
    FixedCharityVault internal vault;
    FixedVaultHandler internal handler;

    function setUp() public {
        vault = new FixedCharityVault();
        handler = new FixedVaultHandler(vault);

        // 明确告诉 Foundry：只随机调用 Handler，
        // 不要直接调用 FixedCharityVault。
        targetContract(address(handler));

        // Handler 中只允许随机调用 donate 和 withdraw。
        bytes4[] memory selectors = new bytes4[](2);
        selectors[0] = FixedVaultHandler.donate.selector;
        selectors[1] = FixedVaultHandler.withdraw.selector;

        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
    }

    /// @notice 金库真实资产、账本总额和测试预期值必须始终相等
    function invariant_VaultBalanceAlwaysMatchesAccounting() public view {
        uint256 realVaultBalance = address(vault).balance;
        uint256 recordedBalances = handler.sumRecordedBalances();
        uint256 expectedBalance = handler.ghostExpectedVaultBalance();

        assertEq(realVaultBalance, recordedBalances, "Vault ETH must equal all recorded user balances");

        assertEq(realVaultBalance, expectedBalance, "Vault ETH must equal the handler ghost balance");
    }
}
