// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";

/// @title Guardian Quest
/// @notice 链安修仙录的挑战注册、报告存证、公益资助与勋章系统
/// @dev 当前版本仅用于教学、测试网和黑客松演示
contract GuardianQuest is ERC1155, AccessControl, ReentrancyGuard {
    using Address for address payable;

    /// @notice 有权确认挑战完成结果的验证者角色
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");

    struct Quest {
        /// @notice 关卡内容的数字指纹
        bytes32 contentHash;

        /// @notice 妖兽资料和勋章元数据地址
        string metadataURI;

        /// @notice 挑战是否开放
        bool active;

        /// @notice 挑战收到的测试公益资金
        uint256 totalFunded;
    }

    /// @notice questId => 挑战信息
    mapping(uint256 => Quest) public quests;

    /// @notice questId => learner => 审计报告哈希
    mapping(uint256 => mapping(address => bytes32)) public reportHashes;

    /// @notice questId => learner => 是否已经完成挑战
    mapping(uint256 => mapping(address => bool)) public completed;

    error InvalidAddress();
    error InvalidQuestId();
    error InvalidContentHash();
    error InvalidMetadataURI();
    error InvalidReportHash();
    error InvalidFundingAmount();

    error QuestAlreadyExists(uint256 questId);
    error QuestNotFound(uint256 questId);
    error QuestInactive(uint256 questId);

    error AlreadyCompleted(uint256 questId, address learner);

    error InsufficientQuestFunds(uint256 available, uint256 requested);

    error BadgeNonTransferable();

    event QuestRegistered(uint256 indexed questId, bytes32 indexed contentHash, string metadataURI);

    event QuestStatusChanged(uint256 indexed questId, bool active);

    event QuestFunded(uint256 indexed questId, address indexed funder, uint256 amount);

    event QuestCompleted(uint256 indexed questId, address indexed learner, bytes32 indexed reportHash);

    event QuestFundsWithdrawn(uint256 indexed questId, address indexed recipient, uint256 amount);

    constructor(address admin) ERC1155("") {
        if (admin == address(0)) {
            revert InvalidAddress();
        }

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(VERIFIER_ROLE, admin);
    }

    modifier questExists(uint256 questId) {
        if (quests[questId].contentHash == bytes32(0)) {
            revert QuestNotFound(questId);
        }

        _;
    }

    /// @notice 注册一只新的漏洞妖兽
    function registerQuest(uint256 questId, bytes32 contentHash, string calldata metadataURI)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (questId == 0) {
            revert InvalidQuestId();
        }

        if (contentHash == bytes32(0)) {
            revert InvalidContentHash();
        }

        if (bytes(metadataURI).length == 0) {
            revert InvalidMetadataURI();
        }

        if (quests[questId].contentHash != bytes32(0)) {
            revert QuestAlreadyExists(questId);
        }

        quests[questId] = Quest({contentHash: contentHash, metadataURI: metadataURI, active: true, totalFunded: 0});

        emit QuestRegistered(questId, contentHash, metadataURI);
    }

    /// @notice 开放或关闭指定挑战
    function setQuestActive(uint256 questId, bool active) external onlyRole(DEFAULT_ADMIN_ROLE) questExists(questId) {
        quests[questId].active = active;

        emit QuestStatusChanged(questId, active);
    }

    /// @notice 确认学习者完成挑战并铸造勋章
    /// @dev 第一版由管理员或后端验证者调用
    function verifyCompletion(address learner, uint256 questId, bytes32 reportHash)
        external
        onlyRole(VERIFIER_ROLE)
        questExists(questId)
    {
        if (learner == address(0)) {
            revert InvalidAddress();
        }

        if (!quests[questId].active) {
            revert QuestInactive(questId);
        }

        if (reportHash == bytes32(0)) {
            revert InvalidReportHash();
        }

        if (completed[questId][learner]) {
            revert AlreadyCompleted(questId, learner);
        }

        // 先记录完成状态，再执行 ERC-1155 铸造。
        // 防止接收方回调时重复领取。
        completed[questId][learner] = true;
        reportHashes[questId][learner] = reportHash;

        // 每个挑战 ID 同时作为对应勋章的 Token ID。
        _mint(learner, questId, 1, "");

        emit QuestCompleted(questId, learner, reportHash);
    }

    /// @notice 使用原生测试代币资助指定挑战
    function fundQuest(uint256 questId) external payable questExists(questId) {
        if (!quests[questId].active) {
            revert QuestInactive(questId);
        }

        if (msg.value == 0) {
            revert InvalidFundingAmount();
        }

        quests[questId].totalFunded += msg.value;

        emit QuestFunded(questId, msg.sender, msg.value);
    }

    /// @notice 管理员提取某个挑战获得的测试资助
    function withdrawQuestFunds(uint256 questId, address payable recipient, uint256 amount)
        external
        nonReentrant
        onlyRole(DEFAULT_ADMIN_ROLE)
        questExists(questId)
    {
        if (recipient == address(0)) {
            revert InvalidAddress();
        }

        if (amount == 0) {
            revert InvalidFundingAmount();
        }

        uint256 available = quests[questId].totalFunded;

        if (amount > available) {
            revert InsufficientQuestFunds(available, amount);
        }

        // Effects：先更新账目
        quests[questId].totalFunded = available - amount;

        // Interactions：最后转账
        recipient.sendValue(amount);

        emit QuestFundsWithdrawn(questId, recipient, amount);
    }

    /// @notice 返回挑战和勋章的元数据地址
    function uri(uint256 questId) public view override returns (string memory) {
        return quests[questId].metadataURI;
    }

    /// @dev 禁止用户之间转移勋章，只允许铸造或销毁
    function _update(address from, address to, uint256[] memory ids, uint256[] memory values) internal override {
        if (from != address(0) && to != address(0)) {
            revert BadgeNonTransferable();
        }

        super._update(from, to, ids, values);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC1155, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
