// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Fixed Charity Vault
/// @notice 使用 Checks-Effects-Interactions 顺序修复重入漏洞
contract FixedCharityVault {
    mapping(address => uint256) public balances;

    event Donated(address indexed donor, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);

    function donate() external payable {
        require(msg.value > 0, "Donation must be greater than zero");

        balances[msg.sender] += msg.value;

        emit Donated(msg.sender, msg.value);
    }

    function withdraw() external {
        uint256 amount = balances[msg.sender];

        require(amount > 0, "No balance to withdraw");

        // Effects：先更新内部状态
        balances[msg.sender] = 0;

        // Event 也属于本次状态变化的记录，放在外部调用之前
        emit Withdrawn(msg.sender, amount);

        // Interactions：最后才与外部地址交互
        (bool success,) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
    }

    function vaultBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
