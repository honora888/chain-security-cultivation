// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Vulnerable Charity Vault
/// @notice 故意包含重入漏洞，仅用于安全教学，禁止用于真实资金
contract VulnerableCharityVault {
    mapping(address => uint256) public balances;

    event Donated(address indexed donor, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);

    /// @notice 向公益金库存款
    function donate() external payable {
        require(msg.value > 0, "Donation must be greater than zero");

        balances[msg.sender] += msg.value;

        emit Donated(msg.sender, msg.value);
    }

    /// @notice 提取自己的存款
    /// @dev 漏洞：先向外部地址转账，之后才把余额清零
    function withdraw() external {
        uint256 amount = balances[msg.sender];

        require(amount > 0, "No balance to withdraw");

        // 危险：外部调用发生时，用户余额还没有清零
        (bool success,) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");

        // 状态更新太晚，攻击者可以在转账回调中再次进入 withdraw()
        balances[msg.sender] = 0;

        emit Withdrawn(msg.sender, amount);
    }

    function vaultBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
