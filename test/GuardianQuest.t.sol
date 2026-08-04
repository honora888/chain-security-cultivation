// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {GuardianQuest} from "../src/GuardianQuest.sol";
import {IERC1155Receiver} from "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

/// @notice 模拟获得 VERIFIER_ROLE 的 ERC-1155 接收合约。
/// @dev 收到 Badge 时尝试再次验证同一学习者，验证完成状态是否已在回调前写入。
contract ReentrantGuardianReceiver is IERC1155Receiver {
    GuardianQuest internal immutable guardian;
    uint256 internal immutable questId;
    bytes32 internal immutable initialReportHash;
    bytes32 internal immutable reentryReportHash;

    bool public reentryAttempted;
    bool public reentryBlocked;
    bytes4 public reentryRevertSelector;

    constructor(GuardianQuest guardian_, uint256 questId_, bytes32 initialReportHash_, bytes32 reentryReportHash_) {
        guardian = guardian_;
        questId = questId_;
        initialReportHash = initialReportHash_;
        reentryReportHash = reentryReportHash_;
    }

    /// @notice 以当前 Receiver 身份发起第一次合法验证。
    function completeQuest() external {
        guardian.verifyCompletion(address(this), questId, initialReportHash);
    }

    /// @notice ERC-1155 铸造回调中尝试重复完成同一 Quest。
    function onERC1155Received(address, address, uint256, uint256, bytes calldata) external override returns (bytes4) {
        reentryAttempted = true;

        try guardian.verifyCompletion(address(this), questId, reentryReportHash) {
            reentryBlocked = false;
        } catch (bytes memory reason) {
            reentryBlocked = true;

            if (reason.length >= 4) {
                bytes4 selector;

                assembly ("memory-safe") {
                    selector := mload(add(reason, 0x20))
                }

                reentryRevertSelector = selector;
            }
        }

        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(address, address, uint256[] calldata, uint256[] calldata, bytes calldata)
        external
        pure
        override
        returns (bytes4)
    {
        return this.onERC1155BatchReceived.selector;
    }

    function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
        return interfaceId == type(IERC1155Receiver).interfaceId || interfaceId == type(IERC165).interfaceId;
    }
}

contract GuardianQuestTest is Test {
    GuardianQuest internal guardian;

    address internal admin;
    address internal verifier;
    address internal learner;
    address internal funder;
    address internal recipient;

    uint256 internal constant QUEST_ID = 1;

    bytes32 internal constant CONTENT_HASH = keccak256("reentrancy-quest-v1");

    bytes32 internal constant REPORT_HASH = keccak256("learner-audit-report-v1");

    string internal constant METADATA_URI = "https://example.com/metadata/1.json";

    function setUp() public {
        admin = makeAddr("admin");
        verifier = makeAddr("verifier");
        learner = makeAddr("learner");
        funder = makeAddr("funder");
        recipient = makeAddr("recipient");

        // 部署时将 admin 设为管理员和初始验证者
        guardian = new GuardianQuest(admin);

        // startPrank 会持续模拟 admin，
        // 不会因为中间调用 VERIFIER_ROLE() 而提前失效。
        vm.startPrank(admin);

        guardian.grantRole(guardian.VERIFIER_ROLE(), verifier);

        guardian.registerQuest(QUEST_ID, CONTENT_HASH, METADATA_URI);

        vm.stopPrank();

        // 给资助者准备本地测试资金
        vm.deal(funder, 10 ether);
    }

    /// @notice 注册后，关卡信息应正确保存
    function testQuestIsRegistered() public view {
        (bytes32 contentHash, string memory metadataURI, bool active, uint256 totalFunded) = guardian.quests(QUEST_ID);

        assertEq(contentHash, CONTENT_HASH);
        assertEq(metadataURI, METADATA_URI);
        assertTrue(active);
        assertEq(totalFunded, 0);

        assertEq(guardian.uri(QUEST_ID), METADATA_URI);
    }

    /// @notice 验证者可以存证报告并铸造勋章
    function testVerifierAnchorsReportAndMintsBadge() public {
        vm.prank(verifier);
        guardian.verifyCompletion(learner, QUEST_ID, REPORT_HASH);

        assertTrue(guardian.completed(QUEST_ID, learner));

        assertEq(guardian.reportHashes(QUEST_ID, learner), REPORT_HASH);

        assertEq(guardian.balanceOf(learner, QUEST_ID), 1);
    }

    /// @notice 同一关卡不能重复领取勋章
    function testCannotCompleteQuestTwice() public {
        vm.prank(verifier);
        guardian.verifyCompletion(learner, QUEST_ID, REPORT_HASH);

        vm.expectRevert(abi.encodeWithSelector(GuardianQuest.AlreadyCompleted.selector, QUEST_ID, learner));

        vm.prank(verifier);
        guardian.verifyCompletion(learner, QUEST_ID, REPORT_HASH);
    }

    /// @notice 未获授权的地址不能验证完成结果
    function testUnauthorizedAddressCannotVerify() public {
        vm.expectRevert();

        vm.prank(funder);
        guardian.verifyCompletion(learner, QUEST_ID, REPORT_HASH);

        assertEq(guardian.balanceOf(learner, QUEST_ID), 0);
    }

    /// @notice 勋章不能在普通用户之间转移
    function testBadgeCannotBeTransferred() public {
        vm.prank(verifier);
        guardian.verifyCompletion(learner, QUEST_ID, REPORT_HASH);

        vm.expectRevert(GuardianQuest.BadgeNonTransferable.selector);

        vm.prank(learner);
        guardian.safeTransferFrom(learner, funder, QUEST_ID, 1, "");

        assertEq(guardian.balanceOf(learner, QUEST_ID), 1);

        assertEq(guardian.balanceOf(funder, QUEST_ID), 0);
    }

    /// @notice 开放中的挑战可以接收测试资助
    function testQuestCanReceiveFunding() public {
        vm.prank(funder);
        guardian.fundQuest{value: 2 ether}(QUEST_ID);

        (,,, uint256 totalFunded) = guardian.quests(QUEST_ID);

        assertEq(totalFunded, 2 ether);

        assertEq(address(guardian).balance, 2 ether);
    }

    /// @notice 管理员可以提取指定挑战的测试资助
    function testAdminCanWithdrawQuestFunds() public {
        vm.prank(funder);
        guardian.fundQuest{value: 2 ether}(QUEST_ID);

        uint256 recipientBalanceBefore = recipient.balance;

        vm.prank(admin);
        guardian.withdrawQuestFunds(QUEST_ID, payable(recipient), 1 ether);

        (,,, uint256 remainingFunding) = guardian.quests(QUEST_ID);

        assertEq(remainingFunding, 1 ether);

        assertEq(recipient.balance, recipientBalanceBefore + 1 ether);

        assertEq(address(guardian).balance, 1 ether);
    }

    /// @notice 非管理员不能提取挑战资助
    function testUnauthorizedAddressCannotWithdrawFunds() public {
        vm.prank(funder);
        guardian.fundQuest{value: 2 ether}(QUEST_ID);

        vm.expectRevert();

        vm.prank(funder);
        guardian.withdrawQuestFunds(QUEST_ID, payable(recipient), 1 ether);

        (,,, uint256 remainingFunding) = guardian.quests(QUEST_ID);

        assertEq(remainingFunding, 2 ether);
        assertEq(recipient.balance, 0);
    }

    /// @notice 已关闭的关卡不能继续领取勋章
    function testInactiveQuestCannotBeCompleted() public {
        vm.prank(admin);
        guardian.setQuestActive(QUEST_ID, false);

        vm.expectRevert(abi.encodeWithSelector(GuardianQuest.QuestInactive.selector, QUEST_ID));

        vm.prank(verifier);
        guardian.verifyCompletion(learner, QUEST_ID, REPORT_HASH);
    }

    /// @notice ERC-1155 接收回调不能重复完成、重复铸造或覆盖报告哈希
    function testReceiverCallbackCannotDuplicateCompletion() public {
        bytes32 reentryReportHash = keccak256("reentrant-report-overwrite-attempt");

        ReentrantGuardianReceiver receiver =
            new ReentrantGuardianReceiver(guardian, QUEST_ID, REPORT_HASH, reentryReportHash);

        // 先读取角色常量，避免该 staticcall 消耗 vm.prank。
        bytes32 verifierRole = guardian.VERIFIER_ROLE();

        // Receiver 必须拥有验证者角色，才能真正到达重复完成检查。
        vm.prank(admin);
        guardian.grantRole(verifierRole, address(receiver));

        receiver.completeQuest();

        // ERC-1155 回调确实发生，并尝试了重复验证。
        assertTrue(receiver.reentryAttempted());

        // 重复调用被 AlreadyCompleted 阻断。
        assertTrue(receiver.reentryBlocked());
        assertEq(bytes32(receiver.reentryRevertSelector()), bytes32(GuardianQuest.AlreadyCompleted.selector));

        // 外层合法完成仍然成功。
        assertTrue(guardian.completed(QUEST_ID, address(receiver)));

        // 回调不能覆盖第一次写入的 Report Hash。
        assertEq(guardian.reportHashes(QUEST_ID, address(receiver)), REPORT_HASH);

        assertNotEq(guardian.reportHashes(QUEST_ID, address(receiver)), reentryReportHash);

        // Badge 只能铸造一个。
        assertEq(guardian.balanceOf(address(receiver), QUEST_ID), 1);
    }
}
